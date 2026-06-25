import React, { useState } from "react";
import { Assignment, BASE_RECIPES } from "../utils/assignmentStore";
import { ChevronDown, ChevronUp, BookOpen, ClipboardList, FlaskConical } from "lucide-react";

interface Props {
  assignment: Assignment;
}

const AssignmentBanner: React.FC<Props> = ({ assignment }) => {
  const [collapsed,  setCollapsed]  = useState(false);

  const recipe = BASE_RECIPES[assignment.practicalId];

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
            ? <><ChevronDown size={14} /> Show</>
            : <><ChevronUp   size={14} /> Hide</>}
        </button>
      </div>

      {/* ── Expandable calculator ── */}
      {!collapsed && (
        <div style={{
          padding: "0 20px 16px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
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

          {/* Reagent reference — the base recipe amounts shown for reference. */}
          <div style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid #1e3a5f",
            borderRadius: 12, padding: "14px 16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <FlaskConical size={14} color="#22c55e" />
              <span style={{ color: "#22c55e", fontSize: 11, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 0.8 }}>
                Reagent Reference
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {recipe.reagents.map((r, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "5px 8px", borderRadius: 6,
                  background: "rgba(34,197,94,0.06)",
                  border: "1px solid rgba(34,197,94,0.2)",
                }}>
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>{r.name}</span>
                  <span style={{ color: "#22c55e", fontWeight: 700,
                    fontSize: 12, fontFamily: "monospace" }}>
                    {r.amount} {r.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentBanner;
