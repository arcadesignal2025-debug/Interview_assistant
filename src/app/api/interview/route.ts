import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import curriculumData from '@/data/curriculum.json';
import { Candidate, CurriculumDay, SkillScore, FeedbackData } from '@/types/interview';

interface InterviewSession {
  sessionId: string;
  candidate: Candidate;
  topicPlan: CurriculumDay[];
  currentTopicIndex: number;
  questionCount: number;
  coveredDays: Set<number>;
  fingerprints: Set<string>;
  transcript: { role: 'interviewer' | 'candidate'; text: string; day?: number; action?: string }[];
  scores: { [day: number]: { totalScore: number; count: number; topic: string } };
  isComplete: boolean;
}

type SessionStore = Map<string, InterviewSession>;
const globalStore = globalThis as typeof globalThis & { __interviewSessions?: SessionStore };
const sessionsStore: SessionStore = globalStore.__interviewSessions ?? new Map<string, InterviewSession>();
globalStore.__interviewSessions = sessionsStore;

const anthropicKey = process.env.ANTHROPIC_API_KEY;
const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;
const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, candidate, message, action } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    if (action === 'terminate_violation') {
      const session = sessionsStore.get(sessionId);
      if (session) session.isComplete = true;
      return NextResponse.json({
        reply: 'Interview terminated due to extended focus-loss violation. Session locked.',
        done: true,
        terminated: true,
        terminationReason: 'Security & focus-loss proctoring timeout exceeded.',
        feedback: {
          summary: 'Interview session terminated early due to extended tab/window focus loss.',
          strengths: ['Initial engagement registered before termination'],
          gaps: ['Incomplete assessment due to security protocol violation'],
          next: ['Retake the technical interview in a distraction-free environment'],
        },
      });
    }

    if (candidate) {
      const session = initializeSession(sessionId, candidate);
      sessionsStore.set(sessionId, session);
      const firstQuestion = await generateNextQuestion(session, true);
      session.transcript.push({ role: 'interviewer', text: firstQuestion, day: session.topicPlan[0]?.day });
      return NextResponse.json({ reply: firstQuestion, done: false });
    }

    const session = sessionsStore.get(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found. Please start interview.' }, { status: 404 });
    }
    if (session.isComplete) {
      return NextResponse.json({ reply: 'Interview completed.', done: true });
    }

    const candidateAnswer = typeof message === 'string' ? message.trim() : '';
    session.transcript.push({ role: 'candidate', text: candidateAnswer, day: session.topicPlan[session.currentTopicIndex]?.day });

    const currentTopic = session.topicPlan[session.currentTopicIndex];
    if (currentTopic) {
      session.coveredDays.add(currentTopic.day);
      scoreAnswer(session, currentTopic, candidateAnswer);
    }

    session.questionCount += 1;

    // Short answers should trigger a probe; strong/long answers should usually escalate or pivot.
    const answerWords = candidateAnswer.split(/\s+/).filter(Boolean).length;
    const previousQuestion = [...session.transcript].reverse().find(t => t.role === 'interviewer')?.text || '';
    const actionTaken = chooseAction(session, answerWords);

    if (actionTaken === 'pivot' || session.questionCount >= 8) {
      if (session.currentTopicIndex < session.topicPlan.length - 1) session.currentTopicIndex += 1;
    }

    const distinctDaysCount = session.coveredDays.size;
    if (session.questionCount >= 8 && distinctDaysCount >= 4) {
      session.isComplete = true;
      const feedback = await generateFinalFeedback(session);
      return NextResponse.json({
        reply: 'Interview completed. Thank you for walking through these technical scenarios with me.',
        done: true,
        feedback,
        skillChart: buildSkillChart(session),
      });
    }

    const nextQuestion = await generateNextQuestion(session, false, {
      previousQuestion,
      candidateAnswer,
      actionTaken,
    });
    session.transcript.push({
      role: 'interviewer',
      text: nextQuestion,
      day: session.topicPlan[session.currentTopicIndex]?.day,
      action: actionTaken,
    });

    return NextResponse.json({ reply: nextQuestion, done: false });
  } catch (error: any) {
    console.error('API Error in /api/interview:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

function initializeSession(sessionId: string, candidate: Candidate): InterviewSession {
  const engagedDays = new Set(
    candidate.missions
      .filter(m => !m.skipped && ((m.attempts ?? 0) > 0 || m.passed === true))
      .map(m => m.day)
  );

  const highValue = new Set(['BUILD', 'AI_CORE', 'SHIP_IT', 'CAPSTONE']);
  const availableDays = (curriculumData as CurriculumDay[]).filter(
    day => !day.type || highValue.has(day.type)
  );
  const candidateDays = availableDays.filter(day => engagedDays.has(day.day));
  const source = candidateDays.length >= 5 ? candidateDays : availableDays;

  // Deterministic shuffle per session so a retry does not accidentally produce the same script.
  const seed = hashString(sessionId + candidate.id);
  const topicPlan = [...source]
    .sort((a, b) => pseudoRandom(seed + a.day) - pseudoRandom(seed + b.day))
    .slice(0, 7);

  return {
    sessionId,
    candidate,
    topicPlan,
    currentTopicIndex: 0,
    questionCount: 0,
    coveredDays: new Set<number>(),
    fingerprints: new Set<string>(),
    transcript: [],
    scores: {},
    isComplete: false,
  };
}

function chooseAction(session: InterviewSession, answerWords: number): 'escalate' | 'perturb' | 'probe' | 'pivot' {
  if (answerWords < 8) return 'probe';
  if (answerWords < 30) return 'perturb';
  if (session.questionCount % 3 === 0) return 'pivot';
  return 'escalate';
}

function scoreAnswer(session: InterviewSession, topic: CurriculumDay, answer: string) {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  let score = 55;
  if (words >= 8) score += 10;
  if (words >= 25) score += 10;
  if (words >= 60) score += 10;
  const lower = answer.toLowerCase();
  score += topic.tools.filter(t => lower.includes(t.toLowerCase())).length * 4;
  score = Math.min(98, Math.max(35, score));
  if (!session.scores[topic.day]) {
    session.scores[topic.day] = { totalScore: score, count: 1, topic: topic.title };
  } else {
    session.scores[topic.day].totalScore += score;
    session.scores[topic.day].count += 1;
  }
}

async function generateNextQuestion(
  session: InterviewSession,
  isFirst: boolean,
  turn?: { previousQuestion: string; candidateAnswer: string; actionTaken: string }
): Promise<string> {
  const candidate = session.candidate;
  const currentTopic = session.topicPlan[session.currentTopicIndex] || session.topicPlan[0];
  if (!currentTopic) return `Let's continue with a production scenario relevant to your healthcare chatbot work.`;

  if (anthropic) {
    try {
      const recentTranscript = session.transcript.slice(-8).map(t => `${t.role}: ${t.text}`).join('\n');
      const prompt = `You are the technical lead conducting a realistic adaptive interview for ${candidate.name}, a ${candidate.jobRole} with ${candidate.yearsExperience} years of experience.

The candidate built an enterprise healthcare chatbot. Current curriculum context is Day ${currentTopic.day}; use its objectives, mechanism and failure modes as hidden source material, but NEVER reveal the curriculum title or textbook concept name.

Objectives: ${currentTopic.objectives.join('; ')}
Mechanism: ${currentTopic.mechanism}
Purpose: ${currentTopic.purpose}
Failure modes: ${currentTopic.commonFailureModes.join('; ')}
Adjacent concepts: ${currentTopic.adjacentConcepts.join('; ')}

Interview action: ${turn?.actionTaken || 'start'}
Previous question: ${turn?.previousQuestion || '(none)'}
Candidate's latest answer: ${turn?.candidateAnswer || '(none)'}
Recent transcript:
${recentTranscript || '(none)'}

Rules:
- Create a NEW healthcare-chatbot scenario. Never repeat the previous question or merely rephrase it.
- Never name the curriculum concept/title in the question.
- If action is probe: ask one focused clarifying question about the candidate's reasoning.
- If action is perturb: change one concrete constraint such as scale, latency, noisy data, incorrect metadata, failure recovery, or conflicting requirements.
- If action is escalate: require a deeper trade-off, causal explanation, or production decision.
- If action is pivot: move to a distinct scenario while staying connected to the candidate's actual curriculum exposure.
- Match implementation-detail expectations to the candidate's role and experience.
- Keep it conversational and under 100 words. ${isFirst ? 'Start with one brief welcome sentence, then the scenario.' : 'Do not greet the candidate again.'}`;

      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 220,
        temperature: 0.8,
        messages: [{ role: 'user', content: prompt }],
      });
      const reply = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
      if (reply && !isDuplicate(session, reply)) {
        session.fingerprints.add(fingerprint(reply));
        return reply;
      }
    } catch (error) {
      console.warn('Claude question generation failed; using deterministic fallback.', error);
    }
  }

  const fallback = fallbackScenarioSynthesizer(candidate, currentTopic, session.questionCount, isFirst, turn?.actionTaken || 'start');
  session.fingerprints.add(fingerprint(fallback));
  return fallback;
}

function fallbackScenarioSynthesizer(
  candidate: Candidate,
  topic: CurriculumDay,
  turnCount: number,
  isFirst: boolean,
  action: string
): string {
  const name = candidate.name.split(' ')[0];
  const base = `Imagine the healthcare chatbot is serving ${turnCount > 2 ? 'a much larger enrollment surge' : 'a normal enrollment workload'} and a member asks a benefits question while the underlying policy data is incomplete. What would you inspect first, and how would you design the system so the response stays reliable?`;
  const modifiers: Record<string, string> = {
    probe: ' Walk me through the exact evidence you would use to decide whether your approach was working.',
    perturb: ' Now assume latency must stay below 2 seconds while the policy corpus has doubled. What changes?',
    escalate: ' Now assume the same design must support conflicting plan rules and an audit trail. What trade-off would you make?',
    pivot: ' Separately, consider a failure where a retrieval result looks relevant but belongs to the wrong plan type. How would you prevent that?',
    start: '',
  };
  const opening = isFirst ? `Welcome ${name}, let's begin your technical evaluation. ` : '';
  return `${opening}${base}${modifiers[action] || ''}`;
}

function isDuplicate(session: InterviewSession, text: string): boolean {
  const fp = fingerprint(text);
  return session.fingerprints.has(fp) || session.transcript.some(t => t.role === 'interviewer' && fingerprint(t.text) === fp);
}

function fingerprint(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).slice(0, 32).join(' ');
}

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}

function pseudoRandom(seed: number): number {
  let x = seed || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

async function generateFinalFeedback(session: InterviewSession): Promise<FeedbackData> {
  const candidate = session.candidate;
  if (anthropic) {
    try {
      const prompt = `Evaluate this technical interview for ${candidate.name} (${candidate.jobRole}, ${candidate.yearsExperience} years). Use only evidence in the transcript. Return JSON with exactly summary, strengths, gaps, next. Each array item must be concise and actionable. Transcript: ${JSON.stringify(session.transcript.slice(-16))}`;
      const res = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 450,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = res.content[0]?.type === 'text' ? res.content[0].text.trim() : '';
      const jsonText = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(jsonText) as FeedbackData;
      if (parsed.summary && Array.isArray(parsed.strengths) && Array.isArray(parsed.gaps) && Array.isArray(parsed.next)) return parsed;
    } catch (error) {
      console.warn('Claude feedback generation failed; using fallback feedback.', error);
    }
  }
  return {
    summary: `${candidate.name} completed an adaptive technical interview calibrated to their ${candidate.jobRole} background and the curriculum topics they engaged with.`,
    strengths: ['Explained practical engineering decisions in a healthcare chatbot context.', 'Responded to production constraints and follow-up scenarios.', 'Connected implementation choices to reliability and user outcomes.'],
    gaps: ['Add more concrete evidence and metrics when explaining production decisions.', 'Practice articulating failure recovery and trade-offs under changing constraints.'],
    next: ['Revisit the weakest interview scenarios and explain the causal reasoning step by step.', 'Build one small production-style experiment that measures the relevant trade-offs.'],
  };
}

function buildSkillChart(session: InterviewSession): SkillScore[] {
  return session.topicPlan.slice(0, 5).map(topic => {
    const data = session.scores[topic.day];
    const depthScore = data ? Math.round(data.totalScore / data.count) : 0;
    return { topic: topic.title, day: topic.day, depthScore };
  });
}
