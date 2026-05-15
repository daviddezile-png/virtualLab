import React, { useState, useEffect, useRef } from "react";
import { Clock, AlertTriangle } from "lucide-react";

interface Props {
  /** Total minutes allowed, set by teacher. 0 = no limit. */
  timeLimitMinutes: number;
  /** epoch ms when the student entered the lab (persisted, survives refresh) */
  sessionStartAt: number;
  /** called once when the timer hits 0:00 */
  onExpire: () => void;
}

const CountdownTimer: React.FC<Props> = ({ timeLimitMinutes, sessionStartAt, onExpire }) => {
  const totalSeconds = timeLimitMinutes * 60;
  const expiredRef   = useRef(false);

  const calcRemaining = () =>
    Math.max(0, totalSeconds - Math.floor((Date.now() - sessionStartAt) / 1000));

  const [remaining, setRemaining] = useState(calcRemaining);

  useEffect(() => {
    if (timeLimitMinutes <= 0) return;

    // Fire immediately if already expired on mount (e.g. page refresh after timeout)
    if (remaining === 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpire();
      return;
    }

    const id = setInterval(() => {
      const left = calcRemaining();
      setRemaining(left);
      if (left === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
        clearInterval(id);
      }
    }, 1000);

    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLimitMinutes, sessionStartAt]);

  if (timeLimitMinutes <= 0) return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct  = remaining / totalSeconds;

  // Colour thresholds
  const isCritical = remaining <= 60;          // ≤ 1 min  → red
  const isLow      = remaining <= 300;         // ≤ 5 min  → amber
  const color      = isCritical ? "#ef4444"
                   : isLow      ? "#f59e0b"
                   :              "#22c55e";

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: `${color}15`,
      border: `1px solid ${color}55`,
      borderRadius: 10, padding: "5px 14px",
      animation: isCritical ? "timerPulse 1s ease-in-out infinite" : "none",
    }}>
      {isLow
        ? <AlertTriangle size={14} color={color} strokeWidth={2.4} />
        : <Clock         size={14} color={color} strokeWidth={2}   />
      }
      <span style={{
        fontFamily: "monospace", fontWeight: 800, fontSize: 15,
        color, letterSpacing: 1,
      }}>
        {pad(mins)}:{pad(secs)}
      </span>
      <span style={{ color: `${color}aa`, fontSize: 10, fontWeight: 600,
        textTransform: "uppercase", letterSpacing: 0.8 }}>
        {isCritical ? "HURRY!" : isLow ? "Low time" : "Remaining"}
      </span>

      {/* Thin progress bar under the text */}
      <style>{`
        @keyframes timerPulse {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.55; }
        }
      `}</style>
    </div>
  );
};

export default CountdownTimer;
