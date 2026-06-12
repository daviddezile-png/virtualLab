import { useEffect, useRef, useState, useCallback } from "react";

const IDLE_MINUTES    = 2;  // show warning after 2 min idle
const WARNING_SECONDS = 60; // 1-minute countdown before auto-logout (total = 3 min)

const EVENTS = ["mousemove","keydown","click","scroll","touchstart"] as const;

export const useSessionTimeout = (onLogout: () => void) => {
  const [showWarning, setShowWarning] = useState(false);
  const [remaining,   setRemaining]   = useState(WARNING_SECONDS);

  const logoutRef  = useRef(onLogout);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  logoutRef.current = onLogout;

  const clearAll = () => {
    if (timerRef.current)  clearTimeout(timerRef.current);
    if (countRef.current)  clearInterval(countRef.current);
  };

  const doLogout = useCallback(() => {
    clearAll();
    setShowWarning(false);
    logoutRef.current();
  }, []);

  const startCountdown = useCallback(() => {
    setShowWarning(true);
    setRemaining(WARNING_SECONDS);
    countRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { doLogout(); return 0; }
        return r - 1;
      });
    }, 1000);
  }, [doLogout]);

  const resetTimer = useCallback(() => {
    clearAll();
    setShowWarning(false);
    timerRef.current = setTimeout(
      startCountdown,
      IDLE_MINUTES * 60 * 1000
    );
  }, [startCountdown]);

  // Activity resets the idle timer; ignored while warning is showing
  useEffect(() => {
    const onActivity = () => {
      setShowWarning(showing => {
        if (!showing) resetTimer();
        return showing;
      });
    };
    EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    resetTimer();
    return () => {
      clearAll();
      EVENTS.forEach(e => window.removeEventListener(e, onActivity));
    };
  }, [resetTimer]);

  const stayLoggedIn = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  return { showWarning, remaining, stayLoggedIn, logoutNow: doLogout };
};
