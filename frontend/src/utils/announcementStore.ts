// ─────────────────────────────────────────────────────────────────────────────
// Announcement store — backed by MongoDB via REST API
// ─────────────────────────────────────────────────────────────────────────────
import { apiGet, apiPost, apiDelete } from "./apiClient";

export interface Announcement {
  id?:      string;   // MongoDB _id
  title:    string;
  body:     string;
  target:   string;
  sentAt?:  string;
  read?:    number;
  total?:   number;
}

export const getAllAnnouncements = async (): Promise<Announcement[]> => {
  try {
    const res = await apiGet<{ announcements: Announcement[] }>("/api/announcements");
    return res.announcements;
  } catch { return []; }
};

export const saveAnnouncement = async (a: Announcement): Promise<void> => {
  await apiPost("/api/announcements", a);
};

export const deleteAnnouncement = async (id: string): Promise<void> => {
  await apiDelete(`/api/announcements/${id}`);
};
