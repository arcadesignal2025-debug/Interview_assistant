import React, { useState } from 'react';
import { Candidate } from '@/types/interview';
import candidatesData from '@/data/candidates.json';
import { User, Award, CheckCircle, AlertTriangle, Play, Sparkles, Filter, Search, ChevronRight, X, Clock } from 'lucide-react';

interface CandidateSelectorProps {
  onSelectCandidate: (candidate: Candidate) => void;
}

export const CandidateSelector: React.FC<CandidateSelectorProps> = ({ onSelectCandidate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [activeModalCandidate, setActiveModalCandidate] = useState<Candidate | null>(null);

  const candidates = candidatesData as Candidate[];

  // Filter roles list
  const roles = ['ALL', ...Array.from(new Set(candidates.map(c => c.jobRole)))];

  const filteredCandidates = candidates.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.jobRole.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === 'ALL' || c.jobRole === selectedRole;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="min-h-screen bg-dark-bg text-gray-100 p-4 sm:p-6 lg:p-8">
      {/* Top Banner Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 text-xs font-mono bg-violet-deep/20 text-violet-light border border-violet-deep/40 rounded-full flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Antigravity AI Engine
              </span>
              <span className="px-3 py-1 text-xs font-mono bg-coolblue-500/20 text-coolblue-400 border border-coolblue-500/40 rounded-full">
                31-Day AI Engineering Cohort
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-violet-light">
              AI Technical Interview Agent
            </h1>
            <p className="text-gray-400 text-sm sm:text-base mt-1">
              Select a candidate profile to launch an adaptive, multi-turn technical interview calibrated to their engineering trajectory.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 glass-panel rounded-xl text-center">
              <div className="text-xs text-gray-400">Total Candidates</div>
              <div className="text-xl font-bold text-white font-mono">{candidates.length}</div>
            </div>
            <div className="px-4 py-2 glass-panel rounded-xl text-center">
              <div className="text-xs text-gray-400">Curriculum Days</div>
              <div className="text-xl font-bold text-violet-light font-mono">31</div>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search candidate name, ID, or engineering role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-dark-surface border border-white/10 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-violet-accent focus:ring-1 focus:ring-violet-accent transition-all"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 bg-dark-surface border border-white/10 rounded-xl text-sm text-gray-100 focus:outline-none focus:border-violet-accent transition-all appearance-none cursor-pointer"
            >
              {roles.map(r => (
                <option key={r} value={r} className="bg-dark-card text-gray-100">
                  {r === 'ALL' ? 'All Job Roles' : r}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Candidates Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCandidates.map((candidate) => {
          const passRate = Math.round((candidate.signals.missionsFirstTry / candidate.signals.missionsCompleted) * 100);

          return (
            <div
              key={candidate.id}
              className="glass-card glass-card-hover rounded-2xl p-5 flex flex-col justify-between relative group border border-white/5"
            >
              <div>
                {/* Header info */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono px-2 py-0.5 bg-white/5 text-gray-400 rounded">
                        {candidate.id}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-medium">
                        {candidate.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mt-1 group-hover:text-violet-light transition-colors">
                      {candidate.name}
                    </h3>
                    <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                      <User className="w-3 h-3 text-violet-accent" /> {candidate.jobRole} • {candidate.yearsExperience} yrs exp
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">First-Try Pass</div>
                    <div className={`text-lg font-bold font-mono ${passRate >= 75 ? 'text-emerald-400' : passRate >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {passRate}%
                    </div>
                  </div>
                </div>

                {/* Signals Badges */}
                <div className="grid grid-cols-3 gap-2 my-4 p-2.5 rounded-xl bg-black/40 border border-white/5 text-center text-xs">
                  <div>
                    <div className="text-gray-500 text-[10px]">Commits</div>
                    <div className="font-mono text-gray-200 font-semibold">{candidate.signals.commitDays}/31</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-[10px]">Missions</div>
                    <div className="font-mono text-gray-200 font-semibold">{candidate.signals.missionsCompleted}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-[10px]">First-Try</div>
                    <div className="font-mono text-violet-light font-semibold">{candidate.signals.missionsFirstTry}</div>
                  </div>
                </div>

                {/* Sample Missions preview */}
                <div className="space-y-1.5 mb-5">
                  <div className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">Recent Missions</div>
                  {candidate.missions.slice(0, 3).map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white/5">
                      <span className="text-gray-300 truncate max-w-[200px]">Day {m.day}: {m.title}</span>
                      {m.skipped ? (
                        <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">Skipped</span>
                      ) : m.passed ? (
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Passed ({m.attempts}x)</span>
                      ) : (
                        <span className="text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">Failed</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                <button
                  onClick={() => setActiveModalCandidate(candidate)}
                  className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 text-xs font-medium text-gray-300 rounded-xl transition-all border border-white/10"
                >
                  View Profile
                </button>
                <button
                  onClick={() => onSelectCandidate(candidate)}
                  className="flex-1 py-2 px-3 bg-purple-gradient text-white text-xs font-semibold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-violet-deep/20"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Start Interview
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Candidate Deep-Dive Modal */}
      {activeModalCandidate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl animate-fade-in max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/10 flex items-start justify-between bg-dark-surface/50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 bg-violet-deep/20 text-violet-light rounded border border-violet-deep/30">
                    {activeModalCandidate.id}
                  </span>
                  <span className="text-xs text-gray-400">{activeModalCandidate.education}</span>
                </div>
                <h2 className="text-2xl font-bold text-white mt-1">{activeModalCandidate.name}</h2>
                <p className="text-sm text-violet-light font-medium">{activeModalCandidate.jobRole} • {activeModalCandidate.yearsExperience} Years Experience</p>
              </div>
              <button
                onClick={() => setActiveModalCandidate(null)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Stats Bar */}
              <div className="grid grid-cols-3 gap-3 p-4 glass-card rounded-xl border border-white/5 text-center">
                <div>
                  <div className="text-xs text-gray-400">Commit Days</div>
                  <div className="text-lg font-bold text-white font-mono">{activeModalCandidate.signals.commitDays}/31</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Missions Passed</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono">{activeModalCandidate.signals.missionsCompleted}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">First-Try Passes</div>
                  <div className="text-lg font-bold text-violet-light font-mono">{activeModalCandidate.signals.missionsFirstTry}</div>
                </div>
              </div>

              {/* Full Mission Trajectory */}
              <div>
                <h4 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4 text-violet-accent" /> Mission Performance History
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {activeModalCandidate.missions.map((mission, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/5 text-xs">
                      <div>
                        <span className="font-mono text-gray-400 mr-2">Day {mission.day}</span>
                        <span className="text-gray-200 font-medium">{mission.title}</span>
                      </div>
                      <div>
                        {mission.skipped ? (
                          <span className="px-2 py-0.5 text-[10px] bg-gray-800 text-gray-400 rounded">Skipped</span>
                        ) : mission.passed ? (
                          <span className="px-2 py-0.5 text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded">
                            Passed ({mission.attempts} attempt{mission.attempts! > 1 ? 's' : ''})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] bg-rose-500/15 text-rose-400 border border-rose-500/30 rounded">
                            Failed ({mission.attempts} attempts)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/10 bg-dark-surface/50 flex justify-end gap-3">
              <button
                onClick={() => setActiveModalCandidate(null)}
                className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const c = activeModalCandidate;
                  setActiveModalCandidate(null);
                  onSelectCandidate(c);
                }}
                className="px-5 py-2 bg-purple-gradient text-white text-xs font-semibold rounded-xl hover:opacity-90 transition-all flex items-center gap-1.5 shadow-lg shadow-violet-deep/30"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Launch Candidate Interview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
