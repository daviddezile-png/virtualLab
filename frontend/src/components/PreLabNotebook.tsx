import React, { useState } from "react";
import { BEAKER_EMPTY_WEIGHTS } from "./apparatusData";

interface Props {
  practicalId: string;
  onStart: () => void;
  onBack: () => void;
}

const SECTIONS = [
  { id: "context",     num: 1, label: "CONTEXT"     },
  { id: "materials",   num: 2, label: "MATERIALS"   },
  { id: "predictions", num: 3, label: "PREDICTIONS" },
  { id: "protocol",    num: 4, label: "PROTOCOL"    },
] as const;
type SectionId = typeof SECTIONS[number]["id"];

/* ── tiny helpers ──────────────────────────────────────────────────────────── */
const Bullet: React.FC<{ text: string; icon?: string }> = ({ text, icon }) => (
  <li style={{ display:"flex", gap:10, marginBottom:8, alignItems:"flex-start" }}>
    {icon ? (
      <span style={{ flexShrink:0, fontSize:16, lineHeight:"20px" }}>{icon}</span>
    ) : (
      <span style={{ marginTop:3, flexShrink:0, width:7, height:7, borderRadius:"50%",
        background:"#3b82f6", display:"inline-block" }} />
    )}
    <span style={{ color:"#374151", fontSize:14, lineHeight:1.65 }}>{text}</span>
  </li>
);

const MatRow: React.FC<{ item:string; qty:string; purpose:string }> = ({ item, qty, purpose }) => (
  <tr>
    <td style={{ padding:"8px 12px", borderBottom:"1px solid #f1f5f9", color:"#1e293b",
      fontSize:13, fontWeight:600 }}>{item}</td>
    <td style={{ padding:"8px 12px", borderBottom:"1px solid #f1f5f9", color:"#3b82f6",
      fontSize:13, fontFamily:"monospace", fontWeight:700 }}>{qty}</td>
    <td style={{ padding:"8px 12px", borderBottom:"1px solid #f1f5f9", color:"#64748b",
      fontSize:12 }}>{purpose}</td>
  </tr>
);

const StepRow: React.FC<{ n:number; text:string; tip?:string; warn?:string }> = ({ n, text, tip, warn }) => (
  <div style={{ display:"flex", gap:12, marginBottom:14, alignItems:"flex-start" }}>
    <span style={{ flexShrink:0, width:28, height:28, borderRadius:"50%",
      background:"#1d4ed8", color:"white", fontWeight:800, fontSize:13,
      display:"flex", alignItems:"center", justifyContent:"center" }}>{n}</span>
    <div>
      <div style={{ color:"#1e293b", fontSize:14, lineHeight:1.6 }}>{text}</div>
      {tip  && <div style={{ color:"#16a34a", fontSize:12, marginTop:3 }}>✓ {tip}</div>}
      {warn && <div style={{ color:"#ca8a04", fontSize:12, marginTop:3 }}>⚠ {warn}</div>}
    </div>
  </div>
);

const InfoBox: React.FC<{ title:string; children:React.ReactNode; color?:string }> = ({ title, children, color="#3b82f6" }) => (
  <div style={{ background:color==="yellow" ? "#fefce8" : color==="green" ? "#f0fdf4" : "#eff6ff",
    border:`1px solid ${color==="yellow" ? "#fde047" : color==="green" ? "#86efac" : "#bfdbfe"}`,
    borderRadius:10, padding:"14px 18px", marginBottom:16 }}>
    <div style={{ fontWeight:700, color: color==="yellow" ? "#854d0e" : color==="green" ? "#166534" : "#1e40af",
      fontSize:13, marginBottom:8 }}>{title}</div>
    {children}
  </div>
);

const PredField: React.FC<{ q:string; value:string; onChange:(v:string)=>void }> = ({ q, value, onChange }) => (
  <div style={{ marginBottom:20 }}>
    <label style={{ display:"block", color:"#374151", fontSize:14, fontWeight:600,
      marginBottom:7, lineHeight:1.6 }}>{q}</label>
    <textarea
      value={value} onChange={e => onChange(e.target.value)} rows={3}
      placeholder="Write your answer here…"
      style={{ width:"100%", border:"1.5px solid #e2e8f0", borderRadius:8, padding:"10px 13px",
        fontSize:13, color:"#1e293b", resize:"vertical", outline:"none", fontFamily:"inherit",
        background:"white", boxSizing:"border-box" }}
      onFocus={e => (e.target.style.borderColor="#3b82f6")}
      onBlur={e  => (e.target.style.borderColor="#e2e8f0")}
    />
  </div>
);

/* ── main component ─────────────────────────────────────────────────────────── */
const PreLabNotebook: React.FC<Props> = ({ practicalId, onStart, onBack }) => {
  const [activeIdx, setActiveIdx]     = useState(0);
  const [pred1, setPred1] = useState("");
  const [pred2, setPred2] = useState("");
  const [pred3, setPred3] = useState("");
  const isColdCream   = practicalId === "cold-cream";
  const activeSection = SECTIONS[activeIdx];
  const isLast        = activeIdx === SECTIONS.length - 1;

  /* ── section content ────────────────────────────────────────────────────── */
  const renderContent = () => {
    // Cold Cream overrides for context, materials, protocol sections
    if (isColdCream && activeSection.id === "context") return (
      <>
        <p style={{ color:"#374151", fontSize:14, lineHeight:1.75, marginBottom:20 }}>
          In this simulation you will prepare a <strong>cold cream</strong> — a classic
          pharmaceutical <strong>water-in-oil (W/O) emulsion</strong>. Unlike a vanishing cream,
          cold cream has much higher oil content and stays on the skin surface for deep moisturisation and cleansing.
        </p>
        <InfoBox title="What do you need to know before this laboratory starts?">
          <ul style={{ listStyle:"none", margin:0, padding:0 }}>
            {["A cold cream is a W/O emulsion — tiny water droplets dispersed in a continuous oil phase. It feels heavier and greasier than O/W creams.",
              "Beeswax reacts with borax (sodium tetraborate) to form beeswax soap, which acts as the emulsifier holding water droplets inside the oil.",
              "Beeswax melts at 62°C — both the oil phase and aqueous phase must be heated to 65–75°C before mixing.",
              "The aqueous phase (borax + water) must be added slowly into the oil phase (beeswax + paraffin) — this produces a stable W/O emulsion.",
              "Cold cream must be cooled to ≤35°C with continuous stirring to develop its characteristic thick, smooth texture.",
            ].map((t,i) => <Bullet key={i} text={t} />)}
          </ul>
        </InfoBox>
        <div style={{ background:"#1e293b", borderRadius:12, padding:"18px 20px", marginBottom:16 }}>
          <div style={{ color:"white", fontWeight:700, fontSize:13, marginBottom:14, textAlign:"center" }}>W/O vs O/W Emulsion</div>
          <div style={{ display:"flex", gap:16, justifyContent:"center" }}>
            {[
              { label:"W/O (Cold Cream)", outer:"rgba(255,213,79,0.35)", inner:"rgba(200,240,255,0.85)", desc:"Oil continuous phase\nWater droplets inside", active:true },
              { label:"O/W (Vanishing Cream)", outer:"rgba(185,228,255,0.35)", inner:"rgba(255,248,195,0.85)", desc:"Water continuous phase\nOil droplets inside", active:false },
            ].map(({ label, outer, inner, desc, active }) => (
              <div key={label} style={{ flex:1, textAlign:"center" }}>
                <div style={{ width:90, height:90, borderRadius:12, background:outer,
                  border:`2px solid ${active ? "#f59e0b" : "#475569"}`,
                  margin:"0 auto 8px", display:"flex", alignItems:"center",
                  justifyContent:"center", flexWrap:"wrap", gap:4, padding:8 }}>
                  {[...Array(9)].map((_,i) => <div key={i} style={{ width:14, height:14, borderRadius:"50%", background:inner }} />)}
                </div>
                <div style={{ color: active ? "#fbbf24" : "#94a3b8", fontSize:11, fontWeight:700 }}>{label}</div>
                <div style={{ color:"#64748b", fontSize:10, marginTop:3, whiteSpace:"pre-line" }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
        <InfoBox title="Learning Objectives" color="green">
          <ul style={{ listStyle:"none", margin:0, padding:0 }}>
            {["Understand W/O emulsion formation and how it differs from O/W",
              "Melt beeswax and blend with liquid paraffin to form the oil phase",
              "Prepare borax aqueous solution as both the aqueous phase and emulsifier source",
              "Measure pH and viscosity of the finished cold cream",
              "Compare results to pharmacopoeial specification for W/O creams",
            ].map((t,i) => <Bullet key={i} text={t} />)}
          </ul>
        </InfoBox>
      </>
    );

    if (isColdCream && activeSection.id === "materials") return (
      <>
        <p style={{ color:"#374151", fontSize:14, lineHeight:1.7, marginBottom:18 }}>
          Cold cream uses the same glassware as vanishing cream but different chemicals and proportions.
        </p>
        <div style={{ fontWeight:700, color:"#1e293b", fontSize:14, marginBottom:10 }}>Apparatus</div>
        <div style={{ border:"1px solid #e2e8f0", borderRadius:10, overflow:"hidden", marginBottom:22 }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <tbody>
              {[["250 mL Beaker (Oil Phase)","1",`Holds beeswax + liquid paraffin · Empty wt ${BEAKER_EMPTY_WEIGHTS["beaker-250-oil"]} g`],
                ["250 mL Beaker (Aqueous Phase)","1",`Holds borax + distilled water · Empty wt ${BEAKER_EMPTY_WEIGHTS["beaker-250-aqueous"]} g`],
                ["500 mL Beaker (Main Mixing)","1",`Final mixing vessel · Empty wt ${BEAKER_EMPTY_WEIGHTS["beaker-500-main"]} g`],
                ["Digital Weight Balance","1","Reads REAL weight (beaker + contents); subtract empty wt"],
                ["Spatula","1","Scooping solid beeswax"],
                ["Glass Stirring Rod","1","Stirring during & after mixing"],
                ["Hot Plate","1","Heating both phases to 70°C"],
                ["Digital Thermometer","1","Monitoring temperature"],
                ["Ice Bucket","1","Cooling below 35°C"],
                ["pH Meter","1","Measuring final pH"],
                ["Viscosity Gauge","1","Measuring final viscosity"],
              ].map(([a,b,c]) => (
                <tr key={a}><td style={{ padding:"8px 12px", borderBottom:"1px solid #f1f5f9", color:"#1e293b", fontSize:13, fontWeight:600 }}>{a}</td>
                  <td style={{ padding:"8px 12px", borderBottom:"1px solid #f1f5f9", color:"#3b82f6", fontSize:13, fontFamily:"monospace", fontWeight:700 }}>{b}</td>
                  <td style={{ padding:"8px 12px", borderBottom:"1px solid #f1f5f9", color:"#64748b", fontSize:12 }}>{c}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontWeight:700, color:"#1e293b", fontSize:14, marginBottom:10 }}>Chemicals</div>
        <div style={{ border:"1px solid #e2e8f0", borderRadius:10, overflow:"hidden", marginBottom:16 }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <tbody>
              {[["Beeswax","12 g","Solid wax. Melts at 62°C. Oil phase emulsifier."],
                ["Liquid Paraffin","35 mL","Main oil phase carrier. Much more than in O/W!"],
                ["Borax Solution","3 mL","Reacts with beeswax to form emulsifier."],
                ["Distilled Water","40 mL","Aqueous phase — dispersed as droplets."],
              ].map(([a,b,c]) => (
                <tr key={a}><td style={{ padding:"8px 12px", borderBottom:"1px solid #f1f5f9", color:"#1e293b", fontSize:13, fontWeight:600 }}>{a}</td>
                  <td style={{ padding:"8px 12px", borderBottom:"1px solid #f1f5f9", color:"#3b82f6", fontSize:13, fontFamily:"monospace", fontWeight:700 }}>{b}</td>
                  <td style={{ padding:"8px 12px", borderBottom:"1px solid #f1f5f9", color:"#64748b", fontSize:12 }}>{c}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <InfoBox title="⚠  Safety Precautions" color="yellow">
          <ul style={{ listStyle:"none", margin:0, padding:0 }}>
            {[
              { icon:"🧪", text:"Borax is a mild irritant — avoid skin contact and wash hands after use" },
              { icon:"🔥", text:"Molten beeswax and hot glassware cause burns — use appropriate caution" },
              { icon:"🥽", text:"Wear safety goggles and gloves throughout the practical" },
            ].map((s,i) => <Bullet key={i} icon={s.icon} text={s.text} />)}
          </ul>
        </InfoBox>
      </>
    );

    if (isColdCream && activeSection.id === "protocol") return (
      <>
        <p style={{ color:"#374151", fontSize:14, lineHeight:1.75, marginBottom:20 }}>
          Follow each step in order. When ready click <strong style={{ color:"#1d4ed8" }}>Start Practical</strong>.
        </p>
        <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:10, padding:"12px 18px", marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:22 }}>⏱</span>
          <div><div style={{ color:"#166534", fontWeight:700, fontSize:13 }}>Estimated time: 45–60 minutes</div>
            <div style={{ color:"#4ade80", fontSize:12 }}>Target: Beeswax 12g · Paraffin 35 mL · Borax 3 mL · Water 40 mL</div></div>
        </div>
        <div style={{ color:"#3b82f6", fontWeight:800, fontSize:11, letterSpacing:1.5, textTransform:"uppercase", margin:"0 0 12px" }}>— Oil Phase —</div>
        <StepRow n={1} text="Drag the Spatula onto the Beeswax container. Select 12 g and click Scoop." tip="Beeswax appears as golden solid chunks" />
        <StepRow n={2} text="Drag the loaded spatula into the 250 mL Oil Phase Beaker to deposit the beeswax." />
        <StepRow n={3} text="Drag the Liquid Paraffin bottle over the Oil Phase Beaker. Select 35 mL and pour." warn="35 mL — much more than in vanishing cream!" />
        <StepRow n={4} text="Drag the Oil Phase Beaker onto the Hot Plate. Set target to 70°C and turn ON." warn="Beeswax melts at 62°C — watch for the melt notification" />
        <StepRow n={5} text={'Wait for: "Oil Phase Beaker reached 70°C". Remove from hot plate.'} tip="Oil phase is now a clear golden liquid" />
        <div style={{ color:"#3b82f6", fontWeight:800, fontSize:11, letterSpacing:1.5, textTransform:"uppercase", margin:"18px 0 12px" }}>— Aqueous Phase —</div>
        <StepRow n={6} text="Drag the Distilled Water bottle over the Aqueous Phase Beaker. Pour 40 mL." />
        <StepRow n={7} text="Add 3 mL Borax Solution to the Aqueous Phase Beaker." />
        <StepRow n={8} text="Drag the Aqueous Phase Beaker onto the Hot Plate. Heat to 70°C, then remove." tip="Both phases must be at the same temperature" />
        <div style={{ color:"#3b82f6", fontWeight:800, fontSize:11, letterSpacing:1.5, textTransform:"uppercase", margin:"18px 0 12px" }}>— Mixing &amp; Finishing —</div>
        <StepRow n={9} text="Pour the Oil Phase Beaker into the 500 mL Main Mixing Beaker first (all volume)." warn="Oil phase MUST go in first for W/O emulsion" />
        <StepRow n={10} text="Pour the Aqueous Phase Beaker slowly into the oil phase (all volume)." tip="You should see 'Phases combined ✓'" />
        <StepRow n={11} text="Stir vigorously for at least 20 seconds." />
        <StepRow n={12} text="Drag the Main Mixing Beaker into the Ice Bucket. Stir until ≤35°C." tip="Cold cream must cool lower than vanishing cream" />
        <StepRow n={13} text="Dip the pH Meter into the Main Mixing Beaker. Target pH: 6.0–7.5." />
        <StepRow n={14} text="Dip the Viscosity Gauge. Target: 2000–6000 cP (much thicker than O/W)." />
        <StepRow n={15} text="Click ⚗ Evaluate (top right) then EVALUATE RESULT." />
        <InfoBox title="Key target values" color="green">
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
            {[["Beeswax","10–16%"],["Liquid Paraffin","34–46%"],["Borax","2–5%"],["Water","38–52%"],
              ["Both Temps","65–75°C"],["Mixing Order","Aqueous → Oil"],["Stirring","≥20 s"],
              ["Cooling","≤35°C"],["pH","6.0–7.5"],["Viscosity","2000–6000 cP"],
            ].map(([k,v]) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", background:"white", border:"1px solid #dcfce7", borderRadius:7, padding:"5px 10px", fontSize:12 }}>
                <span style={{ color:"#374151" }}>{k}</span><span style={{ color:"#16a34a", fontWeight:700 }}>{v}</span>
              </div>
            ))}
          </div>
        </InfoBox>
      </>
    );

    if (isColdCream && activeSection.id === "predictions") return (
      <>
        <p style={{ color:"#374151", fontSize:14, lineHeight:1.75, marginBottom:20 }}>
          Based on your knowledge of W/O emulsions and the cold cream formula, answer these
          questions <strong>before</strong> you begin the practical. Your predictions will be
          compared against your actual results.
        </p>
        <InfoBox title="Why predict before you experiment?">
          <p style={{ color:"#1e40af", fontSize:13, margin:0, lineHeight:1.65 }}>
            Cold cream behaves very differently from vanishing cream. Predicting first
            helps you notice what changes when the oil phase is continuous instead of the
            water phase. There are no wrong answers — focus on your reasoning.
          </p>
        </InfoBox>
        <PredField
          q="1. Cold cream is a W/O emulsion while vanishing cream is O/W. How do you predict their textures will differ when applied to skin?"
          value={pred1} onChange={setPred1} />
        <PredField
          q="2. Beeswax melts at about 62°C. What do you think will happen if the oil phase is not heated high enough to fully melt the beeswax before mixing?"
          value={pred2} onChange={setPred2} />
        <PredField
          q="3. Cold cream requires much more liquid paraffin (35 mL) than vanishing cream (7 mL). Why do you think the oil content is so much higher in a W/O emulsion?"
          value={pred3} onChange={setPred3} />
      </>
    );

    switch (activeSection.id) {

      /* 1. CONTEXT ──────────────────────────────────────────────────────── */
      case "context":
        return (
          <>
            <p style={{ color:"#374151", fontSize:14, lineHeight:1.75, marginBottom:20 }}>
              In this simulation you will prepare a <strong>vanishing cream</strong> — a
              classic pharmaceutical <strong>oil-in-water (O/W) emulsion</strong>. You will
              weigh and measure reagents, heat two separate phases, combine them in the correct
              order, stir, cool, and evaluate the final product.
            </p>

            <InfoBox title="What do you need to know before this laboratory starts?">
              <ul style={{ listStyle:"none", margin:0, padding:0 }}>
                {[
                  "A vanishing cream is an O/W emulsion — tiny oil droplets dispersed in water. It is called \"vanishing\" because the high water content makes it absorb rapidly, leaving no visible residue.",
                  "Stearic acid reacts with potassium hydroxide (KOH) to form potassium stearate — a soap that acts as the emulsifier keeping oil and water together.",
                  "Both the oil phase and aqueous phase must be heated to the same temperature (70–80 °C) before mixing. A large temperature difference causes phase separation.",
                  "The aqueous phase must be added into the oil phase (not the other way around) to form a stable O/W emulsion.",
                  "Continuous stirring during cooling develops the smooth cream texture and prevents crystallisation.",
                ].map((t,i) => <Bullet key={i} text={t} />)}
              </ul>
            </InfoBox>

            {/* Visual: O/W vs W/O */}
            <div style={{ background:"#1e293b", borderRadius:12, padding:"18px 20px", marginBottom:16 }}>
              <div style={{ color:"white", fontWeight:700, fontSize:13, marginBottom:14,
                textAlign:"center" }}>
                O/W Emulsion vs W/O Emulsion
              </div>
              <div style={{ display:"flex", gap:16, justifyContent:"center" }}>
                {[
                  { label:"O/W (Vanishing Cream)", outer:"rgba(185,228,255,0.35)", inner:"rgba(255,248,195,0.85)", desc:"Water continuous phase\nOil droplets inside", active:true },
                  { label:"W/O (Cold Cream)", outer:"rgba(255,248,195,0.35)", inner:"rgba(185,228,255,0.85)", desc:"Oil continuous phase\nWater droplets inside", active:false },
                ].map(({ label, outer, inner, desc, active }) => (
                  <div key={label} style={{ flex:1, textAlign:"center" }}>
                    <div style={{ width:90, height:90, borderRadius:12, background:outer,
                      border:`2px solid ${active ? "#3b82f6" : "#475569"}`,
                      margin:"0 auto 8px", display:"flex", alignItems:"center",
                      justifyContent:"center", flexWrap:"wrap", gap:4, padding:8 }}>
                      {[...Array(9)].map((_,i) => (
                        <div key={i} style={{ width:14, height:14, borderRadius:"50%", background:inner }} />
                      ))}
                    </div>
                    <div style={{ color: active ? "#60a5fa" : "#94a3b8",
                      fontSize:11, fontWeight:700 }}>{label}</div>
                    <div style={{ color:"#64748b", fontSize:10, marginTop:3, whiteSpace:"pre-line" }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <InfoBox title="Learning Objectives" color="green">
              <ul style={{ listStyle:"none", margin:0, padding:0 }}>
                {[
                  "Understand the theory of O/W emulsion formation",
                  "Practise accurate weighing and measuring of reagents",
                  "Learn the critical role of temperature in emulsification",
                  "Measure pH and viscosity of a pharmaceutical cream",
                  "Evaluate product quality against pharmacopoeial specifications",
                ].map((t,i) => <Bullet key={i} text={t} />)}
              </ul>
            </InfoBox>
          </>
        );

      /* 2. MATERIALS ─────────────────────────────────────────────────────── */
      case "materials":
        return (
          <>
            <p style={{ color:"#374151", fontSize:14, lineHeight:1.7, marginBottom:18 }}>
              Ensure all apparatus is clean, dry, and calibrated before starting.
              Confirm all chemicals are at room temperature unless stated otherwise.
            </p>

            <div style={{ fontWeight:700, color:"#1e293b", fontSize:14, marginBottom:10 }}>Apparatus</div>
            <div style={{ border:"1px solid #e2e8f0", borderRadius:10, overflow:"hidden", marginBottom:22 }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"#f8fafc" }}>
                    <th style={{ padding:"9px 12px", textAlign:"left", color:"#64748b",
                      fontSize:11, fontWeight:700, letterSpacing:0.8, textTransform:"uppercase" }}>Item</th>
                    <th style={{ padding:"9px 12px", textAlign:"left", color:"#64748b",
                      fontSize:11, fontWeight:700, letterSpacing:0.8, textTransform:"uppercase" }}>Qty</th>
                    <th style={{ padding:"9px 12px", textAlign:"left", color:"#64748b",
                      fontSize:11, fontWeight:700, letterSpacing:0.8, textTransform:"uppercase" }}>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["250 mL Beaker (Oil Phase)",      "1", `Holds stearic acid + liquid paraffin · Empty wt ${BEAKER_EMPTY_WEIGHTS["beaker-250-oil"]} g`],
                    ["250 mL Beaker (Aqueous Phase)",  "1", `Holds water + glycerin + KOH · Empty wt ${BEAKER_EMPTY_WEIGHTS["beaker-250-aqueous"]} g`],
                    ["500 mL Beaker (Main Mixing)",    "1", `Final mixing vessel · Empty wt ${BEAKER_EMPTY_WEIGHTS["beaker-500-main"]} g`],
                    ["Digital Weight Balance",          "1", "Reads REAL weight (beaker + contents); subtract empty wt"],
                    ["Spatula",                         "1", "Transferring solid stearic acid"],
                    ["Glass Stirring Rod",              "1", "Stirring during mixing & cooling"],
                    ["Hot Plate",                       "1", "Heating both phases to 75°C"],
                    ["Digital Thermometer",             "1", "Monitoring temperature in beakers"],
                    ["Ice Bucket",                      "1", "Controlled cooling below 40°C"],
                    ["pH Meter",                        "1", "Measuring final cream pH"],
                    ["Viscosity Gauge",                 "1", "Measuring final cream viscosity"],
                    ["100 mL Graduated Cylinder",       "1", `Measuring liquid volumes · Empty wt ${BEAKER_EMPTY_WEIGHTS["graduated-cylinder-100"]} g`],
                  ].map(([a,b,c]) => <MatRow key={a} item={a} qty={b} purpose={c} />)}
                </tbody>
              </table>
            </div>

            <div style={{ fontWeight:700, color:"#1e293b", fontSize:14, marginBottom:10 }}>Chemicals</div>
            <div style={{ border:"1px solid #e2e8f0", borderRadius:10, overflow:"hidden", marginBottom:16 }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"#f8fafc" }}>
                    <th style={{ padding:"9px 12px", textAlign:"left", color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase" }}>Chemical</th>
                    <th style={{ padding:"9px 12px", textAlign:"left", color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase" }}>Amount</th>
                    <th style={{ padding:"9px 12px", textAlign:"left", color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase" }}>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Stearic Acid",            "18 g",   "Emulsifier & thickener (oil phase)"],
                    ["Liquid Paraffin",          "7 mL",   "Oil phase — moisturises skin"],
                    ["Glycerin",                 "3 mL",   "Humectant — retains moisture"],
                    ["KOH & Triethanolamine",    "1 mL",   "Alkali — reacts with stearic acid"],
                    ["Distilled Water",          "70 mL",  "Aqueous phase — main carrier"],
                  ].map(([a,b,c]) => <MatRow key={a} item={a} qty={b} purpose={c} />)}
                </tbody>
              </table>
            </div>

            <InfoBox title="⚠  Safety Precautions" color="yellow">
              <ul style={{ listStyle:"none", margin:0, padding:0 }}>
                {[
                  { icon:"⚠️", text:"KOH is corrosive — handle with care and avoid skin contact" },
                  { icon:"🔥", text:"Hot glassware (>70°C) causes burns — use appropriate caution" },
                  { icon:"🥽", text:"Wear safety goggles and gloves throughout the practical" },
                ].map((s,i) => <Bullet key={i} icon={s.icon} text={s.text} />)}
              </ul>
            </InfoBox>
          </>
        );

      /* 3. PREDICTIONS ───────────────────────────────────────────────────── */
      case "predictions":
        return (
          <>
            <p style={{ color:"#374151", fontSize:14, lineHeight:1.75, marginBottom:20 }}>
              Based on your knowledge of emulsions and the materials listed, answer the
              questions below <strong>before</strong> you begin the practical. Your predictions
              will be compared against your actual results in the Reflection section.
            </p>

            <InfoBox title="Why predict before you experiment?">
              <p style={{ color:"#1e40af", fontSize:13, margin:0, lineHeight:1.65 }}>
                Making predictions activates prior knowledge, sharpens observation skills
                during the experiment, and deepens understanding when you compare expected
                versus actual outcomes. There are no wrong predictions — what matters is
                your scientific reasoning.
              </p>
            </InfoBox>

            <PredField
              q="1. What do you predict the final vanishing cream will look like? Describe its texture, colour, and appearance."
              value={pred1} onChange={setPred1} />

            <PredField
              q="2. What pH range do you expect for the final cream, and why? Consider the role of KOH in the formulation."
              value={pred2} onChange={setPred2} />

            <PredField
              q="3. What do you think will happen if the oil phase and aqueous phase are at different temperatures (e.g., oil at 75°C but water at 30°C) when they are mixed together?"
              value={pred3} onChange={setPred3} />
          </>
        );

      /* 4. PROTOCOL ──────────────────────────────────────────────────────── */
      case "protocol":
        return (
          <>
            <p style={{ color:"#374151", fontSize:14, lineHeight:1.75, marginBottom:20 }}>
              Follow each step in order. Do not skip any step — each stage directly affects
              the quality of the final cream. When you are ready, click{" "}
              <strong style={{ color:"#1d4ed8" }}>Start Practical</strong> to enter the virtual lab.
            </p>

            <div style={{ background:"#f0fdf4", border:"1px solid #86efac",
              borderRadius:10, padding:"12px 18px", marginBottom:20,
              display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:22 }}>⏱</span>
              <div>
                <div style={{ color:"#166534", fontWeight:700, fontSize:13 }}>Estimated time: 45–60 minutes</div>
                <div style={{ color:"#4ade80", fontSize:12 }}>Complete all steps without skipping for a PASS result</div>
              </div>
            </div>

            <div style={{ color:"#3b82f6", fontWeight:800, fontSize:11, letterSpacing:1.5,
              textTransform:"uppercase", margin:"0 0 12px" }}>— Oil Phase Preparation —</div>

            <StepRow n={1} text="Drag the Spatula onto the Stearic Acid bottle. Select 18 g and click Scoop."
              tip="Watch the balance display — confirm 18 g" />
            <StepRow n={2} text="Drag the loaded spatula into the 250 mL Oil Phase Beaker to deposit the solid."
              tip="Stearic acid appears as white solid chunks in the beaker" />
            <StepRow n={3} text="Drag the Liquid Paraffin bottle over the Oil Phase Beaker. Select 7 mL and pour." />
            <StepRow n={4} text="Drag the Oil Phase Beaker onto the Hot Plate. Set target to 75°C and turn ON."
              warn="Stearic acid melts above 70°C — wait for the melt notification" />
            <StepRow n={5} text={'Wait for: "Oil Phase Beaker reached 75°C". Remove the beaker from the hot plate.'}
              tip="Temperature is retained after removal — no ambient cooling" />

            <div style={{ color:"#3b82f6", fontWeight:800, fontSize:11, letterSpacing:1.5,
              textTransform:"uppercase", margin:"18px 0 12px" }}>— Aqueous Phase Preparation —</div>

            <StepRow n={6} text="Drag the Distilled Water bottle over the 250 mL Aqueous Phase Beaker. Pour 70 mL." />
            <StepRow n={7} text="Add 3 mL Glycerin and 1 mL KOH & Triethanolamine to the Aqueous Phase Beaker." />
            <StepRow n={8} text="Drag the Aqueous Phase Beaker onto the Hot Plate. Heat to 75°C, then remove."
              tip="Both phases must be at the same temperature before mixing" />

            <div style={{ color:"#3b82f6", fontWeight:800, fontSize:11, letterSpacing:1.5,
              textTransform:"uppercase", margin:"18px 0 12px" }}>— Mixing &amp; Finishing —</div>

            <StepRow n={9} text="Pour the entire Oil Phase Beaker into the 500 mL Main Mixing Beaker first."
              warn="Oil phase MUST go in first — this is the critical mixing order" />
            <StepRow n={10} text="Pour the entire Aqueous Phase Beaker into the Main Mixing Beaker."
              tip="You will see 'Phases combined ✓'" />
            <StepRow n={11} text="Drag the Stirring Rod into the Main Mixing Beaker. Hold to stir for ≥ 30 seconds." />
            <StepRow n={12} text="Drag the Main Mixing Beaker into the Ice Bucket. Stir continuously until ≤ 40°C."
              tip="Watch for 'Cooled to ≤40°C' notification" />
            <StepRow n={13} text="Dip the pH Meter probe into the Main Mixing Beaker. Wait for reading to settle." />
            <StepRow n={14} text="Dip the Viscosity Gauge into the Main Mixing Beaker. Wait for reading to settle." />
            <StepRow n={15} text="Click ⚗ Evaluate (top right), then click EVALUATE RESULT to see your outcome." />

            <InfoBox title="Key target values" color="green">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                {[
                  ["Both phase temperatures","70–80°C"],
                  ["Mixing order","Aqueous into Oil"],
                  ["Stirring time","≥ 30 seconds"],
                  ["Cooling temperature","≤ 40°C"],
                  ["Final pH","5.0–7.0"],
                  ["Final viscosity","1100–1800 cP"],
                ].map(([k,v]) => (
                  <div key={k} style={{ display:"flex", justifyContent:"space-between",
                    background:"white", border:"1px solid #dcfce7",
                    borderRadius:7, padding:"5px 10px", fontSize:12 }}>
                    <span style={{ color:"#374151" }}>{k}</span>
                    <span style={{ color:"#16a34a", fontWeight:700 }}>{v}</span>
                  </div>
                ))}
              </div>
            </InfoBox>
          </>
        );
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#060d18",
      display:"flex", flexDirection:"column", fontFamily:"system-ui,sans-serif" }}>

      {/* ── Top bar ── */}
      <div style={{ background:"rgba(8,15,30,0.98)", borderBottom:"1px solid #1e293b",
        height:52, display:"flex", alignItems:"center", padding:"0 24px",
        justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={onBack}
            style={{ background:"#1e293b", border:"1px solid #334155", borderRadius:8,
              color:"#94a3b8", padding:"5px 12px", cursor:"pointer", fontSize:12, fontWeight:600 }}>
            ← Labs
          </button>
          <div style={{ color:"#475569", fontSize:12 }}>
            LAB NOTEBOOK &nbsp;·&nbsp;
            <span style={{ color:"#94a3b8", fontWeight:600 }}>{isColdCream ? "Cold Cream" : "Vanishing Cream"}</span>
          </div>
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          {SECTIONS.map((s, i) => (
            <button key={s.id} onClick={() => setActiveIdx(i)}
              style={{ width:28, height:28, borderRadius:"50%", border:"none",
                cursor:"pointer", fontWeight:800, fontSize:12,
                background: i === activeIdx ? "#1d4ed8"
                  : i < activeIdx ? "#1e3a5f" : "#1e293b",
                color: i <= activeIdx ? "white" : "#475569",
                transition:"all 0.15s" }}>
              {s.num}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main layout — mirrors LabXchange ── */}
      <div className="nb-layout">

        {/* Left: dimmed lab preview */}
        <div className="nb-preview">
          {/* Lab background illustration */}
          <div style={{ position:"absolute", inset:0,
            background: isColdCream
              ? "linear-gradient(180deg,#1a0d2e 0%,#060d18 100%)"
              : "linear-gradient(180deg,#0d1b2e 0%,#060d18 100%)" }}>
            {/* Shelf line */}
            <div style={{ position:"absolute", top:"28%", left:0, right:0,
              height:3, background: isColdCream ? "rgba(139,92,246,0.25)" : "rgba(59,130,246,0.2)" }} />
            <div style={{ position:"absolute", top:"70%", left:0, right:0,
              height:3, background: isColdCream ? "rgba(139,92,246,0.18)" : "rgba(59,130,246,0.15)" }} />
            {/* Schematic beakers — golden tint for W/O cold cream */}
            {[60,160,260,360,460,560].map((lx,i) => (
              <div key={i} style={{ position:"absolute", top:"18%", left:lx,
                width:40, height:60,
                border:`1.5px solid ${isColdCream ? "rgba(251,191,36,0.3)" : "rgba(59,130,246,0.25)"}`,
                borderTop:"none", borderRadius:"0 0 6px 6px",
                background: isColdCream ? "rgba(255,213,79,0.06)" : "rgba(56,189,248,0.06)" }}>
                <div style={{ position:"absolute", bottom:0, left:0, right:0,
                  height:`${30+i*6}%`,
                  background: isColdCream ? "rgba(255,213,79,0.2)" : "rgba(56,189,248,0.15)",
                  borderRadius:"0 0 4px 4px" }} />
              </div>
            ))}
            {/* Hot plate */}
            <div style={{ position:"absolute", top:"58%", left:180,
              width:90, height:22, background:"rgba(59,130,246,0.12)",
              border:"1px solid rgba(59,130,246,0.2)", borderRadius:4 }} />
            {/* Dim overlay */}
            <div style={{ position:"absolute", inset:0, background:"rgba(6,13,24,0.72)" }} />
          </div>

          {/* "lab preview" label */}
          <div style={{ position:"absolute", bottom:20, left:"50%", transform:"translateX(-50%)",
            background:"rgba(15,23,42,0.85)", border:"1px solid #1e293b",
            borderRadius:20, padding:"6px 16px", color:"#475569", fontSize:11, fontWeight:600,
            whiteSpace:"nowrap" }}>
            Virtual Lab — complete all sections to unlock
          </div>
        </div>

        {/* Center: notebook content */}
        <div className="nb-content">

          {/* Section heading */}
          <div className="nb-section-head" style={{ borderBottom:`3px solid ${isColdCream ? "#8b5cf6" : "#3b82f6"}` }}>
            <div style={{ color:"#1e293b", fontSize:"clamp(18px,2.5vw,26px)", fontWeight:900, letterSpacing:0.5 }}>
              {activeSection.num}. {activeSection.label}
            </div>
            <div style={{ height:3, width:50, background: isColdCream ? "#8b5cf6" : "#3b82f6", borderRadius:2, marginTop:6 }} />
          </div>

          {/* Section body */}
          <div className="nb-section-body">
            {renderContent()}
          </div>

          {/* Navigation footer */}
          <div className="nb-footer">
            <button onClick={() => activeIdx > 0 && setActiveIdx(i => i - 1)}
              disabled={activeIdx === 0}
              style={{ padding:"9px 20px", borderRadius:8, border:"1px solid #e2e8f0",
                background:"white", color: activeIdx === 0 ? "#cbd5e1" : "#374151",
                cursor: activeIdx === 0 ? "not-allowed" : "pointer",
                fontWeight:600, fontSize:13 }}>
              &lt; Previous section
            </button>

            {/* Section dots */}
            <div style={{ display:"flex", gap:7 }}>
              {SECTIONS.map((_, i) => (
                <div key={i} onClick={() => setActiveIdx(i)} style={{ cursor:"pointer",
                  width:9, height:9, borderRadius:"50%", transition:"all 0.15s",
                  background: i === activeIdx ? "#1d4ed8"
                    : i < activeIdx ? "#93c5fd" : "#e2e8f0" }} />
              ))}
            </div>

            {isLast ? (
              <button onClick={onStart}
                style={{ padding:"10px 24px", borderRadius:8, border:"none",
                  background: isColdCream
                    ? "linear-gradient(135deg,#7c3aed,#6d28d9)"
                    : "linear-gradient(135deg,#f97316,#ea580c)",
                  color:"white", fontWeight:800, fontSize:14, cursor:"pointer",
                  boxShadow: isColdCream
                    ? "0 4px 14px rgba(124,58,237,0.45)"
                    : "0 4px 14px rgba(249,115,22,0.45)",
                  letterSpacing:0.3 }}>
                {isColdCream ? "Start Cold Cream →" : "Start Practical →"}
              </button>
            ) : (
              <button onClick={() => setActiveIdx(i => i + 1)}
                style={{ padding:"10px 24px", borderRadius:8, border:"none",
                  background: isColdCream ? "#7c3aed" : "#1d4ed8",
                  color:"white", fontWeight:700, fontSize:13, cursor:"pointer",
                  boxShadow: isColdCream
                    ? "0 3px 12px rgba(124,58,237,0.35)"
                    : "0 3px 12px rgba(29,78,216,0.35)" }}>
                Next section &gt;
              </button>
            )}
          </div>
        </div>

        {/* Right sidebar — section navigation */}
        <div className="nb-sidebar">

          {/* Lab icon */}
          <div style={{ padding:"0 20px 20px", borderBottom:"1px solid #1e293b" }}>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <div style={{ width:40, height:40, borderRadius:10, background:"#1d4ed8",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>
                🧪
              </div>
              <div>
                <div style={{ color:"#64748b", fontSize:9, fontWeight:700, letterSpacing:1,
                  textTransform:"uppercase" }}>LAB NOTEBOOK</div>
                <div style={{ color:"white", fontWeight:700, fontSize:12, marginTop:1 }}>
                  {isColdCream ? "Cold Cream" : "Vanishing Cream"}
                </div>
              </div>
            </div>
          </div>

          {/* Section list */}
          <div style={{ padding:"16px 0" }}>
            {SECTIONS.map((s, i) => {
              const done   = i < activeIdx;
              const active = i === activeIdx;
              return (
                <button key={s.id} onClick={() => setActiveIdx(i)}
                  style={{ width:"100%", display:"flex", alignItems:"center", gap:12,
                    padding:"11px 20px", border:"none", cursor:"pointer", textAlign:"left",
                    background: active ? (isColdCream ? "rgba(124,58,237,0.2)" : "rgba(29,78,216,0.2)") : "transparent",
                    borderLeft: active ? `3px solid ${isColdCream ? "#8b5cf6" : "#3b82f6"}` : "3px solid transparent",
                    transition:"all 0.15s" }}>
                  <div style={{ flexShrink:0, width:24, height:24, borderRadius:"50%",
                    border:`2px solid ${active ? (isColdCream ? "#8b5cf6" : "#3b82f6") : done ? (isColdCream ? "#8b5cf6" : "#3b82f6") : "#334155"}`,
                    background: done ? (isColdCream ? "#6d28d9" : "#1d4ed8") : active ? (isColdCream ? "rgba(139,92,246,0.2)" : "rgba(59,130,246,0.2)") : "transparent",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:11, color: done ? "white" : active ? (isColdCream ? "#c4b5fd" : "#60a5fa") : "#475569",
                    fontWeight:800 }}>
                    {done ? "✓" : s.num}
                  </div>
                  <span style={{ color: active ? "#60a5fa" : done ? "#94a3b8" : "#475569",
                    fontWeight: active ? 800 : 600, fontSize:13, letterSpacing:0.5 }}>
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Progress */}
          <div style={{ padding:"16px 20px", borderTop:"1px solid #1e293b", marginTop:8 }}>
            <div style={{ color:"#475569", fontSize:10, fontWeight:700, letterSpacing:1,
              textTransform:"uppercase", marginBottom:8 }}>Progress</div>
            <div style={{ height:5, background:"#1e293b", borderRadius:3, overflow:"hidden" }}>
              <div style={{ height:"100%",
                background: isColdCream
                  ? "linear-gradient(90deg,#8b5cf6,#6d28d9)"
                  : "linear-gradient(90deg,#3b82f6,#1d4ed8)",
                borderRadius:3, width:`${((activeIdx + 1) / SECTIONS.length) * 100}%`,
                transition:"width 0.3s" }} />
            </div>
            <div style={{ color:"#475569", fontSize:11, marginTop:6 }}>
              {activeIdx + 1} of {SECTIONS.length} sections
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreLabNotebook;
