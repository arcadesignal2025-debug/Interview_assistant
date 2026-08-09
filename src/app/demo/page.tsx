'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Candidate, ChatMessage, FeedbackData, InterviewAPIResponse, SkillScore } from '@/types/interview';
import { InterviewInterface } from '@/components/InterviewInterface';
import { FeedbackDashboard } from '@/components/FeedbackDashboard';

const DEMO_CANDIDATE: Candidate = {
  id: 'DEMO-001',
  name: 'Competition Demo Candidate',
  jobRole: 'AI Platform Engineer',
  yearsExperience: 6,
  education: 'M.S. Computer Science',
  status: 'DEMO',
  missions: [
    { day: 7, title: 'Embeddings Explained', passed: true, attempts: 1 },
    { day: 8, title: 'Vector Databases Overview', passed: true, attempts: 1 },
    { day: 10, title: 'Retrieval & Matching Engine', passed: true, attempts: 1 },
    { day: 16, title: 'Chatbot Backend & API Integration', passed: true, attempts: 1 },
    { day: 22, title: 'Multi-Agent Orchestration', passed: true, attempts: 1 },
    { day: 28, title: 'Docker & Kubernetes Deployment', passed: true, attempts: 1 },
  ],
  signals: { commitDays: 24, missionsCompleted: 6, missionsFirstTry: 6 },
};

const SAMPLE_ANSWERS = [
  'I would validate the member and plan identifiers first, then trace retrieval metadata, source authority, version, and effective date before producing the member response.',
  'I would reject ambiguous metadata, use a deterministic fallback path, and log the decision so the result can be audited and reproduced.',
  'I would verify plan type, effective date, and member scope before allowing a retrieved policy passage into the answer context.',
  'I would inspect latency by dependency, cache hit rate, retrieval timing, queue depth, and downstream saturation before scaling the bottleneck.',
  'I would detect stale eligibility data with freshness checks and communicate uncertainty instead of guessing when the source cannot be trusted.',
  'I would validate required tool fields with a strict schema, return a safe validation error, and prevent execution with incomplete data.',
  'I would rank conflicting policy sources by authority, effective date, and scope, and require an explicit conflict state when the rules cannot be reconciled.',
  'I would add tracing, retrieval precision metrics, answer evaluations, alerts, and audit logs so production failures are detectable and reproducible.',
];

const FALLBACK: FeedbackData = { summary: 'The demo interview did not complete.', strengths: [], gaps: ['Insufficient demo evidence was collected.'], next: ['Restart the demo and complete the technical scenarios.'] };

export default function DemoPage() {
  const [started, setStarted] = useState(false);
  const [view, setView] = useState<'intro' | 'interview' | 'feedback'>('intro');
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [skillChart, setSkillChart] = useState<SkillScore[]>([]);
  const [error, setError] = useState('');

  const parseResponse = async (res: Response): Promise<InterviewAPIResponse> => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Interview service returned ${res.status}.`);
    return data as InterviewAPIResponse;
  };

  const start = async () => {
    const id = `demo-${Date.now().toString(36)}`;
    setSessionId(id); setStarted(true); setView('interview'); setIsLoading(true); setError('');
    try {
      const res = await fetch('/api/interview', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, cache: 'no-store', body: JSON.stringify({ sessionId: id, candidate: DEMO_CANDIDATE }) });
      const data = await parseResponse(res);
      if (!data.reply) throw new Error('No opening question returned.');
      setMessages([{ id: 'interviewer-1', sender: 'interviewer', text: data.reply, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start demo.'); setView('intro'); setStarted(false);
    } finally { setIsLoading(false); }
  };

  const send = async (text: string) => {
    if (!sessionId || isLoading) return;
    const userMsg: ChatMessage = { id: `candidate-${Date.now()}`, sender: 'candidate', text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    const history = [...messages, userMsg].map(({ sender, text: messageText, timestamp }) => ({ sender, text: messageText, timestamp }));
    setMessages(prev => [...prev, userMsg]); setIsLoading(true); setError('');
    try {
      const res = await fetch('/api/interview', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, cache: 'no-store', body: JSON.stringify({ sessionId, candidate: DEMO_CANDIDATE, message: text, history }) });
      const data = await parseResponse(res);
      if (data.reply) setMessages(prev => [...prev, { id: `interviewer-${Date.now()}`, sender: 'interviewer', text: data.reply!, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      if (data.done) { setFeedback(data.feedback || FALLBACK); setSkillChart(data.skillChart || []); setView('feedback'); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to send response.');
    } finally { setIsLoading(false); }
  };

  useEffect(() => { return () => setStarted(false); }, []);

  if (view === 'intro') return (
    <main className="min-h-screen bg-dark-bg text-gray-100 p-6 sm:p-10">
      <div className="max-w-3xl mx-auto pt-10">
        <Link href="/showcase" className="text-xs text-gray-500 hover:text-gray-300">← Back to competition showcase</Link>
        <div className="glass-panel rounded-3xl p-8 mt-5 border border-violet-deep/30">
          <span className="px-3 py-1 rounded-full bg-violet-deep/20 text-violet-light border border-violet-deep/40 text-xs font-mono">SANITIZED INTERACTIVE DEMO</span>
          <h1 className="text-3xl font-bold text-white mt-4">AI Technical Interview Agent</h1>
          <p className="text-sm text-gray-400 mt-3 leading-relaxed">This demo uses only synthetic candidate data. Coordinators can test the adaptive interview and evidence-based evaluation without accessing private candidate records.</p>
          <button onClick={start} disabled={isLoading} className="mt-6 px-5 py-3 rounded-xl bg-purple-gradient text-white text-sm font-semibold disabled:opacity-50">{isLoading ? 'Starting…' : 'Start Interactive Demo'}</button>
          {error && <p className="mt-4 text-xs text-rose-300" role="alert">{error}</p>}
        </div>
      </div>
    </main>
  );

  if (view === 'interview') return (
    <>
      {error && <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-rose-500/30 bg-rose-950/90 px-4 py-3 text-xs text-rose-200" role="alert">{error}</div>}
      <InterviewInterface candidate={DEMO_CANDIDATE} sessionId={sessionId} messages={messages} isLoading={isLoading} onSendMessage={send} onEndEarly={() => { setFeedback({ summary: 'The demo was ended before completion.', strengths: [], gaps: ['The demonstration was intentionally ended early.'], next: ['Restart the demo to view the complete evaluation flow.'] }); setView('feedback'); }} onBackToSelection={() => setView('intro')} proctorActive={false} />
    </>
  );

  return <FeedbackDashboard candidate={DEMO_CANDIDATE} feedback={feedback || FALLBACK} skillChart={skillChart} onRestart={() => { setMessages([]); setSessionId(''); setFeedback(null); setSkillChart([]); setStarted(false); setView('intro'); }} />;
}
