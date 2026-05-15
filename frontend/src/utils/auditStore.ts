// ─────────────────────────────────────────────────────────────────────────────
// Audit log — records every significant platform action
// All helpers read the current user from localStorage directly so they can be
// called from anywhere without prop-drilling or circular imports.
// ─────────────────────────────────────────────────────────────────────────────

export type AuditAction =
  // ── Auth ──────────────────────────────────────────────────────────────────
  | "user_registered"
  | "user_login"
  | "user_deleted"
  // ── Lab session ───────────────────────────────────────────────────────────
  | "lab_started"        // student entered the interactive lab
  | "lab_evaluated"      // student clicked Evaluate Result
  | "code_entered"       // student redeemed an assignment code
  // ── In-lab milestones ─────────────────────────────────────────────────────
  | "lab_milestone"      // heating, cooling, mixing, etc.
  // ── Teacher actions ───────────────────────────────────────────────────────
  | "assignment_created"
  | "assignment_deleted"
  | "question_created"
  | "question_deleted"
  | "announcement_sent"
  // ── Q&A ───────────────────────────────────────────────────────────────────
  | "qa_submitted"
  // ── Admin ─────────────────────────────────────────────────────────────────
  | "admin_action";

export interface AuditEntry {
  id:        string;
  action:    AuditAction;
  actorId:   string;
  actorName: string;
  actorRole: string;
  detail:    string;
  timestamp: string;
}

const KEY      = "vlab_audit_log";
const MAX_LOGS = 500;

// ── Core read/write ───────────────────────────────────────────────────────────
export const getAuditLog = (): AuditEntry[] => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); }
  catch { return []; }
};

export const addAuditEntry = (entry: Omit<AuditEntry, "id" | "timestamp">): void => {
  const log      = getAuditLog();
  const newEntry: AuditEntry = {
    ...entry,
    id:        `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify([newEntry, ...log].slice(0, MAX_LOGS)));
};

export const clearAuditLog = (): void => localStorage.removeItem(KEY);

// ── Internal: read the current session user from localStorage ─────────────────
// This avoids importing userStore here (no circular dependency risk).
interface SessionUser { id:string; fullName:string; role:string; }
const sessionUser = (): SessionUser => {
  try {
    const u = JSON.parse(localStorage.getItem("vlab_current_user") ?? "null");
    if (u && u.id) return u;
  } catch { /* ignore */ }
  return { id:"anonymous", fullName:"Anonymous", role:"student" };
};

// ── Auth helpers ──────────────────────────────────────────────────────────────
export const logUserRegistered = (id: string, name: string, role: string): void =>
  addAuditEntry({ action:"user_registered", actorId:id, actorName:name, actorRole:role,
    detail:`${name} registered as ${role}` });

export const logUserLogin = (id: string, name: string, role: string): void =>
  addAuditEntry({ action:"user_login", actorId:id, actorName:name, actorRole:role,
    detail:`${name} (${role}) signed in` });

// ── Lab session helpers ───────────────────────────────────────────────────────
export const logLabStarted = (practicalId: string, mode: "assignment"|"practice"): void => {
  const u = sessionUser();
  const label = practicalId === "cold-cream" ? "Cold Cream" : "Vanishing Cream";
  addAuditEntry({ action:"lab_started", actorId:u.id, actorName:u.fullName, actorRole:u.role,
    detail:`${u.fullName} started ${label} (${mode} mode)` });
};

export const logCodeEntered = (token: string, practicalId: string): void => {
  const u = sessionUser();
  const label = practicalId === "cold-cream" ? "Cold Cream" : "Vanishing Cream";
  addAuditEntry({ action:"code_entered", actorId:u.id, actorName:u.fullName, actorRole:u.role,
    detail:`${u.fullName} entered assignment code ${token} for ${label}` });
};

export const logEvaluationSubmitted = (
  practicalId: string, scorePct: number, result: string,
): void => {
  const u = sessionUser();
  const label = practicalId === "cold-cream" ? "Cold Cream" : "Vanishing Cream";
  addAuditEntry({ action:"lab_evaluated", actorId:u.id, actorName:u.fullName, actorRole:u.role,
    detail:`${u.fullName} evaluated ${label} — ${scorePct}% (${result})` });
};

// ── In-lab milestone helper ───────────────────────────────────────────────────
// Called from InteractiveLabCanvas at key checkpoints.
export const logLabMilestone = (practicalId: string, milestone: string): void => {
  const u = sessionUser();
  const label = practicalId === "cold-cream" ? "Cold Cream" : "Vanishing Cream";
  addAuditEntry({ action:"lab_milestone", actorId:u.id, actorName:u.fullName, actorRole:u.role,
    detail:`[${label}] ${u.fullName}: ${milestone}` });
};

// ── Q&A helper ────────────────────────────────────────────────────────────────
export const logQASubmitted = (practicalId: string, answered: number, correct: number): void => {
  const u = sessionUser();
  const label = practicalId === "cold-cream" ? "Cold Cream" : "Vanishing Cream";
  addAuditEntry({ action:"qa_submitted", actorId:u.id, actorName:u.fullName, actorRole:u.role,
    detail:`${u.fullName} submitted Q&A for ${label} — ${correct}/${answered} correct` });
};

// ── Teacher helpers ───────────────────────────────────────────────────────────
export const logAssignmentCreated = (teacherName: string, token: string, practicalId: string): void =>
  addAuditEntry({ action:"assignment_created", actorId:"system", actorName:teacherName,
    actorRole:"teacher",
    detail:`${teacherName} created assignment ${token} for ${practicalId}` });

export const logAnnouncement = (teacherName: string, title: string): void =>
  addAuditEntry({ action:"announcement_sent", actorId:"system", actorName:teacherName,
    actorRole:"teacher", detail:`Announcement "${title}" sent by ${teacherName}` });
