import React from "react";

interface Props {
  remaining:     number;  // seconds left
  onStay:        () => void;
  onLogout:      () => void;
}

const SessionWarning: React.FC<Props> = ({ remaining, onStay, onLogout }) => {
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct  = (remaining / 180) * 100;
  const isUrgent = remaining <= 60;

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.78)",
      zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center",
      padding:20,
    }}>
      <div style={{
        background:"#0f172a", border:`1px solid ${isUrgent ? "#ef4444" : "#334155"}`,
        borderRadius:20, padding:"40px 36px", maxWidth:400, width:"100%", textAlign:"center",
        boxShadow:"0 24px 80px rgba(0,0,0,0.8)",
      }}>
        {/* Countdown ring */}
        <div style={{ position:"relative", width:88, height:88, margin:"0 auto 24px" }}>
          <svg width="88" height="88" style={{ transform:"rotate(-90deg)" }}>
            <circle cx="44" cy="44" r="38" fill="none" stroke="#1e293b" strokeWidth="6" />
            <circle cx="44" cy="44" r="38" fill="none"
              stroke={isUrgent ? "#ef4444" : "#3b82f6"}
              strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 38}`}
              strokeDashoffset={`${2 * Math.PI * 38 * (1 - pct / 100)}`}
              strokeLinecap="round"
              style={{ transition:"stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div style={{
            position:"absolute", inset:0, display:"flex", alignItems:"center",
            justifyContent:"center", flexDirection:"column",
          }}>
            <span style={{ color: isUrgent ? "#ef4444" : "#60a5fa", fontWeight:900,
              fontSize:18, fontFamily:"monospace", lineHeight:1 }}>
              {mins}:{secs.toString().padStart(2,"0")}
            </span>
          </div>
        </div>

        <h2 style={{ color:"white", fontSize:20, fontWeight:900, margin:"0 0 10px", letterSpacing:-0.3 }}>
          Session Expiring
        </h2>
        <p style={{ color:"#94a3b8", fontSize:14, lineHeight:1.7, margin:"0 0 28px" }}>
          You've been inactive for a while. You'll be automatically logged out{" "}
          <strong style={{ color: isUrgent ? "#ef4444" : "#e2e8f0" }}>
            in {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
          </strong>.
        </p>

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onLogout} style={{
            flex:1, padding:"12px 0", borderRadius:11, border:"1px solid #334155",
            background:"transparent", color:"#64748b", fontWeight:700, fontSize:14,
            cursor:"pointer",
          }}>
            Log Out
          </button>
          <button onClick={onStay} style={{
            flex:2, padding:"12px 0", borderRadius:11, border:"none",
            background:"linear-gradient(135deg,#1d4ed8,#7c3aed)",
            color:"white", fontWeight:800, fontSize:14, cursor:"pointer",
            boxShadow:"0 4px 18px rgba(29,78,216,0.4)",
          }}>
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionWarning;
