// ─────────────────────────────────────────────────────────────────────────────
// Settings store — global platform configuration, backed by MongoDB.
// Public settings (registration/maintenance) are readable without auth so the
// login screen can react to them. Full settings require an admin token.
// ─────────────────────────────────────────────────────────────────────────────
import { apiGet, apiPatch } from "./apiClient";

export interface PublicSettings {
  maintenanceMode:  boolean;
  openRegistration: boolean;
  maxStudents:      number;
  updatedAt?:       string;
}

export interface AdminSettings extends PublicSettings {
  adminInviteCode: string;
  updatedBy?:      string | null;
}

const PUBLIC_DEFAULTS: PublicSettings = {
  maintenanceMode:  false,
  openRegistration: true,
  maxStudents:      500,
};

// Read-only settings for unauthenticated screens (login / register).
export const getPublicSettings = async (): Promise<PublicSettings> => {
  try {
    const res = await apiGet<{ settings: PublicSettings }>("/api/settings/public");
    return res.settings;
  } catch { return PUBLIC_DEFAULTS; }
};

// Full settings — admin only.
export const getSettings = async (): Promise<AdminSettings | null> => {
  try {
    const res = await apiGet<{ settings: AdminSettings }>("/api/settings");
    return res.settings;
  } catch { return null; }
};

// Persist a partial update — admin only. Returns the saved settings.
export const updateSettings = async (
  patch: Partial<Pick<AdminSettings,
    "maintenanceMode" | "openRegistration" | "maxStudents" | "adminInviteCode">>
): Promise<AdminSettings> => {
  const res = await apiPatch<{ settings: AdminSettings }>("/api/settings", patch);
  return res.settings;
};
