import React, { useState } from "react";
import { Assignment, BASE_RECIPES } from "../utils/assignmentStore";
import { ChevronDown, ChevronUp, BookOpen, Calculator, ClipboardList, FlaskConical } from "lucide-react";

interface Props {
  assignment: Assignment;
}

const AssignmentBanner: React.FC<Props> = ({ assignment }) => {
  const [collapsed,  setCollapsed]  = useState(false);
  const [multiplier, setMultiplier] = useState<string>("");

  const recipe = BASE_RECIPES[assignment.practicalId];
  const mult   = parseFloat(multiplier);
  const isValid = !isNaN(mult) && mult > 0 && mult <= 10;

  // Expected multiplier for reference (shown after student fills in)
  const expectedMult = +(assignment.targetGrams / recipe.totalGrams).toFixed(4);

  const practical = assignment.practicalId === "vanishing-cream"
    ? "Vanishing Cream (O/W)"
    : "Cold Cream (W/O)";

  return (
    <div style={{
      background: "linear-gradient(135deg, #0c1a32 0%, #0f2040 100%)",
      borderBottom: "2px solid #2563eb",
      fontFamily: "system-ui, sans-serif",
      flexShrink: 0,
    }}>
      {/* ── Header bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 20px", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "rgba(37,99,235,0.25)", border: "1px solid #2563eb",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <ClipboardList size={16} color="#60a5fa" strokeWidth={2} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                background: "#1e3a5f", border: "1px solid #2563eb",
                color: "#60a5fa", fontSize: 10, fontWeight: 700,
                borderRadius: 4, padding: "1px 7px", letterSpacing: 0.8,
                textTransform: "uppercase",
              }}>Assignment</span>
              <span style={{ color: "#94a3b8", fontSize: 11 }}>
                Code: <code style={{ color: "#60a5fa", fontWeight: 700, letterSpacing: 1 }}>{assignment.token}</code>
              </span>
              <span style={{ color: "#475569", fontSize: 11 }}>·</span>
              <span style={{ color: "#94a3b8", fontSize: 11 }}>
                <FlaskConical size={11} style={{ verticalAlign: "middle", marginRight: 3 }} />
                {practical}
              </span>
            </div>
            <div style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 700, marginTop: 2 }}>
              {assignment.title}
            </div>
          </div>
        </div>

        <button
          onClick={() => setCollapsed(v => !v)}
          style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid #1e3a5f",
            borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "#94a3b8",
            display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600,
            flexShrink: 0,
          }}>
          {collapsed
            ? <><ChevronDown size={14} /> Show Calculator</>
            : <><ChevronUp   size={14} /> Hide</>}
        </button>
      </div>

      {/* ── Expandable calculator ── */}
      {!collapsed && (
        <div style={{
          padding: "0 20px 16px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 14,
        }}>
          {/* Task card */}
          <div style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid #1e3a5f",
            borderRadius: 12, padding: "14px 16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <BookOpen size={14} color="#60a5fa" />
              <span style={{ color: "#60a5fa", fontSize: 11, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 0.8 }}>Task</span>
            </div>
            <p style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.7, margin: 0 }}>
              {assignment.title}
            </p>
            <div style={{
              marginTop: 12, padding: "8px 12px",
              background: "rgba(37,99,235,0.15)", border: "1px solid #2563eb44",
              borderRadius: 8, textAlign: "center",
            }}>
              <div style={{ color: "#94a3b8", fontSize: 10, textTransform: "uppercase",
                letterSpacing: 0.8, marginBottom: 3 }}>Target</div>
              <div style={{ color: "#60a5fa", fontSize: 22, fontWeight: 800 }}>
                {assignment.targetGrams} g
              </div>
              <div style={{ color: "#64748b", fontSize: 10, marginTop: 2 }}>
                of {assignment.practicalId === "vanishing-cream" ? "vanishing" : "cold"} cream
              </div>
            </div>
          </div>

          {/* Multiplier calculator */}
          <div style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid #1e3a5f",
            borderRadius: 12, padding: "14px 16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <Calculator size={14} color="#a78bfa" />
              <span style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 0.8 }}>Calculate Multiplier</span>
            </div>

            <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 10, lineHeight: 1.6 }}>
              Base recipe = <strong style={{ color: "#e2e8f0" }}>{recipe.totalGrams} g</strong>.
              <br />
              Multiplier = Target ÷ Base
            </div>

            <div style={{
              background: "rgba(167,139,250,0.08)", border: "1px solid #a78bfa44",
              borderRadius: 8, padding: "8px 12px", marginBottom: 12,
              fontFamily: "monospace", fontSize: 13, color: "#a78bfa", textAlign: "center",
            }}>
              {assignment.targetGrams} ÷ {recipe.totalGrams} = {expectedMult}
            </div>

            <label style={{ color: "#94a3b8", fontSize: 11, display: "block", marginBottom: 5,
              textTransform: "uppercase", letterSpacing: 0.7 }}>
              Your calculated multiplier
            </label>
            <input
              type="number"
              step="0.0001"
              placeholder={`e.g. ${expectedMult}`}
              value={multiplier}
              onChange={e => setMultiplier(e.target.value)}
              style={{
                width: "100%", background: "#0a1628", border: `1.5px solid ${isValid ? "#22c55e" : "#334155"}`,
                color: "#e2e8f0", borderRadius: 8, padding: "9px 12px", fontSize: 14,
                fontFamily: "monospace", boxSizing: "border-box", outline: "none",
                transition: "border-color .15s",
              }}
            />
            {isValid && Math.abs(mult - expectedMult) > 0.01 && (
              <div style={{ color: "#f59e0b", fontSize: 11, marginTop: 6 }}>
                ⚠ Expected {expectedMult} — check your calculation
              </div>
            )}
            {isValid && Math.abs(mult - expectedMult) <= 0.01 && (
              <div style={{ color: "#22c55e", fontSize: 11, marginTop: 6 }}>
                ✓ Correct multiplier!
              </div>
            )}
          </div>

          {/* Scaled amounts reference */}
          <div style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid #1e3a5f",
            borderRadius: 12, padding: "14px 16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <FlaskConical size={14} color="#22c55e" />
              <span style={{ color: "#22c55e", fontSize: 11, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 0.8 }}>
                {isValid ? "Scaled Amounts" : "Reagent Reference"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {recipe.reagents.map((r, i) => {
                const scaled = isValid ? +(r.amount * mult).toFixed(2) : null;
                return (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "5px 8px", borderRadius: 6,
                    background: scaled !== null ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${scaled !== null ? "rgba(34,197,94,0.2)" : "#1e3a5f"}`,
                  }}>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>{r.name}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: "#475569", fontSize: 11, fontFamily: "monospace" }}>
                        {r.amount} {r.unit}
                      </span>
                      {scaled !== null && (
                        <>
                          <span style={{ color: "#334155", fontSize: 11 }}>×{mult}</span>
                          <span style={{ color: "#22c55e", fontWeight: 700,
                            fontSize: 12, fontFamily: "monospace" }}>
                            = {scaled} {r.unit}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {!isValid && (
              <div style={{ color: "#475569", fontSize: 11, marginTop: 8, textAlign: "center" }}>
                Enter your multiplier to see scaled amounts
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentBanner;
