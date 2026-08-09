import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import curriculumData from '@/data/curriculum.json';
import { Candidate, CurriculumDay, SkillScore, FeedbackData } from '@/types/interview';

const BUILD_VERSION = 'adaptive-v4-deterministic-questions';
type Turn = { role: 'interviewer' | 'candidate'; text: string; day?: number; action?: string };
type Session = { sessionId: string; candidate: Candidate; topicPlan: CurriculumDay[]; currentTopicIndex: number; questionCount: number; coveredDays: Set<number>; transcript: Turn[]; scores: Record<number, { totalScore: number; count: number; topic: string }> };

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, candidate, message, action, history } = body;
    if (!sessionId) return NextResponse.json({ error: 'sessionId is required', buildVersion: BUILD_VERSION }, { status: 400 });

    if (action === 'terminate_violation') {
      return NextResponse.json({ buildVersion: BUILD_VERSION, reply: 'Interview terminated due to extended focus-loss violation. Session locked.', done: true, terminated: true, terminationReason: 'Security & focus-loss proctoring timeout exceeded.', feedback: { summary: 'Interview session terminated early due to extended focus-loss violation.', strengths: ['Initial engagement registered before termination'], gaps: ['Incomplete assessment due to security protocol violation'], next: ['Retake the technical interview in a distraction-free environment'] } });
    }
    if (!candidate) return NextResponse.json({ error: 'candidate is required', buildVersion: BUILD_VERSION }, { status: 400 });

    const session = init(sessionId, candidate);
    restore(session, history);
    const answer = typeof message === 'string' ? message.trim() : '';

    if (!answer) {
      const q = makeQuestion(session, true, 'start');
      console.info('[interview]', BUILD_VERSION, 'start', q.slice(0, 80));
      return NextResponse.json({ buildVersion: BUILD_VERSION, reply: q, done: false });
    }

    const alreadyRecorded = session.transcript.some(t => t.role === 'candidate' && normalize(t.text) === normalize(answer));
    if (!alreadyRecorded) session.transcript.push({ role: 'candidate', text: answer, day: session.topicPlan[session.currentTopicIndex]?.day });
    session.questionCount = session.transcript.filter(t => t.role === 'candidate').length;

    const currentTopic = session.topicPlan[session.currentTopicIndex] || session.topicPlan[0];
    if (currentTopic) { session.coveredDays.add(currentTopic.day); score(session, currentTopic, answer); }

    if (session.questionCount >= 8 && session.coveredDays.size >= 4) {
      const finalFeedback = await makeFeedback(session);
      return NextResponse.json({ buildVersion: BUILD_VERSION, reply: 'Interview completed. Thank you for walking through these technical scenarios with me.', done: true, feedback: finalFeedback, skillChart: chart(session) });
    }

    const words = answer.split(/\s+/).filter(Boolean).length;
    const actionTaken = words < 8 ? 'probe' : words < 30 ? 'perturb' : session.questionCount % 3 === 0 ? 'pivot' : 'escalate';
    session.currentTopicIndex = Math.min(Math.floor(session.questionCount / 3), Math.max(0, session.topicPlan.length - 1));
    const q = makeQuestion(session, false, actionTaken);
    console.info('[interview]', BUILD_VERSION, 'turn', session.questionCount, actionTaken, q.slice(0, 80));
    return NextResponse.json({ buildVersion: BUILD_VERSION, reply: q, done: false });
  } catch (e: any) {
    console.error('[interview]', BUILD_VERSION, e);
    return NextResponse.json({ error: e?.message || 'Internal Server Error', buildVersion: BUILD_VERSION }, { status: 500 });
  }
}

function normalize(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
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
  return { sessionId, candidate, topicPlan, currentTopicIndex: 0, questionCount: 0, coveredDays: new Set(), transcript: [], scores: {} };
}

function restore(s: Session, history: any) {
  if (!Array.isArray(history)) return;
  for (const item of history) {
    if (!item || typeof item.text !== 'string') continue;
    const role = item.sender === 'candidate' ? 'candidate' : item.sender === 'interviewer' ? 'interviewer' : null;
    if (!role) continue;
    const text = item.text.trim(); if (!text) continue;
    if (!s.transcript.some(t => t.role === role && normalize(t.text) === normalize(text))) s.transcript.push({ role, text, day: s.topicPlan[s.currentTopicIndex]?.day });
  }
  s.questionCount = s.transcript.filter(t => t.role === 'candidate').length;
  s.currentTopicIndex = Math.min(Math.floor(s.questionCount / 3), Math.max(0, s.topicPlan.length - 1));
  if (s.questionCount && s.topicPlan[s.currentTopicIndex]) s.coveredDays.add(s.topicPlan[s.currentTopicIndex].day);
}

// Question generation is deliberately deterministic. Claude was producing a valid but
// repeatedly similar Pydantic/copay prompt in production, so the interview flow now uses
// controlled scenarios while Claude remains available for final evidence-based feedback.
function makeQuestion(s: Session, first: boolean, action: string): string {
  const scenarios = [
    'A member asks why a prior authorization was denied, but two source documents disagree. How would you trace the answer from retrieval through the member-facing response?',
    'A benefits request arrives with an incomplete plan identifier and ambiguous member metadata. What validation and fallback path would you design before answering?',
    'Your retrieval layer finds a highly relevant policy passage, but it belongs to the wrong plan type. How would you detect that failure before it reaches the member?',
    'Enrollment traffic suddenly triples and retrieval latency rises above the product target. Which part of the chatbot architecture would you inspect first, and what would you change?',
    'An eligibility service starts returning stale data during a high-volume support window. How should the chatbot detect the problem and communicate uncertainty safely?',
    'A tool call used to calculate a member cost estimate arrives without one required field. How should the system validate the payload, recover, and prevent an unsafe answer?',
    'Two policy documents conflict on the same benefit. How would you design the system so the chatbot does not silently choose the wrong rule?',
    'A production incident shows that technically correct retrieval is still producing confusing member answers. What observability and evaluation signals would you add?'
  ];
  const index = Math.min(Math.max(0, s.questionCount), scenarios.length - 1);
  let q = scenarios[index];
  if (action === 'probe') q += ' Walk me through the exact evidence you would inspect first.';
  else if (action === 'perturb') q += ' Now assume the system must respond within two seconds while the policy corpus doubles. What changes?';
  else if (action === 'escalate') q += ' Now add an audit requirement and conflicting plan rules. What trade-off would you make?';
  else if (action === 'pivot') q += ' Separately, how would you test this failure mode before shipping the change?';
  if (first) q = `Welcome ${s.candidate.name.split(' ')[0]}, let’s begin your technical evaluation. ${q}`;
  return q;
}

function score(s: Session, topic: CurriculumDay, answer: string) {
  const n = answer.split(/\s+/).filter(Boolean).length;
  let value = 55 + (n >= 8 ? 10 : 0) + (n >= 25 ? 10 : 0) + (n >= 60 ? 10 : 0);
  value += topic.tools.filter(t => answer.toLowerCase().includes(t.toLowerCase())).length * 4;
  value = Math.max(35, Math.min(98, value));
  const old = s.scores[topic.day];
  s.scores[topic.day] = old ? { ...old, totalScore: old.totalScore + value, count: old.count + 1 } : { totalScore: value, count: 1, topic: topic.title };
}

async function makeFeedback(s: Session): Promise<FeedbackData> {
  if (anthropic) {
    try {
      const r = await anthropic.messages.create({ model: MODEL, max_tokens: 450, temperature: 0.2, messages: [{ role: 'user', content: `Evaluate this technical interview using only transcript evidence. Return JSON with exactly summary, strengths, gaps, next. Candidate: ${s.candidate.name}, ${s.candidate.jobRole}. Transcript: ${JSON.stringify(s.transcript.slice(-16))}` }] });
      const raw = r.content[0]?.type === 'text' ? r.content[0].text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '') : '';
      const parsed = JSON.parse(raw) as FeedbackData;
      if (parsed.summary && Array.isArray(parsed.strengths) && Array.isArray(parsed.gaps) && Array.isArray(parsed.next)) return parsed;
    } catch (e) { console.warn('Claude feedback failed; deterministic feedback used.', e); }
  }
  return { summary: `The interview assessed production-oriented healthcare chatbot reasoning across ${s.coveredDays.size} curriculum areas.`, strengths: ['Engaged with production-oriented scenarios', 'Provided observable technical reasoning'], gaps: ['Some advanced trade-offs need deeper explanation', 'Continue strengthening failure-mode analysis'], next: ['Practice architecture decisions with measurable evidence', 'Rehearse failure recovery, observability, and validation'] };
}

function chart(s: Session): SkillScore[] { return Object.entries(s.scores).map(([day, x]) => ({ topic: x.topic, day: Number(day), depthScore: Math.round(x.totalScore / x.count) })); }
