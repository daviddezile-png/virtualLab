import React, { useState, useEffect } from "react";
import { findAssignment, isCodeExpired, Assignment } from "../utils/assignmentStore";
import { getCurrentUser, logoutUser } from "../utils/userStore";
import { isInviteCode, redeemClassInvite, getMyClass } from "../utils/classInviteStore";

interface Practical {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  type: string;
  available: boolean;
  chemicals: { name: string; color: string }[];
  outcome: string;
  learnings: string[];
  bgGradient: string;
  accentColor: string;
  icon: React.ReactNode;
}

const PRACTICALS: Practical[] = [
  {
    id: "vanishing-cream",
    title: "Vanishing Cream",
    subtitle: "Oil-in-Water Emulsion (O/W)",
    description:
      "Prepare a pharmaceutical-grade vanishing cream by forming an oil-in-water emulsion. Master temperature control, correct mixing order, and cooling technique to produce a smooth, pH-balanced cream that absorbs rapidly into the skin.",
    difficulty: "Intermediate",
    duration: "45–60 min",
    type: "O/W Emulsion",
    available: true,
    chemicals: [
      { name: "Stearic Acid",      color: "rgba(255,252,245,0.9)" },
      { name: "Liquid Paraffin",   color: "rgba(255,248,195,0.8)" },
      { name: "Glycerin",          color: "rgba(235,250,215,0.8)" },
      { name: "KOH & TEA",         color: "rgba(255,245,175,0.8)" },
      { name: "Distilled Water",   color: "rgba(185,228,255,0.5)" },
    ],
    outcome: "Smooth white cream · pH 5–7 · Viscosity 1100–1800 cP",
    learnings: ["O/W emulsion theory", "Phase temperature matching", "Emulsification technique", "Cooling & texture development"],
    bgGradient: "linear-gradient(135deg,#0d1b2e 0%,#162032 100%)",
    accentColor: "#3b82f6",
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80">
        <rect x="14" y="34" width="52" height="38" rx="7" fill="rgba(200,220,255,0.10)" stroke="#3b82f6" strokeWidth="1.8"/>
        <rect x="12" y="28" width="56" height="10" rx="4" fill="#1d4ed8" stroke="#3b82f6" strokeWidth="1.4"/>
        <rect x="15" y="42" width="50" height="29" rx="5" fill="rgba(245,240,232,0.88)"/>
        <rect x="18" y="44" width="42" height="6" rx="3" fill="rgba(255,255,255,0.55)"/>
        <rect x="20" y="54" width="40" height="13" rx="3" fill="white"/>
        <text x="40" y="63" textAnchor="middle" fontSize="5.5" fontWeight="bold" fill="#1d4ed8">VANISHING CREAM</text>
        <path d="M30 24 Q32 19 34 24 Q36 19 38 24" fill="none" stroke="rgba(147,197,253,0.55)" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "cold-cream",
    title: "Cold Cream",
    subtitle: "Water-in-Oil Emulsion (W/O)",
    description:
      "Formulate a classic cold cream using a water-in-oil emulsion. Higher oil content and beeswax as the emulsifier produce a heavier, more occlusive cream that stays on the skin surface for deep moisturisation and cleansing.",
    difficulty: "Intermediate",
    duration: "45–60 min",
    type: "W/O Emulsion",
    available: true,
    chemicals: [
      { name: "Stearic Acid",    color: "rgba(255,252,245,0.9)" },
      { name: "Liquid Paraffin", color: "rgba(255,248,195,0.8)" },
      { name: "Beeswax",         color: "rgba(255,220,100,0.7)" },
      { name: "Borax",           color: "rgba(200,240,255,0.7)" },
      { name: "Distilled Water", color: "rgba(185,228,255,0.5)" },
    ],
    outcome: "Heavy white cream · pH 6–7.5 · Greasy texture",
    learnings: ["W/O vs O/W contrast", "Beeswax emulsification", "Borax saponification", "Occlusive moisturisation"],
    bgGradient: "linear-gradient(135deg,#1a0d2e 0%,#1c1232 100%)",
    accentColor: "#8b5cf6",
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80">
        <rect x="14" y="34" width="52" height="38" rx="7" fill="rgba(180,160,255,0.10)" stroke="#8b5cf6" strokeWidth="1.8"/>
        <rect x="12" y="28" width="56" height="10" rx="4" fill="#6d28d9" stroke="#8b5cf6" strokeWidth="1.4"/>
        <rect x="15" y="42" width="50" height="29" rx="5" fill="rgba(230,220,200,0.90)"/>
        <rect x="18" y="44" width="42" height="5" rx="2" fill="rgba(255,255,255,0.38)"/>
        <rect x="20" y="54" width="40" height="13" rx="3" fill="white"/>
        <text x="40" y="63" textAnchor="middle" fontSize="5.5" fontWeight="bold" fill="#6d28d9">COLD CREAM</text>
        <circle cx="62" cy="18" r="13" fill="rgba(15,23,42,0.88)" stroke="#8b5cf6" strokeWidth="1.4"/>
        <text x="62" y="23" textAnchor="middle" fontSize="14">🔒</text>
      </svg>
    ),
  },
];

const DIFF_COLOR = {
  Beginner:     { bg:"#052e16", border:"#16a34a", text:"#4ade80" },
  Intermediate: { bg:"#1c1200", border:"#ca8a04", text:"#fbbf24" },
  Advanced:     { bg:"#2d0a0a", border:"#dc2626", text:"#f87171" },
};

interface Props {
  onSelect:       (id: string) => void;
  onTeacherPanel?: () => void;
  onAssignment?:  (assignment: Assignment) => void;
}

// ── Invite success overlay ────────────────────────────────────────────────────
const InviteSuccess: React.FC<{ teacherName: string; onDismiss: () => void }> = ({ teacherName, onDismiss }) => (
  <div style={{
    position:"fixed", inset:0, background:"rgba(0,0,0,0.78)",
    zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20,
  }}>
    <div style={{
      background:"#0a1628", border:"1px solid #1e3a5f", borderRadius:20,
      padding:"48px 40px", maxWidth:420, width:"100%", textAlign:"center",
      boxShadow:"0 24px 80px rgba(0,0,0,0.7)",
    }}>
      {/* Green circle with tick */}
      <div style={{
        width:88, height:88, borderRadius:"50%", margin:"0 auto 24px",
        background:"rgba(34,197,94,0.12)", border:"3px solid #22c55e",
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
          <path d="M10 22 L18 30 L34 14" stroke="#22c55e" strokeWidth="3.5"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <div style={{ color:"#22c55e", fontSize:22, fontWeight:900, marginBottom:10, letterSpacing:-0.3 }}>
        Class Joined Successfully!
      </div>
      <div style={{ color:"#94a3b8", fontSize:15, lineHeight:1.7, marginBottom:28 }}>
        You are now enrolled in{" "}
        <strong style={{ color:"#e2e8f0" }}>{teacherName}'s</strong> class.
        <br />
        You can now use your teacher's assignment codes to access practicals.
      </div>

      <div style={{ background:"#0d1b2e", border:"1px solid #1e3a5f", borderRadius:12,
        padding:"12px 16px", marginBottom:28, display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:20 }}>🎓</span>
        <div style={{ textAlign:"left" }}>
          <div style={{ color:"#94a3b8", fontSize:11, textTransform:"uppercase",
            letterSpacing:0.8, fontWeight:700, marginBottom:2 }}>Your Teacher</div>
          <div style={{ color:"#e2e8f0", fontWeight:800, fontSize:15 }}>{teacherName}</div>
        </div>
      </div>

      <button onClick={onDismiss} style={{
        width:"100%", padding:"13px 0", borderRadius:11, border:"none",
        background:"linear-gradient(135deg,#16a34a,#15803d)",
        color:"white", fontWeight:800, fontSize:15, cursor:"pointer",
        boxShadow:"0 4px 18px rgba(22,163,74,0.4)",
      }}>
        Continue to Lab →
      </button>
    </div>
  </div>
);

const LabSelection: React.FC<Props> = ({ onSelect, onTeacherPanel, onAssignment }) => {
  const [hovered,         setHovered]         = useState<string | null>(null);
  const [tokenInput,      setTokenInput]       = useState("");
  const [tokenError,      setTokenError]       = useState("");
  const [checking,        setChecking]         = useState(false);
  const [inviteSuccess,   setInviteSuccess]    = useState<{ teacherName: string } | null>(null);
  const [assignedTeacher, setAssignedTeacher]  = useState<string | null>(null);

  const currentUser = getCurrentUser();

  // Load the student's current class (falls back to teacher name) on mount
  useEffect(() => {
    if (currentUser?.role === "student") {
      getMyClass().then(r => setAssignedTeacher(r.assignedClassName ?? r.assignedTeacherName ?? null));
    }
  }, []);

  const handleTokenSubmit = async () => {
    const raw = tokenInput.trim().toUpperCase();
    if (!raw) { setTokenError("Please enter a code."); return; }
    setChecking(true);
    setTokenError("");

    try {
      // ── Class invitation code (CLS-XXXXXX) ───────────────────────────────
      if (isInviteCode(raw)) {
        const result = await redeemClassInvite(raw);
        const label = result.className ?? `${result.teacherName}'s class`;
        if (result.alreadyAssigned) {
          setTokenError(`You are already in ${label}.`);
          return;
        }
        if (result.success) {
          setAssignedTeacher(result.className ?? result.teacherName);
          setTokenInput("");
          setInviteSuccess({ teacherName: label });
          return;
        }
        setTokenError("Invalid class code. Ask your teacher for the correct code.");
        return;
      }

      // ── Assignment code (VC-XXXXXX / CC-XXXXXX) ──────────────────────────
      // Guard: student must have a teacher before using assignment codes
      if (!assignedTeacher) {
        setTokenError(
          "You must join a class first. Ask your teacher for a class invitation code (CLS-XXXXXX) and enter it here."
        );
        return;
      }

      const found = await findAssignment(raw);
      if (!found) {
        setTokenError("Assignment code not found. Check with your teacher and try again.");
        return;
      }
      if (isCodeExpired(found)) {
        const expDate = new Date(found.codeExpiresAt!).toLocaleString();
        setTokenError(`This assignment code expired on ${expDate}. Ask your teacher for a new one.`);
        return;
      }
      onAssignment?.(found);
    } catch (err: unknown) {
      setTokenError((err as Error).message ?? "Failed to validate code. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#060d18",
      display:"flex", flexDirection:"column", fontFamily:"system-ui,sans-serif" }}>

      {/* Invite success overlay */}
      {inviteSuccess && (
        <InviteSuccess
          teacherName={inviteSuccess.teacherName}
          onDismiss={() => setInviteSuccess(null)}
        />
      )}

      {/* ── Header ── */}
      <header style={{ background:"rgba(8,15,30,0.98)", borderBottom:"1px solid #1e293b",
        padding:"0 clamp(16px,3vw,40px)", display:"flex", alignItems:"center",
        justifyContent:"space-between", height:64, position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:38, height:38, borderRadius:10,
            background:"linear-gradient(135deg,#1d4ed8,#7c3aed)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>
            🧪
          </div>
          <div>
            <div style={{ color:"white", fontWeight:900, fontSize:"clamp(14px,1.5vw,17px)", letterSpacing:0.2 }}>
              Cream Formulation Virtual Laboratory
            </div>
            <div style={{ color:"#94a3b8", fontSize:11 }}>Pharmaceutical Chemistry · Emulsion Practicals</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {currentUser && (
            <div style={{ textAlign:"right" }}>
              <div style={{ color:"#e2e8f0", fontSize:12, fontWeight:700 }}>
                {currentUser.fullName}
              </div>
              <div style={{ color:"#94a3b8", fontSize:10, textTransform:"capitalize" }}>
                {currentUser.role}{currentUser.regNumber ? ` · ${currentUser.regNumber}` : ""}
                {assignedTeacher ? ` · 🎓 ${assignedTeacher}` : ""}
              </div>
            </div>
          )}
          {onTeacherPanel && (
            <button onClick={onTeacherPanel} style={{
              display:"flex", alignItems:"center", gap:7,
              background:"rgba(34,197,94,0.10)", border:"1px solid #22c55e44",
              color:"#22c55e", borderRadius:9, padding:"7px 14px",
              fontSize:12, fontWeight:600, cursor:"pointer", transition:"all .15s",
            }}>
              <span>🎓</span> Teacher Panel
            </button>
          )}
          {currentUser && (
            <button
              onClick={() => { logoutUser(); window.location.reload(); }}
              style={{
                background:"rgba(255,255,255,0.05)", border:"1px solid #334155",
                color:"#94a3b8", borderRadius:9, padding:"7px 14px",
                fontSize:12, fontWeight:600, cursor:"pointer",
              }}>
              Logout
            </button>
          )}
        </div>
      </header>

      {/* ── Code Entry ── */}
      <div style={{ background:"#080f1e", borderBottom:"1px solid #1e3a5f",
        padding:"20px clamp(16px,3vw,40px)" }}>
        <div style={{ maxWidth:700, margin:"0 auto" }}>

          {/* Teacher badge (if assigned) */}
          {assignedTeacher && (
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12,
              background:"rgba(34,197,94,0.08)", border:"1px solid #22c55e33",
              borderRadius:9, padding:"8px 14px", width:"fit-content" }}>
              <div style={{ width:20, height:20, borderRadius:"50%",
                background:"rgba(34,197,94,0.2)", border:"1.5px solid #22c55e",
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M2 5.5 L4.5 8 L9 3" stroke="#22c55e" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span style={{ color:"#22c55e", fontSize:12, fontWeight:700 }}>
                Enrolled in <strong>{assignedTeacher}</strong>'s class
              </span>
            </div>
          )}

          <div style={{ color:"#60a5fa", fontSize:11, fontWeight:700, letterSpacing:1.2,
            textTransform:"uppercase", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%",
              background: assignedTeacher ? "#22c55e" : "#f59e0b",
              boxShadow: `0 0 6px ${assignedTeacher ? "#22c55e" : "#f59e0b"}` }} />
            {assignedTeacher
              ? "Enter your Assignment Code or Class Invitation Code"
              : "Enter a Class Invitation Code to join your teacher's class"}
          </div>

          <div style={{ display:"flex", gap:10, alignItems:"flex-start", flexWrap:"wrap" }}>
            <div style={{ flex:1, minWidth:220 }}>
              <input
                value={tokenInput}
                onChange={e => { setTokenInput(e.target.value.toUpperCase()); setTokenError(""); }}
                onKeyDown={e => e.key === "Enter" && handleTokenSubmit()}
                placeholder={assignedTeacher ? "VC-XXXXXX  or  CLS-XXXXXX" : "CLS-XXXXXX  (class invite code)"}
                maxLength={10}
                style={{
                  width:"100%", background:"#0a1628",
                  border:`1.5px solid ${tokenError ? "#ef4444" : tokenInput ? "#2563eb" : "#1e3a5f"}`,
                  color:"#e2e8f0", borderRadius:10, padding:"12px 16px",
                  fontSize:18, fontWeight:700, letterSpacing:3,
                  fontFamily:"monospace", boxSizing:"border-box", outline:"none",
                  textTransform:"uppercase", transition:"border-color .15s",
                }}
              />
              {tokenError && (
                <div style={{ color:"#ef4444", fontSize:12, marginTop:5 }}>⚠ {tokenError}</div>
              )}
            </div>
            <button
              onClick={handleTokenSubmit}
              disabled={checking}
              style={{
                padding:"12px 24px", background: checking ? "#1e293b" : "#2563eb",
                color:"white", border:"none", borderRadius:10, cursor: checking ? "not-allowed" : "pointer",
                fontWeight:700, fontSize:14, flexShrink:0, transition:"background .15s",
              }}>
              {checking ? "Checking…" : "Enter →"}
            </button>
          </div>

          <div style={{ color:"#94a3b8", fontSize:11, marginTop:8, lineHeight:1.6 }}>
            {assignedTeacher
              ? <>Assignment codes look like <code style={{ color:"#94a3b8" }}>VC-XXXXXX</code> · Invitation codes look like <code style={{ color:"#94a3b8" }}>CLS-XXXXXX</code></>
              : <>Ask your teacher for a class invitation code (starts with <code style={{ color:"#94a3b8" }}>CLS-</code>) to join their class before accessing assignments.</>}
          </div>
        </div>
      </div>

      {/* ── Hero ── */}
      <div style={{ background:"linear-gradient(180deg,#0d1b2e 0%,#060d18 60%)",
        padding:"clamp(32px,5vw,56px) clamp(16px,3vw,40px) clamp(28px,4vw,44px)", textAlign:"center", borderBottom:"1px solid #1e293b",
        position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-60, left:"10%", width:300, height:300,
          borderRadius:"50%", background:"rgba(59,130,246,0.04)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", bottom:-80, right:"8%", width:350, height:350,
          borderRadius:"50%", background:"rgba(139,92,246,0.04)", pointerEvents:"none" }} />

        <div style={{ display:"inline-block", background:"rgba(59,130,246,0.1)",
          border:"1px solid rgba(59,130,246,0.3)", borderRadius:20, padding:"5px 18px",
          color:"#60a5fa", fontSize:12, fontWeight:700, letterSpacing:1.2,
          textTransform:"uppercase", marginBottom:18 }}>
          Pharmaceutical Cream &amp; Emulsion Formulation
        </div>

        <h1 style={{ color:"white", fontSize:"clamp(24px,3.5vw,40px)", fontWeight:900, margin:"0 0 16px",
          lineHeight:1.15, letterSpacing:-0.5 }}>
          Self-Practice{" "}
          <span style={{ background:"linear-gradient(135deg,#60a5fa,#a78bfa)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            Lab Mode
          </span>
        </h1>
        <p style={{ color:"#94a3b8", fontSize:"clamp(13px,1.2vw,15px)", maxWidth:"min(580px,90vw)", margin:"0 auto",
          lineHeight:1.75 }}>
          Use these practicals for <strong style={{ color:"#94a3b8" }}>self-training</strong>.
          For a teacher assignment, enter your code above.
          Data from self-practice is stored locally on your device.
        </p>
      </div>

      {/* ── Cards ── */}
      <div className="lab-select-grid" style={{ flex:1, padding:"clamp(24px,3vw,44px) clamp(16px,3vw,40px) clamp(32px,4vw,56px)",
        maxWidth:1200, margin:"0 auto", width:"100%", alignContent:"start" }}>

        {PRACTICALS.map(p => {
          const diff  = DIFF_COLOR[p.difficulty];
          const isHov = hovered === p.id && p.available;

          return (
            <div key={p.id}
              onMouseEnter={() => setHovered(p.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: p.bgGradient,
                border:`1.5px solid ${isHov ? p.accentColor : "#1e293b"}`,
                borderRadius:20, overflow:"hidden",
                cursor: p.available ? "pointer" : "default",
                transition:"all 0.22s ease",
                transform: isHov ? "translateY(-4px)" : "none",
                boxShadow: isHov
                  ? `0 16px 48px rgba(0,0,0,0.65), 0 0 0 1px ${p.accentColor}44`
                  : "0 4px 24px rgba(0,0,0,0.45)",
                opacity: !p.available ? 0.72 : 1,
              }}>

              <div style={{ padding:"clamp(16px,2vw,24px) clamp(16px,2vw,26px) 18px",
                borderBottom:`1px solid ${p.accentColor}20`,
                display:"flex", gap:18, alignItems:"flex-start" }}>
                <div style={{ flexShrink:0, width:86, height:86,
                  background:"rgba(255,255,255,0.04)", borderRadius:16,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  border:"1px solid rgba(255,255,255,0.06)" }}>
                  {p.icon}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7 }}>
                    <span style={{ color:"white", fontWeight:900, fontSize:"clamp(16px,1.6vw,20px)" }}>{p.title}</span>
                    {!p.available && (
                      <span style={{ background:"#1e293b", border:"1px solid #334155",
                        color:"#94a3b8", fontSize:9, fontWeight:700, borderRadius:10,
                        padding:"2px 8px", letterSpacing:0.8, textTransform:"uppercase" }}>
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <div style={{ color:p.accentColor, fontSize:13, fontWeight:600, marginBottom:10 }}>
                    {p.subtitle}
                  </div>
                  <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                    <span style={{ background:diff.bg, border:`1px solid ${diff.border}`,
                      color:diff.text, fontSize:10, fontWeight:700, borderRadius:10, padding:"2px 10px" }}>
                      {p.difficulty}
                    </span>
                    <span style={{ background:"rgba(255,255,255,0.05)", border:"1px solid #334155",
                      color:"#94a3b8", fontSize:10, fontWeight:600, borderRadius:10, padding:"2px 10px" }}>
                      {p.type}
                    </span>
                    <span style={{ background:"rgba(255,255,255,0.05)", border:"1px solid #334155",
                      color:"#94a3b8", fontSize:10, fontWeight:600, borderRadius:10, padding:"2px 10px" }}>
                      ⏱ {p.duration}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ padding:"16px 26px 12px" }}>
                <p style={{ color:"#94a3b8", fontSize:13, lineHeight:1.75, margin:0 }}>
                  {p.description}
                </p>
              </div>

              <div style={{ padding:"0 26px 14px" }}>
                <div style={{ color:"#94a3b8", fontSize:10, fontWeight:700,
                  letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>Chemicals</div>
                <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                  {p.chemicals.map(c => (
                    <div key={c.name} style={{ display:"flex", alignItems:"center", gap:6,
                      background:"rgba(255,255,255,0.04)", border:"1px solid #1e293b",
                      borderRadius:20, padding:"4px 10px" }}>
                      <div style={{ width:11, height:11, borderRadius:"50%",
                        background:c.color, border:"1px solid rgba(255,255,255,0.2)", flexShrink:0 }} />
                      <span style={{ color:"#94a3b8", fontSize:11 }}>{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding:"0 26px 16px" }}>
                <div style={{ color:"#94a3b8", fontSize:10, fontWeight:700,
                  letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>What you will learn</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {p.learnings.map(l => (
                    <span key={l} style={{ background:"rgba(255,255,255,0.03)",
                      border:"1px solid #1e293b", borderRadius:6,
                      color:"#94a3b8", fontSize:11, padding:"2px 9px" }}>{l}</span>
                  ))}
                </div>
              </div>

              <div style={{ margin:"0 26px 18px", background:"rgba(255,255,255,0.03)",
                border:`1px solid ${p.accentColor}22`, borderRadius:10, padding:"9px 13px" }}>
                <span style={{ color:"#94a3b8", fontSize:10, fontWeight:700 }}>Expected outcome: </span>
                <span style={{ color:"#94a3b8", fontSize:11 }}>{p.outcome}</span>
              </div>

              <div style={{ padding:"0 26px 24px" }}>
                <button
                  onClick={() => p.available && onSelect(p.id)}
                  disabled={!p.available}
                  style={{
                    width:"100%", padding:"14px 0", borderRadius:12, border:"none",
                    cursor: p.available ? "pointer" : "not-allowed",
                    fontWeight:800, fontSize:14, letterSpacing:0.5,
                    background: p.available
                      ? `linear-gradient(135deg,${p.accentColor},${p.accentColor}bb)`
                      : "#1e293b",
                    color: p.available ? "white" : "#4b5563",
                    boxShadow: p.available && isHov ? `0 6px 24px ${p.accentColor}55` : "none",
                    transition:"all 0.15s",
                  }}>
                  {p.available ? "▶  Start Practical" : "🔒  Coming Soon"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <footer style={{ borderTop:"1px solid #1e293b", padding:"14px clamp(16px,3vw,40px)",
        display:"flex", justifyContent:"center" }}>
        <span style={{ color:"#1e293b", fontSize:12 }}>
          Cream Formulation Virtual Laboratory — Pharmaceutical Chemistry
        </span>
      </footer>
    </div>
  );
};

export default LabSelection;
