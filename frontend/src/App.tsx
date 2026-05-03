import React, { useState } from "react";
import { SimulationStep } from "./simulation/model/types";
import InteractiveLabCanvas from "./components/InteractiveLabCanvas";
import LabSelection from "./components/LabSelection";
import PreLabNotebook from "./components/PreLabNotebook";
import "./App.css";

type AppState = "selection" | "pre-lab" | "lab";

function App() {
  const [appState,          setAppState]          = useState<AppState>("selection");
  const [selectedPractical, setSelectedPractical] = useState<string>("vanishing-cream");
  const currentStep = SimulationStep.SELECTION;

  const practicalLabel = selectedPractical === "cold-cream"
    ? "Cold Cream — W/O Emulsion"
    : "Vanishing Cream — O/W Emulsion";

  if (appState === "selection") {
    return (
      <LabSelection
        onSelect={(id) => { setSelectedPractical(id); setAppState("pre-lab"); }}
      />
    );
  }

  if (appState === "pre-lab") {
    return (
      <PreLabNotebook
        practicalId={selectedPractical}
        onStart={() => setAppState("lab")}
        onBack={() => setAppState("selection")}
      />
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:"#060d18",
      display:"flex", flexDirection:"column", fontFamily:"system-ui,sans-serif" }}>

      <header style={{ background:"rgba(8,15,30,0.98)", borderBottom:"1px solid #1e293b",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        height:56, padding:"0 20px", position:"relative", zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={() => setAppState("pre-lab")}
            style={{ background:"#1e293b", border:"1px solid #334155", borderRadius:8,
              color:"#94a3b8", padding:"6px 12px", cursor:"pointer",
              fontSize:12, fontWeight:600 }}>
            ← Notebook
          </button>
          <div style={{ width:1, height:24, background:"#1e293b" }} />
          <div style={{ width:28, height:28, borderRadius:8,
            background: selectedPractical === "cold-cream"
              ? "linear-gradient(135deg,#6d28d9,#4c1d95)"
              : "linear-gradient(135deg,#1d4ed8,#7c3aed)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>
            🧪
          </div>
          <div>
            <div style={{ color:"white", fontWeight:800, fontSize:14 }}>{practicalLabel}</div>
            <div style={{ color:"#475569", fontSize:10 }}>Cream Formulation Virtual Laboratory</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ background:"#052e16", border:"1px solid #16a34a",
            borderRadius:20, padding:"3px 12px", color:"#4ade80", fontSize:11, fontWeight:700 }}>
            ● Live Session
          </div>
        </div>
      </header>

      <div style={{ height:"calc(100vh - 56px)", overflow:"hidden" }}>
        <InteractiveLabCanvas
          currentStep={currentStep}
          onApparatusClick={() => {}}
          practicalId={selectedPractical}
        />
      </div>
    </div>
  );
}

export default App;
