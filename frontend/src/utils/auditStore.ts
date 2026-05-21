// ─────────────────────────────────────────────────────────────────────────────
// Audit store — backed by MongoDB via REST API
// All log helpers are fire-and-forget (never block the UI)
// ─────────────────────────────────────────────────────────────────────────────
import { apiGet, apiPost, apiDelete } from "./apiClient";

export type AuditAction =
  | "user_registered" | "user_login"    | "user_deleted"
  | "lab_started"     | "lab_evaluated" | "code_entered" | "lab_milestone"
  | "assignment_created" | "assignment_deleted"
  | "question_created"   | "question_deleted"
  | "announcement_sent"  | "qa_submitted" | "admin_action";

export interface AuditEntry {
  id:        string;
  action:    AuditAction;
  actorId:   string;
  actorName: string;
  actorRole: string;
  detail:    string;
  timestamp: string;
}

// ── Read (admin panel) ────────────────────────────────────────────────────────
export const getAuditLog = async (): Promise<AuditEntry[]> => {
  try {
    const res = await apiGet<{ logs: AuditEntry[] }>("/api/audit");
    return res.logs;
  } catch { return []; }
};

export const clearAuditLog = async (): Promise<void> => {
  await apiDelete("/api/audit");
};

// ── Write helper (fire-and-forget) ────────────────────────────────────────────
const push = (entry: Omit<AuditEntry, "id" | "timestamp">): void => {
  const id        = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const timestamp = new Date().toISOString();
  apiPost("/api/audit", { ...entry, clientId: id, timestamp }).catch(() => {});
};

// ── Internal: read the current session user ───────────────────────────────────
interface SessionUser { id: string; clientId?: string; fullName: string; role: string; }
const sessionUser = (): SessionUser => {
  try {
    const u = JSON.parse(localStorage.getItem("vlab_current_user") ?? "null");
    if (u && (u.id || u.clientId)) return { id: u.clientId ?? u.id, fullName: u.fullName, role: u.role };
  } catch { /* ignore */ }
  return { id: "anonymous", fullName: "Anonymous", role: "student" };
};

// ── Auth helpers ──────────────────────────────────────────────────────────────
export const logUserRegistered = (id: string, name: string, role: string): void =>
  push({ action: "user_registered", actorId: id, actorName: name, actorRole: role,
    detail: `${name} registered as ${role}` });

export const logUserLogin = (id: string, name: string, role: string): void =>
  push({ action: "user_login", actorId: id, actorName: name, actorRole: role,
    detail: `${name} (${role}) signed in` });

// ── Lab session helpers ───────────────────────────────────────────────────────
export const logLabStarted = (practicalId: string, mode: "assignment" | "practice"): void => {
  const u = sessionUser();
  const label = practicalId === "cold-cream" ? "Cold Cream" : "Vanishing Cream";
  push({ action: "lab_started", actorId: u.id, actorName: u.fullName, actorRole: u.role,
    detail: `${u.fullName} started ${label} (${mode} mode)` });
};

export const logCodeEntered = (token: string, practicalId: string): void => {
  const u = sessionUser();
  const label = practicalId === "cold-cream" ? "Cold Cream" : "Vanishing Cream";
  push({ action: "code_entered", actorId: u.id, actorName: u.fullName, actorRole: u.role,
    detail: `${u.fullName} entered assignment code ${token} for ${label}` });
};

export const logEvaluationSubmitted = (practicalId: string, scorePct: number, result: string): void => {
  const u = sessionUser();
  const label = practicalId === "cold-cream" ? "Cold Cream" : "Vanishing Cream";
  push({ action: "lab_evaluated", actorId: u.id, actorName: u.fullName, actorRole: u.role,
    detail: `${u.fullName} evaluated ${label} — ${scorePct}% (${result})` });
};

export const logLabMilestone = (practicalId: string, milestone: string): void => {
  const u = sessionUser();
  const label = practicalId === "cold-cream" ? "Cold Cream" : "Vanishing Cream";
  push({ action: "lab_milestone", actorId: u.id, actorName: u.fullName, actorRole: u.role,
    detail: `[${label}] ${u.fullName}: ${milestone}` });
};

export const logQASubmitted = (practicalId: string, answered: number, correct: number): void => {
  const u = sessionUser();
  const label = practicalId === "cold-cream" ? "Cold Cream" : "Vanishing Cream";
  push({ action: "qa_submitted", actorId: u.id, actorName: u.fullName, actorRole: u.role,
    detail: `${u.fullName} submitted Q&A for ${label} — ${correct}/${answered} correct` });
};

export const logAssignmentCreated = (teacherName: string, token: string, practicalId: string): void =>
  push({ action: "assignment_created", actorId: "system", actorName: teacherName,
    actorRole: "teacher", detail: `${teacherName} created assignment ${token} for ${practicalId}` });

export const logAnnouncement = (teacherName: string, title: string): void =>
  push({ action: "announcement_sent", actorId: "system", actorName: teacherName,
    actorRole: "teacher", detail: `Announcement "${title}" sent by ${teacherName}` });
