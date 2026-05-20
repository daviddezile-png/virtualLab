// ─────────────────────────────────────────────────────────────────────────────
// Submission store — backed by MongoDB via REST API
// ─────────────────────────────────────────────────────────────────────────────
import { apiGet, apiPost } from "./apiClient";

export type SubmissionResult = "PASS" | "AVERAGE" | "FAIL";

export interface LabSubmission {
  id:           string;
  token:        string;
  practicalId:  string;
  mode:         "practice" | "assignment";
  studentId:    string;
  studentName:  string;
  studentReg?:  string;
  submittedAt:  string;
  durationSec:  number;
  score10:      number;
  scorePct:     number;
  passCount:    number;
  totalSteps:   number;
  result:       SubmissionResult;
  ph:           number;
  viscosity:    number;
  stability:    string;
  synced:       boolean;
}

export interface StatsResult {
  total:      number;
  passed:     number;
  average:    number;
  failed:     number;
  classAvg:   number;
  todayCount: number;
  avgDur:     number;
}

export const getAllSubmissions = async (): Promise<LabSubmission[]> => {
  try {
    const res = await apiGet<{ submissions: LabSubmission[] }>("/api/submissions");
    return res.submissions;
  } catch { return []; }
};

export const saveSubmission = async (s: LabSubmission): Promise<void> => {
  await apiPost("/api/submissions", { ...s, clientId: s.id });
};

export const avgScore = (subs: LabSubmission[]): number => {
  if (subs.length === 0) return 0;
  return Math.round(subs.reduce((acc, s) => acc + s.scorePct, 0) / subs.length);
};

export const getStats = async (): Promise<StatsResult> => {
  try {
    const all        = await getAllSubmissions();
    const total      = all.length;
    const passed     = all.filter(s => s.result === "PASS").length;
    const average    = all.filter(s => s.result === "AVERAGE").length;
    const failed     = all.filter(s => s.result === "FAIL").length;
    const classAvg   = avgScore(all);
    const todayCount = all.filter(s =>
      new Date(s.submittedAt).toDateString() === new Date().toDateString()
    ).length;
    const avgDur = total > 0
      ? Math.round(all.reduce((acc, s) => acc + s.durationSec, 0) / total / 60)
      : 0;
    return { total, passed, average, failed, classAvg, todayCount, avgDur };
  } catch {
    return { total: 0, passed: 0, average: 0, failed: 0, classAvg: 0, todayCount: 0, avgDur: 0 };
  }
};
