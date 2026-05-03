import React, { useState } from "react";
import { Apparatus } from "./apparatusData";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  apparatus: Apparatus[];
}

// ── Section index ──────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: "context",    icon: "📖", label: "Context"    },
  { id: "materials",  icon: "🧪", label: "Materials"  },
  { id: "prediction", icon: "🔮", label: "Prediction" },
  { id: "protocol",   icon: "📋", label: "Protocol"   },
  { id: "results",    icon: "📊", label: "Results"    },
  { id: "reflection", icon: "💭", label: "Reflection" },
  { id: "summary",    icon: "✅", label: "Summary"    },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

// ── Styles ─────────────────────────────────────────────────────────────────────
const S = {
  heading: { color: "#e2e8f0", fontWeight: 700, fontSize: 15, marginBottom: 10, marginTop: 18 } as React.CSSProperties,
  sub:     { color: "#94a3b8", fontWeight: 600, fontSize: 12, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: 1 },
  body:    { color: "#cbd5e1", fontSize: 13, lineHeight: 1.7 } as React.CSSProperties,
  card:    { background: "#0d1b2e", border: "1px solid #1e3a5f", borderRadius: 10, padding: "12px 14px", marginBottom: 12 } as React.CSSProperties,
  warn:    { background: "#1c1200", border: "1px solid #92400e", borderRadius: 10, padding: "10px 14px", marginBottom: 10 } as React.CSSProperties,
  tip:     { background: "#052e16", border: "1px solid #166534", borderRadius: 10, padding: "10px 14px", marginBottom: 10 } as React.CSSProperties,
  label:   { color: "#64748b", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: 0.8 },
  textarea:{ width: "100%", background: "#0a1628", border: "1.5px solid #334155", color: "#f1f5f9",
             fontSize: 13, borderRadius: 8, padding: "10px 12px", outline: "none",
             resize: "vertical" as const, minHeight: 72, boxSizing: "border-box" as const, fontFamily: "inherit" },
};

// ── SVG Apparatus Illustrations ───────────────────────────────────────────────

const SvgBeaker: React.FC<{ ml: number; liquid?: string }> = ({ ml, liquid = "rgba(56,189,248,0.45)" }) => (
  <svg width="64" height="80" viewBox="0 0 64 80">
    {/* body */}
    <polygon points="10,10 54,10 58,72 6,72" fill="rgba(180,220,255,0.08)" stroke="#4a9eca" strokeWidth="1.5"/>
    {/* liquid fill */}
    <polygon points="12,42 52,42 56,72 8,72" fill={liquid} />
    {/* graduation marks */}
    {[30,45,58,70].map((y,i) => (
      <g key={i}>
        <line x1="10" y1={y} x2="17" y2={y} stroke="#4a9eca" strokeWidth="1" opacity="0.6"/>
        <text x="19" y={y+4} fontSize="7" fill="#7dd3fc" opacity="0.8">{[ml, Math.round(ml*0.75), Math.round(ml*0.5), Math.round(ml*0.25)][i]}</text>
      </g>
    ))}
    {/* spout */}
    <polygon points="34,10 44,10 48,2 30,2" fill="rgba(180,220,255,0.1)" stroke="#4a9eca" strokeWidth="1.5"/>
    {/* bottom */}
    <line x1="6" y1="72" x2="58" y2="72" stroke="#4a9eca" strokeWidth="2"/>
    {/* label */}
    <text x="32" y="88" textAnchor="middle" fontSize="9" fill="#7dd3fc" fontWeight="bold">{ml} mL</text>
  </svg>
);

const SvgCylinder: React.FC = () => (
  <svg width="36" height="90" viewBox="0 0 36 90">
    <rect x="10" y="6" width="16" height="72" rx="2" fill="rgba(180,220,255,0.08)" stroke="#4a9eca" strokeWidth="1.5"/>
    <rect x="10" y="46" width="16" height="32" rx="2" fill="rgba(56,189,248,0.35)"/>
    {[14,25,36,47,58,69].map((y,i) => (
      <g key={i}>
        <line x1="10" y1={y} x2="16" y2={y} stroke="#4a9eca" strokeWidth="1" opacity="0.7"/>
        <text x="18" y={y+3} fontSize="6" fill="#7dd3fc" opacity="0.8">{[100,80,60,40,20,0][i]}</text>
      </g>
    ))}
    {/* top rim */}
    <rect x="8" y="3" width="20" height="5" rx="2" fill="rgba(74,158,202,0.3)" stroke="#4a9eca" strokeWidth="1"/>
    {/* base */}
    <rect x="6" y="78" width="24" height="5" rx="2" fill="rgba(74,158,202,0.3)" stroke="#4a9eca" strokeWidth="1"/>
    <text x="18" y="92" textAnchor="middle" fontSize="7" fill="#7dd3fc" fontWeight="bold">100 mL</text>
  </svg>
);

const SvgBottle: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <svg width="52" height="90" viewBox="0 0 52 90">
    {/* body */}
    <rect x="8" y="30" width="36" height="50" rx="4" fill={color} stroke="#64748b" strokeWidth="1.5"/>
    {/* liquid */}
    <rect x="9" y="48" width="34" height="31" rx="3" fill={color.replace("0.9","0.6").replace("0.95","0.7")} opacity="0.8"/>
    {/* neck */}
    <rect x="16" y="12" width="20" height="20" rx="2" fill={color} stroke="#64748b" strokeWidth="1.5"/>
    {/* cap */}
    <rect x="14" y="4" width="24" height="10" rx="3" fill="#334155" stroke="#475569" strokeWidth="1"/>
    {/* label strip */}
    <rect x="10" y="52" width="32" height="18" rx="2" fill="rgba(255,255,255,0.12)"/>
    <text x="26" y="63" textAnchor="middle" fontSize="6" fill="white" fontWeight="bold">{label}</text>
    {/* base */}
    <rect x="6" y="78" width="40" height="5" rx="2" fill={color} stroke="#64748b" strokeWidth="1"/>
  </svg>
);

const SvgHotPlate: React.FC = () => (
  <svg width="80" height="60" viewBox="0 0 80 60">
    {/* base */}
    <rect x="4" y="22" width="72" height="34" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1.5"/>
    {/* surface */}
    <rect x="4" y="18" width="72" height="10" rx="3" fill="#334155" stroke="#64748b" strokeWidth="1"/>
    {/* heating coil */}
    {[0,1,2,3].map(i => (
      <ellipse key={i} cx="40" cy="19" rx={28-i*6} ry={3-i*0.5} fill="none" stroke="#f97316" strokeWidth="1.2" opacity={0.7-i*0.1}/>
    ))}
    {/* control knob */}
    <circle cx="60" cy="37" r="7" fill="#0f172a" stroke="#475569" strokeWidth="1"/>
    <circle cx="60" cy="37" r="4" fill="#1d4ed8"/>
    <line x1="60" y1="33" x2="60" y2="37" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    {/* indicator light */}
    <circle cx="20" cy="37" r="4" fill="#22c55e" opacity="0.9"/>
    <text x="40" y="54" textAnchor="middle" fontSize="7" fill="#94a3b8">HOT PLATE</text>
  </svg>
);

const SvgBalance: React.FC = () => (
  <svg width="90" height="70" viewBox="0 0 90 70">
    {/* base */}
    <rect x="5" y="42" width="80" height="24" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1.5"/>
    {/* platform */}
    <rect x="15" y="30" width="60" height="14" rx="3" fill="#334155" stroke="#64748b" strokeWidth="1.5"/>
    {/* display */}
    <rect x="8" y="46" width="48" height="16" rx="3" fill="#0a1628" stroke="#1e3a5f" strokeWidth="1"/>
    <text x="32" y="57" textAnchor="middle" fontSize="9" fill="#4ade80" fontWeight="bold" fontFamily="monospace">0.00 g</text>
    {/* TARE button */}
    <rect x="60" y="46" width="22" height="16" rx="3" fill="#1d4ed8" stroke="#2563eb" strokeWidth="1"/>
    <text x="71" y="57" textAnchor="middle" fontSize="7" fill="white" fontWeight="bold">TARE</text>
    <text x="45" y="68" textAnchor="middle" fontSize="7" fill="#94a3b8">DIGITAL BALANCE</text>
  </svg>
);

const SvgSpatula: React.FC = () => (
  <svg width="28" height="90" viewBox="0 0 28 90">
    {/* handle */}
    <rect x="11" y="4" width="6" height="55" rx="3" fill="#8B6914" stroke="#6b5010" strokeWidth="1"/>
    {/* shaft */}
    <rect x="12" y="56" width="4" height="18" fill="#9ca3af" stroke="#6b7280" strokeWidth="0.8"/>
    {/* blade */}
    <ellipse cx="14" cy="80" rx="8" ry="6" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1"/>
    <text x="14" y="92" textAnchor="middle" fontSize="7" fill="#94a3b8">Spatula</text>
  </svg>
);

const SvgRod: React.FC = () => (
  <svg width="24" height="90" viewBox="0 0 24 90">
    <rect x="10" y="4" width="4" height="80" rx="2" fill="rgba(180,220,255,0.25)" stroke="#7dd3fc" strokeWidth="1.2"/>
    <ellipse cx="12" cy="84" rx="4" ry="3" fill="rgba(125,211,252,0.4)" stroke="#7dd3fc" strokeWidth="1"/>
    <text x="12" y="96" textAnchor="middle" fontSize="6" fill="#94a3b8">Stirring</text>
    <text x="12" y="104" textAnchor="middle" fontSize="6" fill="#94a3b8">Rod</text>
  </svg>
);

const SvgThermometer: React.FC = () => (
  <svg width="28" height="90" viewBox="0 0 28 90">
    {/* stem */}
    <rect x="11" y="6" width="6" height="62" rx="3" fill="rgba(180,220,255,0.1)" stroke="#7dd3fc" strokeWidth="1.2"/>
    {/* mercury/liquid column */}
    <rect x="13" y="28" width="2" height="38" fill="#ef4444"/>
    {/* bulb */}
    <circle cx="14" cy="74" r="7" fill="rgba(239,68,68,0.3)" stroke="#ef4444" strokeWidth="1.5"/>
    <circle cx="14" cy="74" r="4" fill="#ef4444"/>
    {/* scale marks */}
    {[14,24,34,44,54].map((y,i) => (
      <line key={i} x1="17" y1={y} x2="21" y2={y} stroke="#7dd3fc" strokeWidth="0.8" opacity="0.7"/>
    ))}
    {/* screen */}
    <rect x="2" y="2" width="24" height="10" rx="2" fill="#0a1628" stroke="#1e3a5f" strokeWidth="1"/>
    <text x="14" y="9.5" textAnchor="middle" fontSize="6" fill="#4ade80" fontWeight="bold">25°C</text>
    <text x="14" y="90" textAnchor="middle" fontSize="6" fill="#94a3b8">Therm.</text>
  </svg>
);

const SvgIceBucket: React.FC = () => (
  <svg width="80" height="64" viewBox="0 0 80 64">
    {/* bucket body */}
    <polygon points="8,14 72,14 64,58 16,58" fill="rgba(180,220,255,0.06)" stroke="#60a5fa" strokeWidth="1.5"/>
    {/* water level */}
    <polygon points="12,34 68,34 64,58 16,58" fill="rgba(56,189,248,0.2)"/>
    {/* ice cubes */}
    {[[16,20],[34,18],[50,22],[24,32],[44,30]].map(([x,y],i) => (
      <rect key={i} x={x} y={y} width="10" height="8" rx="1.5"
        fill="rgba(224,242,254,0.7)" stroke="rgba(147,197,253,0.9)" strokeWidth="0.8"/>
    ))}
    {/* handle arcs */}
    <path d="M8,14 Q4,4 14,3" fill="none" stroke="#60a5fa" strokeWidth="1.5"/>
    <path d="M72,14 Q76,4 66,3" fill="none" stroke="#60a5fa" strokeWidth="1.5"/>
    <text x="40" y="64" textAnchor="middle" fontSize="8" fill="#7dd3fc" fontWeight="bold">Ice Bucket</text>
  </svg>
);

const SvgPhMeter: React.FC = () => (
  <svg width="40" height="90" viewBox="0 0 40 90">
    {/* body/display */}
    <rect x="4" y="2" width="32" height="42" rx="5" fill="#0f172a" stroke="#1d4ed8" strokeWidth="1.5"/>
    {/* screen */}
    <rect x="7" y="6" width="26" height="16" rx="3" fill="#0a1628" stroke="#1e3a5f" strokeWidth="1"/>
    <text x="20" y="16" textAnchor="middle" fontSize="8" fill="#4ade80" fontWeight="bold" fontFamily="monospace">7.00</text>
    <text x="20" y="24" textAnchor="middle" fontSize="5" fill="#64748b">pH</text>
    {/* buttons */}
    {[28,34,40].map((y,i) => (
      <rect key={i} x="8" y={y} width="10" height="6" rx="2" fill="#1e293b" stroke="#334155" strokeWidth="0.8"/>
    ))}
    {/* probe */}
    <rect x="17" y="44" width="6" height="36" rx="3" fill="#334155" stroke="#475569" strokeWidth="1"/>
    <ellipse cx="20" cy="80" rx="4" ry="3" fill="#1d4ed8" stroke="#3b82f6" strokeWidth="1"/>
    <text x="20" y="90" textAnchor="middle" fontSize="7" fill="#94a3b8">pH Meter</text>
  </svg>
);

const SvgViscGauge: React.FC = () => (
  <svg width="52" height="90" viewBox="0 0 52 90">
    {/* body */}
    <rect x="4" y="2" width="44" height="52" rx="5" fill="#0f172a" stroke="#7c3aed" strokeWidth="1.5"/>
    {/* dial */}
    <circle cx="26" cy="24" r="16" fill="#0a1628" stroke="#6d28d9" strokeWidth="1.2"/>
    <path d="M14,30 A14,14 0 0,1 38,30" fill="none" stroke="#334155" strokeWidth="6" strokeLinecap="round"/>
    <path d="M14,30 A14,14 0 0,1 30,13" fill="none" stroke="#7c3aed" strokeWidth="6" strokeLinecap="round"/>
    <circle cx="26" cy="24" r="3" fill="#a78bfa"/>
    <line x1="26" y1="24" x2="30" y2="15" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round"/>
    {/* label area */}
    <rect x="7" y="42" width="38" height="10" rx="2" fill="#0a1628" stroke="#1e293b" strokeWidth="0.8"/>
    <text x="26" y="50" textAnchor="middle" fontSize="7" fill="#a78bfa" fontWeight="bold" fontFamily="monospace">cP</text>
    {/* probe */}
    <rect x="21" y="54" width="10" height="28" rx="3" fill="#334155" stroke="#475569" strokeWidth="1"/>
    <ellipse cx="26" cy="82" rx="5" ry="3" fill="#7c3aed" stroke="#6d28d9" strokeWidth="1"/>
    <text x="26" y="92" textAnchor="middle" fontSize="7" fill="#94a3b8">Viscosity</text>
  </svg>
);

// ── Apparatus card with SVG illustration ───────────────────────────────────────
const ApparatusCard: React.FC<{
  svg: React.ReactNode;
  name: string;
  qty: string;
  purpose: string;
}> = ({ svg, name, qty, purpose }) => (
  <div style={{ display: "flex", gap: 12, alignItems: "flex-start",
    background: "#0d1b2e", border: "1px solid #1e3a5f", borderRadius: 10,
    padding: "12px 14px", marginBottom: 10 }}>
    <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
      minWidth: 70, background: "rgba(30,58,95,0.4)", borderRadius: 8, padding: "8px 4px" }}>
      {svg}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 13 }}>{name}</div>
      <div style={{ color: "#3b82f6", fontSize: 11, fontWeight: 700, marginTop: 2 }}>Qty: {qty}</div>
      <div style={{ color: "#64748b", fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>{purpose}</div>
    </div>
  </div>
);

// ── TextArea with label ────────────────────────────────────────────────────────
const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; rows?: number }> = ({ label, value, onChange, rows = 3 }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={S.label}>{label}</label>
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      style={S.textarea}
      onFocus={e => (e.target.style.borderColor = "#3b82f6")}
      onBlur={e  => (e.target.style.borderColor = "#334155")}
      placeholder="Write your answer here…"
    />
  </div>
);

// ── Numbered step row ──────────────────────────────────────────────────────────
const Step: React.FC<{ n: number; text: string; tip?: string; warn?: string }> = ({ n, text, tip, warn }) => (
  <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
    <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%",
      background: "#1d4ed8", color: "white", fontWeight: 800, fontSize: 12,
      display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
    <div style={{ flex: 1 }}>
      <div style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.6 }}>{text}</div>
      {tip  && <div style={{ color: "#4ade80", fontSize: 11, marginTop: 3 }}>✓ {tip}</div>}
      {warn && <div style={{ color: "#fbbf24", fontSize: 11, marginTop: 3 }}>⚠ {warn}</div>}
    </div>
  </div>
);

// ── Results row ────────────────────────────────────────────────────────────────
const ResultRow: React.FC<{ label: string; value: string; unit?: string; pass?: boolean | null }> = ({ label, value, unit, pass }) => {
  const color = pass === null || pass === undefined ? "#94a3b8" : pass ? "#4ade80" : "#f87171";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px",
      borderBottom: "1px solid rgba(255,255,255,0.05)", alignItems: "center" }}>
      <span style={{ color: "#94a3b8", fontSize: 12 }}>{label}</span>
      <span style={{ color, fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>
        {value}{unit ? ` ${unit}` : ""}
      </span>
    </div>
  );
};

// ── Material table row ─────────────────────────────────────────────────────────
const MatRow: React.FC<{ item: string; qty: string; note?: string }> = ({ item, qty, note }) => (
  <div style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
    <span style={{ flex: 2, color: "#e2e8f0", fontSize: 12 }}>{item}</span>
    <span style={{ flex: 1, color: "#60a5fa", fontSize: 12, fontFamily: "monospace", fontWeight: 700 }}>{qty}</span>
    {note && <span style={{ flex: 2, color: "#64748b", fontSize: 11 }}>{note}</span>}
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────
const ProtocolSidebar: React.FC<Props> = ({ isOpen, onClose, apparatus }) => {
  const [activeSection, setActiveSection] = useState<SectionId>("context");

  // Prediction fields
  const [pred1, setPred1] = useState("");
  const [pred2, setPred2] = useState("");
  const [pred3, setPred3] = useState("");
  const [pred4, setPred4] = useState("");

  // Reflection fields
  const [ref1, setRef1] = useState("");
  const [ref2, setRef2] = useState("");
  const [ref3, setRef3] = useState("");
  const [ref4, setRef4] = useState("");

  // Summary fields
  const [sum1, setSum1] = useState("");
  const [sum2, setSum2] = useState("");

  if (!isOpen) return null;

  // ── Read live lab state for Results section ──────────────────────────────────
  const mainBeaker = apparatus.find(a => a.id === "beaker-500-main");
  const oilBeaker  = apparatus.find(a => a.id === "beaker-250-oil");
  const aqBeaker   = apparatus.find(a => a.id === "beaker-250-aqueous");
  const phMeter    = apparatus.find(a => a.type === "phmeter");
  const viscGauge  = apparatus.find(a => a.type === "viscositygauge");

  const comp = (mainBeaker?.data?.composition ?? {}) as Record<string, number>;
  const oilComp  = (oilBeaker?.data?.composition  ?? {}) as Record<string, number>;
  const aqComp   = (aqBeaker?.data?.composition   ?? {}) as Record<string, number>;

  const stearicG   = Math.round(((comp.stearicAcid  ?? 0) + (oilComp.stearicAcid  ?? 0) + (mainBeaker?.data?.solidStearicGrams ?? 0) + (oilBeaker?.data?.solidStearicGrams ?? 0)) * 10) / 10;
  const paraffinML = Math.round(((comp.liquidParaffin ?? 0) + (oilComp.liquidParaffin ?? 0)) * 10) / 10;
  const glycerinML = Math.round(((comp.glycerin ?? 0) + (aqComp.glycerin ?? 0)) * 10) / 10;
  const kohML      = Math.round(((comp.koh     ?? 0) + (aqComp.koh     ?? 0)) * 10) / 10;
  const waterML    = Math.round(((comp.water   ?? 0) + (aqComp.water   ?? 0)) * 10) / 10;
  const oilMaxT    = Math.max(oilBeaker?.data?.maxTemperatureReached ?? 25, mainBeaker?.data?.maxTemperatureReached ?? 25);
  const aqMaxT     = aqBeaker?.data?.maxTemperatureReached ?? 25;
  const stirSec    = Math.round(mainBeaker?.data?.stirringSeconds ?? 0);
  const rawMinCool = mainBeaker?.data?.minCoolingTemp;
  const coolTemp   = (rawMinCool !== undefined && rawMinCool < 99) ? Math.round(rawMinCool) : Math.round(mainBeaker?.data?.liquidTemperature ?? 25);
  const measuredPH   = Math.round((phMeter?.data?.phReading   ?? 0) * 100) / 100;
  const measuredVisc = Math.round(viscGauge?.data?.viscosityReading ?? 0);

  const currentIdx = SECTIONS.findIndex(s => s.id === activeSection);

  const renderContent = () => {
    switch (activeSection) {

      // ── 1. CONTEXT ────────────────────────────────────────────────────────────
      case "context":
        return (
          <div>
            <div style={S.card}>
              <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: 14, marginBottom: 6 }}>What is Vanishing Cream?</div>
              <p style={S.body}>
                A vanishing cream is an <strong style={{ color: "#a78bfa" }}>oil-in-water (O/W) emulsion</strong> — tiny droplets of oil
                suspended in a water base. It is called "vanishing" because it absorbs rapidly into the skin
                and leaves no visible residue after rubbing in.
              </p>
            </div>

            <div style={S.card}>
              <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Why Does It Vanish?</div>
              <p style={S.body}>
                The high water content (60–75%) makes the cream light and fast-absorbing. Stearic acid
                and potassium hydroxide react to form <strong style={{ color: "#4ade80" }}>potassium stearate</strong>,
                a soap that acts as the emulsifier holding the oil and water together.
              </p>
            </div>

            <div style={S.card}>
              <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Role of Each Ingredient</div>
              {[
                ["Stearic Acid (18 g)", "Primary emulsifier & thickener. Reacts with KOH to form soap."],
                ["Liquid Paraffin (7 mL)", "Oil phase. Moisturises and softens skin."],
                ["Glycerin (3 mL)", "Humectant. Attracts moisture and improves texture."],
                ["KOH & Triethanolamine (1 mL)", "Alkali. Reacts with stearic acid to form emulsifier."],
                ["Distilled Water (70 mL)", "Aqueous phase. Main carrier of the cream."],
              ].map(([name, role]) => (
                <div key={name} style={{ marginBottom: 8 }}>
                  <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 12 }}>{name}</span>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>{role}</div>
                </div>
              ))}
            </div>

            <div style={S.card}>
              <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Learning Objectives</div>
              {["Understand O/W emulsion formation",
                "Practise accurate weighing and measuring",
                "Learn the effect of temperature on emulsification",
                "Measure pH and viscosity of a pharmaceutical cream",
                "Evaluate product quality against specifications",
              ].map((obj, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5 }}>
                  <span style={{ color: "#3b82f6", fontWeight: 700, minWidth: 18, fontSize: 12 }}>{i + 1}.</span>
                  <span style={{ color: "#cbd5e1", fontSize: 12 }}>{obj}</span>
                </div>
              ))}
            </div>
          </div>
        );

      // ── 2. MATERIALS ──────────────────────────────────────────────────────────
      case "materials":
        return (
          <div>
            <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
              Glassware &amp; Apparatus
            </div>

            <ApparatusCard
              svg={<SvgBeaker ml={250} liquid="rgba(56,189,248,0.35)" />}
              name="250 mL Beaker — Oil Phase"
              qty="1"
              purpose="Holds stearic acid + liquid paraffin. Heated on hot plate to 75°C." />

            <ApparatusCard
              svg={<SvgBeaker ml={250} liquid="rgba(185,228,255,0.4)" />}
              name="250 mL Beaker — Aqueous Phase"
              qty="1"
              purpose="Holds distilled water + glycerin + KOH. Heated to 75°C." />

            <ApparatusCard
              svg={<SvgBeaker ml={500} liquid="rgba(248,220,180,0.4)" />}
              name="500 mL Beaker — Main Mixing"
              qty="1"
              purpose="Both phases are combined here. Final mixing and stirring vessel." />

            <ApparatusCard
              svg={<SvgCylinder />}
              name="100 mL Graduated Cylinder"
              qty="1"
              purpose="Accurately measuring liquid volumes of chemicals." />

            <ApparatusCard
              svg={<SvgBalance />}
              name="Digital Weight Balance"
              qty="1"
              purpose="Weighing stearic acid accurately to ±0.1 g." />

            <ApparatusCard
              svg={<SvgSpatula />}
              name="Spatula"
              qty="1"
              purpose="Scooping and transferring solid stearic acid into the oil beaker." />

            <ApparatusCard
              svg={<SvgRod />}
              name="Glass Stirring Rod"
              qty="1"
              purpose="Stirring the emulsion during and after mixing phases." />

            <ApparatusCard
              svg={<SvgHotPlate />}
              name="Hot Plate"
              qty="1"
              purpose="Heating oil phase and aqueous phase separately to 75°C." />

            <ApparatusCard
              svg={<SvgIceBucket />}
              name="Ice Bucket"
              qty="1"
              purpose="Controlled cooling of the cream below 40°C while stirring." />

            <ApparatusCard
              svg={<SvgThermometer />}
              name="Digital Thermometer"
              qty="1"
              purpose="Monitoring the temperature of liquids in beakers in real time." />

            <ApparatusCard
              svg={<SvgPhMeter />}
              name="pH Meter"
              qty="1"
              purpose="Measuring the final pH of the cream. Target range: 5.0–7.0." />

            <ApparatusCard
              svg={<SvgViscGauge />}
              name="Viscosity Gauge"
              qty="1"
              purpose="Measuring the viscosity of the final cream. Target: 1100–1800 cP." />

            <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: 14, margin: "18px 0 10px" }}>
              Chemicals
            </div>
            {[
              ["rgba(255,252,245,0.95)", "Stearic Acid",          "18 g",   "Solid white flakes. Emulsifier & thickener."],
              ["rgba(255,248,195,0.70)", "Liquid Paraffin",       "7 mL",   "Light colourless oil. Moisturises skin."],
              ["rgba(235,250,215,0.62)", "Glycerin",              "3 mL",   "Clear viscous liquid. Humectant."],
              ["rgba(255,245,175,0.68)", "KOH & Triethanolamine", "1 mL",   "Alkaline solution. Reacts with stearic acid."],
              ["rgba(185,228,255,0.32)", "Distilled Water",       "70 mL",  "Clear, pH 7. Main aqueous carrier."],
            ].map(([color, name, qty, note]) => (
              <div key={name} style={{ display: "flex", gap: 10, alignItems: "center",
                background: "#0d1b2e", border: "1px solid #1e3a5f", borderRadius: 10,
                padding: "10px 14px", marginBottom: 8 }}>
                <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 6,
                  background: color as string, border: "1.5px solid rgba(255,255,255,0.25)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 12 }}>{name}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                    <span style={{ color: "#3b82f6", fontSize: 11, fontWeight: 700 }}>{qty}</span>
                    <span style={{ color: "#64748b", fontSize: 11 }}>{note}</span>
                  </div>
                </div>
              </div>
            ))}

            <div style={S.warn}>
              <div style={{ color: "#fbbf24", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>⚠ Safety Precautions</div>
              {["KOH is corrosive — handle with care",
                "Hot glassware causes burns — use appropriate care",
                "Wear safety goggles and gloves throughout",
                "Work carefully with all apparatus",
              ].map((s, i) => <div key={i} style={{ color: "#fcd34d", fontSize: 12, marginBottom: 3 }}>• {s}</div>)}
            </div>
          </div>
        );

      // ── 3. PREDICTION ─────────────────────────────────────────────────────────
      case "prediction":
        return (
          <div>
            <div style={S.card}>
              <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Before You Begin</div>
              <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>
                Based on your knowledge of emulsions and the ingredients listed, answer the
                questions below <strong style={{ color: "#e2e8f0" }}>before</strong> conducting the practical.
                Your predictions will be compared to your actual results.
              </p>
            </div>

            <Field
              label="1. What do you predict the final cream will look like? Describe its texture, colour, and appearance."
              value={pred1}
              onChange={setPred1}
              rows={4}
            />
            <Field
              label="2. What pH range do you expect for the final cream? Explain why."
              value={pred2}
              onChange={setPred2}
              rows={3}
            />
            <Field
              label="3. What do you think will happen if the oil phase and aqueous phase are at different temperatures when mixed?"
              value={pred3}
              onChange={setPred3}
              rows={4}
            />
            <Field
              label="4. What do you predict will happen if the mixing order is wrong (aqueous poured first, then oil added into it)?"
              value={pred4}
              onChange={setPred4}
              rows={4}
            />

            <div style={S.tip}>
              <div style={{ color: "#4ade80", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
                ✓ Tip
              </div>
              <div style={{ color: "#86efac", fontSize: 12 }}>
                There are no wrong predictions — what matters is your scientific reasoning.
                Compare these to your Results and Reflection sections after completing the practical.
              </div>
            </div>
          </div>
        );

      // ── 4. PROTOCOL ───────────────────────────────────────────────────────────
      case "protocol":
        return (
          <div>
            <div style={S.card}>
              <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Preparation of Vanishing Cream</div>
              <div style={{ color: "#64748b", fontSize: 12 }}>Follow each step in order. Do not skip steps.</div>
            </div>

            <div style={{ color: "#60a5fa", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10, marginTop: 4 }}>
              — Oil Phase —
            </div>
            <Step n={1} text="Drag the Spatula onto the Stearic Acid bottle. Select 18 g and click Scoop."
              tip="Use the digital balance to confirm weight" />
            <Step n={2} text="Drag the loaded spatula into the 250 mL Oil Phase Beaker to deposit the stearic acid."
              tip="Stearic acid appears as solid white chunks" />
            <Step n={3} text="Drag the Liquid Paraffin bottle over the Oil Phase Beaker. Select 7 mL and pour."
              tip="Liquid paraffin is light yellow — correct amount turns green" />
            <Step n={4} text="Drag the Oil Phase Beaker onto the Hot Plate. Confirm target = 75°C and turn ON."
              warn="Stearic acid melts at 70°C — wait for the melt toast" />
            <Step n={5} text="Wait for the green toast: 'Oil Phase Beaker reached 75°C'. Then drag beaker off the hot plate."
              tip="Temperature holds after removal — no cooling until ice bucket" />

            <div style={{ color: "#60a5fa", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10, marginTop: 16 }}>
              — Aqueous Phase —
            </div>
            <Step n={6} text="Drag the Distilled Water bottle over the 250 mL Aqueous Phase Beaker. Select 70 mL and pour." />
            <Step n={7} text="Add 3 mL Glycerin then 1 mL KOH & Triethanolamine to the Aqueous Phase Beaker." />
            <Step n={8} text="Drag the Aqueous Phase Beaker onto the Hot Plate. Wait for 75°C toast. Remove from plate."
              tip="Both phases must be at the same temperature before mixing" />

            <div style={{ color: "#60a5fa", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10, marginTop: 16 }}>
              — Mixing & Finishing —
            </div>
            <Step n={9} text="Pour the Oil Phase Beaker into the 500 mL Main Mixing Beaker first (select all volume)."
              warn="Oil goes in FIRST — this is the critical order" />
            <Step n={10} text="Pour the Aqueous Phase Beaker into the Main Mixing Beaker (select all volume)."
              tip="You should see 'Phases combined ✓'" />
            <Step n={11} text="Drag the Stirring Rod into the Main Mixing Beaker. Hold mouse to stir for at least 30 seconds." />
            <Step n={12} text="Drag the Main Mixing Beaker into the Ice Bucket. Continue stirring until temperature ≤ 40°C."
              tip="Watch for 'Cooled to ≤40°C' toast" />
            <Step n={13} text="Dip the pH Meter into the Main Mixing Beaker. Wait 2–3 seconds for reading to settle." />
            <Step n={14} text="Dip the Viscosity Gauge into the Main Mixing Beaker. Wait for reading to settle." />
            <Step n={15} text="Click ⚗ Evaluate Formulation (bottom right) then click EVALUATE RESULT." />
          </div>
        );

      // ── 5. RESULTS ────────────────────────────────────────────────────────────
      case "results":
        return (
          <div>
            <div style={S.card}>
              <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Auto-detected Lab Measurements</div>
              <div style={{ color: "#64748b", fontSize: 12, marginBottom: 10 }}>
                These values are recorded automatically as you work in the lab.
              </div>

              <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Ingredients Used</div>
              <ResultRow label="Stearic Acid"          value={`${stearicG}`}   unit="g"  pass={stearicG >= 15 && stearicG <= 20} />
              <ResultRow label="Liquid Paraffin"       value={`${paraffinML}`} unit="mL" pass={paraffinML >= 5 && paraffinML <= 10} />
              <ResultRow label="Glycerin"              value={`${glycerinML}`} unit="mL" pass={glycerinML >= 2 && glycerinML <= 5} />
              <ResultRow label="KOH & Triethanolamine" value={`${kohML}`}      unit="mL" pass={kohML >= 0.5 && kohML <= 2} />
              <ResultRow label="Distilled Water"       value={`${waterML}`}    unit="mL" pass={waterML >= 65 && waterML <= 75} />

              <div style={{ borderTop: "1px solid #1e293b", margin: "12px 0" }} />
              <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Temperature</div>
              <ResultRow label="Oil Phase Max Temp"     value={`${Math.round(oilMaxT)}`} unit="°C" pass={oilMaxT >= 70 && oilMaxT <= 80} />
              <ResultRow label="Aqueous Phase Max Temp" value={`${Math.round(aqMaxT)}`}  unit="°C" pass={aqMaxT >= 70 && aqMaxT <= 80} />

              <div style={{ borderTop: "1px solid #1e293b", margin: "12px 0" }} />
              <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Process</div>
              <ResultRow label="Stirring Time"      value={`${stirSec}`}      unit="s"  pass={stirSec >= 30} />
              <ResultRow label="Cooling Temperature" value={`${coolTemp}`}    unit="°C" pass={coolTemp <= 40} />

              <div style={{ borderTop: "1px solid #1e293b", margin: "12px 0" }} />
              <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Instrument Readings</div>
              <ResultRow label="pH Meter"        value={measuredPH   > 0 ? measuredPH.toFixed(2)   : "Not measured"} pass={measuredPH > 0 ? measuredPH >= 5 && measuredPH <= 7 : null} />
              <ResultRow label="Viscosity Gauge" value={measuredVisc > 0 ? `${measuredVisc} cP`     : "Not measured"} pass={measuredVisc > 0 ? measuredVisc >= 1100 && measuredVisc <= 1800 : null} />
            </div>

            <div style={{ ...S.card, marginTop: 4 }}>
              <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Target Ranges</div>
              {[
                ["Stearic Acid",    "15–20 g"],
                ["Liquid Paraffin", "5–10 mL"],
                ["Glycerin",        "2–5 mL"],
                ["KOH & TEA",       "0.5–2 mL"],
                ["Water",           "65–75 mL"],
                ["Both Temps",      "70–80°C"],
                ["Stirring",        "≥ 30 s"],
                ["Cooling",         "≤ 40°C"],
                ["pH",              "5.0–7.0"],
                ["Viscosity",       "1100–1800 cP"],
              ].map(([label, range]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between",
                  padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12 }}>
                  <span style={{ color: "#64748b" }}>{label}</span>
                  <span style={{ color: "#60a5fa", fontFamily: "monospace" }}>{range}</span>
                </div>
              ))}
            </div>
          </div>
        );

      // ── 6. REFLECTION ─────────────────────────────────────────────────────────
      case "reflection":
        return (
          <div>
            <div style={S.card}>
              <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Reflect on Your Practical</div>
              <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>
                Answer these questions after completing the practical. Use your results and
                observations to support your answers.
              </p>
            </div>

            <Field
              label="1. Was your prediction about the cream's appearance correct? How did the actual result compare?"
              value={ref1}
              onChange={setRef1}
              rows={4}
            />
            <Field
              label="2. Why is it important to heat both the oil phase and aqueous phase to the same temperature (75°C) before mixing?"
              value={ref2}
              onChange={setRef2}
              rows={4}
            />
            <Field
              label="3. Why must the oil phase be poured into the main beaker first, and the aqueous phase added into it (not the other way around)?"
              value={ref3}
              onChange={setRef3}
              rows={4}
            />
            <Field
              label="4. What would happen to the cream's quality if you skipped the cooling step or cooled it too quickly? Explain."
              value={ref4}
              onChange={setRef4}
              rows={4}
            />

            <div style={S.card}>
              <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Key Concepts to Review</div>
              {[
                ["O/W Emulsion",       "Oil droplets dispersed in a continuous water phase"],
                ["Emulsification",     "The process of combining immiscible liquids using an emulsifier"],
                ["Potassium Stearate", "Soap formed by KOH + stearic acid reaction; acts as emulsifier"],
                ["Phase Temperature",  "Both phases at 75°C ensures equal fluidity for uniform mixing"],
                ["Viscosity",          "Resistance to flow; increases as cream cools and sets"],
                ["pH",                 "Affects skin compatibility; 5–7 matches skin's natural pH"],
              ].map(([term, def]) => (
                <div key={term} style={{ marginBottom: 8 }}>
                  <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 12 }}>{term}: </span>
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>{def}</span>
                </div>
              ))}
            </div>
          </div>
        );

      // ── 7. SUMMARY ────────────────────────────────────────────────────────────
      case "summary":
        return (
          <div>
            <div style={S.card}>
              <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Conclusion</div>
              <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>
                Complete this summary after reviewing your results and reflections.
              </p>
            </div>

            <Field
              label="1. Write a conclusion summarising what you did and what you produced."
              value={sum1}
              onChange={setSum1}
              rows={5}
            />
            <Field
              label="2. If you were to repeat this practical, what would you do differently and why?"
              value={sum2}
              onChange={setSum2}
              rows={5}
            />

            <div style={S.card}>
              <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Procedure Checklist</div>
              {[
                ["Weighed 18 g stearic acid accurately",                   stearicG >= 15 && stearicG <= 20],
                ["Added 7 mL liquid paraffin to oil beaker",               paraffinML >= 5 && paraffinML <= 10],
                ["Heated oil phase to 70–80°C",                            oilMaxT >= 70 && oilMaxT <= 80],
                ["Added 70 mL water + 3 mL glycerin + 1 mL KOH to aq.",   waterML >= 65 && waterML <= 75 && glycerinML >= 2 && kohML >= 0.5],
                ["Heated aqueous phase to 70–80°C",                        aqMaxT >= 70 && aqMaxT <= 80],
                ["Poured oil phase into main beaker first",                (mainBeaker?.data?.pouringSourceHistory ?? []).includes("beaker-250-oil")],
                ["Poured aqueous phase into oil (correct order)",          (() => { const h = mainBeaker?.data?.pouringSourceHistory ?? []; const o = h.indexOf("beaker-250-oil"); const a = h.indexOf("beaker-250-aqueous"); return o !== -1 && a !== -1 && o < a; })()],
                ["Stirred for at least 30 seconds",                        stirSec >= 30],
                ["Cooled in ice bucket to ≤ 40°C",                        coolTemp <= 40],
                ["Measured pH (5.0–7.0)",                                  measuredPH >= 5 && measuredPH <= 7],
                ["Measured viscosity (1100–1800 cP)",                      measuredVisc >= 1100 && measuredVisc <= 1800],
              ].map(([label, done]) => (
                <div key={label as string} style={{ display: "flex", gap: 10, alignItems: "center",
                  padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
                    background: done ? "#052e16" : "#1e293b",
                    border: `1.5px solid ${done ? "#16a34a" : "#334155"}`,
                    color: done ? "#4ade80" : "#475569" }}>
                    {done ? "✓" : "○"}
                  </span>
                  <span style={{ color: done ? "#e2e8f0" : "#64748b", fontSize: 12 }}>{label as string}</span>
                </div>
              ))}
            </div>

            <div style={S.tip}>
              <div style={{ color: "#4ade80", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                Key Learning
              </div>
              <div style={{ color: "#86efac", fontSize: 12, lineHeight: 1.6 }}>
                Vanishing cream formation depends on precise temperatures, correct ingredient proportions,
                proper mixing order, sufficient stirring, and controlled cooling. Every step affects
                the stability, pH, and viscosity of the final product.
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ position: "fixed", top: 0, right: 0, height: "100vh", width: 400,
      background: "#0f172a", borderLeft: "1px solid #1e293b", zIndex: 100,
      display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,0.6)" }}>

      {/* ── Header ── */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #1e293b",
        background: "#080f1e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "white", fontWeight: 800, fontSize: 16 }}>Lab Workbook</div>
          <div style={{ color: "#475569", fontSize: 11 }}>Vanishing Cream — O/W Emulsion</div>
        </div>
        <button onClick={onClose} style={{ background: "#1e293b", border: "none", color: "#94a3b8",
          borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
      </div>

      {/* ── Section tab bar ── */}
      <div style={{ display: "flex", borderBottom: "1px solid #1e293b", background: "#080f1e",
        overflowX: "auto", flexShrink: 0 }}>
        {SECTIONS.map((sec, i) => {
          const active = sec.id === activeSection;
          return (
            <button key={sec.id} onClick={() => setActiveSection(sec.id)}
              style={{ flexShrink: 0, padding: "10px 12px", border: "none", cursor: "pointer",
                background: active ? "#0f172a" : "transparent",
                borderBottom: active ? "2px solid #3b82f6" : "2px solid transparent",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 16 }}>{sec.icon}</span>
              <span style={{ color: active ? "#60a5fa" : "#475569", fontSize: 9,
                fontWeight: active ? 700 : 500, letterSpacing: 0.5, whiteSpace: "nowrap" }}>
                {i + 1}. {sec.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Section title ── */}
      <div style={{ padding: "12px 18px 0", background: "#0a1628", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>{SECTIONS[currentIdx].icon}</span>
          <div>
            <div style={{ color: "white", fontWeight: 700, fontSize: 14 }}>{SECTIONS[currentIdx].label}</div>
            <div style={{ color: "#475569", fontSize: 11 }}>Section {currentIdx + 1} of {SECTIONS.length}</div>
          </div>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", background: "#0a1628" }}>
        {renderContent()}
      </div>

      {/* ── Footer navigation ── */}
      <div style={{ padding: "12px 18px", borderTop: "1px solid #1e293b", background: "#080f1e",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <button
          onClick={() => currentIdx > 0 && setActiveSection(SECTIONS[currentIdx - 1].id)}
          disabled={currentIdx === 0}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: currentIdx === 0 ? "not-allowed" : "pointer",
            background: currentIdx === 0 ? "#1e293b" : "#334155",
            color: currentIdx === 0 ? "#374151" : "#e2e8f0", fontWeight: 600, fontSize: 13 }}>
          ← Previous
        </button>

        {/* Section dots */}
        <div style={{ display: "flex", gap: 5 }}>
          {SECTIONS.map((s, i) => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              style={{ width: 8, height: 8, borderRadius: "50%", border: "none", cursor: "pointer", padding: 0,
                background: s.id === activeSection ? "#3b82f6" : "#334155" }} />
          ))}
        </div>

        <button
          onClick={() => currentIdx < SECTIONS.length - 1 && setActiveSection(SECTIONS[currentIdx + 1].id)}
          disabled={currentIdx === SECTIONS.length - 1}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none",
            cursor: currentIdx === SECTIONS.length - 1 ? "not-allowed" : "pointer",
            background: currentIdx === SECTIONS.length - 1 ? "#1e293b" : "#1d4ed8",
            color: currentIdx === SECTIONS.length - 1 ? "#374151" : "white", fontWeight: 600, fontSize: 13 }}>
          Next →
        </button>
      </div>
    </div>
  );
};

export default ProtocolSidebar;
