import React from 'react';
import { Candidate, FeedbackData, SkillScore } from '@/types/interview';
import { Award, CheckCircle, AlertCircle, ArrowRight, RotateCcw, BarChart3, ChevronRight } from 'lucide-react';

interface FeedbackDashboardProps {
  candidate: Candidate;
  feedback: FeedbackData;
  skillChart?: SkillScore[];
  terminated?: boolean;
  endedEarly?: boolean;
  terminationReason?: string;
  onRestart: () => void;
}

export const FeedbackDashboard: React.FC<FeedbackDashboardProps> = ({ candidate, feedback, skillChart, terminated, endedEarly, terminationReason, onRestart }) => {
  const statusLabel = terminated ? 'TERMINATED VIOLATION' : endedEarly ? 'ENDED EARLY' : 'EVALUATION COMPLETE';
  const statusClass = terminated ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : endedEarly ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  const hasInsufficientEvidence = feedback.summary.toLowerCase().includes('insufficient technical evidence');

  return (
    <div className="min-h-screen bg-dark-bg text-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className={`glass-panel rounded-2xl p-6 border ${terminated ? 'border-rose-500/30' : endedEarly ? 'border-amber-500/30' : 'border-violet-deep/30'} relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-deep/10 rounded-full blur-3xl -z-10 pointer-events-none" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2.5 py-0.5 text-xs font-mono rounded-full border ${statusClass}`}>{statusLabel}</span>
                <span className="text-xs text-gray-400 font-mono">{candidate.id}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Technical Interview Report: {candidate.name}</h1>
              <p className="text-sm text-violet-light mt-0.5">{candidate.jobRole} • {candidate.yearsExperience} Years Experience</p>
            </div>
            <button onClick={onRestart} className="py-2.5 px-4 bg-purple-gradient text-white text-xs font-semibold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-deep/20 shrink-0">
              <RotateCcw className="w-3.5 h-3.5" /> Return to Candidate List
            </button>
          </div>
        </div>

        {(terminated || endedEarly) && terminationReason && (
          <div className={`p-4 rounded-xl text-sm flex items-center gap-3 ${terminated ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300' : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'}`}>
            <AlertCircle className={`w-5 h-5 shrink-0 ${terminated ? 'text-rose-400' : 'text-amber-400'}`} />
            <div><div className="font-semibold">{terminated ? 'Security & Proctoring Notice' : 'Interview Status'}</div><div className="text-xs opacity-80">{terminationReason}</div></div>
          </div>
        )}

        {hasInsufficientEvidence && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div><div className="font-semibold text-sm">Assessment limited by response evidence</div><div className="text-xs text-amber-100/80 mt-1">The score reflects only what was demonstrated in the interview. Short or non-technical responses are not treated as evidence of technical ability.</div></div>
          </div>
        )}

        <div className="glass-card rounded-2xl p-6 border border-white/10">
          <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2"><Award className="w-4 h-4 text-violet-accent" /> Assessment Executive Summary</h3>
          <p className="text-sm text-gray-300 leading-relaxed bg-black/40 p-4 rounded-xl border border-white/5 font-sans">"{feedback.summary}"</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="glass-card rounded-2xl p-5 border border-emerald-500/20 bg-emerald-950/10">
            <h4 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Demonstrated Engineering Strengths</h4>
            <ul className="space-y-2.5">{feedback.strengths.map((str, idx) => <li key={idx} className="text-xs text-gray-200 flex items-start gap-2 bg-black/30 p-2.5 rounded-lg border border-emerald-500/10"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" /><span>{str}</span></li>)}</ul>
          </div>
          <div className="glass-card rounded-2xl p-5 border border-amber-500/20 bg-amber-950/10">
            <h4 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Technical Gaps & Limitations</h4>
            <ul className="space-y-2.5">{feedback.gaps.map((gap, idx) => <li key={idx} className="text-xs text-gray-200 flex items-start gap-2 bg-black/30 p-2.5 rounded-lg border border-amber-500/10"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" /><span>{gap}</span></li>)}</ul>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-white/10">
          <h4 className="text-sm font-semibold text-violet-light mb-3 flex items-center gap-2"><ArrowRight className="w-4 h-4" /> Recommended Career Next Steps</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{feedback.next.map((step, idx) => <div key={idx} className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs text-gray-300 flex items-center gap-2"><ChevronRight className="w-4 h-4 text-violet-accent shrink-0" /><span>{step}</span></div>)}</div>
        </div>

        {skillChart && skillChart.length > 0 && (
          <div className="glass-card rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between gap-3 mb-1"><h4 className="text-sm font-semibold text-white flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Domain Technical Depth Breakdown</h4><span className="text-[10px] uppercase tracking-wide text-gray-500">Assessed domains only</span></div>
            <p className="text-xs text-gray-500 mb-4">Only domains reached by the interview are shown. A low score means limited demonstrated evidence, not a definitive measure of ability.</p>
            <div className="space-y-4">{skillChart.map((skill, idx) => { const insufficient = skill.depthScore < 40; return <div key={`${skill.day}-${idx}`} className="space-y-1.5"><div className="flex justify-between text-xs font-medium"><span className="text-gray-300"><span className="font-mono text-gray-500 mr-2">Day {skill.day}</span>{skill.topic}</span><span className={`font-mono font-bold ${insufficient ? 'text-amber-300' : 'text-violet-light'}`}>{skill.depthScore}/100{insufficient ? ' · insufficient evidence' : ''}</span></div><div className="w-full h-2 bg-black/50 rounded-full overflow-hidden p-0.5 border border-white/5"><div className="h-full bg-purple-gradient rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, skill.depthScore))}%` }} /></div></div>; })}</div>
          </div>
        )}
      </div>
    </div>
  );
};
