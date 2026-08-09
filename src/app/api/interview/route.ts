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
    const { sessionId, candidate, message, action, history } = body;

    if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

    if (action === 'terminate_violation') {
      const session = sessionsStore.get(sessionId);
      if (session) session.isComplete = true;
      return NextResponse.json({
        reply: 'Interview terminated due to extended focus-loss violation. Session locked.',
        done: true,
        terminated: true,
        terminationReason: 'Security & focus-loss proctoring timeout exceeded.',
        feedback: {
          summary: 'Interview session terminated early due to extended focus-loss violation.',
          strengths: ['Initial engagement registered before termination'],
          gaps: ['Incomplete assessment due to security protocol violation'],
          next: ['Retake the technical interview in a distraction-free environment'],
        },
      });
    }

    // candidate may be sent on every turn. A request with a message is always an answer turn,
    // even if Vercel routed it to a fresh serverless instance and the in-memory session is gone.
    let session = sessionsStore.get(sessionId);
    if (!session && candidate) {
      session = initializeSession(sessionId, candidate);
      restoreClientHistory(session, history);
      sessionsStore.set(sessionId, session);

      const hasCurrentMessage = typeof message === 'string' && message.trim().length > 0;
      if (!hasCurrentMessage) {
        const existingInterviewer = session.transcript.find(t => t.role === 'interviewer');
        if (existingInterviewer) return NextResponse.json({ reply: existingInterviewer.text, done: false, recovered: true });
        const firstQuestion = await generateNextQuestion(session, true);
        session.transcript.push({ role: 'interviewer', text: firstQuestion, day: session.topicPlan[0]?.day });
        return NextResponse.json({ reply: firstQuestion, done: false });
      }
    }

    if (!session) return NextResponse.json({ error: 'Session not found. Please start interview.' }, { status: 404 });
    if (session.isComplete) return NextResponse.json({ reply: 'Interview completed.', done: true });

    const candidateAnswer = typeof message === 'string' ? message.trim() : '';
    if (!candidateAnswer) return NextResponse.json({ error: 'message is required for an interview turn' }, { status: 400 });

    if (Array.isArray(history) && session.transcript.length === 0) restoreClientHistory(session, history);

    // Avoid duplicating an answer if a retry reaches the same warm instance.
    const lastCandidate = [...session.transcript].reverse().find(t => t.role === 'candidate');
    if (!lastCandidate || fingerprint(lastCandidate.text) !== fingerprint(candidateAnswer)) {
      session.transcript.push({ role: 'candidate', text: candidateAnswer, day: session.topicPlan[session.currentTopicIndex]?.day });
    }

    const currentTopic = session.topicPlan[session.currentTopicIndex];
    if (currentTopic) {
      session.coveredDays.add(currentTopic.day);
      scoreAnswer(session, currentTopic, candidateAnswer);
    }

    session.questionCount += 1;
    const answerWords = candidateAnswer.split(/\s+/).filter(Boolean).length;
    const previousQuestion = [...session.transcript].reverse().find(t => t.role === 'interviewer')?.text || '';
    const actionTaken = chooseAction(session, answerWords);

    if (actionTaken === 'pivot' || session.questionCount >= 8) {
      if (session.currentTopicIndex < session.topicPlan.length - 1) session.currentTopicIndex += 1;
    }

    if (session.questionCount >= 8 && session.coveredDays.size >= 4) {
      session.isComplete = true;
      const feedback = await generateFinalFeedback(session);
      return NextResponse.json({ reply: 'Interview completed. Thank you for walking through these technical scenarios with me.', done: true, feedback, skillChart: buildSkillChart(session) });
    }

    const nextQuestion = await generateNextQuestion(session, false, { previousQuestion, candidateAnswer, actionTaken });
    session.transcript.push({ role: 'interviewer', text: nextQuestion, day: session.topicPlan[session.currentTopicIndex]?.day, action: actionTaken });
    return NextResponse.json({ reply: nextQuestion, done: false });
  } catch (error: any) {
    console.error('API Error in /api/interview:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

function restoreClientHistory(session: InterviewSession, history: any) {
  if (!Array.isArray(history)) return;
  for (const item of history) {
    if (!item || typeof item.text !== 'string') continue;
    const role = item.sender === 'candidate' ? 'candidate' : item.sender === 'interviewer' ? 'interviewer' : null;
    if (!role) continue;
    const text = item.text.trim();
    if (!text) continue;
    if (session.transcript.some(t => t.role === role && fingerprint(t.text) === fingerprint(text))) continue;
    session.transcript.push({ role, text, day: role === 'interviewer' ? session.topicPlan[session.currentTopicIndex]?.day : undefined });
    if (role === 'interviewer') session.fingerprints.add(fingerprint(text));
  }
  session.questionCount = session.transcript.filter(t => t.role === 'candidate').length;
  const currentDay = session.topicPlan[session.currentTopicIndex]?.day ?? session.topicPlan[0]?.day;
  if (currentDay && session.questionCount > 0) session.coveredDays.add(currentDay);
}

function initializeSession(sessionId: string, candidate: Candidate): InterviewSession {
  const engagedDays = new Set(candidate.missions.filter(m => !m.skipped && ((m.attempts ?? 0) > 0 || m.passed === true)).map(m => m.day));
  const highValue = new Set(['BUILD', 'AI_CORE', 'SHIP_IT', 'CAPSTONE']);
  const availableDays = (curriculumData as CurriculumDay[]).filter(day => !day.type || highValue.has(day.type));
  const candidateDays = availableDays.filter(day => engagedDays.has(day.day));
  const source = candidateDays.length >= 5 ? candidateDays : availableDays;
  const seed = hashString(sessionId + candidate.id);
  const topicPlan = [...source].sort((a, b) => pseudoRandom(seed + a.day) - pseudoRandom(seed + b.day)).slice(0, 7);
  return { sessionId, candidate, topicPlan, currentTopicIndex: 0, questionCount: 0, coveredDays: new Set<number>(), fingerprints: new Set<string>(), transcript: [], scores: {}, isComplete: false };
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
  if (!session.scores[topic.day]) session.scores[topic.day] = { totalScore: score, count: 1, topic: topic.title };
  else { session.scores[topic.day].totalScore += score; session.scores[topic.day].count += 1; }
}

async function generateNextQuestion(session: InterviewSession, isFirst: boolean, turn?: { previousQuestion: string; candidateAnswer: string; actionTaken: string }): Promise<string> {
  const candidate = session.candidate;
  const currentTopic = session.topicPlan[session.currentTopicIndex] || session.topicPlan[0];
  if (!currentTopic) return 'Let’s continue with a production scenario relevant to your healthcare chatbot work.';

  if (anthropic) {
    try {
      const recentTranscript = session.transcript.slice(-8).map(t => `${t.role}: ${t.text}`).join('\n');
      const prompt = `You are the technical lead conducting a realistic adaptive interview for ${candidate.name}, a ${candidate.jobRole} with ${candidate.yearsExperience} years of experience.\n\nThe candidate built an enterprise healthcare chatbot. Current curriculum context is Day ${currentTopic.day}; use its objectives, mechanism and failure modes as hidden source material, but NEVER reveal the curriculum title or textbook concept name.\n\nObjectives: ${currentTopic.objectives.join('; ')}\nMechanism: ${currentTopic.mechanism}\nPurpose: ${currentTopic.purpose}\nFailure modes: ${currentTopic.commonFailureModes.join('; ')}\nAdjacent concepts: ${currentTopic.adjacentConcepts.join('; ')}\n\nInterview action: ${turn?.actionTaken || 'start'}\nPrevious question: ${turn?.previousQuestion || '(none)'}\nCandidate's latest answer: ${turn?.candidateAnswer || '(none)'}\nRecent transcript:\n${recentTranscript || '(none)'}\n\nRules:\n- Create a NEW healthcare-chatbot scenario. Never repeat the previous question or merely rephrase it.\n- Never name the curriculum concept/title in the question.\n- If action is probe: ask one focused clarifying question about the candidate's reasoning.\n- If action is perturb: change one concrete constraint such as scale, latency, noisy data, incorrect metadata, failure recovery, or conflicting requirements.\n- If action is escalate: require a deeper trade-off, causal explanation, or production decision.\n- If action is pivot: move to a distinct scenario while staying connected to the candidate's actual curriculum exposure.\n- Match implementation-detail expectations to the candidate's role and experience.\n- Keep it conversational and under 100 words. ${isFirst ? 'Start with one brief welcome sentence, then the scenario.' : 'Do not greet the candidate again.'}`;
      const response = await anthropic.messages.create({ model: CLAUDE_MODEL, max_tokens: 220, temperature: 0.8, messages: [{ role: 'user', content: prompt }] });
      const reply = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
      if (reply && !isDuplicate(session, reply)) { session.fingerprints.add(fingerprint(reply)); return reply; }
    } catch (error) { console.warn('Claude question generation failed; using deterministic fallback.', error); }
  }

  const fallback = fallbackScenarioSynthesizer(candidate, currentTopic, session.questionCount, isFirst, turn?.actionTaken || 'start');
  if (!isDuplicate(session, fallback)) session.fingerprints.add(fingerprint(fallback));
  return fallback;
}

function fallbackScenarioSynthesizer(candidate: Candidate, topic: CurriculumDay, turnCount: number, isFirst: boolean, action: string): string {
  const name = candidate.name.split(' ')[0];
  const scenarios = [
    'a member asks why a prior authorization was denied and the source documents disagree',
    'a benefits question arrives with an incomplete plan identifier and ambiguous member metadata',
    'a retrieval result is relevant to the policy but belongs to the wrong plan type',
    'an enrollment surge causes retrieval latency to spike while members expect immediate answers',
    'a downstream eligibility service returns stale data during a high-volume support window',
    'an LLM tool call omits a required field while calculating a member cost estimate',
    'two policy documents conflict and the chatbot must explain uncertainty without inventing an answer',
  ];
  const scenario = scenarios[Math.min(turnCount, scenarios.length - 1)];
  const opening = isFirst ? `Welcome ${name}, let's begin your technical evaluation. ` : '';
  const base = `${opening}Imagine the healthcare chatbot is handling ${scenario}. What would you inspect first, and how would you design the system so the response stays reliable?`;
  const modifiers: Record<string, string> = {
    probe: ' Walk me through the exact evidence you would use to decide whether your approach was working.',
    perturb: ' Now assume latency must stay below 2 seconds while the policy corpus has doubled. What changes?',
    escalate: ' Now assume the same design must support conflicting plan rules and an audit trail. What trade-off would you make?',
    pivot: ' Separately, consider how you would detect and contain a wrong-plan retrieval result before it reaches the member.',
    start: '',
  };
  return `${base}${modifiers[action] || ''}`;
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
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

async function generateFinalFeedback(session: InterviewSession): Promise<FeedbackData> {
  const candidate = session.candidate;
  if (anthropic) {
    try {
      const prompt = `Evaluate this technical interview for ${candidate.name} (${candidate.jobRole}, ${candidate.yearsExperience} years). Use only evidence in the transcript. Return JSON with exactly summary, strengths, gaps, next. Each array item must be concise and actionable. Transcript: ${JSON.stringify(session.transcript.slice(-16))}`;
      const res = await anthropic.messages.create({ model: CLAUDE_MODEL, max_tokens: 450, temperature: 0.2, messages: [{ role: 'user', content: prompt }] });
      const text = res.content[0]?.type === 'text' ? res.content[0].text.trim() : '';
      const jsonText = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(jsonText) as FeedbackData;
      if (parsed.summary && Array.isArray(parsed.strengths) && Array.isArray(parsed.gaps) && Array.isArray(parsed.next)) return parsed;
    } catch (error) { console.warn('Claude feedback generation failed; using deterministic feedback.', error); }
  }
  const entries = Object.values(session.scores);
  const average = entries.length ? Math.round(entries.reduce((sum, item) => sum + item.totalScore / item.count, 0) / entries.length) : 0;
  return { summary: `The interview produced an evidence-based technical assessment across ${session.coveredDays.size} curriculum days, with an overall demonstrated score of ${average}%.`, strengths: ['Engaged with production-oriented healthcare chatbot scenarios', 'Provided observable technical reasoning during the interview'], gaps: ['Some advanced trade-offs require deeper explanation', 'Continue strengthening failure-mode analysis and operational validation'], next: ['Practice explaining architecture decisions with measurable evidence', 'Rehearse failure recovery, observability, and validation strategies'] };
}

function buildSkillChart(session: InterviewSession): SkillScore[] {
  return Object.values(session.scores).map(item => ({ skill: item.topic, score: Math.round(item.totalScore / item.count) }));
}
