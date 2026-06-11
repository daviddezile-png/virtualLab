// ─────────────────────────────────────────────────────────────────────────────
// Assignment store — backed by MongoDB via REST API
// Timer start times remain in localStorage (ephemeral session state)
// ─────────────────────────────────────────────────────────────────────────────
import { apiGet, apiPost, apiDelete } from "./apiClient";

export type PracticalId = "vanishing-cream" | "cold-cream";

export interface Assignment {
  _id?:              string;    // MongoDB id
  token:             string;
  practicalId:       PracticalId;
  title?:            string;
  targetGrams:       number;
  timeLimitMinutes:  number;
  codeExpiresAt:     string | null;
  createdAt?:        string;
  createdBy?:        string;
  teacherId?:        string;
  uses?:             number;
  // Per-student timer start (ms epoch). Set by the backend when this student
  // first redeems the code — authoritative across devices and sessions.
  startedAt?:        number;
}

export const isCodeExpired = (a: Assignment): boolean =>
  a.codeExpiresAt !== null && new Date(a.codeExpiresAt) < new Date();

// ── Base recipes ──────────────────────────────────────────────────────────────
export interface Reagent { name: string; amount: number; unit: "g" | "mL"; }

export const BASE_RECIPES: Record<PracticalId, { totalGrams: number; reagents: Reagent[] }> = {
  "vanishing-cream": {
    totalGrams: 100,
    reagents: [
      { name: "Stearic Acid",          amount: 18, unit: "g"  },
      { name: "Liquid Paraffin",       amount:  7, unit: "mL" },
      { name: "Glycerin",              amount:  3, unit: "mL" },
      { name: "KOH & Triethanolamine", amount:  1, unit: "mL" },
      { name: "Distilled Water",       amount: 70, unit: "mL" },
    ],
  },
  "cold-cream": {
    totalGrams: 90,
    reagents: [
      { name: "Beeswax",         amount: 12, unit: "g"  },
      { name: "Liquid Paraffin", amount: 35, unit: "mL" },
      { name: "Borax Solution",  amount:  3, unit: "mL" },
      { name: "Distilled Water", amount: 40, unit: "mL" },
    ],
  },
};

// ── Token generator (frontend still generates the token string) ───────────────
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const generateToken = (practicalId: PracticalId): string => {
  const prefix = practicalId === "vanishing-cream" ? "VC" : "CC";
  const rand   = Array.from({ length: 6 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join("");
  return `${prefix}-${rand}`;
};

// ── API calls ─────────────────────────────────────────────────────────────────
export const getAllAssignments = async (): Promise<Assignment[]> => {
  try {
    const res = await apiGet<{ assignments: Assignment[] }>("/api/assignments");
    return res.assignments;
  } catch { return []; }
};

export const saveAssignment = async (a: Assignment): Promise<void> => {
  await apiPost("/api/assignments", a);
};

export const deleteAssignment = async (token: string): Promise<void> => {
  // Find by token first to get the MongoDB _id
  const all = await getAllAssignments();
  const found = all.find(x => x.token === token);
  if (found?._id) await apiDelete(`/api/assignments/${found._id}`);
};

export const findAssignment = async (token: string): Promise<Assignment | null> => {
  // Errors propagate so callers can surface backend messages (e.g. "no teacher assigned").
  const res = await apiGet<{ assignment: Assignment; startedAt?: number }>(
    `/api/assignments/redeem/${token.toUpperCase().trim()}`
  );
  if (!res.assignment) return null;
  // Attach the server-authoritative per-student timer start to the assignment object.
  return { ...res.assignment, startedAt: res.startedAt };
};

export const incrementUses = async (_token: string): Promise<void> => {
  // Backend increments automatically on /redeem — nothing to do here
};

// ── Timer (stays in localStorage — ephemeral, per-device session state) ───────
const TIMER_PREFIX = "vlab_timer_";

export const getOrSetTimerStart = (token: string): number => {
  const key    = TIMER_PREFIX + token;
  const stored = localStorage.getItem(key);
  if (stored) return parseInt(stored, 10);
  const now = Date.now();
  localStorage.setItem(key, String(now));
  return now;
};

export const clearTimerStart = (token: string): void =>
  localStorage.removeItem(TIMER_PREFIX + token);
