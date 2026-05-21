// ─────────────────────────────────────────────────────────────────────────────
// User store — now backed by MongoDB via REST API
// JWT token stored in localStorage (vlab_token)
// Current user object cached in localStorage (vlab_current_user) for routing
// ─────────────────────────────────────────────────────────────────────────────
import { apiGet, apiPost, apiPatch, apiDelete } from "./apiClient";

export type Role       = "admin" | "teacher" | "student";
export type UserStatus = "active" | "pending" | "rejected";

export interface User {
  id?:          string;      // MongoDB _id
  clientId:     string;      // e.g. "u1716000000-abc12"
  role:         Role;
  fullName:     string;
  email:        string;
  regNumber?:   string | null;
  status?:      UserStatus;
  suspended?:   boolean;
  seeded?:      boolean;
  createdAt?:   string;
  lastLogin?:   string;
}

export interface AuthResult {
  ok:       boolean;
  error?:   string;
  user?:    User;
  pending?: boolean;
}

export interface RegisterInput {
  role:         "teacher" | "student";
  fullName:     string;
  email:        string;
  password:     string;
  regNumber?:   string;
  forceActive?: boolean;
}

// ── Theme (stays in localStorage — user preference only) ─────────────────────
export type ThemeMode = "light" | "dark";
const THEME_KEY = "vlab_theme";

export const getStoredTheme = (): ThemeMode => {
  const v = localStorage.getItem(THEME_KEY);
  return v === "dark" ? "dark" : "light";
};
export const storeTheme = (mode: ThemeMode): void =>
  localStorage.setItem(THEME_KEY, mode);

// ── Session cache (localStorage) ─────────────────────────────────────────────
const TOKEN_KEY   = "vlab_token";
const SESSION_KEY = "vlab_current_user";

export const getCurrentUser = (): User | null => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null"); }
  catch { return null; }
};

const saveSession = (user: User, token: string) => {
  localStorage.setItem(TOKEN_KEY,   token);
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
};

export const logoutUser = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
};

// Called once at app startup — no-op now (admin seeded via backend script)
export const seedDefaultAdmin = (): void => { /* handled by backend */ };

// ── Auth ──────────────────────────────────────────────────────────────────────
export const registerUser = async (input: RegisterInput): Promise<AuthResult> => {
  try {
    const res = await apiPost<{
      token?: string; user?: User;
      pending?: boolean; created?: boolean;
      message?: string; error?: string;
    }>("/api/auth/register", input);

    if (res.pending) return { ok: true, user: res.user, pending: true };

    // forceActive = admin/teacher created this account on behalf of someone else.
    // The backend returns no token so we must NOT overwrite the caller's session.
    if (res.created && res.user) return { ok: true, user: res.user };

    // Normal self-registration — save session so the new user is logged in.
    if (res.token && res.user) {
      saveSession(res.user, res.token);
      return { ok: true, user: res.user };
    }

    return { ok: false, error: res.error ?? "Registration failed" };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error).message };
  }
};

export const loginUser = async (email: string, password: string): Promise<AuthResult> => {
  try {
    const res = await apiPost<{ token?: string; user?: User; error?: string }>(
      "/api/auth/login", { email, password }
    );
    if (res.token && res.user) {
      saveSession(res.user, res.token);
      return { ok: true, user: res.user };
    }
    return { ok: false, error: res.error ?? "Login failed" };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error).message };
  }
};

// ── User management ───────────────────────────────────────────────────────────
// Admin only — full user list with all roles
export const getAllUsers = async (): Promise<User[]> => {
  try {
    const res = await apiGet<{ users: User[] }>("/api/users");
    return res.users;
  } catch { return []; }
};

// Teacher + Admin — list of active students only
export const getStudents = async (): Promise<User[]> => {
  try {
    const res = await apiGet<{ users: User[] }>("/api/users/students");
    return res.users;
  } catch { return []; }
};

// Teacher + Admin — user counts for dashboard stats
export const getUserCounts = async (): Promise<{ students: number; teachers: number; admins: number; total: number }> => {
  try {
    return await apiGet("/api/users/counts");
  } catch { return { students: 0, teachers: 0, admins: 0, total: 0 }; }
};

export const getPendingTeachers = async (): Promise<User[]> => {
  try {
    const res = await apiGet<{ users: User[] }>("/api/users/pending-teachers");
    return res.users;
  } catch { return []; }
};

export const createAdminUser = async (
  fullName: string, email: string, password: string
): Promise<AuthResult> => {
  try {
    const res = await apiPost<{ user?: User; error?: string }>(
      "/api/users", { role: "admin", fullName, email, password, forceActive: true }
    );
    return res.user ? { ok: true, user: res.user } : { ok: false, error: res.error };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error).message };
  }
};

export const approveTeacher = async (clientId: string): Promise<void> => {
  await apiPatch(`/api/users/${clientId}/approve`);
};

export const rejectTeacher = async (clientId: string): Promise<void> => {
  await apiPatch(`/api/users/${clientId}/reject`);
};

export const deleteUserById = async (clientId: string): Promise<void> => {
  await apiDelete(`/api/users/${clientId}`);
};

export const toggleSuspend = async (clientId: string): Promise<void> => {
  await apiPatch(`/api/users/${clientId}/suspend`);
};
