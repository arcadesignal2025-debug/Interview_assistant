import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import curriculumData from '@/data/curriculum.json';
import { Candidate, CurriculumDay, SkillScore, FeedbackData } from '@/types/interview';

type Turn = { role: 'interviewer' | 'candidate'; text: string; day?: number; action?: string };
type Session = { sessionId: string; candidate: Candidate; topicPlan: CurriculumDay[]; currentTopicIndex: number; questionCount: number; coveredDays: Set<number>; fingerprints: Set<string>; transcript: Turn[]; scores: Record<number, { totalScore: number; count: number; topic: string }>; isComplete: boolean };

const store = (globalThis as typeof globalThis & { __interviewSessions?: Map<string, Session> }).__interviewSessions ?? new Map<string, Session>();
(globalThis as typeof globalThis & { __interviewSessions?: Map<string, Session> }).__interviewSessions = store;
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, candidate, message, action, history } = await req.json();
    if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

    if (action === 'terminate_violation') {
      const s = store.get(sessionId); if (s) s.isComplete = true;
      return NextResponse.json({ reply: 'Interview terminated due to extended focus-loss violation. Session locked.', done: true, terminated: true, terminationReason: 'Security & focus-loss proctoring timeout exceeded.', feedback: { summary: 'Interview session terminated early due to extended focus-loss violation.', strengths: ['Initial engagement registered before termination'], gaps: ['Incomplete assessment due to security protocol violation'], next: ['Retake the technical interview in a distraction-free environment'] } });
    }

    let session = store.get(sessionId);
    if (!session && candidate) {
      session = init(sessionId, candidate);
      restore(session, history);
      store.set(sessionId, session);
      if (!hasText(message)) {
        const q = await nextQuestion(session, true);
        session.transcript.push({ role: 'interviewer', text: q, day: session.topicPlan[0]?.day });
        return NextResponse.json({ reply: q, done: false });
      }
    }
    if (!session) return NextResponse.json({ error: 'Session not found. Please start interview.' }, { status: 404 });
    if (session.isComplete) return NextResponse.json({ reply: 'Interview completed.', done: true });

    const answer = String(message || '').trim();
    if (!answer) return NextResponse.json({ error: 'message is required for an interview turn' }, { status: 400 });

    if (session.transcript.filter(t => t.role === 'candidate').length === 0 && Array.isArray(history)) restore(session, history);
    const lastCandidate = [...session.transcript].reverse().find(t => t.role === 'candidate');
    if (!lastCandidate || fingerprint(lastCandidate.text) !== fingerprint(answer)) session.transcript.push({ role: 'candidate', text: answer, day: session.topicPlan[session.currentTopicIndex]?.day });

    const topic = session.topicPlan[session.currentTopicIndex] || session.topicPlan[0];
    if (topic) { session.coveredDays.add(topic.day); score(session, topic, answer); }
    session.questionCount++;
    const previous = [...session.transcript].reverse().find(t => t.role === 'interviewer')?.text || '';
    const actionTaken = answer.split(/\s+/).filter(Boolean).length < 8 ? 'probe' : answer.split(/\s+/).filter(Boolean).length < 30 ? 'perturb' : session.questionCount % 3 === 0 ? 'pivot' : 'escalate';
    if (actionTaken === 'pivot' && session.currentTopicIndex < session.topicPlan.length - 1) session.currentTopicIndex++;

    if (session.questionCount >= 8 && session.coveredDays.size >= 4) {
      session.isComplete = true;
      return NextResponse.json({ reply: 'Interview completed. Thank you for walking through these technical scenarios with me.', done: true, feedback: await feedback(session), skillChart: chart(session) });
    }

    const q = await nextQuestion(session, false, { previous, answer, action: actionTaken });
    session.transcript.push({ role: 'interviewer', text: q, day: session.topicPlan[session.currentTopicIndex]?.day, action: actionTaken });
    return NextResponse.json({ reply: q, done: false });
  } catch (e: any) {
    console.error('/api/interview', e);
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}

function hasText(v: unknown) { return typeof v === 'string' && v.trim().length > 0; }
function fingerprint(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).slice(0, 32).join(' '); }
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
function rand(seed: number) { let x = seed || 1; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }

function init(sessionId: string, candidate: Candidate): Session {
  const engaged = new Set(candidate.missions.filter(m => !m.skipped && ((m.attempts ?? 0) > 0 || m.passed === true)).map(m => m.day));
  const allowed = new Set(['BUILD', 'AI_CORE', 'SHIP_IT', 'CAPSTONE']);
  const days = (curriculumData as CurriculumDay[]).filter(d => allowed.has(d.type));
  const personalized = days.filter(d => engaged.has(d.day));
  const source = personalized.length >= 5 ? personalized : days;
  const seed = hash(sessionId + candidate.id);
  const plan = [...source].sort((a, b) => rand(seed + a.day) - rand(seed + b.day)).slice(0, 7);
  return { sessionId, candidate, topicPlan: plan, currentTopicIndex: 0, questionCount: 0, coveredDays: new Set(), fingerprints: new Set(), transcript: [], scores: {}, isComplete: false };
}

function restore(s: Session, history: any) {
  if (!Array.isArray(history)) return;
  for (const x of history) {
    if (!x || typeof x.text !== 'string') continue;
    const role = x.sender === 'candidate' ? 'candidate' : x.sender === 'interviewer' ? 'interviewer' : null;
    if (!role) continue;
    const text = x.text.trim(); if (!text) continue;
    if (!s.transcript.some(t => t.role === role && fingerprint(t.text) === fingerprint(text))) s.transcript.push({ role, text, day: s.topicPlan[s.currentTopicIndex]?.day });
    if (role === 'interviewer') s.fingerprints.add(fingerprint(text));
  }
  s.questionCount = s.transcript.filter(t => t.role === 'candidate').length;
  if (s.questionCount && s.topicPlan[0]) s.coveredDays.add(s.topicPlan[0].day);
}

function score(s: Session, topic: CurriculumDay, answer: string) {
  const n = answer.split(/\s+/).filter(Boolean).length; let value = 55 + (n >= 8 ? 10 : 0) + (n >= 25 ? 10 : 0) + (n >= 60 ? 10 : 0);
  value += topic.tools.filter(t => answer.toLowerCase().includes(t.toLowerCase())).length * 4; value = Math.max(35, Math.min(98, value));
  const old = s.scores[topic.day]; s.scores[topic.day] = old ? { ...old, totalScore: old.totalScore + value, count: old.count + 1 } : { totalScore: value, count: 1, topic: topic.title };
}

async function nextQuestion(s: Session, first: boolean, turn?: { previous: string; answer: string; action: string }) {
  const t = s.topicPlan[s.currentTopicIndex] || s.topicPlan[0]; if (!t) return 'Let’s continue with a production scenario relevant to your healthcare chatbot work.';
  if (anthropic) {
    try {
      const recent = s.transcript.slice(-8).map(x => `${x.role}: ${x.text}`).join('\n');
      const prompt = `Conduct an adaptive technical interview for ${s.candidate.name}, ${s.candidate.jobRole}, ${s.candidate.yearsExperience} years. The candidate built an enterprise healthcare chatbot. Use the following curriculum material as hidden context; never reveal its title or concept name. Day ${t.day}; objectives: ${t.objectives.join('; ')}; mechanism: ${t.mechanism}; failure modes: ${t.commonFailureModes.join('; ')}; adjacent concepts: ${t.adjacentConcepts.join('; ')}.\nAction: ${turn?.action || 'start'}\nPrevious question: ${turn?.previous || '(none)'}\nLatest answer: ${turn?.answer || '(none)'}\nRecent transcript:\n${recent || '(none)'}\nRules: create a genuinely NEW healthcare-chatbot scenario, never repeat or merely rephrase the previous question; probe means clarify reasoning, perturb means change one constraint, escalate means demand a deeper trade-off, pivot means a distinct scenario. Match role/experience. Under 100 words. ${first ? 'Briefly welcome the candidate.' : 'Do not greet again.'}`;
      const r = await anthropic.messages.create({ model: MODEL, max_tokens: 220, temperature: 0.8, messages: [{ role: 'user', content: prompt }] });
      const text = r.content[0]?.type === 'text' ? r.content[0].text.trim() : '';
      if (text && !duplicate(s, text)) { s.fingerprints.add(fingerprint(text)); return text; }
    } catch (e) { console.warn('Claude generation failed; fallback used.', e); }
  }
  const scenarios = ['a member asks why a prior authorization was denied and source documents disagree', 'a benefits question arrives with an incomplete plan identifier and ambiguous metadata', 'a retrieval result is relevant but belongs to the wrong plan type', 'an enrollment surge makes retrieval latency spike', 'an eligibility service returns stale data during a high-volume window', 'an LLM tool call omits a required field while calculating a cost estimate', 'two policy documents conflict and the chatbot must explain uncertainty without inventing an answer'];
  const scenario = scenarios[Math.min(s.questionCount, scenarios.length - 1)];
  const modifier: Record<string, string> = { probe: ' Walk me through the exact evidence you would use.', perturb: ' Now assume latency must stay below 2 seconds while the corpus doubles. What changes?', escalate: ' Now require conflicting plan rules and an audit trail. What trade-off would you make?', pivot: ' Separately, how would you detect and contain a wrong-plan retrieval result before it reaches the member?', start: '' };
  const text = `${first ? `Welcome ${s.candidate.name.split(' ')[0]}, let’s begin. ` : ''}Imagine the healthcare chatbot is handling ${scenario}. What would you inspect first, and how would you design the system so the response stays reliable?${modifier[turn?.action || 'start'] || ''}`;
  s.fingerprints.add(fingerprint(text)); return text;
}
function duplicate(s: Session, text: string) { const f = fingerprint(text); return s.fingerprints.has(f) || s.transcript.some(x => x.role === 'interviewer' && fingerprint(x.text) === f); }

async function feedback(s: Session): Promise<FeedbackData> {
  if (anthropic) {
    try {
      const r = await anthropic.messages.create({ model: MODEL, max_tokens: 450, temperature: 0.2, messages: [{ role: 'user', content: `Evaluate this technical interview using only transcript evidence. Return JSON with exactly summary, strengths, gaps, next. Candidate: ${s.candidate.name}, ${s.candidate.jobRole}. Transcript: ${JSON.stringify(s.transcript.slice(-16))}` }] });
      const raw = r.content[0]?.type === 'text' ? r.content[0].text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '') : '';
      const parsed = JSON.parse(raw) as FeedbackData; if (parsed.summary && Array.isArray(parsed.strengths) && Array.isArray(parsed.gaps) && Array.isArray(parsed.next)) return parsed;
    } catch (e) { console.warn('Claude feedback failed; fallback used.', e); }
  }
  return { summary: `The interview assessed production-oriented healthcare chatbot reasoning across ${s.coveredDays.size} curriculum days.`, strengths: ['Engaged with production-oriented scenarios', 'Provided observable technical reasoning'], gaps: ['Some advanced trade-offs need deeper explanation', 'Continue strengthening failure-mode analysis'], next: ['Practice architecture decisions with measurable evidence', 'Rehearse failure recovery, observability, and validation'] };
}

function chart(s: Session): SkillScore[] { return Object.entries(s.scores).map(([day, x]) => ({ topic: x.topic, day: Number(day), depthScore: Math.round(x.totalScore / x.count) })); }
