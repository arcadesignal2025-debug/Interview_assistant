'use client';

import React, { useState } from 'react';
import { Candidate, ChatMessage, FeedbackData, SkillScore, InterviewAPIResponse } from '@/types/interview';
import { CandidateSelector } from '@/components/CandidateSelector';
import { InterviewInterface } from '@/components/InterviewInterface';
import { FeedbackDashboard } from '@/components/FeedbackDashboard';
import { ProctorWarningModal } from '@/components/ProctorWarningModal';
import { useProctoring } from '@/lib/proctoring';

type ViewMode = 'selector' | 'interview' | 'feedback';
const BUILD_VERSION = 'ui-v5-hardened';
const FALLBACK_FEEDBACK: FeedbackData = { summary: 'The interview was not completed.', strengths: [], gaps: ['Insufficient interview evidence was collected.'], next: ['Restart the interview and complete all technical scenarios.'] };

export default function Home() {
  const [view, setView] = useState<ViewMode>('selector');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [finalFeedback, setFinalFeedback] = useState<FeedbackData | null>(null);
  const [skillChart, setSkillChart] = useState<SkillScore[]>([]);
  const [isTerminated, setIsTerminated] = useState(false);
  const [endedEarly, setEndedEarly] = useState(false);
  const [terminationReason, setTerminationReason] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const parseResponse = async (res: Response): Promise<InterviewAPIResponse> => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Interview service returned ${res.status}.`);
    return data as InterviewAPIResponse;
  };

  const handleStartInterview = async (candidate: Candidate) => {
    const newSessionId = `session-${candidate.id}-${Date.now().toString(36)}`;
    setSelectedCandidate(candidate); setSessionId(newSessionId); setMessages([]); setFinalFeedback(null); setSkillChart([]); setIsTerminated(false); setEndedEarly(false); setTerminationReason(''); setErrorMessage(''); setIsLoading(true); setView('interview');
    try {
      const res = await fetch('/api/interview', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, cache: 'no-store', body: JSON.stringify({ sessionId: newSessionId, candidate }) });
      const data = await parseResponse(res);
      console.info('Interview API build:', data.buildVersion);
      const reply = data.reply;
      if (!reply) throw new Error('Interview service returned no opening question.');
      setMessages([{ id: 'interviewer-1', sender: 'interviewer', text: reply, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to start interview.';
      console.error('Failed to initialize interview:', err); setErrorMessage(message); setView('selector');
    } finally { setIsLoading(false); }
  };

  const handleSendMessage = async (text: string) => {
    if (!sessionId || isLoading || !selectedCandidate) return;
    const userMsg: ChatMessage = { id: `candidate-${Date.now()}`, sender: 'candidate', text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    const historyForServer = messages.map(({ sender, text: messageText, timestamp }) => ({ sender, text: messageText, timestamp }));
    setMessages(prev => [...prev, userMsg]); setIsLoading(true); setErrorMessage('');
    try {
      const res = await fetch('/api/interview', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, cache: 'no-store', body: JSON.stringify({ sessionId, candidate: selectedCandidate, message: text, history: historyForServer }) });
      const data = await parseResponse(res);
      console.info('Interview API build:', data.buildVersion);
      const reply = data.reply;
      if (reply) setMessages(prev => [...prev, { id: `interviewer-${Date.now()}`, sender: 'interviewer', text: reply, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      if (data.done) { setFinalFeedback(data.feedback || FALLBACK_FEEDBACK); setSkillChart(data.skillChart || []); setView('feedback'); }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to send response.';
      console.error('Failed to send message:', err); setErrorMessage(message); setMessages(prev => prev.filter(m => m.id !== userMsg.id));
    } finally { setIsLoading(false); }
  };

  const handleEndEarly = () => {
    setEndedEarly(true); setIsTerminated(false); setTerminationReason('You ended the interview before the minimum assessment was completed.'); setFinalFeedback({ summary: 'The candidate ended the interview before a complete technical assessment could be produced.', strengths: [], gaps: ['The assessment contains insufficient evidence because the interview ended early.'], next: ['Restart the interview and complete the remaining scenarios.'] }); setView('feedback');
  };

  const handleViolationTerminate = async () => {
    if (view !== 'interview' || !sessionId) return;
    setIsTerminated(true); setEndedEarly(false); setTerminationReason('Interview terminated due to focus-loss violation exceeding grace period.');
    try { const res = await fetch('/api/interview', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, cache: 'no-store', body: JSON.stringify({ sessionId, action: 'terminate_violation' }) }); const data = await parseResponse(res); setFinalFeedback(data.feedback || FALLBACK_FEEDBACK); } catch (err) { console.error('Termination API call error:', err); setFinalFeedback(FALLBACK_FEEDBACK); }
    setView('feedback');
  };

  const { hasLostFocus, timeLeft, dismissWarning, backModalOpen, setBackModalOpen } = useProctoring({ active: view === 'interview', gracePeriodSeconds: 25, onViolationTerminate: handleViolationTerminate });

  return <div className="min-h-screen bg-dark-bg selection:bg-violet-deep selection:text-white">
    {errorMessage && <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] max-w-xl w-[calc(100%-2rem)] rounded-xl border border-rose-500/30 bg-rose-950/90 px-4 py-3 text-xs text-rose-200 shadow-xl" role="alert">{errorMessage}</div>}
    {view === 'selector' && <CandidateSelector onSelectCandidate={handleStartInterview} />}
    {view === 'interview' && selectedCandidate && <InterviewInterface candidate={selectedCandidate} sessionId={sessionId} messages={messages} isLoading={isLoading} onSendMessage={handleSendMessage} onEndEarly={handleEndEarly} onBackToSelection={() => { setView('selector'); setErrorMessage(''); }} proctorActive={true} />}
    {view === 'feedback' && selectedCandidate && <FeedbackDashboard candidate={selectedCandidate} feedback={finalFeedback || FALLBACK_FEEDBACK} skillChart={skillChart} terminated={isTerminated} endedEarly={endedEarly} terminationReason={terminationReason} onRestart={() => { setView('selector'); setMessages([]); setSessionId(''); setFinalFeedback(null); setSkillChart([]); setIsTerminated(false); setEndedEarly(false); setTerminationReason(''); setErrorMessage(''); }} />}
    {view === 'interview' && <div className="fixed bottom-2 left-2 z-50 rounded-md border border-white/10 bg-black/70 px-2 py-1 text-[9px] text-gray-400">{BUILD_VERSION}</div>}
    <ProctorWarningModal hasLostFocus={hasLostFocus} timeLeft={timeLeft} onDismissWarning={dismissWarning} backModalOpen={backModalOpen} onConfirmBackLeave={() => { setBackModalOpen(false); setView('selector'); }} onCancelBackLeave={() => setBackModalOpen(false)} />
  </div>;
}
