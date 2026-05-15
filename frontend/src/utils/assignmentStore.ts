// ─────────────────────────────────────────────────────────────────────────────
// Assignment store — localStorage now, ready for API swap later
// ─────────────────────────────────────────────────────────────────────────────

export type PracticalId = "vanishing-cream" | "cold-cream";

export interface Assignment {
  token:             string;
  practicalId:       PracticalId;
  title:             string;        // teacher's task/question text
  targetGrams:       number;        // e.g. 50  (how many grams of cream to prepare)
  timeLimitMinutes:  number;        // e.g. 45 — 0 means no limit
  codeExpiresAt:     string | null; // ISO datetime string — null = never expires
  createdAt:         string;
  createdBy:         string;
  uses:              number;        // incremented each time a student opens it
}

/** Returns true if the code is past its expiry date */
export const isCodeExpired = (a: Assignment): boolean =>
  a.codeExpiresAt !== null && new Date(a.codeExpiresAt) < new Date();

export interface StudentSession {
  token:       string;
  practicalId: PracticalId;
  startedAt:   string;
  mode:        "practice" | "assignment";
  synced:      boolean;      // false → needs DB write when backend is ready
}

// ── Base recipes ──────────────────────────────────────────────────────────────
// totalGrams is the reference batch size for each practical.
// multiplier = targetGrams / totalGrams

export interface Reagent {
  name:   string;
  amount: number;
  unit:   "g" | "mL";
}

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

// ── Token generation ──────────────────────────────────────────────────────────
// Format: VC-XXXXXX or CC-XXXXXX  (no 0/O/I/1 to avoid confusion)
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const generateToken = (practicalId: PracticalId): string => {
  const prefix = practicalId === "vanishing-cream" ? "VC" : "CC";
  const rand = Array.from({ length: 6 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join("");
  return `${prefix}-${rand}`;
};

// ── Persistence ───────────────────────────────────────────────────────────────
const ASSIGNMENT_KEY = "vlab_assignments";
const SESSION_KEY    = "vlab_sessions";

export const getAllAssignments = (): Assignment[] => {
  try { return JSON.parse(localStorage.getItem(ASSIGNMENT_KEY) ?? "[]"); }
  catch { return []; }
};

export const saveAssignment = (a: Assignment): void => {
  const all = getAllAssignments().filter(x => x.token !== a.token);
  localStorage.setItem(ASSIGNMENT_KEY, JSON.stringify([...all, a]));
};

export const deleteAssignment = (token: string): void => {
  localStorage.setItem(
    ASSIGNMENT_KEY,
    JSON.stringify(getAllAssignments().filter(a => a.token !== token))
  );
};

export const findAssignment = (token: string): Assignment | null =>
  getAllAssignments().find(a => a.token === token.toUpperCase().trim()) ?? null;

export const incrementUses = (token: string): void => {
  const all = getAllAssignments().map(a =>
    a.token === token ? { ...a, uses: a.uses + 1 } : a
  );
  localStorage.setItem(ASSIGNMENT_KEY, JSON.stringify(all));
};

// ── Student sessions ──────────────────────────────────────────────────────────
export const startSession = (session: StudentSession): void => {
  const all: StudentSession[] = (() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "[]"); }
    catch { return []; }
  })();
  localStorage.setItem(SESSION_KEY, JSON.stringify([...all, session]));
  // TODO: when backend is ready, POST /api/sessions with session data
};

// ── Timer persistence — survives page refresh ─────────────────────────────────
const TIMER_PREFIX = "vlab_timer_";

// Call once when the student first opens the lab with this token.
// Returns the epoch ms start time (uses existing if already set, so refreshes keep the same clock).
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
