// ─────────────────────────────────────────────────────────────────────────────
// Announcement store — persisted to localStorage
// ─────────────────────────────────────────────────────────────────────────────

export interface Announcement {
  id:      string;
  title:   string;
  body:    string;
  target:  string;
  sentAt:  string;
  read:    number;
  total:   number;
}

const KEY = "vlab_announcements";

export const getAllAnnouncements = (): Announcement[] => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); }
  catch { return []; }
};

export const saveAnnouncement = (a: Announcement): void => {
  const all = getAllAnnouncements().filter(x => x.id !== a.id);
  localStorage.setItem(KEY, JSON.stringify([a, ...all])); // newest first
};

export const deleteAnnouncement = (id: string): void =>
  localStorage.setItem(KEY, JSON.stringify(getAllAnnouncements().filter(a => a.id !== id)));
