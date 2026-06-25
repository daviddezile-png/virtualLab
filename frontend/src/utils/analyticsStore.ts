// ─────────────────────────────────────────────────────────────────────────────
// Analytics store — read-only dashboards for teachers and admins.
// All endpoints are scoped server-side: teachers see only their own students,
// admins see everyone. Backed by real AuditLog / Submission / Q&A data.
// ─────────────────────────────────────────────────────────────────────────────
import { apiGet } from "./apiClient";

export type StageOutcome = {
  stage:   string;
  total:   number;
  success: number;
  warning: number;
  error:   number;
  info:    number;
};

export interface HeatmapResult {
  days:        number | null;
  hours?:      number | null;
  totalEvents: number;
  stages:      StageOutcome[];
}

// A heatmap time window — either an hours-based or days-based range.
export interface HeatmapPeriod { days?: number; hours?: number; }

export interface ActivityPoint { date: string; started: number; evaluated: number; }
export interface ActivityResult { days: number; series: ActivityPoint[]; }

export interface ErrorTrendPoint { date: string; warning: number; error: number; }
export interface ErrorTrendStage { stage: string; warning: number; error: number; }
export interface ErrorTrendResult {
  days:    number;
  series:  ErrorTrendPoint[];
  byStage: ErrorTrendStage[];
}

export interface FunnelStage { stage: string; count: number; }
export interface FunnelResult { funnel: FunnelStage[]; }

export type RiskLevel = "high" | "medium" | "low";
export interface AtRiskStudent {
  studentId: string;
  name:      string;
  email:     string;
  regNumber: string | null;
  attempts:  number;
  avgScore:  number;
  failCount: number;
  idleDays:  number | null;
  reasons:   string[];
  severity:  RiskLevel;
}
export interface AtRiskResult {
  total:        number;
  flaggedCount: number;
  students:     AtRiskStudent[];
}

export interface ItemStat {
  questionId:  string;
  text:        string;
  type:        string;
  practicalId: string;
  answered:    number;
  correct:     number;
  wrong:       number;
  pending:     number;
  correctPct:  number | null;
}
export interface ItemAnalysisResult { totalAnswers: number; items: ItemStat[]; }

const EMPTY_HEATMAP: HeatmapResult = { days: 0, totalEvents: 0, stages: [] };
const EMPTY_ACTIVITY: ActivityResult = { days: 0, series: [] };
const EMPTY_ERROR: ErrorTrendResult = { days: 0, series: [], byStage: [] };
const EMPTY_FUNNEL: FunnelResult = { funnel: [] };
const EMPTY_ATRISK: AtRiskResult = { total: 0, flaggedCount: 0, students: [] };
const EMPTY_ITEMS: ItemAnalysisResult = { totalAnswers: 0, items: [] };

// Append an optional class filter to an existing query string ("" or "a=b").
const withClass = (qs: string, classId?: string): string => {
  const cls = classId ? `classId=${encodeURIComponent(classId)}` : "";
  const parts = [qs, cls].filter(Boolean);
  return parts.length ? `?${parts.join("&")}` : "";
};

export const getHeatmap = async (period: HeatmapPeriod = { days: 30 }, classId?: string): Promise<HeatmapResult> => {
  const qs = period.hours ? `hours=${period.hours}` : `days=${period.days ?? 30}`;
  try { return await apiGet(`/api/analytics/heatmap${withClass(qs, classId)}`); }
  catch { return EMPTY_HEATMAP; }
};

export const getActivity = async (days = 14, classId?: string): Promise<ActivityResult> => {
  try { return await apiGet(`/api/analytics/activity${withClass(`days=${days}`, classId)}`); }
  catch { return EMPTY_ACTIVITY; }
};

export const getErrorTrend = async (days = 14, classId?: string): Promise<ErrorTrendResult> => {
  try { return await apiGet(`/api/analytics/error-trend${withClass(`days=${days}`, classId)}`); }
  catch { return EMPTY_ERROR; }
};

export const getFunnel = async (classId?: string): Promise<FunnelResult> => {
  try { return await apiGet(`/api/analytics/funnel${withClass("", classId)}`); }
  catch { return EMPTY_FUNNEL; }
};

export const getAtRisk = async (classId?: string): Promise<AtRiskResult> => {
  try { return await apiGet(`/api/analytics/at-risk${withClass("", classId)}`); }
  catch { return EMPTY_ATRISK; }
};

export const getItemAnalysis = async (practicalId?: string, classId?: string): Promise<ItemAnalysisResult> => {
  const qs = practicalId ? `practicalId=${encodeURIComponent(practicalId)}` : "";
  try { return await apiGet(`/api/analytics/item-analysis${withClass(qs, classId)}`); }
  catch { return EMPTY_ITEMS; }
};

// ── CSV export helper (Phase 4) ───────────────────────────────────────────────
// Converts an array of flat objects to a CSV string and triggers a download.
export const downloadCSV = (filename: string, rows: Record<string, unknown>[]): void => {
  if (rows.length === 0) { rows = [{ note: "No data" }]; }
  const headers = Array.from(
    rows.reduce<Set<string>>((set, r) => { Object.keys(r).forEach(k => set.add(k)); return set; }, new Set())
  );
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map(r => headers.map(h => escape(r[h])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};
