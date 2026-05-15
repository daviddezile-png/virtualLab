// ─────────────────────────────────────────────────────────────────────────────
// Submission store — records every evaluated lab session
// localStorage now; swap saveSubmission() body for POST /api/submissions later
// ─────────────────────────────────────────────────────────────────────────────

export type SubmissionResult = "PASS" | "AVERAGE" | "FAIL";

export interface LabSubmission {
  id:           string;
  token:        string;           // assignment token — "" for self-practice
  practicalId:  string;
  mode:         "practice" | "assignment";

  studentId:    string;
  studentName:  string;
  studentReg?:  string;

  submittedAt:  string;           // ISO string
  durationSec:  number;           // seconds between entering lab and evaluating

  score10:      number;           // normalised score 0–10  (engine / 18 * 10)
  scorePct:     number;           // percent  = passCount/totalSteps * 100
  passCount:    number;
  totalSteps:   number;
  result:       SubmissionResult;

  ph:           number;
  viscosity:    number;
  stability:    string;

  synced:       boolean;          // false = waiting for backend POST
}

const KEY = "vlab_submissions";

export const getAllSubmissions = (): LabSubmission[] => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); }
  catch { return []; }
};

export const saveSubmission = (s: LabSubmission): void => {
  const all = getAllSubmissions().filter(x => x.id !== s.id);
  localStorage.setItem(KEY, JSON.stringify([...all, s]));
  // TODO: POST /api/submissions with s when backend is ready
};

// ── Derived helpers used by TeacherPanel ──────────────────────────────────────

export const getSubmissionsByToken = (token: string) =>
  getAllSubmissions().filter(s => s.token === token);

export const getSubmissionsByStudent = (studentId: string) =>
  getAllSubmissions().filter(s => s.studentId === studentId);

/** Average score (0–100) across an array of submissions */
export const avgScore = (subs: LabSubmission[]): number => {
  if (subs.length === 0) return 0;
  return Math.round(subs.reduce((acc, s) => acc + s.scorePct, 0) / subs.length);
};

/** Latest submission for a given student + practical */
export const latestSubmission = (
  studentId: string, practicalId: string,
): LabSubmission | null => {
  const matches = getAllSubmissions()
    .filter(s => s.studentId === studentId && s.practicalId === practicalId)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  return matches[0] ?? null;
};

/** Summary stats across all submissions */
export const getStats = () => {
  const all = getAllSubmissions();
  const total      = all.length;
  const passed     = all.filter(s => s.result === "PASS").length;
  const average    = all.filter(s => s.result === "AVERAGE").length;
  const failed     = all.filter(s => s.result === "FAIL").length;
  const classAvg   = avgScore(all);
  const todayCount = all.filter(s =>
    new Date(s.submittedAt).toDateString() === new Date().toDateString()
  ).length;
  const avgDur     = total > 0
    ? Math.round(all.reduce((acc, s) => acc + s.durationSec, 0) / total / 60)
    : 0;
  return { total, passed, average, failed, classAvg, todayCount, avgDur };
};
