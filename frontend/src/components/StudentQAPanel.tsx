import React, { useState, useEffect } from "react";
import {
  ClipboardList, CheckCircle, XCircle, Clock, Send,
  ChevronRight, Award, AlertCircle, BookOpen,
} from "lucide-react";
import {
  QAQuestion, QAAnswer,
  getQuestionsForPractical, saveAnswer, getAnswersForSubmission,
  autoMark, computeCombinedScore, CombinedScore,
} from "../utils/qaStore";
import { User } from "../utils/userStore";
import { LabSubmission } from "../utils/submissionStore";

// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  practicalId:    string;
  currentUser:    User;
  submission:     LabSubmission | null;  // the just-completed lab submission
  onClose:        () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
const StudentQAPanel: React.FC<Props> = ({ practicalId, currentUser, submission, onClose }) => {
  const questions = getQuestionsForPractical(practicalId);
  const existingAnswers = submission ? getAnswersForSubmission(submission.id) : [];

  const [answers,   setAnswers]   = useState<Record<string,string>>(() => {
    const map: Record<string,string> = {};
    existingAnswers.forEach(a => { map[a.questionId] = a.answer; });
    return map;
  });
  const [submitted,  setSubmitted]  = useState(existingAnswers.length > 0);
  const [savedAnswers, setSavedAnswers] = useState<QAAnswer[]>(existingAnswers);
  const [combined, setCombined] = useState<CombinedScore | null>(null);

  useEffect(() => {
    if (submitted && submission) {
      setCombined(computeCombinedScore(submission.scorePct, submission.id));
    }
  }, [submitted, submission]);

  const totalPoints = questions.reduce((s, q) => s + q.points, 0);
  const alreadyAnswered = (qid: string) => savedAnswers.some(a => a.questionId === qid);

  const handleSubmit = () => {
    if (!submission) return;

    const newAnswers: QAAnswer[] = questions.map(q => {
      const answer = (answers[q.id] ?? "").trim();
      const { isCorrect, pointsAwarded } = autoMark(q, answer);
      return {
        id:              `qa_${Date.now()}_${q.id}`,
        questionId:      q.id,
        studentId:       currentUser.id,
        studentName:     currentUser.fullName,
        studentReg:      currentUser.regNumber,
        practicalId,
        labSubmissionId: submission.id,
        answer,
        isCorrect,
        pointsAwarded,
        maxPoints:       q.points,
        submittedAt:     new Date().toISOString(),
        synced:          false,
      };
    });

    newAnswers.forEach(saveAnswer);
    setSavedAnswers(newAnswers);
    setSubmitted(true);
    setCombined(computeCombinedScore(submission.scorePct, submission.id));
  };

  const practicalLabel = practicalId === "cold-cream" ? "Cold Cream" : "Vanishing Cream";
  const unanswered = questions.filter(q => !(answers[q.id] ?? "").trim()).length;

  // ── Colour helpers ─────────────────────────────────────────────────────────
  const resultColor = (a: QAAnswer) =>
    a.isCorrect === null ? "#f59e0b" : a.isCorrect ? "#22c55e" : "#ef4444";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 12,
    }}>
      <div style={{
        background: "#0f172a", border: "1px solid #1e293b",
        borderRadius: 18, width: "min(720px,98vw)", maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 22px", borderBottom: "1px solid #1e293b",
          background: "#080f1e", borderRadius: "18px 18px 0 0",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(59,130,246,0.2)", border: "1px solid #3b82f688",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ClipboardList size={18} color="#60a5fa" />
            </div>
            <div>
              <div style={{ color: "white", fontWeight: 800, fontSize: 16 }}>
                Q&amp;A Assessment
              </div>
              <div style={{ color: "#64748b", fontSize: 11 }}>
                {practicalLabel} · {questions.length} question{questions.length !== 1 ? "s" : ""} · {totalPoints} pts
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "#1e293b", border: "none", color: "#94a3b8",
            borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 20, lineHeight: 1,
          }}>×</button>
        </div>

        {/* Combined score banner (shown after submission + lab eval) */}
        {submitted && combined && submission && (
          <div style={{
            padding: "14px 22px",
            background: "linear-gradient(135deg,rgba(37,99,235,0.15),rgba(124,58,237,0.15))",
            borderBottom: "1px solid #1e3a5f",
          }}>
            <div style={{ color: "#60a5fa", fontSize: 11, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
              Combined Result
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
              {[
                { label: "Practical", value: `${combined.practicalPct}%`, color: "#4ade80" },
                { label: "Q&A", value: combined.qaMaxPts > 0 ? `${combined.qaTotalPts}/${combined.qaMaxPts} pts` : "—", color: "#60a5fa" },
                { label: "Q&A %", value: combined.qaMaxPts > 0 ? `${combined.qaPct}%` : "—", color: "#a78bfa" },
                { label: "Combined", value: `${combined.combinedPct}%`, color: combined.combinedPct >= 70 ? "#22c55e" : combined.combinedPct >= 50 ? "#f59e0b" : "#ef4444" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background: "rgba(255,255,255,0.05)", borderRadius: 10,
                  padding: "10px 14px", textAlign: "center",
                }}>
                  <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
                    {label}
                  </div>
                  <div style={{ color, fontSize: 18, fontWeight: 800 }}>{value}</div>
                </div>
              ))}
            </div>
            {combined.qaPending > 0 && (
              <div style={{ marginTop: 8, color: "#f59e0b", fontSize: 12,
                display: "flex", alignItems: "center", gap: 6 }}>
                <Clock size={13} /> {combined.qaPending} short answer{combined.qaPending>1?"s":""} pending teacher review — combined score may increase.
              </div>
            )}
          </div>
        )}

        {/* Questions scrollable area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px" }}>
          {questions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#475569" }}>
              <BookOpen size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: "#94a3b8" }}>No questions yet</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>
                Your teacher has not added Q&amp;A questions for this practical.
              </div>
            </div>
          ) : (
            questions.map((q, i) => {
              const savedAns = savedAnswers.find(a => a.questionId === q.id);
              const currentVal = answers[q.id] ?? "";
              const isLocked = submitted;

              return (
                <div key={q.id} style={{
                  background: "#0d1b2e", border: `1px solid ${
                    savedAns
                      ? savedAns.isCorrect === true ? "#22c55e44"
                      : savedAns.isCorrect === false ? "#ef444444"
                      : "#f59e0b44"
                      : "#1e3a5f"
                  }`,
                  borderRadius: 12, padding: "16px 18px", marginBottom: 14,
                }}>
                  {/* Question header */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                    gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                        <span style={{ color: "#475569", fontSize: 12 }}>Q{i+1}</span>
                        <span style={{
                          background: q.type === "mcq" ? "rgba(59,130,246,0.15)" : "rgba(34,197,94,0.15)",
                          color: q.type === "mcq" ? "#60a5fa" : "#4ade80",
                          borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700,
                        }}>{q.type === "mcq" ? "Multiple Choice" : "Short Answer"}</span>
                        <span style={{ color: "#64748b", fontSize: 11 }}>{q.points} pt{q.points>1?"s":""}</span>
                        {savedAns && (
                          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4,
                            color: resultColor(savedAns), fontSize: 12, fontWeight: 700 }}>
                            {savedAns.isCorrect === true  && <><CheckCircle size={14} /> Correct (+{savedAns.pointsAwarded} pts)</>}
                            {savedAns.isCorrect === false && <><XCircle size={14} /> Incorrect</>}
                            {savedAns.isCorrect === null  && <><Clock size={14} /> Pending review</>}
                          </span>
                        )}
                      </div>
                      <div style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 1.65 }}>{q.text}</div>
                    </div>
                  </div>

                  {/* MCQ options */}
                  {q.type === "mcq" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                      {q.options.map((opt, oi) => {
                        const isSelected = currentVal === opt;
                        const isCorrectOpt = savedAns && opt === q.correctAnswer;
                        const isWrongSel   = savedAns && isSelected && !savedAns.isCorrect;

                        let bg     = "rgba(255,255,255,0.04)";
                        let border = "#1e3a5f";
                        let color  = "#94a3b8";

                        if (!isLocked && isSelected) { bg = "rgba(59,130,246,0.15)"; border = "#3b82f6"; color = "#60a5fa"; }
                        if (isLocked && isCorrectOpt) { bg = "rgba(34,197,94,0.12)"; border = "#22c55e44"; color = "#4ade80"; }
                        if (isLocked && isWrongSel)   { bg = "rgba(239,68,68,0.10)"; border = "#ef444444"; color = "#f87171"; }

                        return (
                          <button key={oi} disabled={isLocked}
                            onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                            style={{
                              background: bg, border: `1px solid ${border}`,
                              borderRadius: 9, padding: "11px 14px",
                              display: "flex", alignItems: "center", gap: 10,
                              cursor: isLocked ? "default" : "pointer",
                              textAlign: "left", width: "100%",
                            }}>
                            <span style={{
                              width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                              border: `2px solid ${border}`,
                              background: isSelected ? border : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              {isLocked && isCorrectOpt && <CheckCircle size={14} color="#22c55e" />}
                              {isLocked && isWrongSel   && <XCircle    size={14} color="#ef4444" />}
                              {!isLocked && isSelected  && <div style={{ width:10, height:10, borderRadius:"50%", background:"#60a5fa" }} />}
                            </span>
                            <span style={{ color, fontSize: 13, fontWeight: isSelected ? 600 : 400 }}>
                              {String.fromCharCode(65+oi)}. {opt}
                            </span>
                          </button>
                        );
                      })}
                      {/* Show correct answer after wrong submission */}
                      {isLocked && savedAns && !savedAns.isCorrect && (
                        <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid #22c55e44",
                          borderRadius: 8, padding: "8px 12px",
                          color: "#4ade80", fontSize: 12, display: "flex", gap: 8, alignItems: "center" }}>
                          <CheckCircle size={13} /> Correct answer: <strong>{q.correctAnswer}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Short answer */}
                  {q.type === "short" && (
                    <div style={{ marginTop: 10 }}>
                      <textarea
                        value={isLocked ? (savedAns?.answer ?? "") : currentVal}
                        disabled={isLocked}
                        onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Write your answer here…"
                        rows={3}
                        style={{
                          width: "100%", background: "#0a1628",
                          border: `1.5px solid ${isLocked ? "#1e3a5f" : "#334155"}`,
                          color: "#e2e8f0", borderRadius: 8, padding: "10px 12px",
                          fontSize: 13, resize: "vertical", fontFamily: "inherit",
                          boxSizing: "border-box", outline: "none",
                          opacity: isLocked ? 0.7 : 1,
                        }}
                      />
                      {isLocked && q.correctAnswer && (
                        <div style={{ marginTop: 6, background: "rgba(167,139,250,0.08)",
                          border: "1px solid #a78bfa44", borderRadius: 8, padding: "8px 12px",
                          color: "#a78bfa", fontSize: 12 }}>
                          <strong>Model answer:</strong> {q.correctAnswer}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {questions.length > 0 && (
          <div style={{ padding: "14px 22px", borderTop: "1px solid #1e293b",
            background: "#080f1e", borderRadius: "0 0 18px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between" }}>

            {submitted ? (
              <div style={{ color: "#4ade80", fontSize: 13, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle size={15} strokeWidth={2.5} />
                Answers submitted. {combined && combined.qaPending > 0 ? "Short answers pending teacher review." : "All marked."}
              </div>
            ) : (
              <div style={{ color: "#64748b", fontSize: 12 }}>
                {unanswered > 0
                  ? <><AlertCircle size={13} style={{ verticalAlign:"middle", marginRight:4 }} />{unanswered} unanswered</>
                  : <><CheckCircle size={13} color="#22c55e" style={{ verticalAlign:"middle", marginRight:4 }} />All answered</>}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} style={{
                background: "transparent", border: "1px solid #334155",
                color: "#94a3b8", borderRadius: 8, padding: "9px 16px",
                cursor: "pointer", fontSize: 13, fontWeight: 600,
              }}>Close</button>
              {!submitted && questions.length > 0 && (
                <button onClick={handleSubmit}
                  disabled={!submission}
                  style={{
                    background: submission ? "#3b82f6" : "#1e293b",
                    color: "white", border: "none", borderRadius: 8,
                    padding: "9px 20px", cursor: submission ? "pointer" : "not-allowed",
                    fontSize: 13, fontWeight: 700,
                    display: "flex", alignItems: "center", gap: 7,
                    opacity: submission ? 1 : 0.5,
                  }}>
                  <Send size={14} strokeWidth={2.5} />
                  Submit Answers
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentQAPanel;
