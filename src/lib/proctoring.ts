import { useCallback, useEffect, useRef, useState } from 'react';

interface UseProctoringOptions {
  active: boolean;
  onGracePeriodStart?: () => void;
  onGracePeriodEnd?: () => void;
  onViolationTerminate?: () => void;
  gracePeriodSeconds?: number;
}

export function useProctoring({ active, onGracePeriodStart, onGracePeriodEnd, onViolationTerminate, gracePeriodSeconds = 25 }: UseProctoringOptions) {
  const [hasLostFocus, setHasLostFocus] = useState(false);
  const [timeLeft, setTimeLeft] = useState(gracePeriodSeconds);
  const [backModalOpen, setBackModalOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(active);
  const terminatedRef = useRef(false);
  const callbacksRef = useRef({ onGracePeriodStart, onGracePeriodEnd, onViolationTerminate });

  activeRef.current = active;
  callbacksRef.current = { onGracePeriodStart, onGracePeriodEnd, onViolationTerminate };

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!active) {
      terminatedRef.current = false;
      clearTimer();
      setHasLostFocus(false);
      setTimeLeft(gracePeriodSeconds);
      setBackModalOpen(false);
      return;
    }

    terminatedRef.current = false;
    const handleFocusLoss = () => {
      if (!activeRef.current || terminatedRef.current) return;
      setHasLostFocus(true);
      callbacksRef.current.onGracePeriodStart?.();
    };

    const handleFocusGain = () => {
      if (!activeRef.current || terminatedRef.current) return;
      clearTimer();
      setHasLostFocus(false);
      setTimeLeft(gracePeriodSeconds);
      callbacksRef.current.onGracePeriodEnd?.();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleFocusLoss();
      else handleFocusGain();
    };

    window.addEventListener('blur', handleFocusLoss);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('blur', handleFocusLoss);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [active, gracePeriodSeconds, clearTimer]);

  useEffect(() => {
    clearTimer();
    if (!active || !hasLostFocus || terminatedRef.current) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearTimer();
          if (!terminatedRef.current && activeRef.current) {
            terminatedRef.current = true;
            callbacksRef.current.onViolationTerminate?.();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [active, hasLostFocus, gracePeriodSeconds, clearTimer]);

  const dismissWarning = useCallback(() => {
    if (terminatedRef.current) return;
    clearTimer();
    setHasLostFocus(false);
    setTimeLeft(gracePeriodSeconds);
    callbacksRef.current.onGracePeriodEnd?.();
  }, [clearTimer, gracePeriodSeconds]);

  useEffect(() => {
    if (!active) return;
    window.history.pushState({ page: 'interview' }, '', window.location.href);

    const handlePopState = () => {
      if (!activeRef.current) return;
      window.history.pushState({ page: 'interview' }, '', window.location.href);
      setBackModalOpen(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [active]);

  return { hasLostFocus, timeLeft, dismissWarning, backModalOpen, setBackModalOpen };
}
