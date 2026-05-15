// ─────────────────────────────────────────────────────────────────────────────
// User store — localStorage now, ready for backend swap later
// ─────────────────────────────────────────────────────────────────────────────
import { logUserRegistered, logUserLogin } from "./auditStore";

export type Role = "admin" | "teacher" | "student";

export interface User {
  id:           string;
  role:         Role;
  fullName:     string;
  email:        string;
  regNumber?:   string;   // students only
  passwordHash: string;
  createdAt:    string;
  seeded?:      boolean;  // true for the default admin — cannot be deleted
}

const USERS_KEY   = "vlab_users";
const SESSION_KEY = "vlab_current_user";
const THEME_KEY   = "vlab_theme";

// Tiny deterministic hash — replace with bcrypt when backend is wired up
const hash = (s: string): string => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return `h${Math.abs(h).toString(36)}`;
};

// ── Read ──────────────────────────────────────────────────────────────────────
export const getAllUsers = (): User[] => {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]"); }
  catch { return []; }
};

export const findUserByEmail = (email: string): User | null =>
  getAllUsers().find(u => u.email.toLowerCase() === email.toLowerCase().trim()) ?? null;

export const getCurrentUser = (): User | null => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null"); }
  catch { return null; }
};

// ── Write ─────────────────────────────────────────────────────────────────────
const persistUsers = (users: User[]) =>
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

const persistSession = (user: User | null) => {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else      localStorage.removeItem(SESSION_KEY);
};

// ── Seeded default admin ──────────────────────────────────────────────────────
// Called once on app startup. Creates the primary admin if they don't exist yet.
// Credentials are hardcoded here — change them in the admin settings later.
const SEED_ADMIN: { fullName:string; email:string; password:string } = {
  fullName: "Baraka Mahuvi",
  email:    "barakamahuvi99@gmail.com",
  password: "Shazam@255",
};

export const seedDefaultAdmin = (): void => {
  const existing = getAllUsers().find(u => u.role === "admin");
  if (existing) return;   // admin already exists — skip

  const seededAdmin: User = {
    id:           "admin-seed-001",
    role:         "admin",
    fullName:     SEED_ADMIN.fullName,
    email:        SEED_ADMIN.email,
    passwordHash: hash(SEED_ADMIN.password),
    createdAt:    new Date().toISOString(),
    seeded:       true,
  };

  persistUsers([seededAdmin, ...getAllUsers()]);
};

// ── Auth API (teacher + student only — admins are seeded or created internally)
export interface AuthResult { ok: boolean; error?: string; user?: User; }

export interface RegisterInput {
  role:       "teacher" | "student";   // admins cannot self-register
  fullName:   string;
  email:      string;
  password:   string;
  regNumber?: string;
}

export const registerUser = (input: RegisterInput): AuthResult => {
  const fullName = input.fullName.trim();
  const email    = input.email.trim().toLowerCase();
  if (!fullName) return { ok: false, error: "Full name is required" };
  if (!email)    return { ok: false, error: "Email is required" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, error: "Please enter a valid email" };
  if (input.password.length < 6)
    return { ok: false, error: "Password must be at least 6 characters" };
  if (input.role === "student" && !input.regNumber?.trim())
    return { ok: false, error: "Registration number is required" };
  if (findUserByEmail(email))
    return { ok: false, error: "An account with this email already exists" };

  const newUser: User = {
    id:           `u${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role:         input.role,
    fullName,
    email,
    regNumber:    input.role === "student" ? input.regNumber!.trim() : undefined,
    passwordHash: hash(input.password),
    createdAt:    new Date().toISOString(),
  };

  persistUsers([...getAllUsers(), newUser]);
  persistSession(newUser);
  logUserRegistered(newUser.id, newUser.fullName, newUser.role);
  return { ok: true, user: newUser };
};

export const loginUser = (email: string, password: string): AuthResult => {
  const user = findUserByEmail(email);
  if (!user)                               return { ok: false, error: "No account found with that email" };
  if (user.passwordHash !== hash(password)) return { ok: false, error: "Incorrect password" };
  persistSession(user);
  logUserLogin(user.id, user.fullName, user.role);
  return { ok: true, user };
};

// ── Admin-only: create another admin account (called from inside AdminPanel) ──
export const createAdminUser = (
  fullName: string, email: string, password: string,
): AuthResult => {
  const clean = email.trim().toLowerCase();
  if (!fullName.trim())        return { ok: false, error: "Full name is required" };
  if (!clean)                  return { ok: false, error: "Email is required" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean))
                               return { ok: false, error: "Invalid email address" };
  if (password.length < 6)     return { ok: false, error: "Password must be at least 6 characters" };
  if (findUserByEmail(clean))  return { ok: false, error: "An account with this email already exists" };

  const newAdmin: User = {
    id:           `admin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role:         "admin",
    fullName:     fullName.trim(),
    email:        clean,
    passwordHash: hash(password),
    createdAt:    new Date().toISOString(),
  };

  persistUsers([...getAllUsers(), newAdmin]);
  logUserRegistered(newAdmin.id, newAdmin.fullName, "admin");
  return { ok: true, user: newAdmin };
};

export const logoutUser = (): void => persistSession(null);

// ── Theme persistence ─────────────────────────────────────────────────────────
export type ThemeMode = "light" | "dark";

export const getStoredTheme = (): ThemeMode => {
  const v = localStorage.getItem(THEME_KEY);
  return v === "dark" ? "dark" : "light";
};

export const storeTheme = (mode: ThemeMode): void =>
  localStorage.setItem(THEME_KEY, mode);
