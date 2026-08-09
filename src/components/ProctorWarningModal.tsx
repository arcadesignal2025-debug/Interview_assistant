import React from 'react';
import { ShieldAlert, AlertTriangle, ArrowLeft, Lock } from 'lucide-react';

interface ProctorWarningModalProps {
  hasLostFocus: boolean;
  timeLeft: number;
  onDismissWarning: () => void;
  backModalOpen: boolean;
  onConfirmBackLeave: () => void;
  onCancelBackLeave: () => void;
}

export const ProctorWarningModal: React.FC<ProctorWarningModalProps> = ({
  hasLostFocus,
  timeLeft,
  onDismissWarning,
  backModalOpen,
  onConfirmBackLeave,
  onCancelBackLeave,
}) => {
  return (
    <>
      {/* 1. FOCUS LOSS INTEGRITY WARNING OVERLAY */}
      {hasLostFocus && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-amber-500/30 text-center shadow-2xl animate-fade-in">
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-400">
              <ShieldAlert className="w-8 h-8 animate-pulse" />
            </div>

            <h3 className="text-xl font-bold text-white">Focus Loss Detected!</h3>
            <p className="text-sm text-gray-300 mt-2">
              You left the active interview window. Return immediately—an extended violation will automatically terminate this session.
            </p>

            {/* Countdown Badge */}
            <div className="my-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="text-xs text-amber-300 font-medium uppercase tracking-wider">Session Termination Grace Period</div>
              <div className="text-4xl font-extrabold text-amber-400 font-mono mt-1">{timeLeft}s</div>
            </div>

            <button
              onClick={onDismissWarning}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/20"
            >
              I Understand — Resume Interview Now
            </button>
          </div>
        </div>
      )}

      {/* 2. BROWSER BACK BUTTON TRAP CONFIRMATION MODAL */}
      {backModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-rose-500/30 text-center shadow-2xl animate-fade-in">
            <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-400">
              <Lock className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-bold text-white">Leaving Interview Session?</h3>
            <p className="text-sm text-gray-300 mt-2">
              Navigating away while an interview is in progress forfeits your session under proctoring rules. Are you sure you want to exit?
            </p>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={onCancelBackLeave}
                className="py-2.5 px-4 bg-white/10 hover:bg-white/15 text-white font-medium text-xs rounded-xl transition-all border border-white/10"
              >
                Stay & Continue
              </button>
              <button
                onClick={onConfirmBackLeave}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl transition-all shadow-lg shadow-rose-600/20"
              >
                Forfeit & Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
