import React, { useState } from "react";
import {
  FlaskConical, Sun, Moon, ArrowLeft, Mail, Lock, User as UserIcon,
  Hash, GraduationCap, Users, Eye, EyeOff, AlertCircle, CheckCircle,
  ArrowRight,
} from "lucide-react";
import { User, ThemeMode, registerUser, loginUser } from "../utils/userStore";

// ─────────────────────────────────────────────────────────────────────────────
// Palette (light + dark)
// ─────────────────────────────────────────────────────────────────────────────
const DARK = {
  bg:       "#0a0a0a",
  surface:  "#121212",
  card:     "#161616",
  input:    "#0f0f0f",
  border:   "#262626",
  borderHi: "#404040",
  pri:      "#fafafa",
  sec:      "#a3a3a3",
  mut:      "#525252",
  green:    "#22c55e",
  greenHi:  "#16a34a",
  greenBg:  "rgba(34,197,94,0.10)",
  red:      "#ef4444",
} as const;

const LIGHT = {
  bg:       "#ffffff",
  surface:  "#fafafa",
  card:     "#ffffff",
  input:    "#f9fafb",
  border:   "#e5e5e5",
  borderHi: "#d4d4d4",
  pri:      "#0a0a0a",
  sec:      "#525252",
  mut:      "#9ca3af",
  green:    "#10b981",
  greenHi:  "#059669",
  greenBg:  "rgba(16,185,129,0.08)",
  red:      "#dc2626",
} as const;

type Colors = typeof DARK;
type Role   = "teacher" | "student";
type Mode   = "signin" | "signup";

// ─────────────────────────────────────────────────────────────────────────────
// Field — defined at MODULE LEVEL so React never re-mounts it on re-render
// ─────────────────────────────────────────────────────────────────────────────
interface FieldProps {
  C:            Colors;
  Icon:         React.FC<{ size?: number; strokeWidth?: number; color?: string }>;
  label:        string;
  type?:        string;
  value:        string;
  onChange:     (v: string) => void;
  placeholder:  string;
  rightSlot?:   React.ReactNode;
  autoComplete?: string;
  required?:    boolean;
}

const Field: React.FC<FieldProps> = ({
  C, Icon, label, type = "text", value, onChange,
  placeholder, rightSlot, autoComplete, required = true,
}) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{
      display: "block", fontSize: 11, fontWeight: 700, color: C.mut,
      textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 7,
    }}>
      {label}
    </label>
    <div style={{ position: "relative" }}>
      <span style={{
        position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)",
        display: "flex", color: C.mut, pointerEvents: "none", zIndex: 1,
      }}>
        <Icon size={16} strokeWidth={2} />
      </span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        style={{
          width: "100%",
          background: C.input,
          border: `1.5px solid ${C.border}`,
          color: C.pri,
          borderRadius: 10,
          padding: rightSlot ? "12px 44px 12px 40px" : "12px 14px 12px 40px",
          fontSize: 14,
          outline: "none",
          boxSizing: "border-box",
          fontFamily: "inherit",
        }}
        onFocus={e  => (e.currentTarget.style.borderColor = C.green)}
        onBlur={ e  => (e.currentTarget.style.borderColor = C.border)}
      />
      {rightSlot && (
        <div style={{
          position: "absolute", right: 8, top: "50%",
          transform: "translateY(-50%)",
        }}>
          {rightSlot}
        </div>
      )}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// AuthPage
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  initialMode?:   Mode;
  onAuth:         (user: User) => void;
  onBack:         () => void;
  theme:          ThemeMode;
  onToggleTheme:  () => void;
}

const AuthPage: React.FC<Props> = ({
  initialMode = "signup", onAuth, onBack, theme, onToggleTheme,
}) => {
  const C = theme === "dark" ? DARK : LIGHT;

  const [mode,           setMode]           = useState<Mode>(initialMode);
  const [role,           setRole]           = useState<Role>("student");
  const [fullName,       setFullName]       = useState("");
  const [email,          setEmail]          = useState("");
  const [regNumber,      setRegNumber]      = useState("");
  const [password,       setPassword]       = useState("");
  const [showPass,       setShowPass]       = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [pendingName,     setPendingName]     = useState("");

  const clearForm = () => {
    setFullName(""); setEmail(""); setRegNumber(""); setPassword("");
    setError(null); setShowPass(false);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    clearForm();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    setTimeout(() => {
      const result =
        mode === "signup"
          ? registerUser({ role, fullName, email, password, regNumber })
          : loginUser(email, password);

      if (!result.ok) {
        setError(result.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      // Teacher self-registration → pending approval screen (not logged in yet)
      if (result.pending) {
        setPendingName(result.user!.fullName);
        setPendingApproval(true);
        setLoading(false);
        return;
      }

      onAuth(result.user!);
    }, 400);
  };

  const passOk = password.length >= 6;

  // ── Pending approval screen ────────────────────────────────────────────────
  if (pendingApproval) {
    return (
      <div style={{
        minHeight:"100vh", background:C.bg, color:C.pri,
        fontFamily:"system-ui,-apple-system,sans-serif",
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        padding:"24px",
      }}>
        <div style={{
          width:"100%", maxWidth:460,
          background:C.card, border:`1px solid ${C.border}`,
          borderRadius:20, padding:"40px 36px", textAlign:"center",
          boxShadow: theme==="dark" ? "0 24px 60px rgba(0,0,0,0.6)" : "0 12px 48px rgba(0,0,0,0.08)",
        }}>
          {/* Icon */}
          <div style={{
            width:72, height:72, borderRadius:"50%", margin:"0 auto 20px",
            background:"rgba(234,179,8,0.12)", border:"2px solid rgba(234,179,8,0.4)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:34,
          }}>⏳</div>

          <h2 style={{ margin:"0 0 10px", fontSize:22, fontWeight:900, letterSpacing:-0.3 }}>
            Awaiting Admin Approval
          </h2>
          <p style={{ color:C.sec, fontSize:14, lineHeight:1.7, margin:"0 0 24px" }}>
            Hi <strong style={{ color:C.pri }}>{pendingName}</strong>, your teacher account
            has been created and is waiting for the administrator to verify and approve it.
          </p>

          {/* Info box */}
          <div style={{
            background: theme==="dark" ? "rgba(234,179,8,0.08)" : "rgba(234,179,8,0.06)",
            border:"1px solid rgba(234,179,8,0.3)", borderRadius:12,
            padding:"16px 18px", marginBottom:24, textAlign:"left",
          }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#ca8a04",
              textTransform:"uppercase", letterSpacing:0.8, marginBottom:10 }}>
              What happens next?
            </div>
            {[
              "The admin will review your registration details.",
              "Once approved, you can sign in with your email and password.",
              "If rejected, you will be notified on the login screen.",
            ].map((s, i) => (
              <div key={i} style={{ display:"flex", gap:10, marginBottom:7,
                fontSize:13, color:C.sec }}>
                <span style={{ color:"#ca8a04", fontWeight:700, flexShrink:0 }}>{i+1}.</span>
                <span>{s}</span>
              </div>
            ))}
          </div>

          <button onClick={onBack} style={{
            width:"100%", padding:"13px 0", borderRadius:10, border:"none",
            background:C.green, color:"white", fontWeight:800, fontSize:15,
            cursor:"pointer", letterSpacing:0.3,
          }}>
            Back to Home
          </button>
          <p style={{ color:C.mut, fontSize:12, marginTop:14 }}>
            Already approved?{" "}
            <button onClick={() => { setPendingApproval(false); switchMode("signin"); }}
              style={{ background:"none", border:"none", color:C.green,
                fontWeight:700, cursor:"pointer", padding:0, fontSize:12 }}>
              Sign in here
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      color: C.pri,
      fontFamily: "system-ui, -apple-system, sans-serif",
      transition: "background .25s, color .25s",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Dot-grid background */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `radial-gradient(${C.border} 1px, transparent 1px)`,
        backgroundSize: "32px 32px",
        opacity: theme === "dark" ? 0.4 : 0.45,
        maskImage: "radial-gradient(ellipse at center, black 0%, transparent 70%)",
        WebkitMaskImage: "radial-gradient(ellipse at center, black 0%, transparent 70%)",
      }} />

      {/* ── Top bar ── */}
      <div style={{
        position: "relative", display: "flex", alignItems: "center",
        justifyContent: "space-between",
        padding: "18px clamp(16px,3vw,32px)",
      }}>
        <button onClick={onBack} style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "transparent", border: "none",
          color: C.sec, fontSize: 13, fontWeight: 600,
          cursor: "pointer", padding: "8px 12px", borderRadius: 8,
        }}>
          <ArrowLeft size={16} /> Back to Home
        </button>

        <button onClick={onToggleTheme} aria-label="Toggle theme" style={{
          width: 38, height: 38, borderRadius: 10, cursor: "pointer",
          background: "transparent", border: `1px solid ${C.border}`,
          color: C.pri, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* ── Card ── */}
      <div style={{
        position: "relative",
        display: "flex", justifyContent: "center",
        padding: "12px clamp(16px,3vw,32px) 60px",
      }}>
        <div style={{
          width: "100%", maxWidth: 460,
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 20,
          padding: "32px clamp(20px,3vw,36px)",
          boxShadow: theme === "dark"
            ? "0 24px 60px rgba(0,0,0,0.6)"
            : "0 12px 48px rgba(0,0,0,0.08)",
        }}>

          {/* Logo + title */}
          <div style={{ textAlign: "center", marginBottom: 26 }}>
            <div style={{
              width: 54, height: 54, borderRadius: 14,
              background: C.green,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              marginBottom: 14,
            }}>
              <FlaskConical size={26} color="white" strokeWidth={2.4} />
            </div>
            <h1 style={{
              fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 5, letterSpacing: -0.4,
            }}>
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </h1>
            <p style={{ color: C.sec, fontSize: 13, margin: 0, lineHeight: 1.6 }}>
              {mode === "signup"
                ? "Join the cream formulation virtual lab."
                : "Sign in to continue your lab session."}
            </p>
          </div>

          {/* ── Role selector (signup only) ── */}
          {mode === "signup" && (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: C.mut,
                textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8,
              }}>
                I am a
              </div>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: 4,
              }}>
                {([
                  { id: "student", label: "Student", Icon: Users          },
                  { id: "teacher", label: "Teacher", Icon: GraduationCap  },
                ] as { id: Role; label: string; Icon: React.FC<{ size?: number; strokeWidth?: number }> }[]).map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    style={{
                      padding: "9px 12px", borderRadius: 9, border: "none",
                      cursor: "pointer", fontWeight: 700, fontSize: 13,
                      display: "flex", alignItems: "center",
                      justifyContent: "center", gap: 6,
                      background: role === r.id ? C.green : "transparent",
                      color:      role === r.id ? "white" : C.sec,
                      transition: "background .15s, color .15s",
                    }}>
                    <r.Icon size={14} strokeWidth={2.2} /> {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} noValidate>

            {/* Full Name — signup only */}
            {mode === "signup" && (
              <Field
                C={C} Icon={UserIcon}
                label="Full Name"
                value={fullName}
                onChange={setFullName}
                placeholder="e.g. Amara Nkosi"
                autoComplete="name"
              />
            )}

            {/* Registration Number — students signing up only */}
            {mode === "signup" && role === "student" && (
              <Field
                C={C} Icon={Hash}
                label="Registration Number"
                value={regNumber}
                onChange={setRegNumber}
                placeholder="e.g. T23-001"
                autoComplete="off"
              />
            )}


            {/* Email */}
            <Field
              C={C} Icon={Mail}
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@school.edu"
              autoComplete={mode === "signup" ? "email" : "username"}
            />

            {/* Password */}
            <Field
              C={C} Icon={Lock}
              label="Password"
              type={showPass ? "text" : "password"}
              value={password}
              onChange={setPassword}
              placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                  style={{
                    background: "transparent", border: "none", color: C.mut,
                    cursor: "pointer", padding: "8px 10px",
                    display: "flex", alignItems: "center",
                  }}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />

            {/* Password strength hint (signup) */}
            {mode === "signup" && password.length > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 12, marginTop: -8, marginBottom: 14,
                color: passOk ? C.green : C.mut,
              }}>
                {passOk
                  ? <><CheckCircle size={13} strokeWidth={2.5} /> Strong enough</>
                  : <><AlertCircle size={13} strokeWidth={2.5} /> Need at least 6 characters</>}
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div style={{
                background: theme === "dark"
                  ? "rgba(239,68,68,0.10)"
                  : "rgba(220,38,38,0.06)",
                border: `1px solid ${C.red}55`,
                borderRadius: 10, padding: "10px 14px",
                color: C.red, fontSize: 13, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 8,
                marginBottom: 14,
              }}>
                <AlertCircle size={15} strokeWidth={2.4} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "13px 16px",
                background: loading ? C.borderHi : C.green,
                color: "white", border: "none",
                borderRadius: 11, fontSize: 14, fontWeight: 800,
                cursor: loading ? "wait" : "pointer",
                display: "flex", alignItems: "center",
                justifyContent: "center", gap: 7,
                marginTop: 4,
                transition: "background .15s",
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = C.greenHi; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = C.green; }}
            >
              {loading
                ? "Please wait…"
                : mode === "signup"
                  ? <><span>Create Account</span><ArrowRight size={15} strokeWidth={2.5} /></>
                  : <><span>Sign In</span><ArrowRight size={15} strokeWidth={2.5} /></>}
            </button>
          </form>

          {/* Switch mode */}
          <div style={{
            marginTop: 22, paddingTop: 18,
            borderTop: `1px solid ${C.border}`,
            textAlign: "center", color: C.sec, fontSize: 13,
          }}>
            {mode === "signup"
              ? "Already have an account? "
              : "Don't have an account? "}
            <button
              type="button"
              onClick={() => switchMode(mode === "signup" ? "signin" : "signup")}
              style={{
                background: "transparent", border: "none",
                color: C.green, fontWeight: 700, fontSize: 13,
                cursor: "pointer", textDecoration: "underline", padding: 0,
              }}
            >
              {mode === "signup" ? "Sign in" : "Create account"}
            </button>
          </div>

          {/* Role-based hint for students */}
          {mode === "signup" && role === "student" && (
            <div style={{
              marginTop: 14, padding: "10px 14px",
              background: C.greenBg, border: `1px solid ${C.green}33`,
              borderRadius: 9, fontSize: 12, color: C.sec, lineHeight: 1.6,
            }}>
              <strong style={{ color: C.green }}>Students</strong> — use your institution
              registration number (e.g. <code style={{ color: C.green }}>T23-001</code>).
              Your teacher will share assignment codes for the practicals.
            </div>
          )}
          {mode === "signup" && role === "teacher" && (
            <div style={{
              marginTop: 14, padding: "10px 14px",
              background: C.greenBg, border: `1px solid ${C.green}33`,
              borderRadius: 9, fontSize: 12, color: C.sec, lineHeight: 1.6,
            }}>
              <strong style={{ color: C.green }}>Teachers</strong> — create assignments,
              generate codes for students, and track results from your dashboard.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
