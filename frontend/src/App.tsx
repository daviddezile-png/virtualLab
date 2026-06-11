import { useState, useEffect } from "react";
import { SimulationStep } from "./simulation/model/types";
import InteractiveLabCanvas from "./components/InteractiveLabCanvas";
import LabSelection from "./components/LabSelection";
import PreLabNotebook from "./components/PreLabNotebook";
import TeacherPanel from "./components/TeacherPanel";
import AdminPanel from "./components/AdminPanel";
import AssignmentBanner from "./components/AssignmentBanner";
import CountdownTimer from "./components/CountdownTimer";
import LandingPage from "./components/LandingPage";
import AuthPage from "./components/AuthPage";
import StudentQAPanel from "./components/StudentQAPanel";
import SessionWarning from "./components/SessionWarning";
import { useSessionTimeout } from "./hooks/useSessionTimeout";
import { Assignment } from "./utils/assignmentStore";
import { logLabStarted, logCodeEntered } from "./utils/auditStore";
import { getAllSubmissions } from "./utils/submissionStore";
import type { LabSubmission } from "./utils/submissionStore";
import { getQuestionsForPractical } from "./utils/qaStore";
import {
  User, getCurrentUser, logoutUser,
  ThemeMode, getStoredTheme, storeTheme,
} from "./utils/userStore";
import "./App.css";

// ── One-time migration: remove old localStorage keys from the localStorage era ─
const OLD_KEYS = [
  "vlab_users", "vlab_submissions", "vlab_assignments",
  "vlab_qa_questions", "vlab_qa_answers", "vlab_announcements",
  "vlab_audit_log", "vlab_suspended", "vlab_sessions",
];
if (!localStorage.getItem("vlab_migrated_v2")) {
  OLD_KEYS.forEach(k => localStorage.removeItem(k));
  localStorage.setItem("vlab_migrated_v2", "1");
}

type AppState = "landing" | "auth" | "selection" | "pre-lab" | "lab" | "teacher" | "admin";

function App() {
  // ── Theme (persisted) ────────────────────────────────────────────────────
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme());
  const toggleTheme = () => {
    setTheme(prev => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      storeTheme(next);
      return next;
    });
  };

  // ── User session ─────────────────────────────────────────────────────────
  const [user, setUser] = useState<User | null>(getCurrentUser());

  // ── App state — derived from user on mount ───────────────────────────────
  const [appState, setAppState] = useState<AppState>(() => {
    const u = getCurrentUser();
    if (!u) return "landing";
    // Pending/rejected teachers who somehow have a session are kicked out
    if (u.role === "teacher" && (u.status === "pending" || u.status === "rejected")) {
      logoutUser();
      return "landing";
    }
    if (u.role === "admin")   return "admin";
    if (u.role === "teacher") return "teacher";
    return "selection";
  });

  const [authMode,          setAuthMode]          = useState<"signup" | "signin">("signup");
  const [selectedPractical, setSelectedPractical] = useState("vanishing-cream");
  const [activeAssignment,  setActiveAssignment]  = useState<Assignment | null>(null);
  const [sessionStartAt,    setSessionStartAt]    = useState<number | null>(null);
  const [labExpired,        setLabExpired]        = useState(false);
  const [showQAPanel,       setShowQAPanel]       = useState(false);
  const currentStep = SimulationStep.SELECTION;

  const [latestSubmission,  setLatestSubmission]  = useState<LabSubmission | null>(null);
  const [hasQAQuestions,    setHasQAQuestions]    = useState(false);

  // Reload latest submission and Q&A availability whenever practical or appState changes
  useEffect(() => {
    if (appState !== "lab" || !user) return;
    const uid = (user as User).clientId ?? "";
    getAllSubmissions().then(subs => {
      const match = subs
        .filter(s => s.studentId === uid && s.practicalId === selectedPractical)
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      setLatestSubmission(match[0] ?? null);
    });
    getQuestionsForPractical(selectedPractical).then(qs => setHasQAQuestions(qs.length > 0));
  }, [appState, selectedPractical, user]);

  useEffect(() => {
    const sync = () => setUser(getCurrentUser());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const practicalLabel = selectedPractical === "cold-cream"
    ? "Cold Cream — W/O Emulsion"
    : "Vanishing Cream — O/W Emulsion";

  const isAssignmentMode = activeAssignment !== null;

  // ── All handlers defined in dependency order ─────────────────────────────

  // Fully reset to landing (logout)
  const handleLogout = () => {
    logoutUser();
    setUser(null);
    setActiveAssignment(null);
    setSessionStartAt(null);
    setLabExpired(false);
    setAppState("landing");
  };

  // Session timeout — only active when a user is logged in
  const isLoggedIn = appState !== "landing" && appState !== "auth";
  const { showWarning, remaining, stayLoggedIn } = useSessionTimeout(
    isLoggedIn ? handleLogout : () => {}
  );

  const handleAuth = (u: User) => {
    setUser(u);
    if (u.role === "admin")   setAppState("admin");
    else if (u.role === "teacher") setAppState("teacher");
    else setAppState("selection");
  };

  const handleAssignment = (assignment: Assignment) => {
    setActiveAssignment(assignment);
    setSelectedPractical(assignment.practicalId);
    setLabExpired(false);
    logCodeEntered(assignment.token, assignment.practicalId);

    // Timer starts the moment the student redeems the code — not when they click
    // "Start Lab". The server provides the authoritative startedAt timestamp so
    // it persists across devices and page refreshes.
    if (assignment.timeLimitMinutes > 0) {
      const t = assignment.startedAt ?? Date.now();
      setSessionStartAt(t);
      // Cache in localStorage so the pre-lab page and lab canvas can read it
      // without an extra API call.
      try { localStorage.setItem(`vlab_timer_${assignment.token}`, String(t)); } catch { /* ignore */ }
      // Already expired before even reaching the pre-lab? Lock immediately.
      if (Date.now() - t >= assignment.timeLimitMinutes * 60 * 1000) {
        setLabExpired(true);
      }
    }

    setAppState("pre-lab");
  };

  // Called when student clicks "Start Lab" from the pre-lab notebook
  const handleLabStart = () => {
    logLabStarted(selectedPractical, activeAssignment ? "assignment" : "practice");

    // sessionStartAt was already set at code entry — just re-check expiry in case
    // the student spent a long time in the pre-lab notebook.
    if (activeAssignment && activeAssignment.timeLimitMinutes > 0) {
      const t = sessionStartAt ?? activeAssignment.startedAt ?? Date.now();
      setSessionStartAt(t);
      if (Date.now() - t >= activeAssignment.timeLimitMinutes * 60 * 1000) {
        setLabExpired(true);
      }
    }

    setAppState("lab");
  };

  const handleLabExpire = () => {
    setLabExpired(true);
    // TODO: POST /api/sessions/expire when backend is ready
  };

  // ── Routes ────────────────────────────────────────────────────────────────
  if (appState === "landing") {
    return (
      <LandingPage
        theme={theme}
        onToggleTheme={toggleTheme}
        onSignIn={()      => { setAuthMode("signin"); setAppState("auth"); }}
        onGetStarted={()  => { setAuthMode("signup"); setAppState("auth"); }}
      />
    );
  }

  if (appState === "auth") {
    return (
      <AuthPage
        theme={theme}
        onToggleTheme={toggleTheme}
        initialMode={authMode}
        onBack={() => setAppState("landing")}
        onAuth={handleAuth}
      />
    );
  }

  if (appState === "admin") {
    return (
      <>
        <AdminPanel onLogout={handleLogout} />
        {showWarning && <SessionWarning remaining={remaining} onStay={stayLoggedIn} onLogout={handleLogout} />}
      </>
    );
  }

  if (appState === "teacher") {
    return (
      <>
        <TeacherPanel onBack={handleLogout} />
        {showWarning && <SessionWarning remaining={remaining} onStay={stayLoggedIn} onLogout={handleLogout} />}
      </>
    );
  }

  if (appState === "selection") {
    return (
      <LabSelection
        onSelect={id => {
          setActiveAssignment(null);
          setSelectedPractical(id);
          setAppState("pre-lab");
        }}
        onTeacherPanel={user?.role === "teacher" ? () => setAppState("teacher") : undefined}
        onAssignment={handleAssignment}
      />
    );
  }

  if (appState === "pre-lab") {
    const hasTimer = activeAssignment && (activeAssignment.timeLimitMinutes ?? 0) > 0 && sessionStartAt !== null;
    return (
      <div style={{ position: "relative" }}>
        {/* Floating timer banner — only shown when assignment has a time limit */}
        {hasTimer && !labExpired && (
          <div style={{
            position: "fixed", top: 12, right: 16, zIndex: 999,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <CountdownTimer
              timeLimitMinutes={activeAssignment!.timeLimitMinutes}
              sessionStartAt={sessionStartAt!}
              onExpire={() => { setLabExpired(true); handleLabStart(); }}
            />
          </div>
        )}
        {labExpired && hasTimer && (
          <div style={{
            position: "fixed", top: 12, right: 16, zIndex: 999,
            background: "rgba(239,68,68,0.15)", border: "1px solid #ef444466",
            borderRadius: 10, padding: "5px 14px", color: "#f87171",
            fontSize: 12, fontWeight: 700,
          }}>
            ⏰ Time expired
          </div>
        )}
        <PreLabNotebook
          practicalId={selectedPractical}
          onStart={handleLabStart}
          onBack={() => {
            setAppState("selection");
            setActiveAssignment(null);
            setSessionStartAt(null);
            setLabExpired(false);
          }}
        />
      </div>
    );
  }

  // ── Lab view ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"#060d18",
      display:"flex", flexDirection:"column", fontFamily:"system-ui,sans-serif" }}>

      <header style={{
        background:"rgba(8,15,30,0.98)", borderBottom:"1px solid #1e293b",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        height:56, padding:"0 20px", zIndex:10, flexShrink:0,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={() => setAppState("pre-lab")} style={{
            background:"#1e293b", border:"1px solid #334155", borderRadius:8,
            color:"#94a3b8", padding:"6px 12px", cursor:"pointer", fontSize:12, fontWeight:600,
          }}>← Notebook</button>
          <div style={{ width:1, height:24, background:"#1e293b" }} />
          <div style={{ width:28, height:28, borderRadius:8,
            background: selectedPractical === "cold-cream"
              ? "linear-gradient(135deg,#6d28d9,#4c1d95)"
              : "linear-gradient(135deg,#1d4ed8,#7c3aed)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🧪
          </div>
          <div>
            <div style={{ color:"white", fontWeight:800, fontSize:14 }}>{practicalLabel}</div>
            <div style={{ color:"#475569", fontSize:10 }}>
              {user ? `${user.fullName} · ${user.role}` : "Cream Formulation Virtual Laboratory"}
            </div>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {isAssignmentMode && (
            <div style={{ background:"rgba(37,99,235,0.15)", border:"1px solid #2563eb66",
              borderRadius:20, padding:"3px 12px", color:"#60a5fa",
              fontSize:11, fontWeight:700, display:"flex", alignItems:"center", gap:5 }}>
              📋 <code style={{ letterSpacing:1 }}>{activeAssignment!.token}</code>
            </div>
          )}

          {/* Countdown timer */}
          {isAssignmentMode && sessionStartAt !== null &&
           (activeAssignment!.timeLimitMinutes ?? 0) > 0 && !labExpired && (
            <CountdownTimer
              timeLimitMinutes={activeAssignment!.timeLimitMinutes}
              sessionStartAt={sessionStartAt}
              onExpire={handleLabExpire}
            />
          )}

          {labExpired && (
            <div style={{ background:"rgba(239,68,68,0.15)", border:"1px solid #ef444466",
              borderRadius:20, padding:"3px 14px", color:"#f87171", fontSize:11, fontWeight:700 }}>
              ⏰ Session Expired
            </div>
          )}

          {/* Q&A Button — shows when questions exist for this practical */}
          {hasQAQuestions && user?.role === "student" && (
            <button
              onClick={() => setShowQAPanel(true)}
              style={{
                display:"flex", alignItems:"center", gap:6,
                background:"rgba(167,139,250,0.15)", border:"1px solid #a78bfa66",
                borderRadius:10, padding:"6px 14px",
                color:"#a78bfa", fontSize:12, fontWeight:700, cursor:"pointer",
                transition:"background .15s",
              }}>
              📝 Q&amp;A
            </button>
          )}

          <div style={{ background:"#052e16", border:"1px solid #16a34a",
            borderRadius:20, padding:"3px 12px", color:"#4ade80", fontSize:11, fontWeight:700 }}>
            ● {isAssignmentMode ? "Assignment Session" : "Self-Practice"}
          </div>

          {user && (
            <button onClick={handleLogout} style={{
              background:"#1e293b", border:"1px solid #334155", borderRadius:8,
              color:"#94a3b8", padding:"6px 12px", cursor:"pointer", fontSize:12, fontWeight:600,
            }}>Logout</button>
          )}
        </div>
      </header>

      {isAssignmentMode && <AssignmentBanner assignment={activeAssignment!} />}

      {/* Student Q&A Panel */}
      {showQAPanel && user && (
        <StudentQAPanel
          practicalId={selectedPractical}
          currentUser={user}
          submission={latestSubmission}
          onClose={() => setShowQAPanel(false)}
        />
      )}

      {showWarning && <SessionWarning remaining={remaining} onStay={stayLoggedIn} onLogout={handleLogout} />}

      <div className="lab-canvas-wrap" style={{ overflowX:"auto", overflowY:"hidden", flex:1 }}>
        <div style={{ minWidth:1200, height:"100%" }}>
          <InteractiveLabCanvas
            currentStep={currentStep}
            onApparatusClick={() => {}}
            practicalId={selectedPractical}
            assignment={activeAssignment}
            labExpired={labExpired}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
