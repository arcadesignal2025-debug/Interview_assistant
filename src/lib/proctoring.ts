import { useEffect, useState, useRef } from 'react';

interface UseProctoringOptions {
  active: boolean;
  onGracePeriodStart?: () => void;
  onGracePeriodEnd?: () => void;
  onViolationTerminate?: () => void;
  gracePeriodSeconds?: number;
}

export function useProctoring({
  active,
  onGracePeriodStart,
  onGracePeriodEnd,
  onViolationTerminate,
  gracePeriodSeconds = 25,
}: UseProctoringOptions) {
  const [hasLostFocus, setHasLostFocus] = useState(false);
  const [timeLeft, setTimeLeft] = useState(gracePeriodSeconds);
  const [backModalOpen, setBackModalOpen] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  // Visibility and Blur Monitoring
  useEffect(() => {
    if (!active) {
      setHasLostFocus(false);
      setTimeLeft(gracePeriodSeconds);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const handleFocusLoss = () => {
      if (!activeRef.current) return;
      setHasLostFocus(true);
      if (onGracePeriodStart) onGracePeriodStart();
    };

    const handleFocusGain = () => {
      // Focus regained - keep modal open briefly or clear if returned in time
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleFocusLoss();
      } else {
        handleFocusGain();
      }
    };

    window.addEventListener('blur', handleFocusLoss);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleFocusLoss);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [active, gracePeriodSeconds, onGracePeriodStart]);

  // Grace Period Countdown Timer
  useEffect(() => {
    if (hasLostFocus && active) {
      setTimeLeft(gracePeriodSeconds);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            if (onViolationTerminate) onViolationTerminate();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasLostFocus, active, gracePeriodSeconds, onViolationTerminate]);

  const dismissWarning = () => {
    setHasLostFocus(false);
    setTimeLeft(gracePeriodSeconds);
    if (timerRef.current) clearInterval(timerRef.current);
    if (onGracePeriodEnd) onGracePeriodEnd();
  };

  // Browser Back Button Interception (History Trap)
  useEffect(() => {
    if (!active) return;

    // Push dummy history entry
    window.history.pushState({ page: 'interview' }, '', window.location.href);

    const handlePopState = (e: PopStateEvent) => {
      if (activeRef.current) {
        // Re-push state to trap user on page
        window.history.pushState({ page: 'interview' }, '', window.location.href);
        setBackModalOpen(true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [active]);

  return {
    hasLostFocus,
    timeLeft,
    dismissWarning,
    backModalOpen,
    setBackModalOpen,
  };
}
