// ─────────────────────────────────────────────────────────────────────────────
// Q&A Store — teacher-authored questions + student answers
// localStorage now; swap bodies for API calls when backend is ready
// ─────────────────────────────────────────────────────────────────────────────

export type QAPractical = "vanishing-cream" | "cold-cream" | "all";

export interface QAQuestion {
  id:            string;
  practicalId:   QAPractical;
  text:          string;
  type:          "mcq" | "short";
  options:       string[];      // MCQ choices (empty for short answer)
  correctAnswer: string;        // MCQ: exact option text  |  short: model/expected answer
  points:        number;
  createdAt:     string;
  createdBy:     string;
}

export interface QAAnswer {
  id:              string;
  questionId:      string;
  studentId:       string;
  studentName:     string;
  studentReg?:     string;
  practicalId:     string;
  labSubmissionId: string;      // links to LabSubmission.id
  answer:          string;
  isCorrect:       boolean | null; // null = needs teacher review (short answers)
  pointsAwarded:   number;
  maxPoints:       number;
  submittedAt:     string;
  synced:          boolean;
}

// ── Keys ─────────────────────────────────────────────────────────────────────
const Q_KEY = "vlab_qa_questions";
const A_KEY = "vlab_qa_answers";

// ── Question CRUD ─────────────────────────────────────────────────────────────
export const getAllQuestions = (): QAQuestion[] => {
  try { return JSON.parse(localStorage.getItem(Q_KEY) ?? "[]"); }
  catch { return []; }
};

export const getQuestionsForPractical = (practicalId: string): QAQuestion[] =>
  getAllQuestions().filter(q => q.practicalId === practicalId || q.practicalId === "all");

export const saveQuestion = (q: QAQuestion): void => {
  const all = getAllQuestions().filter(x => x.id !== q.id);
  localStorage.setItem(Q_KEY, JSON.stringify([...all, q]));
};

export const deleteQuestion = (id: string): void =>
  localStorage.setItem(Q_KEY, JSON.stringify(getAllQuestions().filter(q => q.id !== id)));

// ── Answer CRUD ───────────────────────────────────────────────────────────────
export const getAllAnswers = (): QAAnswer[] => {
  try { return JSON.parse(localStorage.getItem(A_KEY) ?? "[]"); }
  catch { return []; }
};

export const getAnswersForSubmission = (labSubmissionId: string): QAAnswer[] =>
  getAllAnswers().filter(a => a.labSubmissionId === labSubmissionId);

export const getAnswersForStudent = (studentId: string): QAAnswer[] =>
  getAllAnswers().filter(a => a.studentId === studentId);

export const saveAnswer = (a: QAAnswer): void => {
  const all = getAllAnswers().filter(x => x.id !== a.id);
  localStorage.setItem(A_KEY, JSON.stringify([...all, a]));
  // TODO: POST /api/qa/answers when backend is ready
};

export const updateAnswerScore = (id: string, isCorrect: boolean, pointsAwarded: number): void => {
  const all = getAllAnswers().map(a =>
    a.id === id ? { ...a, isCorrect, pointsAwarded } : a
  );
  localStorage.setItem(A_KEY, JSON.stringify(all));
};

// ── Auto-marking ──────────────────────────────────────────────────────────────
export const autoMark = (
  q: QAQuestion, answer: string,
): { isCorrect: boolean | null; pointsAwarded: number } => {
  if (q.type === "mcq") {
    const correct = answer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
    return { isCorrect: correct, pointsAwarded: correct ? q.points : 0 };
  }
  // Short answer: submit for teacher review
  return { isCorrect: null, pointsAwarded: 0 };
};

// ── Combined score ────────────────────────────────────────────────────────────
export interface CombinedScore {
  practicalPct:  number;   // 0-100 from lab evaluation
  qaTotalPts:    number;   // points awarded from Q&A
  qaMaxPts:      number;   // maximum possible Q&A points
  qaPct:         number;   // 0-100
  combinedPct:   number;   // weighted: 60% practical + 40% Q&A (or 100% practical if no Q&A)
  qaAnswered:    number;   // how many Q&A answered
  qaPending:     number;   // short answers pending teacher review
}

export const computeCombinedScore = (
  practicalPct: number,
  labSubmissionId: string,
): CombinedScore => {
  const answers = getAnswersForSubmission(labSubmissionId);
  if (answers.length === 0) {
    return {
      practicalPct, qaTotalPts: 0, qaMaxPts: 0,
      qaPct: 0, combinedPct: practicalPct,
      qaAnswered: 0, qaPending: 0,
    };
  }

  const qaTotalPts = answers.reduce((s, a) => s + a.pointsAwarded, 0);
  const qaMaxPts   = answers.reduce((s, a) => s + a.maxPoints, 0);
  const qaPct      = qaMaxPts > 0 ? Math.round((qaTotalPts / qaMaxPts) * 100) : 0;
  const qaPending  = answers.filter(a => a.isCorrect === null).length;
  const combinedPct = Math.round(practicalPct * 0.6 + qaPct * 0.4);

  return {
    practicalPct, qaTotalPts, qaMaxPts,
    qaPct, combinedPct, qaAnswered: answers.length, qaPending,
  };
};
