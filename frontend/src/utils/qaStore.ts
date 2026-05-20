// ─────────────────────────────────────────────────────────────────────────────
// Q&A store — backed by MongoDB via REST API
// ─────────────────────────────────────────────────────────────────────────────
import { apiGet, apiPost, apiDelete } from "./apiClient";

export type QAPractical = "vanishing-cream" | "cold-cream" | "all";

export interface QAQuestion {
  id?:           string;
  practicalId:   QAPractical;
  text:          string;
  type:          "mcq" | "short";
  options:       string[];
  correctAnswer: string;
  points:        number;
  createdAt?:    string;
  createdBy?:    string;
}

export interface QAAnswer {
  id?:             string;
  questionId:      string;
  studentId:       string;
  studentName:     string;
  studentReg?:     string;
  practicalId:     string;
  labSubmissionId: string;
  answer:          string;
  isCorrect:       boolean | null;
  pointsAwarded:   number;
  maxPoints:       number;
  submittedAt?:    string;
  synced?:         boolean;
}

// ── Questions ─────────────────────────────────────────────────────────────────
export const getAllQuestions = async (): Promise<QAQuestion[]> => {
  try {
    const res = await apiGet<{ questions: QAQuestion[] }>("/api/qa/questions");
    return res.questions;
  } catch { return []; }
};

export const getQuestionsForPractical = async (practicalId: string): Promise<QAQuestion[]> => {
  try {
    const res = await apiGet<{ questions: QAQuestion[] }>(
      `/api/qa/questions?practicalId=${practicalId}`
    );
    return res.questions;
  } catch { return []; }
};

export const saveQuestion = async (q: QAQuestion): Promise<void> => {
  await apiPost("/api/qa/questions", {
    practicalId:   q.practicalId,
    question:      q.text,
    type:          q.type,
    options:       q.options,
    correctAnswer: q.options.indexOf(q.correctAnswer),
    points:        q.points,
  });
};

export const deleteQuestion = async (id: string): Promise<void> => {
  await apiDelete(`/api/qa/questions/${id}`);
};

// ── Answers ───────────────────────────────────────────────────────────────────
export const getAllAnswers = async (): Promise<QAAnswer[]> => {
  try {
    const res = await apiGet<{ answers: QAAnswer[] }>("/api/qa/answers");
    return res.answers;
  } catch { return []; }
};

export const saveAnswer = async (a: QAAnswer): Promise<void> => {
  await apiPost("/api/qa/answers", {
    answers: [{
      clientId:      a.id,
      questionId:    a.questionId,
      answer:        a.answer,
      isCorrect:     a.isCorrect,
      pointsAwarded: a.pointsAwarded,
    }],
    practicalId:  a.practicalId,
    submissionId: a.labSubmissionId,
    studentName:  a.studentName,
  });
};

// ── Combined score ────────────────────────────────────────────────────────────
export const computeCombinedScore = (
  practicalPct: number,
  answers: QAAnswer[],
  questions: QAQuestion[],
): { qaPct: number; combinedPct: number } => {
  if (questions.length === 0) return { qaPct: 0, combinedPct: practicalPct };
  const totalPts    = questions.reduce((s, q) => s + q.points, 0);
  const earned      = answers.reduce((s, a)  => s + (a.pointsAwarded ?? 0), 0);
  const qaPct       = totalPts > 0 ? Math.round((earned / totalPts) * 100) : 0;
  const combinedPct = Math.round(practicalPct * 0.6 + qaPct * 0.4);
  return { qaPct, combinedPct };
};
