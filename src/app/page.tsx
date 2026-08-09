'use client';

import React, { useState } from 'react';
import { Candidate, ChatMessage, FeedbackData, SkillScore, InterviewAPIResponse } from '@/types/interview';
import { CandidateSelector } from '@/components/CandidateSelector';
import { InterviewInterface } from '@/components/InterviewInterface';
import { FeedbackDashboard } from '@/components/FeedbackDashboard';
import { ProctorWarningModal } from '@/components/ProctorWarningModal';
import { useProctoring } from '@/lib/proctoring';

type ViewMode = 'selector' | 'interview' | 'feedback';
const BUILD_VERSION = 'ui-v4-deterministic-questions';

export default function Home() {
  const [view, setView] = useState<ViewMode>('selector');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [finalFeedback, setFinalFeedback] = useState<FeedbackData | null>(null);
  const [skillChart, setSkillChart] = useState<SkillScore[]>([]);
  const [isTerminated, setIsTerminated] = useState<boolean>(false);
  const [terminationReason, setTerminationReason] = useState<string>('');

  const handleStartInterview = async (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    const newSessionId = `session-${candidate.id}-${Date.now().toString(36)}`;
    setSessionId(newSessionId); setMessages([]); setFinalFeedback(null); setSkillChart([]); setIsTerminated(false); setIsLoading(true); setView('interview');
    try {
      const res = await fetch('/api/interview', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, cache: 'no-store', body: JSON.stringify({ sessionId: newSessionId, candidate }) });
      const data: InterviewAPIResponse & { buildVersion?: string } = await res.json();
      console.info('Interview API build:', data.buildVersion);
      if (data.reply) setMessages([{ id: '1', sender: 'interviewer', text: data.reply, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    } catch (err) { console.error('Failed to initialize interview:', err); } finally { setIsLoading(false); }
  };

  const handleSendMessage = async (text: string) => {
    if (!sessionId || isLoading || !selectedCandidate) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), sender: 'candidate', text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    const historyForServer = messages.map(({ sender, text: messageText, timestamp }) => ({ sender, text: messageText, timestamp }));
    setMessages(prev => [...prev, userMsg]); setIsLoading(true);
    try {
      const res = await fetch('/api/interview', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, cache: 'no-store', body: JSON.stringify({ sessionId, candidate: selectedCandidate, message: text, history: historyForServer }) });
      const data: InterviewAPIResponse & { buildVersion?: string } = await res.json();
      console.info('Interview API build:', data.buildVersion);
      if (data.reply) setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'interviewer', text: data.reply, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      if (data.done) { if (data.feedback) setFinalFeedback(data.feedback); if (data.skillChart) setSkillChart(data.skillChart); setView('feedback'); }
    } catch (err) { console.error('Failed to send message:', err); } finally { setIsLoading(false); }
  };

  const handleViolationTerminate = async () => {
    if (view !== 'interview' || !sessionId) return;
    setIsTerminated(true); setTerminationReason('Interview terminated due to focus-loss violation exceeding grace period.');
    try { const res = await fetch('/api/interview', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, cache: 'no-store', body: JSON.stringify({ sessionId, action: 'terminate_violation' }) }); const data: InterviewAPIResponse = await res.json(); if (data.feedback) setFinalFeedback(data.feedback); } catch (err) { console.error('Termination API call error:', err); }
    setView('feedback');
  };

  const { hasLostFocus, timeLeft, dismissWarning, backModalOpen, setBackModalOpen } = useProctoring({ active: view === 'interview', gracePeriodSeconds: 25, onViolationTerminate: handleViolationTerminate });

  return <div className="min-h-screen bg-dark-bg selection:bg-violet-deep selection:text-white">
    {view === 'selector' && <CandidateSelector onSelectCandidate={handleStartInterview} />}
    {view === 'interview' && selectedCandidate && <InterviewInterface candidate={selectedCandidate} sessionId={sessionId} messages={messages} isLoading={isLoading} onSendMessage={handleSendMessage} onEndEarly={() => setView('feedback')} onBackToSelection={() => setView('selector')} proctorActive={true} />}
    {view === 'feedback' && selectedCandidate && <FeedbackDashboard candidate={selectedCandidate} feedback={finalFeedback || { summary: 'Candidate completed the interview evaluation session.', strengths: ['Demonstrated practical AI engineering reasoning'], gaps: ['Further depth needed in advanced orchestration'], next: ['Continue practice on production deployment'] }} skillChart={skillChart} terminated={isTerminated} terminationReason={terminationReason} onRestart={() => setView('selector')} />}
    {view === 'interview' && <div className="fixed bottom-2 left-2 z-50 rounded-md border border-white/10 bg-black/70 px-2 py-1 text-[9px] text-gray-400">{BUILD_VERSION}</div>}
    <ProctorWarningModal hasLostFocus={hasLostFocus} timeLeft={timeLeft} onDismissWarning={dismissWarning} backModalOpen={backModalOpen} onConfirmBackLeave={() => { setBackModalOpen(false); setView('selector'); }} onCancelBackLeave={() => setBackModalOpen(false)} />
  </div>;
}
