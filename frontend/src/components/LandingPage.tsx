import React from "react";
import {
  FlaskConical, ArrowRight, Sun, Moon, Beaker, Sparkles, GraduationCap,
  Users, TrendingUp, Zap, Check,
  Droplets, Award, Target,
} from "lucide-react";
import { ThemeMode } from "../utils/userStore";

// ─────────────────────────────────────────────────────────────────────────────
// Pure black / white / green palette
// ─────────────────────────────────────────────────────────────────────────────
const DARK = {
  bg:       "#0a0a0a",
  surface:  "#121212",
  card:     "#161616",
  cardHi:   "#1c1c1c",
  border:   "#262626",
  borderHi: "#404040",
  pri:      "#fafafa",
  sec:      "#a3a3a3",
  mut:      "#737373",
  green:    "#1d4ed8",
  greenHi:  "#1e40af",
  greenBg:  "rgba(29,78,216,0.12)",
} as const;

const LIGHT = {
  bg:       "#ffffff",
  surface:  "#fafafa",
  card:     "#ffffff",
  cardHi:   "#f5f5f5",
  border:   "#e5e5e5",
  borderHi: "#d4d4d4",
  pri:      "#0a0a0a",
  sec:      "#525252",
  mut:      "#a3a3a3",
  green:    "#2563eb",
  greenHi:  "#1d4ed8",
  greenBg:  "rgba(37,99,235,0.08)",
} as const;

interface Props {
  onSignIn:   () => void;
  onGetStarted: () => void;
  theme:      ThemeMode;
  onToggleTheme: () => void;
}

const LandingPage: React.FC<Props> = ({ onSignIn, onGetStarted, theme, onToggleTheme }) => {
  const C = theme === "dark" ? DARK : LIGHT;

  // ── Inline section components (closures capture C) ────────────────────────
  const Container: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 clamp(20px,4vw,40px)", ...style }}>
      {children}
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.pri,
      fontFamily: "system-ui, -apple-system, sans-serif",
      transition: "background .25s ease,color .25s ease",
    }}>

      {/* ═══════════════════════════════════════════════════════════════════
          NAV
          ═══════════════════════════════════════════════════════════════════ */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: theme === "dark" ? "rgba(10,10,10,0.85)" : "rgba(255,255,255,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.border}`,
      }}>
        <Container>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: C.green, display: "flex",
                alignItems: "center", justifyContent: "center",
              }}>
                <FlaskConical size={18} color="white" strokeWidth={2.4} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: -0.3 }}>VirtualLab</div>
                <div style={{ fontSize: 10, color: C.mut, letterSpacing: 0.8, textTransform: "uppercase" }}>
                  Cream Formulation
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/* Desktop nav links */}
              <div style={{ display: "flex", gap: 4, marginRight: 8 }} className="lp-nav-links">
                {[
                  { label: "Features",     href: "#features" },
                  { label: "About",        href: "#about" },
                  { label: "How it Works", href: "#how" },
                ].map(l => (
                  <a key={l.label} href={l.href} style={{
                    color: C.sec, textDecoration: "none", fontSize: 13, fontWeight: 500,
                    padding: "8px 12px", borderRadius: 8,
                  }}>{l.label}</a>
                ))}
              </div>

              {/* Theme toggle */}
              <button onClick={onToggleTheme}
                aria-label="Toggle theme"
                style={{
                  width: 38, height: 38, borderRadius: 10, cursor: "pointer",
                  background: "transparent", border: `1px solid ${C.border}`,
                  color: C.pri, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              <button onClick={onSignIn} className="lp-signin-btn" style={{
                background: "transparent", border: "none", color: C.pri,
                padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                borderRadius: 8,
              }}>Sign In</button>

              <button onClick={onGetStarted} style={{
                background: C.green, color: "white", border: "none",
                padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                borderRadius: 9, display: "flex", alignItems: "center", gap: 5,
              }}>
                Get Started <ArrowRight size={14} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </Container>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════════
          HERO
          ═══════════════════════════════════════════════════════════════════ */}
      <section style={{ paddingTop: 80, paddingBottom: 100, position: "relative", overflow: "hidden" }}>
        {/* Decorative grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `radial-gradient(${C.border} 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
          opacity: theme === "dark" ? 0.4 : 0.5,
          maskImage: "radial-gradient(ellipse at center, black 0%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <Container style={{ position: "relative", textAlign: "center" }}>
          {/* Pill */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: C.greenBg, border: `1px solid ${C.green}55`,
            borderRadius: 999, padding: "5px 14px", marginBottom: 24,
          }}>
            <Sparkles size={12} color={C.green} strokeWidth={2.4} />
            <span style={{ fontSize: 11, fontWeight: 700, color: C.green,
              letterSpacing: 1, textTransform: "uppercase" }}>
              Pharmaceutical Virtual Laboratory
            </span>
          </div>

          <h1 style={{
            fontSize: "clamp(36px, 6vw, 68px)", fontWeight: 900,
            lineHeight: 1.05, letterSpacing: -1.5, margin: 0, marginBottom: 18,
          }}>
            Master <span style={{ color: C.green }}>Cream Formulation</span><br />
            in a Virtual Lab
          </h1>

          <p style={{
            fontSize: "clamp(15px, 1.6vw, 18px)", color: C.sec,
            maxWidth: 640, margin: "0 auto 36px", lineHeight: 1.7,
          }}>
            Practice oil-in-water and water-in-oil emulsion preparation with realistic
            apparatus, step-by-step protocols, and instant feedback — just like a real pharmacy lab.
          </p>

          <div className="lp-hero-btns" style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onGetStarted} style={{
              background: C.green, color: "white", border: "none",
              padding: "14px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer",
              borderRadius: 11, display: "inline-flex", alignItems: "center", gap: 8,
              transition: "transform .15s, background .15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.greenHi; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.green;   e.currentTarget.style.transform = "translateY(0)"; }}>
              Start Free — Create Account <ArrowRight size={16} strokeWidth={2.5} />
            </button>
            <button onClick={onSignIn} style={{
              background: "transparent", color: C.pri,
              border: `1px solid ${C.borderHi}`,
              padding: "14px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer",
              borderRadius: 11, display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              I have an account
            </button>
          </div>

          {/* Trust line */}
          <div className="lp-trust-row" style={{ display: "flex", gap: 24, justifyContent: "center",
            marginTop: 40, flexWrap: "wrap" }}>
            {[
              "No installation required",
              "Real-time feedback",
              "Teacher & student modes",
            ].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 6,
                color: C.mut, fontSize: 13 }}>
                <Check size={14} color={C.green} strokeWidth={3} />
                {t}
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FEATURES
          ═══════════════════════════════════════════════════════════════════ */}
      <section id="features" style={{ background: C.surface, padding: "80px 0",
        borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <Container>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ color: C.green, fontSize: 12, fontWeight: 800,
              letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Features</div>
            <h2 style={{ fontSize: "clamp(28px,3.5vw,44px)", fontWeight: 900,
              margin: 0, marginBottom: 12, letterSpacing: -0.8 }}>
              Everything you need to <span style={{ color: C.green }}>learn formulation</span>
            </h2>
            <p style={{ color: C.sec, fontSize: 15, maxWidth: 580, margin: "0 auto", lineHeight: 1.7 }}>
              A complete pharmaceutical lab experience — designed for both teachers and students.
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}>
            {[
              {
                Icon: Beaker,
                title: "Interactive Lab",
                desc: "Drag apparatus, scoop solids, pour liquids, heat phases — every action mirrors a real lab procedure.",
              },
              {
                Icon: Zap,
                title: "Real-Time Feedback",
                desc: "Instant notifications guide you when temperatures, mixing orders, or amounts deviate from the protocol.",
              },
              {
                Icon: GraduationCap,
                title: "Teacher Assignments",
                desc: "Teachers issue volume-based assignments with unique codes. Students enter the code and the lab adapts.",
              },
              {
                Icon: TrendingUp,
                title: "Performance Analytics",
                desc: "Track class progress, common mistakes, and individual scores from the teacher dashboard.",
              },
            ].map(({ Icon, title, desc }) => (
              <div key={title} style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: 24,
                transition: "border-color .15s, transform .15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.green; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateY(0)"; }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 11,
                  background: C.greenBg, border: `1px solid ${C.green}33`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 16,
                }}>
                  <Icon size={20} color={C.green} strokeWidth={2} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{title}</div>
                <div style={{ color: C.sec, fontSize: 13, lineHeight: 1.7 }}>{desc}</div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          ABOUT CREAM FORMULATION
          ═══════════════════════════════════════════════════════════════════ */}
      <section id="about" style={{ padding: "100px 0" }}>
        <Container>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(280px,1fr) minmax(280px,1fr)",
            gap: 60, alignItems: "center" }} className="lp-about-grid">
            <div>
              <div style={{ color: C.green, fontSize: 12, fontWeight: 800,
                letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
                The Science
              </div>
              <h2 style={{ fontSize: "clamp(28px,3.5vw,42px)", fontWeight: 900,
                margin: 0, marginBottom: 18, letterSpacing: -0.8 }}>
                What is <span style={{ color: C.green }}>cream formulation?</span>
              </h2>
              <p style={{ color: C.sec, fontSize: 15, lineHeight: 1.8, marginBottom: 14 }}>
                Pharmaceutical creams are <strong style={{ color: C.pri }}>emulsions</strong> — stable
                mixtures of oil and water held together by an emulsifier.
                Mastering them means understanding precise temperatures, the right
                mixing order, and how molecules behave at the oil-water interface.
              </p>
              <p style={{ color: C.sec, fontSize: 15, lineHeight: 1.8, marginBottom: 24 }}>
                Our virtual lab simulates two classic formulations used in pharmacy education,
                so you can practice the technique safely — and as many times as you need.
              </p>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {[
                  { Icon: Target,  label: "Precise temperatures" },
                  { Icon: Droplets, label: "Correct mixing order" },
                  { Icon: Award,    label: "pH & viscosity testing" },
                ].map(({ Icon, label }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 8,
                    color: C.sec, fontSize: 13, fontWeight: 600 }}>
                    <Icon size={15} color={C.green} strokeWidth={2.2} /> {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Cream comparison cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                {
                  Icon:    FlaskConical,
                  title:   "Vanishing Cream",
                  type:    "Oil-in-Water (O/W)",
                  notes:   "Light, fast-absorbing, leaves no oily residue. Used for daily moisturisers.",
                  ratio:   "60-75% water · ~18g stearic acid",
                },
                {
                  Icon:    Beaker,
                  title:   "Cold Cream",
                  type:    "Water-in-Oil (W/O)",
                  notes:   "Heavy, occlusive, stays on skin surface. Used for cleansing and deep moisturisation.",
                  ratio:   "35+ mL paraffin · 12g beeswax",
                },
              ].map(c => (
                <div key={c.title} style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 14, padding: 22,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: theme === "dark" ? "#222" : "#f0f0f0",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <c.Icon size={20} color={C.pri} strokeWidth={2} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>{c.title}</div>
                      <div style={{ fontSize: 11, color: C.green, fontWeight: 700,
                        letterSpacing: 0.6, textTransform: "uppercase" }}>{c.type}</div>
                    </div>
                  </div>
                  <p style={{ color: C.sec, fontSize: 13, lineHeight: 1.7, margin: "0 0 8px" }}>{c.notes}</p>
                  <div style={{ fontSize: 11, color: C.mut, fontFamily: "monospace" }}>{c.ratio}</div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          HOW IT WORKS
          ═══════════════════════════════════════════════════════════════════ */}
      <section id="how" style={{ background: C.surface, padding: "90px 0",
        borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <Container>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ color: C.green, fontSize: 12, fontWeight: 800,
              letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
              How It Works
            </div>
            <h2 style={{ fontSize: "clamp(28px,3.5vw,42px)", fontWeight: 900,
              margin: 0, letterSpacing: -0.8 }}>
              Built for <span style={{ color: C.green }}>teachers</span> and{" "}
              <span style={{ color: C.green }}>students</span>
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }} className="lp-howit-grid">
            {[
              {
                role:  "For Teachers",
                Icon:  GraduationCap,
                steps: [
                  "Sign up with your full name, email, and password",
                  "Create volume-based assignments (e.g. 50g of vanishing cream)",
                  "Share unique codes with your students",
                  "Track submissions, scores, and analytics in real time",
                ],
              },
              {
                role:  "For Students",
                Icon:  Users,
                steps: [
                  "Register with your name, email, password, and registration number",
                  "Enter your teacher's code or pick a practical for self-practice",
                  "Follow the protocol and get instant feedback on every step",
                  "Submit your work for evaluation against pharmacopoeia specs",
                ],
              },
            ].map(card => (
              <div key={card.role} style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 16, padding: 28,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: C.greenBg, border: `1px solid ${C.green}33`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <card.Icon size={22} color={C.green} strokeWidth={2} />
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800 }}>{card.role}</div>
                </div>
                {card.steps.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, marginBottom: 16,
                    alignItems: "flex-start" }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%",
                      background: theme === "dark" ? "#222" : "#f0f0f0",
                      border: `1px solid ${C.border}`,
                      color: C.pri, fontWeight: 800, fontSize: 12,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>{i + 1}</div>
                    <div style={{ color: C.sec, fontSize: 14, lineHeight: 1.7, paddingTop: 2 }}>
                      {s}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          STATS / SOCIAL PROOF
          ═══════════════════════════════════════════════════════════════════ */}
      <section style={{ padding: "70px 0" }}>
        <Container>
          <div className="lp-stats-grid" style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))",
            gap: 18, textAlign: "center",
          }}>
            {[
              { value: "2",   label: "Practicals" },
              { value: "12+", label: "Apparatus types" },
              { value: "14",  label: "Validation checks" },
              { value: "100%",label: "Hands-on" },
            ].map(s => (
              <div key={s.label} style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: "22px 14px",
              }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: C.green,
                  letterSpacing: -1, lineHeight: 1 }}>{s.value}</div>
                <div style={{ color: C.mut, fontSize: 12, marginTop: 6,
                  letterSpacing: 0.8, textTransform: "uppercase", fontWeight: 600 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FINAL CTA
          ═══════════════════════════════════════════════════════════════════ */}
      <section style={{ padding: "80px 0 100px" }}>
        <Container>
          <div style={{
            background: theme === "dark" ? "#0f0f0f" : "#fafafa",
            border: `1px solid ${C.border}`,
            borderRadius: 24, padding: "60px 32px", textAlign: "center",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: `radial-gradient(${C.green}22 1px, transparent 1px)`,
              backgroundSize: "24px 24px", opacity: 0.5, pointerEvents: "none",
            }} />

            <div style={{ position: "relative" }}>
              <h2 style={{ fontSize: "clamp(28px,3.5vw,42px)", fontWeight: 900,
                margin: 0, marginBottom: 14, letterSpacing: -0.8 }}>
                Ready to start <span style={{ color: C.green }}>formulating?</span>
              </h2>
              <p style={{ color: C.sec, fontSize: 16, maxWidth: 520, margin: "0 auto 28px",
                lineHeight: 1.7 }}>
                Create your account and walk into a virtual pharmacy lab in seconds.
                No downloads, no setup — just sign up and start practicing.
              </p>

              <div className="lp-cta-btns" style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={onGetStarted} style={{
                  background: C.green, color: "white", border: "none",
                  padding: "14px 30px", fontSize: 15, fontWeight: 700, cursor: "pointer",
                  borderRadius: 11, display: "inline-flex", alignItems: "center", gap: 8,
                }}>
                  Create Account <ArrowRight size={16} strokeWidth={2.5} />
                </button>
                <button onClick={onSignIn} style={{
                  background: "transparent", color: C.pri,
                  border: `1px solid ${C.borderHi}`,
                  padding: "14px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer",
                  borderRadius: 11,
                }}>
                  Sign In
                </button>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════════════ */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: "32px 0" }}>
        <Container>
          <div className="lp-footer-row" style={{ display: "flex", justifyContent: "space-between",
            alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, background: C.green,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <FlaskConical size={14} color="white" strokeWidth={2.4} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>VirtualLab</span>
              <span style={{ fontSize: 12, color: C.mut }}>· Cream Formulation</span>
            </div>
            <div style={{ color: C.mut, fontSize: 12 }}>
              © {new Date().getFullYear()} VirtualLab. Pharmaceutical Chemistry Education.
            </div>
          </div>
        </Container>
      </footer>

      {/* Inline responsive helpers */}
      <style>{`
        @media (max-width: 760px) {
          .lp-nav-links   { display: none !important; }
          .lp-about-grid  { grid-template-columns: 1fr !important; gap: 32px !important; }
          .lp-howit-grid  { grid-template-columns: 1fr !important; gap: 16px !important; }
          .lp-hero-btns   { flex-direction: column !important; align-items: stretch !important; }
          .lp-hero-btns button { justify-content: center !important; }
          .lp-cta-btns    { flex-direction: column !important; align-items: stretch !important; }
          .lp-cta-btns button { justify-content: center !important; }
          .lp-trust-row   { gap: 12px !important; justify-content: flex-start !important; }
          .lp-footer-row  { flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }
          .lp-signin-btn  { display: none !important; }
        }
        @media (max-width: 480px) {
          .lp-stats-grid  { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
};

// Persist theme on toggle from outside is handled by the parent
export default LandingPage;
