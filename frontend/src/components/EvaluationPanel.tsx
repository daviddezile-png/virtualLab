import React, { useState, useEffect } from "react";
import { evaluateFormulation, FormulationInput, EvaluationResult } from "../simulation/engine";
import { Apparatus } from "./apparatusData";

interface Props { isOpen: boolean; onClose: () => void; apparatus: Apparatus[]; }

// ── helpers ───────────────────────────────────────────────────────────────────

const StatusIcon: React.FC<{ status: "pass"|"warn"|"fail" }> = ({ status }) => {
  const cfg = {
    pass: { bg:"#052e16", border:"#16a34a", icon:"✓", color:"#4ade80" },
    warn: { bg:"#1c1200", border:"#ca8a04", icon:"⚠", color:"#fbbf24" },
    fail: { bg:"#2d0a0a", border:"#dc2626", icon:"✗", color:"#f87171" },
  }[status];
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", justifyContent:"center",
      width:22, height:22, borderRadius:"50%",
      background:cfg.bg, border:`1.5px solid ${cfg.border}`,
      color:cfg.color, fontSize:13, fontWeight:800, flexShrink:0,
    }}>{cfg.icon}</span>
  );
};

const CheckRow: React.FC<{ label:string; got:string; target:string; status:"pass"|"warn"|"fail" }> = ({ label, got, target, status }) => {
  const color = status==="pass" ? "#4ade80" : status==="warn" ? "#fbbf24" : "#f87171";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
      <StatusIcon status={status} />
      <div style={{ flex:1 }}>
        <div style={{ color:"#e2e8f0", fontSize:13, fontWeight:600 }}>{label}</div>
        <div style={{ fontSize:11, marginTop:2, display:"flex", gap:8 }}>
          <span style={{ color, fontFamily:"monospace" }}>Got: {got}</span>
          <span style={{ color:"#4b5563" }}>|</span>
          <span style={{ color:"#6b7280" }}>Target: {target}</span>
        </div>
      </div>
    </div>
  );
};

const ProductJar: React.FC<{ result:"PASS"|"AVERAGE"|"FAIL" }> = ({ result }) => {
  const cream =
    result==="PASS"    ? { color:"#f5f0e8", label:"Smooth White Cream",         texture:"smooth" }
  : result==="AVERAGE" ? { color:"#e8e0cc", label:"Slightly Unstable Cream",    texture:"dull"   }
  :                      { color:"#d4c9a8", label:"Phase Separated / Grainy",   texture:"fail"   };
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
      <div style={{ position:"relative", width:90, height:68 }}>
        <div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)",
          width:70, height:14, borderRadius:"6px 6px 0 0",
          background:"linear-gradient(180deg,#94a3b8,#64748b)", border:"1px solid #475569" }} />
        <div style={{ position:"absolute", top:14, left:"50%", transform:"translateX(-50%)",
          width:80, height:54, borderRadius:"0 0 12px 12px",
          border:"1.5px solid rgba(148,163,184,0.7)", overflow:"hidden",
          backgroundColor:"rgba(200,220,240,0.15)" }}>
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"78%",
            backgroundColor:cream.color,
            borderTop: cream.texture==="fail" ? "3px dashed rgba(150,130,80,0.6)" : "2px solid rgba(255,255,255,0.5)" }}>
            {cream.texture==="smooth" && (
              <div style={{ position:"absolute", top:4, left:8, right:8, height:6,
                borderRadius:3, background:"rgba(255,255,255,0.55)" }} />
            )}
            {cream.texture==="fail" && (
              <>
                <div style={{ position:"absolute", top:6, left:6, width:18, height:10, borderRadius:4, background:"rgba(220,200,150,0.6)" }} />
                <div style={{ position:"absolute", top:14, left:22, width:12, height:8, borderRadius:3, background:"rgba(180,170,120,0.5)" }} />
              </>
            )}
          </div>
          <div style={{ position:"absolute", top:14, left:"50%", transform:"translateX(-50%)",
            width:52, height:22, borderRadius:3, background:"white", border:"1px solid #cbd5e1",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:6, fontWeight:700, color:"#334155", textAlign:"center", padding:"2px 3px" }}>
            VANISHING CREAM
          </div>
        </div>
      </div>
      <div style={{ color: result==="PASS" ? "#4ade80" : result==="AVERAGE" ? "#fbbf24" : "#f87171",
        fontSize:12, fontWeight:600, textAlign:"center" }}>{cream.label}</div>
    </div>
  );
};

// ── styled input ──────────────────────────────────────────────────────────────

const Inp: React.FC<{ value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }> = ({ value, onChange, min=0, max=9999, step=0.5 }) => (
  <input
    type="number"
    value={value}
    min={min}
    max={max}
    step={step}
    onChange={e => onChange(parseFloat(e.target.value) || 0)}
    style={{
      width:"100%", background:"#1e293b", border:"1.5px solid #334155",
      color:"#f1f5f9", fontSize:14, borderRadius:8, padding:"8px 12px",
      outline:"none", boxSizing:"border-box", fontFamily:"monospace",
    }}
    onFocus={e => (e.target.style.borderColor = "#3b82f6")}
    onBlur={e  => (e.target.style.borderColor = "#334155")}
  />
);

const Sel: React.FC<{ value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }> = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    style={{
      width:"100%", background:"#1e293b", border:"1.5px solid #334155",
      color:"#f1f5f9", fontSize:14, borderRadius:8, padding:"8px 12px",
      outline:"none", boxSizing:"border-box",
    }}
    onFocus={e => (e.target.style.borderColor = "#3b82f6")}
    onBlur={e  => (e.target.style.borderColor = "#334155")}
  >
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const Label: React.FC<{ text: string; hint?: string }> = ({ text, hint }) => (
  <label style={{ display:"block", color:"#94a3b8", fontSize:11, fontWeight:600, marginBottom:5,
    textTransform:"uppercase", letterSpacing:0.6 }}>
    {text}{hint && <span style={{ color:"#4b5563", fontWeight:400, textTransform:"none", marginLeft:5 }}>({hint})</span>}
  </label>
);

const Field: React.FC<{ text: string; hint?: string; children: React.ReactNode }> = ({ text, hint, children }) => (
  <div style={{ marginBottom:12 }}>
    <Label text={text} hint={hint} />
    {children}
  </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ color:"#64748b", fontSize:10, fontWeight:700, letterSpacing:2,
    marginBottom:10, marginTop:4, textTransform:"uppercase" }}>{children}</div>
);

// ── main component ─────────────────────────────────────────────────────────────

const EvaluationPanel: React.FC<Props> = ({ isOpen, onClose, apparatus }) => {
  const getInitialForm = (): FormulationInput => {
    const mainBeaker = apparatus.find(a => a.id === "beaker-500-main");
    const oilBeaker  = apparatus.find(a => a.id === "beaker-250-oil");
    const aqBeaker   = apparatus.find(a => a.id === "beaker-250-aqueous");

    // ── Ingredients: merge composition from all beakers ──────────────────────
    const merge = (key: keyof NonNullable<NonNullable<Apparatus["data"]>["composition"]>) =>
      (mainBeaker?.data?.composition?.[key] ?? 0) +
      (oilBeaker?.data?.composition?.[key]  ?? 0) +
      (aqBeaker?.data?.composition?.[key]   ?? 0);

    const solidStearic =
      (mainBeaker?.data?.solidStearicGrams ?? 0) +
      (oilBeaker?.data?.solidStearicGrams  ?? 0);

    // ── Oil phase temperature: max temp reached while heating oil beaker ─────
    const oilMaxTemp = Math.max(
      oilBeaker?.data?.maxTemperatureReached ?? 25,
      mainBeaker?.data?.maxTemperatureReached ?? 25,   // fallback if poured into main directly
    );

    // ── Aqueous phase temperature: max temp reached in aqueous beaker ────────
    const aqMaxTemp = aqBeaker?.data?.maxTemperatureReached ?? 25;

    // ── Mixing order: derived from pour history of the main mixing beaker ────
    const history = mainBeaker?.data?.pouringSourceHistory ?? [];
    let mixingOrder: "aqueous_to_oil" | "oil_to_aqueous" = "aqueous_to_oil";
    const oilIdx = history.findIndex(id => id === "beaker-250-oil");
    const aqIdx  = history.findIndex(id => id === "beaker-250-aqueous");
    if (oilIdx !== -1 && aqIdx !== -1) {
      // Oil poured first, then aqueous added into it → aqueous_to_oil (correct)
      // Aqueous poured first, then oil added → oil_to_aqueous (incorrect)
      mixingOrder = oilIdx < aqIdx ? "aqueous_to_oil" : "oil_to_aqueous";
    }

    // ── Mixing time: total seconds stirred in main beaker ────────────────────
    const stirSec = Math.round(mainBeaker?.data?.stirringSeconds ?? 0);

    // ── Cooling temperature: lowest temperature reached in ice bucket ─────────
    const minCool = Math.round(mainBeaker?.data?.minCoolingTemp ?? 100);
    // If never put in ice bucket, default to a sensible prompt value
    const coolingTemp = minCool < 99 ? minCool : 35;

    return {
      stearic_acid:              Math.round((merge("stearicAcid") + solidStearic) * 10) / 10,
      liquid_paraffin:           Math.round(merge("liquidParaffin") * 10) / 10,
      glycerin:                  Math.round(merge("glycerin") * 10) / 10,
      potassium_hydroxide:       Math.round(merge("koh") * 10) / 10,
      water:                     Math.round(merge("water") * 10) / 10,
      oil_phase_temperature:     Math.round(oilMaxTemp),
      aqueous_phase_temperature: Math.round(aqMaxTemp),
      mixing_order:              mixingOrder,
      mixing_time:               stirSec,
      cooling_temperature:       coolingTemp,
      cooling_stirring:          stirSec > 0,
    };
  };

  const [form,   setForm]   = useState<FormulationInput>(getInitialForm);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error,  setError]  = useState("");

  // Re-sync form from apparatus every time the panel is opened
  useEffect(() => {
    if (isOpen) {
      setForm(getInitialForm());
      setResult(null);
      setError("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const set = <K extends keyof FormulationInput>(k: K, v: FormulationInput[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleEvaluate = () => {
    setError("");
    try { setResult(evaluateFormulation(form)); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Evaluation failed."); }
  };

  const resultColor = result
    ? result.result==="PASS" ? "#4ade80" : result.result==="AVERAGE" ? "#fbbf24" : "#f87171"
    : "#60a5fa";

  const buildChecklist = (r: EvaluationResult, f: FormulationInput) => {
    const td = Math.abs(f.oil_phase_temperature - f.aqueous_phase_temperature);
    return [
      { label:"Stearic Acid %",          got:`${r.percentages.stearic}%`,   target:"15–20%",
        status:(r.percentages.stearic>=15 && r.percentages.stearic<=20 ? "pass" : r.percentages.stearic>=12 && r.percentages.stearic<=23 ? "warn" : "fail") as "pass"|"warn"|"fail" },
      { label:"Liquid Paraffin %",        got:`${r.percentages.paraffin}%`,  target:"5–10%",
        status:(r.percentages.paraffin>=5 && r.percentages.paraffin<=10 ? "pass" : r.percentages.paraffin>=2 && r.percentages.paraffin<=13 ? "warn" : "fail") as "pass"|"warn"|"fail" },
      { label:"Glycerin %",               got:`${r.percentages.glycerin}%`,  target:"2–5%",
        status:(r.percentages.glycerin>=2 && r.percentages.glycerin<=5 ? "pass" : r.percentages.glycerin>=0.5 && r.percentages.glycerin<=8 ? "warn" : "fail") as "pass"|"warn"|"fail" },
      { label:"KOH & TEA %",             got:`${r.percentages.koh}%`,       target:"0.5–2%",
        status:(r.percentages.koh>=0.5 && r.percentages.koh<=2 ? "pass" : r.percentages.koh>0 && r.percentages.koh<=5 ? "warn" : "fail") as "pass"|"warn"|"fail" },
      { label:"Distilled Water %",        got:`${r.percentages.water}%`,     target:"60–75%",
        status:(r.percentages.water>=60 && r.percentages.water<=75 ? "pass" : r.percentages.water>=57 && r.percentages.water<=78 ? "warn" : "fail") as "pass"|"warn"|"fail" },
      { label:"Oil Phase Temperature",    got:`${f.oil_phase_temperature}°C`,  target:"70–80°C",
        status:(f.oil_phase_temperature>=70 && f.oil_phase_temperature<=80 ? "pass" : f.oil_phase_temperature>=60 && f.oil_phase_temperature<=90 ? "warn" : "fail") as "pass"|"warn"|"fail" },
      { label:"Aqueous Phase Temperature",got:`${f.aqueous_phase_temperature}°C`, target:"70–80°C",
        status:(f.aqueous_phase_temperature>=70 && f.aqueous_phase_temperature<=80 ? "pass" : f.aqueous_phase_temperature>=60 && f.aqueous_phase_temperature<=90 ? "warn" : "fail") as "pass"|"warn"|"fail" },
      { label:"Temperature Difference",   got:`${td.toFixed(1)}°C`,          target:"≤5°C",
        status:(td<=5 ? "pass" : td<=10 ? "warn" : "fail") as "pass"|"warn"|"fail" },
      { label:"Mixing Order",             got: f.mixing_order==="aqueous_to_oil" ? "Aqueous → Oil" : "Oil → Aqueous", target:"Aqueous → Oil",
        status:(f.mixing_order==="aqueous_to_oil" ? "pass" : "fail") as "pass"|"warn"|"fail" },
      { label:"Mixing Time",              got:`${f.mixing_time} s`,          target:"≥30 s",
        status:(f.mixing_time>=30 ? "pass" : f.mixing_time>=20 ? "warn" : "fail") as "pass"|"warn"|"fail" },
      { label:"Cooling Temperature",      got:`${f.cooling_temperature}°C`,  target:"≤40°C",
        status:(f.cooling_temperature<=40 ? "pass" : f.cooling_temperature<=50 ? "warn" : "fail") as "pass"|"warn"|"fail" },
      { label:"Cooling with Stirring",    got: f.cooling_stirring ? "Yes" : "No", target:"Yes",
        status:(f.cooling_stirring ? "pass" : "fail") as "pass"|"warn"|"fail" },
      { label:"Predicted pH",             got: r.predicted_pH.toFixed(2),    target:"5.0–7.0",
        status:(r.predicted_pH>=5 && r.predicted_pH<=7 ? "pass" : r.predicted_pH>=4.5 && r.predicted_pH<=8 ? "warn" : "fail") as "pass"|"warn"|"fail" },
      { label:"Predicted Viscosity",      got:`${r.predicted_viscosity} cP`, target:"1100–1800 cP",
        status:(r.predicted_viscosity>=1100 && r.predicted_viscosity<=1800 ? "pass" : r.predicted_viscosity>=800 && r.predicted_viscosity<=2200 ? "warn" : "fail") as "pass"|"warn"|"fail" },
    ];
  };

  const checklist   = result ? buildChecklist(result, form) : [];
  const passCount   = checklist.filter(i => i.status==="pass").length;
  const totalSteps  = 14;

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)",
      zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:12 }}>
      <div style={{ background:"#0f172a", borderRadius:16, border:"1px solid #1e293b",
        width:"min(1060px, 97vw)", maxHeight:"95vh", display:"flex", flexDirection:"column",
        overflow:"hidden", boxShadow:"0 24px 80px rgba(0,0,0,0.7)" }}>

        {/* ── Header ── */}
        <div style={{ padding:"14px 24px", borderBottom:"1px solid #1e293b",
          background:"#080f1e", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ color:"white", fontWeight:800, fontSize:18 }}>Formulation Evaluator</div>
            <div style={{ color:"#64748b", fontSize:12 }}>Vanishing Cream — Procedure Verification</div>
          </div>
          <button onClick={onClose} style={{ background:"#1e293b", border:"none", color:"#94a3b8",
            borderRadius:8, width:34, height:34, cursor:"pointer", fontSize:22, lineHeight:1 }}>×</button>
        </div>

        {/* ── Body ── */}
        <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

          {/* ── LEFT: inputs ── */}
          <div style={{ width:310, flexShrink:0, borderRight:"1px solid #1e293b",
            padding:"16px 18px", overflowY:"auto", background:"#0a1628" }}>

            <SectionTitle>Ingredients</SectionTitle>

            <Field text="Stearic Acid" hint="grams">
              <Inp value={form.stearic_acid} onChange={v => set("stearic_acid", v)} min={0} max={500} step={0.5} />
            </Field>
            <Field text="Liquid Paraffin" hint="mL">
              <Inp value={form.liquid_paraffin} onChange={v => set("liquid_paraffin", v)} min={0} max={500} step={0.5} />
            </Field>
            <Field text="Glycerin" hint="mL">
              <Inp value={form.glycerin} onChange={v => set("glycerin", v)} min={0} max={500} step={0.5} />
            </Field>
            <Field text="KOH & Triethanolamine" hint="mL">
              <Inp value={form.potassium_hydroxide} onChange={v => set("potassium_hydroxide", v)} min={0} max={100} step={0.1} />
            </Field>
            <Field text="Distilled Water" hint="mL">
              <Inp value={form.water} onChange={v => set("water", v)} min={0} max={1000} step={1} />
            </Field>

            <div style={{ borderTop:"1px solid #1e293b", margin:"14px 0" }} />
            <SectionTitle>Temperatures (°C)</SectionTitle>

            <Field text="Oil Phase Temperature">
              <Inp value={form.oil_phase_temperature} onChange={v => set("oil_phase_temperature", v)} min={0} max={200} step={1} />
            </Field>
            <Field text="Aqueous Phase Temperature">
              <Inp value={form.aqueous_phase_temperature} onChange={v => set("aqueous_phase_temperature", v)} min={0} max={200} step={1} />
            </Field>

            <div style={{ borderTop:"1px solid #1e293b", margin:"14px 0" }} />
            <SectionTitle>Process Parameters</SectionTitle>

            <Field text="Mixing Order">
              <Sel
                value={form.mixing_order}
                onChange={v => set("mixing_order", v as "aqueous_to_oil"|"oil_to_aqueous")}
                options={[
                  { value:"aqueous_to_oil",  label:"Aqueous → Oil  (correct)" },
                  { value:"oil_to_aqueous",  label:"Oil → Aqueous  (incorrect)" },
                ]}
              />
            </Field>
            <Field text="Mixing Time" hint="seconds">
              <Inp value={form.mixing_time} onChange={v => set("mixing_time", v)} min={0} max={600} step={5} />
            </Field>
            <Field text="Cooling Temperature" hint="°C">
              <Inp value={form.cooling_temperature} onChange={v => set("cooling_temperature", v)} min={0} max={100} step={1} />
            </Field>

            <Field text="Cooling with Stirring">
              <div style={{ display:"flex", gap:20, marginTop:4 }}>
                {([true, false] as const).map(v => (
                  <label key={String(v)} style={{ display:"flex", alignItems:"center", gap:8,
                    cursor:"pointer", color: form.cooling_stirring===v ? "#60a5fa" : "#94a3b8", fontSize:14, fontWeight:600 }}>
                    <input type="radio" name="cool_stir" checked={form.cooling_stirring===v}
                      onChange={() => set("cooling_stirring", v)}
                      style={{ accentColor:"#3b82f6", width:16, height:16 }} />
                    {v ? "Yes" : "No"}
                  </label>
                ))}
              </div>
            </Field>

            {error && (
              <div style={{ background:"#450a0a", border:"1px solid #f87171", color:"#fca5a5",
                borderRadius:8, padding:"10px 12px", fontSize:13, marginBottom:10 }}>{error}</div>
            )}

            <button onClick={handleEvaluate} style={{
              width:"100%", marginTop:4,
              background:"linear-gradient(135deg,#1d4ed8,#7c3aed)",
              color:"white", border:"none", borderRadius:10, padding:"13px 0",
              fontWeight:800, fontSize:15, cursor:"pointer", letterSpacing:1,
              boxShadow:"0 4px 18px rgba(37,99,235,0.45)",
            }}>
              ⚗ EVALUATE FORMULATION
            </button>

            {/* Refresh from lab button */}
            <button onClick={() => { setForm(getInitialForm()); setResult(null); }} style={{
              width:"100%", marginTop:8,
              background:"#1e293b", color:"#94a3b8",
              border:"1px solid #334155", borderRadius:10, padding:"8px 0",
              fontWeight:600, fontSize:12, cursor:"pointer",
            }}>
              ↺ Refresh values from lab
            </button>
          </div>

          {/* ── RIGHT: results ── */}
          <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>
            {!result ? (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                justifyContent:"center", height:"100%", color:"#4b5563", textAlign:"center" }}>
                <div style={{ fontSize:56, marginBottom:14 }}>⚗️</div>
                <div style={{ fontSize:17, fontWeight:700, color:"#64748b" }}>Ready to evaluate</div>
                <div style={{ fontSize:13, marginTop:8, color:"#4b5563", lineHeight:1.6 }}>
                  Fill in the parameters on the left<br />
                  then click <strong style={{ color:"#3b82f6" }}>EVALUATE FORMULATION</strong>
                </div>
              </div>
            ) : (
              <>
                {/* ── Result strip ── */}
                <div style={{ background: result.result==="PASS" ? "#052e16" : result.result==="AVERAGE" ? "#1c1200" : "#2d0a0a",
                  border:`2px solid ${resultColor}`, borderRadius:14, padding:"16px 20px", marginBottom:16,
                  display:"flex", alignItems:"center", gap:20 }}>

                  <ProductJar result={result.result} />

                  <div style={{ flex:1 }}>
                    <div style={{ color:resultColor, fontSize:36, fontWeight:900, letterSpacing:3 }}>
                      {result.result}
                    </div>
                    <div style={{ color:"#94a3b8", fontSize:13, marginTop:2 }}>
                      {result.result==="PASS"    ? "Excellent! Your procedure is correct." :
                       result.result==="AVERAGE" ? "Good attempt — some steps need improvement." :
                                                   "Incorrect procedure — please review and redo."}
                    </div>
                    <div style={{ marginTop:10 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#6b7280", marginBottom:3 }}>
                        <span>FINAL SCORE</span>
                        <span style={{ color:resultColor, fontWeight:700 }}>{result.score.toFixed(1)} / 10</span>
                      </div>
                      <div style={{ height:8, background:"#1e293b", borderRadius:4, overflow:"hidden" }}>
                        <div style={{ height:"100%", borderRadius:4, width:`${Math.min(result.score/10*100,100)}%`,
                          background:resultColor, transition:"width 0.8s ease" }} />
                      </div>
                    </div>
                    <div style={{ marginTop:8, display:"flex", gap:12 }}>
                      {[
                        { label:"Steps Correct", value:`${passCount} / ${totalSteps}`, color:"#4ade80" },
                        { label:"Stability",     value:result.stability.toUpperCase(),
                          color: result.stability==="stable" ? "#4ade80" : result.stability==="unstable" ? "#fbbf24" : "#f87171" },
                        { label:"pH",            value:result.predicted_pH.toFixed(2),
                          color: result.predicted_pH>=5 && result.predicted_pH<=7 ? "#4ade80" : "#f87171" },
                        { label:"Viscosity",     value:`${result.predicted_viscosity} cP`,
                          color: result.predicted_viscosity>=1100 && result.predicted_viscosity<=1800 ? "#4ade80" : "#f59e0b" },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ background:"rgba(0,0,0,0.25)", borderRadius:8, padding:"5px 10px" }}>
                          <div style={{ color:"#6b7280", fontSize:9, textTransform:"uppercase" }}>{label}</div>
                          <div style={{ color, fontWeight:700, fontSize:13 }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Procedure checklist ── */}
                <div style={{ background:"#0d1b2e", border:"1px solid #1e293b", borderRadius:12,
                  padding:"14px 16px", marginBottom:14 }}>
                  <div style={{ color:"#94a3b8", fontSize:10, fontWeight:700, letterSpacing:2, marginBottom:10 }}>
                    PROCEDURE VERIFICATION — {passCount} / {totalSteps} STEPS CORRECT
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 24px" }}>
                    {checklist.map(item => <CheckRow key={item.label} {...item} />)}
                  </div>
                </div>

                {/* ── Feedback ── */}
                {result.feedback.length > 0 ? (
                  <div style={{ background:"#1c1200", border:"1px solid #78350f", borderRadius:12, padding:"14px 16px" }}>
                    <div style={{ color:"#fbbf24", fontSize:10, fontWeight:700, letterSpacing:2, marginBottom:8 }}>
                      CORRECTIONS NEEDED
                    </div>
                    {result.feedback.map((msg, i) => (
                      <div key={i} style={{ display:"flex", gap:8, marginBottom:6, fontSize:13, color:"#fcd34d" }}>
                        <span style={{ flexShrink:0 }}>▸</span><span>{msg}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ background:"#052e16", border:"1px solid #166534", borderRadius:12,
                    padding:"14px 16px", color:"#6ee7b7", fontSize:13,
                    display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:24 }}>🎉</span>
                    <span><strong>All steps correct!</strong> Your vanishing cream formulation follows the ideal procedure. Well done!</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvaluationPanel;
