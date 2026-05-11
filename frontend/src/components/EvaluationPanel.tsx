import React, { useState, useEffect } from "react";
import { evaluateFormulation, FormulationInput, EvaluationResult,
         evaluateColdCream, ColdCreamInput, ColdCreamResult } from "../simulation/engine";
import { Apparatus } from "./apparatusData";

interface Props { isOpen: boolean; onClose: () => void; apparatus: Apparatus[]; practicalId?: string; }

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

// ── detected value row (read-only) ────────────────────────────────────────────
const DetectedRow: React.FC<{ label:string; value:string; inRange: boolean|null }> = ({ label, value, inRange }) => {
  const color = inRange === null ? "#94a3b8" : inRange ? "#4ade80" : "#f87171";
  const dot   = inRange === null ? "#475569" : inRange ? "#16a34a" : "#dc2626";
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"6px 10px", borderRadius:7, background:"rgba(255,255,255,0.03)",
      marginBottom:4, border:`1px solid ${dot}33` }}>
      <span style={{ color:"#94a3b8", fontSize:12 }}>{label}</span>
      <span style={{ color, fontSize:13, fontWeight:700, fontFamily:"monospace",
        background:`${dot}18`, padding:"2px 8px", borderRadius:5 }}>{value}</span>
    </div>
  );
};

// ── product jar visual ────────────────────────────────────────────────────────
const ProductJar: React.FC<{ result:"PASS"|"AVERAGE"|"FAIL" }> = ({ result }) => {
  const cream =
    result==="PASS"    ? { color:"#f5f0e8", label:"Smooth White Cream",       texture:"smooth" }
  : result==="AVERAGE" ? { color:"#e8e0cc", label:"Slightly Unstable Cream",  texture:"dull"   }
  :                      { color:"#c8b870", label:"Phase Separated / Grainy", texture:"fail"   };
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
      <div style={{ position:"relative", width:100, height:76 }}>
        {/* lid */}
        <div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)",
          width:76, height:16, borderRadius:"7px 7px 0 0",
          background:"linear-gradient(180deg,#94a3b8,#64748b)", border:"1px solid #475569" }} />
        {/* jar body */}
        <div style={{ position:"absolute", top:16, left:"50%", transform:"translateX(-50%)",
          width:88, height:60, borderRadius:"0 0 14px 14px",
          border:"1.5px solid rgba(148,163,184,0.7)", overflow:"hidden",
          backgroundColor:"rgba(200,220,240,0.15)" }}>
          {/* content fill */}
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"80%",
            backgroundColor:cream.color,
            borderTop: cream.texture==="fail"
              ? "4px dashed rgba(120,100,40,0.7)"
              : "2px solid rgba(255,255,255,0.55)" }}>
            {cream.texture==="smooth" && (
              <>
                <div style={{ position:"absolute", top:5, left:10, right:10, height:7,
                  borderRadius:4, background:"rgba(255,255,255,0.6)" }} />
                <div style={{ position:"absolute", top:16, left:18, width:30, height:4,
                  borderRadius:2, background:"rgba(255,255,255,0.35)" }} />
              </>
            )}
            {cream.texture==="fail" && (
              <>
                <div style={{ position:"absolute", top:4, left:6, width:20, height:12,
                  borderRadius:5, background:"rgba(240,220,140,0.7)" }} />
                <div style={{ position:"absolute", top:16, left:24, width:14, height:10,
                  borderRadius:3, background:"rgba(180,160,100,0.55)" }} />
                <div style={{ position:"absolute", top:8, right:8, width:10, height:18,
                  borderRadius:4, background:"rgba(210,190,120,0.4)" }} />
              </>
            )}
          </div>
          {/* label */}
          <div style={{ position:"absolute", top:14, left:"50%", transform:"translateX(-50%)",
            width:58, height:22, borderRadius:3, background:"white", border:"1px solid #cbd5e1",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:5.5, fontWeight:700, color:"#334155", textAlign:"center", padding:"2px 3px" }}>
            VANISHING CREAM
          </div>
        </div>
      </div>
      <div style={{ color: result==="PASS" ? "#4ade80" : result==="AVERAGE" ? "#fbbf24" : "#f87171",
        fontSize:12, fontWeight:700, textAlign:"center", letterSpacing:0.3 }}>{cream.label}</div>
    </div>
  );
};

// ── read lab state into FormulationInput ──────────────────────────────────────
function readLabState(apparatus: Apparatus[]): FormulationInput {
  const mainBeaker = apparatus.find(a => a.id === "beaker-500-main");
  const oilBeaker  = apparatus.find(a => a.id === "beaker-250-oil");
  const aqBeaker   = apparatus.find(a => a.id === "beaker-250-aqueous");

  const merge = (key: keyof NonNullable<NonNullable<Apparatus["data"]>["composition"]>) =>
    (mainBeaker?.data?.composition?.[key] ?? 0) +
    (oilBeaker?.data?.composition?.[key]  ?? 0) +
    (aqBeaker?.data?.composition?.[key]   ?? 0);

  const solidStearic =
    (mainBeaker?.data?.solidStearicGrams ?? 0) +
    (oilBeaker?.data?.solidStearicGrams  ?? 0);

  const oilMaxTemp = Math.max(
    oilBeaker?.data?.maxTemperatureReached  ?? 25,
    mainBeaker?.data?.maxTemperatureReached ?? 25,
  );
  const aqMaxTemp = aqBeaker?.data?.maxTemperatureReached ?? 25;

  const history = mainBeaker?.data?.pouringSourceHistory ?? [];
  let mixingOrder: "aqueous_to_oil" | "oil_to_aqueous" = "oil_to_aqueous";
  const oilIdx = history.findIndex(id => id === "beaker-250-oil");
  const aqIdx  = history.findIndex(id => id === "beaker-250-aqueous");
  if (oilIdx !== -1 && aqIdx !== -1) {
    // Oil poured first into main, aqueous added later → aqueous into oil = correct
    mixingOrder = oilIdx < aqIdx ? "aqueous_to_oil" : "oil_to_aqueous";
  }

  const stirSec = Math.round(mainBeaker?.data?.stirringSeconds ?? 0);

  // Cooling temperature: use recorded minimum from ice bucket, or current liquid temp if never cooled
  const rawMinCool = mainBeaker?.data?.minCoolingTemp;
  const coolingTemp = (rawMinCool !== undefined && rawMinCool < 99)
    ? Math.round(rawMinCool)
    : Math.round(mainBeaker?.data?.liquidTemperature ?? 75);

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
}

// ── Cold Cream lab state reader ───────────────────────────────────────────────
function readColdCreamLabState(apparatus: Apparatus[]): ColdCreamInput {
  const mainBeaker = apparatus.find(a => a.id === "beaker-500-main");
  const oilBeaker  = apparatus.find(a => a.id === "beaker-250-oil");
  const aqBeaker   = apparatus.find(a => a.id === "beaker-250-aqueous");

  const merge = (key: string) =>
    ((mainBeaker?.data?.composition as Record<string,number>|undefined)?.[key] ?? 0) +
    ((oilBeaker?.data?.composition  as Record<string,number>|undefined)?.[key] ?? 0) +
    ((aqBeaker?.data?.composition   as Record<string,number>|undefined)?.[key] ?? 0);

  const solidBeeswax =
    (mainBeaker?.data?.solidBeeswaxGrams ?? 0) +
    (oilBeaker?.data?.solidBeeswaxGrams  ?? 0);

  const oilMaxTemp = Math.max(
    oilBeaker?.data?.maxTemperatureReached  ?? 25,
    mainBeaker?.data?.maxTemperatureReached ?? 25,
  );
  const aqMaxTemp = aqBeaker?.data?.maxTemperatureReached ?? 25;

  const history = mainBeaker?.data?.pouringSourceHistory ?? [];
  const oilIdx  = history.findIndex(id => id === "beaker-250-oil");
  const aqIdx   = history.findIndex(id => id === "beaker-250-aqueous");
  let mixingOrder: "aqueous_to_oil" | "oil_to_aqueous" = "oil_to_aqueous";
  if (oilIdx !== -1 && aqIdx !== -1)
    mixingOrder = oilIdx < aqIdx ? "aqueous_to_oil" : "oil_to_aqueous";

  const stirSec    = Math.round(mainBeaker?.data?.stirringSeconds ?? 0);
  const rawMinCool = mainBeaker?.data?.minCoolingTemp;
  const coolingTemp = (rawMinCool !== undefined && rawMinCool < 99)
    ? Math.round(rawMinCool)
    : Math.round(mainBeaker?.data?.liquidTemperature ?? 70);

  return {
    beeswax:                   Math.round((merge("beeswax") + solidBeeswax) * 10) / 10,
    liquid_paraffin:           Math.round(merge("liquidParaffin") * 10) / 10,
    borax:                     Math.round(merge("borax") * 10) / 10,
    water:                     Math.round(merge("water") * 10) / 10,
    oil_phase_temperature:     Math.round(oilMaxTemp),
    aqueous_phase_temperature: Math.round(aqMaxTemp),
    mixing_order:              mixingOrder,
    mixing_time:               stirSec,
    cooling_temperature:       coolingTemp,
    cooling_stirring:          stirSec > 0,
  };
}

// ── Section title ─────────────────────────────────────────────────────────────
const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ color:"#475569", fontSize:10, fontWeight:700, letterSpacing:2,
    marginBottom:8, marginTop:2, textTransform:"uppercase", display:"flex",
    alignItems:"center", gap:6 }}>
    <div style={{ flex:1, height:1, background:"#1e293b" }} />
    <span>{children}</span>
    <div style={{ flex:1, height:1, background:"#1e293b" }} />
  </div>
);

// ── main component ─────────────────────────────────────────────────────────────
const EvaluationPanel: React.FC<Props> = ({ isOpen, onClose, apparatus, practicalId = "vanishing-cream" }) => {
  const isColdCream = practicalId === "cold-cream";

  const [form,      setForm]      = useState<FormulationInput>(() => readLabState(apparatus));
  const [ccForm,    setCcForm]    = useState<ColdCreamInput>(() => readColdCreamLabState(apparatus));
  const [result,    setResult]    = useState<EvaluationResult | null>(null);
  const [ccResult,  setCcResult]  = useState<ColdCreamResult | null>(null);
  // Instrument readings captured at evaluation time (shown for reference only)
  const [gaugeVisc, setGaugeVisc] = useState<number>(0);
  const [meterPH,   setMeterPH]   = useState<number>(0);

  // Re-sync from live lab state each time panel opens
  useEffect(() => {
    if (isOpen) {
      if (isColdCream) {
        setCcForm(readColdCreamLabState(apparatus));
        setCcResult(null);
      } else {
        setForm(readLabState(apparatus));
        setResult(null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEvaluate = () => {
    const viscGauge = apparatus.find(a => a.type === "viscositygauge");
    const phMeter   = apparatus.find(a => a.type === "phmeter");
    const liveVisc  = Math.round(viscGauge?.data?.viscosityReading ?? 0);
    const livePH    = Math.round((phMeter?.data?.phReading ?? 7.0) * 100) / 100;
    setGaugeVisc(liveVisc);
    setMeterPH(livePH);

    if (isColdCream) {
      const ccLive = readColdCreamLabState(apparatus);
      setCcForm(ccLive);
      try { setCcResult(evaluateColdCream(ccLive)); }
      catch { /* no ingredients */ }
    } else {
      const live = readLabState(apparatus);
      setForm(live);
      try { setResult(evaluateFormulation(live)); }
      catch { /* no ingredients yet */ }
    }
  };


  const buildChecklist = (r: EvaluationResult, f: FormulationInput, measuredVisc: number, measuredPH: number) => {
    const td = Math.abs(f.oil_phase_temperature - f.aqueous_phase_temperature);
    // Always use formula-computed values for scoring (they are the settled/correct values).
    // The gauge/meter readings are shown as secondary info but don't affect pass/fail.
    const dispVisc = r.predicted_viscosity;
    const dispPH   = r.predicted_pH;
    return [
      { label:"Stearic Acid %",
        got:`${r.percentages.stearic}%`, target:"15–20%",
        status:(r.percentages.stearic>=15&&r.percentages.stearic<=20?"pass":r.percentages.stearic>=12&&r.percentages.stearic<=23?"warn":"fail") as "pass"|"warn"|"fail" },
      { label:"Liquid Paraffin %",
        got:`${r.percentages.paraffin}%`, target:"5–10%",
        status:(r.percentages.paraffin>=5&&r.percentages.paraffin<=10?"pass":r.percentages.paraffin>=2&&r.percentages.paraffin<=13?"warn":"fail") as "pass"|"warn"|"fail" },
      { label:"Glycerin %",
        got:`${r.percentages.glycerin}%`, target:"2–5%",
        status:(r.percentages.glycerin>=2&&r.percentages.glycerin<=5?"pass":r.percentages.glycerin>=0.5&&r.percentages.glycerin<=8?"warn":"fail") as "pass"|"warn"|"fail" },
      { label:"KOH & TEA %",
        got:`${r.percentages.koh}%`, target:"0.5–2%",
        status:(r.percentages.koh>=0.5&&r.percentages.koh<=2?"pass":r.percentages.koh>0&&r.percentages.koh<=5?"warn":"fail") as "pass"|"warn"|"fail" },
      { label:"Distilled Water %",
        got:`${r.percentages.water}%`, target:"60–75%",
        status:(r.percentages.water>=60&&r.percentages.water<=75?"pass":r.percentages.water>=57&&r.percentages.water<=78?"warn":"fail") as "pass"|"warn"|"fail" },
      { label:"Oil Phase Temperature",
        got:`${f.oil_phase_temperature}°C`, target:"70–80°C",
        status:(f.oil_phase_temperature>=70&&f.oil_phase_temperature<=80?"pass":f.oil_phase_temperature>=60&&f.oil_phase_temperature<=90?"warn":"fail") as "pass"|"warn"|"fail" },
      { label:"Aqueous Phase Temperature",
        got:`${f.aqueous_phase_temperature}°C`, target:"70–80°C",
        status:(f.aqueous_phase_temperature>=70&&f.aqueous_phase_temperature<=80?"pass":f.aqueous_phase_temperature>=60&&f.aqueous_phase_temperature<=90?"warn":"fail") as "pass"|"warn"|"fail" },
      { label:"Phase Temperature Difference",
        got:`${td.toFixed(1)}°C`, target:"≤5°C",
        status:(td<=5?"pass":td<=10?"warn":"fail") as "pass"|"warn"|"fail" },
      { label:"Mixing Order",
        got:f.mixing_order==="aqueous_to_oil"?"Oil first, then Aqueous":"Aqueous first, then Oil",
        target:"Oil first, then Aqueous",
        status:(f.mixing_order==="aqueous_to_oil"?"pass":"fail") as "pass"|"warn"|"fail" },
      { label:"Mixing Time",
        got:`${f.mixing_time} s`, target:"≥30 s",
        status:(f.mixing_time>=30?"pass":f.mixing_time>=20?"warn":"fail") as "pass"|"warn"|"fail" },
      { label:"Cooling Temperature",
        got:`${f.cooling_temperature}°C`, target:"≤40°C",
        status:(f.cooling_temperature<=40?"pass":f.cooling_temperature<=50?"warn":"fail") as "pass"|"warn"|"fail" },
      { label:"Cooling with Stirring",
        got:f.cooling_stirring?"Yes":"No", target:"Yes",
        status:(f.cooling_stirring?"pass":"fail") as "pass"|"warn"|"fail" },
      { label:`pH${measuredPH>0 ? ` (meter: ${measuredPH.toFixed(2)})` : ""}`,
        got:dispPH.toFixed(2), target:"5.0–7.0",
        status:(dispPH>=5&&dispPH<=7?"pass":dispPH>=4.5&&dispPH<=8?"warn":"fail") as "pass"|"warn"|"fail" },
      { label:`Viscosity${measuredVisc>0 ? ` (gauge: ${measuredVisc} cP)` : ""}`,
        got:`${dispVisc} cP`, target:"1100–1800 cP",
        status:(dispVisc>=1100&&dispVisc<=1800?"pass":dispVisc>=800&&dispVisc<=2200?"warn":"fail") as "pass"|"warn"|"fail" },
    ];
  };

  // Cold cream checklist
  const buildColdCreamChecklist = (r: ColdCreamResult, f: ColdCreamInput, measuredVisc: number, measuredPH: number) => {
    const td = Math.abs(f.oil_phase_temperature - f.aqueous_phase_temperature);
    const p  = r.percentages;
    return [
      { label:"Beeswax %",          got:`${p.beeswax}%`,  target:"10–16%",
        status:(p.beeswax>=10&&p.beeswax<=16?"pass":p.beeswax>=8&&p.beeswax<=18?"warn":"fail") as "pass"|"warn"|"fail" },
      { label:"Liquid Paraffin %",  got:`${p.paraffin}%`, target:"34–46%",
        status:(p.paraffin>=34&&p.paraffin<=46?"pass":p.paraffin>=28&&p.paraffin<=52?"warn":"fail") as "pass"|"warn"|"fail" },
      { label:"Borax Solution %",   got:`${p.borax}%`,    target:"2–5%",
        status:(p.borax>=2&&p.borax<=5?"pass":p.borax>=1&&p.borax<=7?"warn":"fail") as "pass"|"warn"|"fail" },
      { label:"Distilled Water %",  got:`${p.water}%`,    target:"38–52%",
        status:(p.water>=38&&p.water<=52?"pass":p.water>=34&&p.water<=56?"warn":"fail") as "pass"|"warn"|"fail" },
      { label:"Oil Phase Temperature",    got:`${f.oil_phase_temperature}°C`, target:"65–75°C",
        status:(f.oil_phase_temperature>=65&&f.oil_phase_temperature<=75?"pass":f.oil_phase_temperature>=58&&f.oil_phase_temperature<=82?"warn":"fail") as "pass"|"warn"|"fail" },
      { label:"Aqueous Phase Temperature",got:`${f.aqueous_phase_temperature}°C`, target:"65–75°C",
        status:(f.aqueous_phase_temperature>=65&&f.aqueous_phase_temperature<=75?"pass":f.aqueous_phase_temperature>=58&&f.aqueous_phase_temperature<=82?"warn":"fail") as "pass"|"warn"|"fail" },
      { label:"Phase Temperature Difference", got:`${td.toFixed(1)}°C`, target:"≤5°C",
        status:(td<=5?"pass":td<=10?"warn":"fail") as "pass"|"warn"|"fail" },
      { label:"Mixing Order",       got:f.mixing_order==="aqueous_to_oil"?"Oil first, then Aqueous":"Aqueous first, then Oil", target:"Oil first, then Aqueous",
        status:(f.mixing_order==="aqueous_to_oil"?"pass":"fail") as "pass"|"warn"|"fail" },
      { label:"Mixing Time",        got:`${f.mixing_time} s`, target:"≥20 s",
        status:(f.mixing_time>=20?"pass":f.mixing_time>=12?"warn":"fail") as "pass"|"warn"|"fail" },
      { label:"Cooling Temperature",got:`${f.cooling_temperature}°C`, target:"≤35°C",
        status:(f.cooling_temperature<=35?"pass":f.cooling_temperature<=45?"warn":"fail") as "pass"|"warn"|"fail" },
      { label:"Cooling with Stirring",got:f.cooling_stirring?"Yes":"No", target:"Yes",
        status:(f.cooling_stirring?"pass":"fail") as "pass"|"warn"|"fail" },
      { label:`pH${measuredPH>0?` (meter: ${measuredPH.toFixed(2)})`:""}`,
        got:r.predicted_pH.toFixed(2), target:"6.0–7.5",
        status:(r.predicted_pH>=6&&r.predicted_pH<=7.5?"pass":r.predicted_pH>=5.5&&r.predicted_pH<=8?"warn":"fail") as "pass"|"warn"|"fail" },
      { label:`Viscosity${measuredVisc>0?` (gauge: ${measuredVisc} cP)`:""}`,
        got:`${r.predicted_viscosity} cP`, target:"2000–6000 cP",
        status:(r.predicted_viscosity>=2000&&r.predicted_viscosity<=6000?"pass":r.predicted_viscosity>=1500&&r.predicted_viscosity<=7000?"warn":"fail") as "pass"|"warn"|"fail" },
    ];
  };

  const checklist  = isColdCream
    ? (ccResult ? buildColdCreamChecklist(ccResult, ccForm, gaugeVisc, meterPH) : [])
    : (result   ? buildChecklist(result, form, gaugeVisc, meterPH) : []);
  const passCount  = checklist.filter(i => i.status==="pass").length;
  const warnCount  = checklist.filter(i => i.status==="warn").length;
  const totalSteps = isColdCream ? 13 : 14;

  // Display result is driven by the CHECKLIST, not the engine's internal result field,
  // so 14/14 correct always shows PASS regardless of engine weighting quirks.
  const displayResult: "PASS" | "AVERAGE" | "FAIL" =
    passCount === totalSteps               ? "PASS"
    : passCount + warnCount >= totalSteps  ? "AVERAGE"   // all pass or warn, none hard-fail
    : passCount >= 10                      ? "AVERAGE"
    :                                        "FAIL";

  const resultColor =
    displayResult === "PASS"    ? "#4ade80"
    : displayResult === "AVERAGE" ? "#fbbf24"
    :                               "#f87171";

  // ── Detected value helpers ─────────────────────────────────────────────────
  const totalIngredients = isColdCream
    ? ccForm.beeswax + ccForm.liquid_paraffin + ccForm.borax + ccForm.water
    : form.stearic_acid + form.liquid_paraffin + form.glycerin + form.potassium_hydroxide + form.water;
  const hasIngredients = totalIngredients > 0.1;
  const activeResult   = isColdCream ? ccResult : result;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)",
      zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:12 }}>
      <div style={{ background:"#0f172a", borderRadius:16, border:"1px solid #1e293b",
        width:"min(1060px, 98vw)", maxHeight:"96vh", display:"flex", flexDirection:"column",
        overflow:"hidden", boxShadow:"0 24px 80px rgba(0,0,0,0.7)" }}>

        {/* ── Header ── */}
        <div style={{ padding:"14px 24px", borderBottom:"1px solid #1e293b",
          background:"#080f1e", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ color:"white", fontWeight:800, fontSize:18 }}>Lab Evaluation</div>
            <div style={{ color:"#64748b", fontSize:12 }}>
              {isColdCream ? "Cold Cream (W/O)" : "Vanishing Cream (O/W)"} — auto-read from your lab session
            </div>
          </div>
          <button onClick={onClose} style={{ background:"#1e293b", border:"none", color:"#94a3b8",
            borderRadius:8, width:34, height:34, cursor:"pointer", fontSize:22, lineHeight:1 }}>×</button>
        </div>

        {/* ── Body ── */}
        <div className="eval-body">

          {/* ── LEFT: detected lab values (read-only) ── */}
          <div className="eval-left">

            <div style={{ background:"#0d1b2e", border:"1px solid #1e3a5f", borderRadius:10,
              padding:"10px 14px", marginBottom:16, fontSize:12, color:"#7dd3fc", lineHeight:1.5 }}>
              <strong style={{ display:"block", marginBottom:4, color:"#38bdf8" }}>
                ℹ Auto-detected from your lab
              </strong>
              These values are recorded by the simulation as you work. You cannot edit them — the result reflects what you <em>actually did</em>.
            </div>

            <SectionTitle>Ingredients Added</SectionTitle>

            {isColdCream ? (<>
              <DetectedRow label="Beeswax"         value={`${ccForm.beeswax} g`}          inRange={null} />
              <DetectedRow label="Liquid Paraffin" value={`${ccForm.liquid_paraffin} mL`}  inRange={null} />
              <DetectedRow label="Borax Solution"  value={`${ccForm.borax} mL`}            inRange={null} />
              <DetectedRow label="Distilled Water" value={`${ccForm.water} mL`}            inRange={null} />
            </>) : (<>
              <DetectedRow label="Stearic Acid"          value={`${form.stearic_acid} g`}          inRange={null} />
              <DetectedRow label="Liquid Paraffin"       value={`${form.liquid_paraffin} mL`}       inRange={null} />
              <DetectedRow label="Glycerin"              value={`${form.glycerin} mL`}              inRange={null} />
              <DetectedRow label="KOH & Triethanolamine" value={`${form.potassium_hydroxide} mL`}   inRange={null} />
              <DetectedRow label="Distilled Water"       value={`${form.water} mL`}                 inRange={null} />
            </>)}
            <DetectedRow label="Total (approx.)" value={`${Math.round(totalIngredients * 10) / 10}`} inRange={null} />

            <div style={{ borderTop:"1px solid #1e293b", margin:"14px 0" }} />
            <SectionTitle>Temperature Reached</SectionTitle>

            {isColdCream ? (<>
              <DetectedRow label="Oil Phase (max)"     value={`${ccForm.oil_phase_temperature}°C`}     inRange={ccForm.oil_phase_temperature>=65 && ccForm.oil_phase_temperature<=75} />
              <DetectedRow label="Aqueous Phase (max)" value={`${ccForm.aqueous_phase_temperature}°C`} inRange={ccForm.aqueous_phase_temperature>=65 && ccForm.aqueous_phase_temperature<=75} />
            </>) : (<>
              <DetectedRow label="Oil Phase (max)"     value={`${form.oil_phase_temperature}°C`}     inRange={form.oil_phase_temperature>=70 && form.oil_phase_temperature<=80} />
              <DetectedRow label="Aqueous Phase (max)" value={`${form.aqueous_phase_temperature}°C`} inRange={form.aqueous_phase_temperature>=70 && form.aqueous_phase_temperature<=80} />
            </>)}

            <div style={{ borderTop:"1px solid #1e293b", margin:"14px 0" }} />
            <SectionTitle>Process Recorded</SectionTitle>

            {isColdCream ? (<>
              <DetectedRow label="Mixing Order"        value={ccForm.mixing_order==="aqueous_to_oil" ? "Oil first ✓" : "Aqueous first ✗"} inRange={ccForm.mixing_order==="aqueous_to_oil"} />
              <DetectedRow label="Stirring Time"       value={`${ccForm.mixing_time} s`}       inRange={ccForm.mixing_time>=20} />
              <DetectedRow label="Cooling Temperature" value={`${ccForm.cooling_temperature}°C`} inRange={ccForm.cooling_temperature<=35} />
              <DetectedRow label="Stirred while Cooling" value={ccForm.cooling_stirring ? "Yes ✓" : "No ✗"} inRange={ccForm.cooling_stirring} />
            </>) : (<>
              <DetectedRow label="Mixing Order"        value={form.mixing_order==="aqueous_to_oil" ? "Oil first ✓" : "Aqueous first ✗"} inRange={form.mixing_order==="aqueous_to_oil"} />
              <DetectedRow label="Stirring Time"       value={`${form.mixing_time} s`}       inRange={form.mixing_time>=30} />
              <DetectedRow label="Cooling Temperature" value={`${form.cooling_temperature}°C`} inRange={form.cooling_temperature<=40} />
              <DetectedRow label="Stirred while Cooling" value={form.cooling_stirring ? "Yes ✓" : "No ✗"} inRange={form.cooling_stirring} />
            </>)}

            <div style={{ borderTop:"1px solid #1e293b", margin:"14px 0" }} />

            {!hasIngredients && (
              <div style={{ background:"#2d0a0a", border:"1px solid #7f1d1d", borderRadius:8,
                padding:"10px 12px", color:"#fca5a5", fontSize:12, marginBottom:12 }}>
                No ingredients detected yet. Add chemicals to the beakers and complete the procedure before evaluating.
              </div>
            )}

            <button onClick={handleEvaluate}
              disabled={!hasIngredients}
              style={{
                width:"100%", marginTop:4,
                background: hasIngredients
                  ? "linear-gradient(135deg,#1d4ed8,#7c3aed)"
                  : "#1e293b",
                color: hasIngredients ? "white" : "#4b5563",
                border:"none", borderRadius:10, padding:"13px 0",
                fontWeight:800, fontSize:15, cursor: hasIngredients ? "pointer" : "not-allowed",
                letterSpacing:1,
                boxShadow: hasIngredients ? "0 4px 18px rgba(37,99,235,0.45)" : "none",
              }}>
              ⚗ EVALUATE RESULT
            </button>
          </div>

          {/* ── RIGHT: result ── */}
          <div className="eval-right">
            {!activeResult ? (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                justifyContent:"center", height:"100%", color:"#4b5563", textAlign:"center", gap:14 }}>
                <div style={{ fontSize:56 }}>⚗️</div>
                <div style={{ fontSize:17, fontWeight:700, color:"#64748b" }}>
                  Complete the procedure, then evaluate
                </div>
                <div style={{ fontSize:13, color:"#4b5563", lineHeight:1.7, maxWidth:360 }}>
                  The simulation records everything you do:<br />
                  <span style={{ color:"#3b82f6" }}>amounts poured</span>,{" "}
                  <span style={{ color:"#f59e0b" }}>temperatures reached</span>,{" "}
                  <span style={{ color:"#22c55e" }}>stirring time</span>, and{" "}
                  <span style={{ color:"#a78bfa" }}>cooling</span>.<br /><br />
                  Follow the correct procedure to produce a smooth vanishing cream. Shortcuts will result in phase separation.
                </div>

                {/* Quick procedure reminder */}
                <div style={{ background:"#0d1b2e", border:"1px solid #1e3a5f", borderRadius:12,
                  padding:"14px 18px", width:"100%", maxWidth:420, textAlign:"left" }}>
                  <div style={{ color:"#38bdf8", fontSize:11, fontWeight:700, letterSpacing:1.5,
                    textTransform:"uppercase", marginBottom:10 }}>Correct Procedure</div>
                  {[
                    ["1", "Weigh 18 g stearic acid, add to oil beaker"],
                    ["2", "Add 7 mL liquid paraffin to oil beaker"],
                    ["3", "Heat oil beaker to 75°C on hot plate"],
                    ["4", "Add 70 mL distilled water to aqueous beaker"],
                    ["5", "Add 3 mL glycerin + 1 mL KOH to aqueous beaker"],
                    ["6", "Heat aqueous beaker to 75°C on hot plate"],
                    ["7", "Pour oil phase into main beaker first"],
                    ["8", "Pour aqueous phase into oil phase (correct order)"],
                    ["9", "Stir for at least 30 seconds continuously"],
                    ["10", "Cool in ice bucket to below 40°C with stirring"],
                  ].map(([n, txt]) => (
                    <div key={n} style={{ display:"flex", gap:10, marginBottom:6, fontSize:12 }}>
                      <span style={{ color:"#3b82f6", fontWeight:700, minWidth:20 }}>{n}.</span>
                      <span style={{ color:"#94a3b8" }}>{txt}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* ── Result strip — driven by checklist passCount, not engine internals ── */}
                <div style={{
                  background: displayResult==="PASS"    ? "#052e16"
                            : displayResult==="AVERAGE" ? "#1c1200" : "#2d0a0a",
                  border:`2px solid ${resultColor}`, borderRadius:14, padding:"18px 22px", marginBottom:16,
                  display:"flex", alignItems:"center", gap:22 }}>

                  <ProductJar result={displayResult} />

                  <div style={{ flex:1 }}>
                    <div style={{ color:resultColor, fontSize:28, fontWeight:900, letterSpacing:1 }}>
                      {isColdCream
                        ? displayResult === "PASS"    ? "Cold Cream Formed!"
                          : displayResult === "AVERAGE" ? "Cold Cream Formed — Unstable"
                          : "Cold Cream Formed with Watery Texture"
                        : displayResult === "PASS"    ? "Vanishing Cream Formed!"
                          : displayResult === "AVERAGE" ? "Vanishing Cream Formed — Unstable"
                          : "Vanishing Cream Formed with Grainy Texture"}
                    </div>
                    <div style={{ color:"#94a3b8", fontSize:13, marginTop:3 }}>
                      {displayResult==="PASS"
                        ? `Excellent! Correct procedure — a quality ${isColdCream ? "cold cream (W/O emulsion)" : "vanishing cream (O/W emulsion)"} was produced.`
                        : displayResult==="AVERAGE"
                        ? "A cream was formed but the emulsion is unstable — some steps need improvement."
                        : "Cream formed but with incorrect texture due to procedural errors. Review and redo."}
                    </div>
                    {/* Score bar — normalised to /10 (engine max = 18) */}
                    <div style={{ marginTop:12 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11,
                        color:"#6b7280", marginBottom:4 }}>
                        <span>SCORE</span>
                        <span style={{ color:resultColor, fontWeight:700 }}>
                          {((activeResult?.score ?? 0) / 18 * 10).toFixed(1)} / 10
                        </span>
                      </div>
                      <div style={{ height:9, background:"#1e293b", borderRadius:5, overflow:"hidden" }}>
                        <div style={{ height:"100%", borderRadius:5,
                          width:`${Math.min((activeResult?.score ?? 0) / 18 * 100, 100)}%`,
                          background:resultColor, transition:"width 0.9s ease" }} />
                      </div>
                    </div>
                    {/* Mini stats */}
                    <div style={{ marginTop:10, display:"flex", gap:10, flexWrap:"wrap" }}>
                      {[
                        { label:"Steps",     value:`${passCount}/${totalSteps}`, color:"#4ade80" },
                        { label:"Stability", value:(activeResult?.stability ?? "unstable").toUpperCase(),
                          color:activeResult?.stability==="stable"?"#4ade80":activeResult?.stability==="unstable"?"#fbbf24":"#f87171" },
                        { label:"pH",        value:(activeResult?.predicted_pH ?? 0).toFixed(2),
                          color: isColdCream
                            ? ((activeResult?.predicted_pH ?? 0)>=6&&(activeResult?.predicted_pH ?? 0)<=7.5?"#4ade80":"#f87171")
                            : ((activeResult?.predicted_pH ?? 0)>=5&&(activeResult?.predicted_pH ?? 0)<=7?"#4ade80":"#f87171") },
                        { label:"Viscosity", value:`${activeResult?.predicted_viscosity ?? 0} cP`,
                          color: isColdCream
                            ? ((activeResult?.predicted_viscosity ?? 0)>=2000&&(activeResult?.predicted_viscosity ?? 0)<=6000?"#4ade80":"#f59e0b")
                            : ((activeResult?.predicted_viscosity ?? 0)>=1100&&(activeResult?.predicted_viscosity ?? 0)<=1800?"#4ade80":"#f59e0b") },
                        { label:"Texture",   value:activeResult?.appearance ?? "", color:"#94a3b8" },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ background:"rgba(0,0,0,0.3)", borderRadius:8, padding:"5px 10px" }}>
                          <div style={{ color:"#6b7280", fontSize:9, textTransform:"uppercase" }}>{label}</div>
                          <div style={{ color, fontWeight:700, fontSize:12 }}>{value}</div>
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
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:"0 24px" }}>
                    {checklist.map(item => <CheckRow key={item.label} {...item} />)}
                  </div>
                </div>

                {/* ── Feedback / Congratulations ── */}
                {(activeResult?.feedback ?? []).length > 0 ? (
                  <div style={{ background:"#1c1200", border:"1px solid #78350f",
                    borderRadius:12, padding:"14px 16px" }}>
                    <div style={{ color:"#fbbf24", fontSize:10, fontWeight:700,
                      letterSpacing:2, marginBottom:10 }}>WHAT TO FIX</div>
                    {(activeResult?.feedback ?? []).map((msg, i) => (
                      <div key={i} style={{ display:"flex", gap:8, marginBottom:7,
                        fontSize:13, color:"#fcd34d" }}>
                        <span style={{ flexShrink:0 }}>▸</span><span>{msg}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ background:"#052e16", border:"1px solid #166534",
                    borderRadius:12, padding:"16px 18px", color:"#6ee7b7", fontSize:13,
                    display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ fontSize:28 }}>🎉</span>
                    <span>
                      <strong>All steps correct!</strong> Your {isColdCream ? "cold cream (W/O emulsion)" : "vanishing cream"} was formed with the correct texture, pH, and viscosity. Excellent work!
                    </span>
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
