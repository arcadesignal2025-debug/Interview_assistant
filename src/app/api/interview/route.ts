import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import curriculumData from '@/data/curriculum.json';
import { Candidate, CurriculumDay, SkillScore, FeedbackData } from '@/types/interview';

const BUILD_VERSION = 'adaptive-v7-evidence-aware';
const MAX_HISTORY_ITEMS = 40;
const MAX_TEXT_LENGTH = 4000;

type Turn = { role: 'interviewer' | 'candidate'; text: string; day?: number; action?: string };
type ScoreEntry = { totalScore: number; count: number; topic: string };
type Session = { sessionId: string; candidate: Candidate; topicPlan: CurriculumDay[]; currentTopicIndex: number; questionCount: number; coveredDays: Set<number>; transcript: Turn[]; scores: Record<number, ScoreEntry> };

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, candidate, message, action, history } = body as { sessionId?: unknown; candidate?: Candidate; message?: unknown; action?: unknown; history?: unknown };
    if (typeof sessionId !== 'string' || sessionId.length < 8 || sessionId.length > 200) return NextResponse.json({ error: 'A valid sessionId is required.', buildVersion: BUILD_VERSION }, { status: 400 });
    if (action === 'terminate_violation') return NextResponse.json({ buildVersion: BUILD_VERSION, reply: 'Interview terminated due to extended focus-loss violation. Session locked.', done: true, terminated: true, terminationReason: 'Security & focus-loss proctoring timeout exceeded.', feedback: { summary: 'Interview terminated early due to extended focus-loss violation.', strengths: ['Initial engagement registered before termination'], gaps: ['Incomplete assessment due to security protocol violation'], next: ['Retake the technical interview in a distraction-free environment'] } });
    if (!isCandidate(candidate)) return NextResponse.json({ error: 'A complete candidate profile is required.', buildVersion: BUILD_VERSION }, { status: 400 });

    const session = init(sessionId, candidate);
    restore(session, history);
    const answer = typeof message === 'string' ? message.trim().slice(0, MAX_TEXT_LENGTH) : '';
    if (!answer) return NextResponse.json({ buildVersion: BUILD_VERSION, reply: makeQuestion(session, true, 'start'), done: false });

    const answerIndex = session.questionCount;
    const answerTopic = session.topicPlan[Math.min(answerIndex, Math.max(0, session.topicPlan.length - 1))];
    session.transcript.push({ role: 'candidate', text: answer, day: answerTopic?.day });
    if (answerTopic) { session.coveredDays.add(answerTopic.day); score(session, answerTopic, answer); }
    session.questionCount += 1;
    session.currentTopicIndex = Math.min(session.questionCount, Math.max(0, session.topicPlan.length - 1));

    if (session.questionCount >= 8 && session.coveredDays.size >= 4) {
      return NextResponse.json({ buildVersion: BUILD_VERSION, reply: 'Interview completed. Thank you for walking through these technical scenarios with me.', done: true, feedback: await makeFeedback(session), skillChart: chart(session) });
    }

    const words = answer.split(/\s+/).filter(Boolean).length;
    const actionTaken = words < 8 ? 'probe' : words < 30 ? 'perturb' : session.questionCount % 3 === 0 ? 'pivot' : 'escalate';
    return NextResponse.json({ buildVersion: BUILD_VERSION, reply: makeQuestion(session, false, actionTaken), done: false });
  } catch (error: unknown) {
    console.error('[interview]', BUILD_VERSION, error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error', buildVersion: BUILD_VERSION }, { status: 500 });
  }
}

function isCandidate(value: unknown): value is Candidate {
  if (!value || typeof value !== 'object') return false;
  const c = value as Candidate;
  return typeof c.id === 'string' && c.id.length > 0 && typeof c.name === 'string' && c.name.length > 0
    && typeof c.jobRole === 'string' && typeof c.yearsExperience === 'number' && Number.isFinite(c.yearsExperience)
    && Array.isArray(c.missions) && !!c.signals && typeof c.signals === 'object';
}

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
function rand(seed: number) { let x = seed || 1; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }

function init(sessionId: string, candidate: Candidate): Session {
  const engaged = new Set(candidate.missions.filter(m => !m.skipped && ((m.attempts ?? 0) > 0 || m.passed === true)).map(m => m.day));
  const allowed = new Set(['BUILD', 'AI_CORE', 'SHIP_IT', 'CAPSTONE']);
  const days = (curriculumData as CurriculumDay[]).filter(d => allowed.has(d.type));
  const personalized = days.filter(d => engaged.has(d.day));
  const source = personalized.length >= 5 ? personalized : days;
  const seed = hash(sessionId + candidate.id);
  const topicPlan = [...source].sort((a, b) => rand(seed + a.day) - rand(seed + b.day)).slice(0, 7);
  return { sessionId, candidate, topicPlan, currentTopicIndex: 0, questionCount: 0, coveredDays: new Set<number>(), transcript: [], scores: {} };
}

function restore(s: Session, history: unknown) {
  if (!Array.isArray(history)) return;
  for (const item of history.slice(-MAX_HISTORY_ITEMS)) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { sender?: unknown; text?: unknown };
    const role = row.sender === 'candidate' ? 'candidate' : row.sender === 'interviewer' ? 'interviewer' : null;
    if (!role || typeof row.text !== 'string') continue;
    const text = row.text.trim().slice(0, MAX_TEXT_LENGTH); if (!text) continue;
    if (role === 'interviewer') s.transcript.push({ role, text, day: s.topicPlan[Math.min(s.questionCount, Math.max(0, s.topicPlan.length - 1))]?.day });
    else {
      const candidateIndex = s.questionCount;
      const topic = s.topicPlan[Math.min(candidateIndex, Math.max(0, s.topicPlan.length - 1))];
      s.transcript.push({ role, text, day: topic?.day });
      if (topic) { s.coveredDays.add(topic.day); score(s, topic, text); }
      s.questionCount += 1;
    }
  }
  s.currentTopicIndex = Math.min(s.questionCount, Math.max(0, s.topicPlan.length - 1));
}

function makeQuestion(s: Session, first: boolean, action: string): string {
  const scenarios = [
    'A member asks why a prior authorization was denied, but two source documents disagree. How would you trace the answer from retrieval through the member-facing response?',
    'A benefits request arrives with an incomplete plan identifier and ambiguous member metadata. What validation and fallback path would you design before answering?',
    'Your retrieval layer finds a highly relevant policy passage, but it belongs to the wrong plan type. How would you detect that failure before it reaches the member?',
    'Enrollment traffic suddenly triples and retrieval latency rises above the product target. Which part of the chatbot architecture would you inspect first, and what would you change?',
    'An eligibility service starts returning stale data during a high-volume support window. How should the chatbot detect the problem and communicate uncertainty safely?',
    'A tool call used to calculate a member cost estimate arrives without one required field. How should the system validate the payload, recover, and prevent an unsafe answer?',
    'Two policy documents conflict on the same benefit. How would you design the system so the chatbot does not silently choose the wrong rule?',
    'A production incident shows that technically correct retrieval is still producing confusing member answers. What observability and evaluation signals would you add?',
  ];
  const index = Math.min(Math.max(0, s.questionCount), scenarios.length - 1);
  let q = scenarios[index];
  if (action === 'probe') q += ' Walk me through the exact evidence you would inspect first.';
  else if (action === 'perturb') q += ' Now assume the system must respond within two seconds while the policy corpus doubles. What changes?';
  else if (action === 'escalate') q += ' Now add an audit requirement and conflicting plan rules. What trade-off would you make?';
  else if (action === 'pivot') q += ' Separately, how would you test this failure mode before shipping the change?';
  return first ? `Welcome ${s.candidate.name.split(' ')[0]}, let’s begin your technical evaluation. ${q}` : q;
}

function normalize(text: string): string { return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function containsConcept(answer: string, concept: string): boolean {
  const a = normalize(answer);
  const c = normalize(concept);
  if (!c || c.length < 3) return false;
  return a.includes(c);
}

function score(s: Session, topic: CurriculumDay, answer: string) {
  const words = answer.split(/\s+/).filter(Boolean);
  const n = words.length;
  const lower = answer.toLowerCase();
  let value = 20;
  value += Math.min(20, Math.floor(n / 5) * 2);

  const objectiveHits = topic.objectives.filter(x => containsConcept(answer, x)).length;
  const failureHits = topic.commonFailureModes.filter(x => containsConcept(answer, x)).length;
  const adjacentHits = topic.adjacentConcepts.filter(x => containsConcept(answer, x)).length;
  const toolHits = topic.tools.filter(x => lower.includes(x.toLowerCase())).length;

  value += Math.min(20, objectiveHits * 5);
  value += Math.min(15, failureHits * 5);
  value += Math.min(10, adjacentHits * 3);
  value += Math.min(10, toolHits * 3);

  if (/\b(because|therefore|so that|trade[- ]?off|first|then|finally|measure|monitor|validate|fallback|test|observe|audit)\b/i.test(answer)) value += 8;
  if (n < 3) value = Math.min(value, 25);
  else if (n < 8) value = Math.min(value, 40);

  value = Math.max(0, Math.min(100, value));
  const old = s.scores[topic.day];
  s.scores[topic.day] = old ? { ...old, totalScore: old.totalScore + value, count: old.count + 1 } : { totalScore: value, count: 1, topic: topic.title };
}

function evidenceStats(s: Session) {
  const answers = s.transcript.filter(t => t.role === 'candidate');
  const wordCounts = answers.map(a => a.text.split(/\s+/).filter(Boolean).length);
  const averageWords = wordCounts.length ? wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length : 0;
  const substantiveAnswers = wordCounts.filter(n => n >= 8).length;
  return { answers: answers.length, averageWords, substantiveAnswers };
}

async function makeFeedback(s: Session): Promise<FeedbackData> {
  const stats = evidenceStats(s);
  // Never let an LLM invent strengths when the transcript contains too little evidence.
  if (stats.substantiveAnswers < 2 || stats.averageWords < 8) {
    return {
      summary: `Insufficient technical evidence to make a reliable depth assessment. The candidate provided ${stats.answers} answer${stats.answers === 1 ? '' : 's'}, averaging ${Math.round(stats.averageWords)} words per answer, with only ${stats.substantiveAnswers} substantive response${stats.substantiveAnswers === 1 ? '' : 's'}.`,
      strengths: ['No reliable technical strengths could be established from the available responses.'],
      gaps: ['Responses were too brief to demonstrate technical reasoning, trade-offs, or implementation depth.', 'Provide concrete architecture decisions, validation steps, failure handling, and measurable evidence in future responses.'],
      next: ['Answer with a clear approach, rationale, and trade-offs.', 'Use concrete production examples and explain how you would validate the design.'],
    };
  }

  if (anthropic) {
    try {
      const r = await anthropic.messages.create({ model: MODEL, max_tokens: 450, temperature: 0.2, messages: [{ role: 'user', content: `Evaluate this technical interview using only transcript evidence. Do not infer skills that are not demonstrated. Return JSON with exactly summary, strengths, gaps, next. Candidate: ${s.candidate.name}, ${s.candidate.jobRole}. Transcript: ${JSON.stringify(s.transcript.slice(-16))}` }] });
      const raw = r.content[0]?.type === 'text' ? r.content[0].text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '') : '';
      const parsed = JSON.parse(raw) as FeedbackData;
      if (parsed.summary && Array.isArray(parsed.strengths) && Array.isArray(parsed.gaps) && Array.isArray(parsed.next)) return parsed;
    } catch (error) { console.warn('Claude feedback failed; deterministic feedback used.', error); }
  }
  return { summary: `The interview assessed production-oriented healthcare chatbot reasoning across ${s.coveredDays.size} curriculum areas.`, strengths: ['Engaged with production-oriented scenarios', 'Provided observable technical reasoning'], gaps: ['Some advanced trade-offs need deeper explanation', 'Continue strengthening failure-mode analysis'], next: ['Practice architecture decisions with measurable evidence', 'Rehearse failure recovery, observability, and validation'] };
}

function chart(s: Session): SkillScore[] {
  return Object.entries(s.scores)
    .map(([day, x]) => ({ topic: x.topic, day: Number(day), depthScore: Math.round(x.totalScore / x.count) }))
    .sort((a, b) => a.day - b.day);
}
