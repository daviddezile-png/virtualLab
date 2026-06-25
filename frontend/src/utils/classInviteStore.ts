import { apiGet, apiPost, apiPatch, apiDelete } from "./apiClient";

// A "class invite" is a named class plus the code students redeem to join it.
export interface ClassInvite {
  _id?:        string;
  token:       string;
  teacherId:   string;
  teacherName: string;
  name:        string;
  year?:       string;
  archived?:   boolean;
  useCount:    number;
  createdAt?:  string;
}

export interface InviteRedeemResult {
  success?:         boolean;
  alreadyAssigned?: boolean;
  teacherName:      string;
  teacherId:        string;
  className?:       string;
  classId?:         string;
  message:          string;
}

export interface MyClass {
  assignedTeacherId:   string | null;
  assignedTeacherName: string | null;
  assignedClassId:     string | null;
  assignedClassName:   string | null;
}

export const getClassInvites = async (includeArchived = false): Promise<ClassInvite[]> => {
  try {
    const q = includeArchived ? "?includeArchived=1" : "";
    const res = await apiGet<{ invites: ClassInvite[] }>(`/api/class-invites${q}`);
    return res.invites;
  } catch { return []; }
};

// Create a new class. The server generates and returns its enrollment code.
export const createClass = async (name: string, year = ""): Promise<ClassInvite> => {
  const res = await apiPost<{ invite: ClassInvite }>("/api/class-invites", { name, year });
  return res.invite;
};

// Rename a class, change its year, or archive/unarchive it.
export const updateClass = async (
  id: string,
  patch: { name?: string; year?: string; archived?: boolean },
): Promise<ClassInvite> => {
  const res = await apiPatch<{ invite: ClassInvite }>(`/api/class-invites/${id}`, patch);
  return res.invite;
};

export const redeemClassInvite = async (token: string): Promise<InviteRedeemResult> => {
  return apiPost<InviteRedeemResult>("/api/class-invites/redeem", { token });
};

export const getMyClass = async (): Promise<MyClass> => {
  try {
    return await apiGet("/api/class-invites/my-class");
  } catch {
    return { assignedTeacherId: null, assignedTeacherName: null, assignedClassId: null, assignedClassName: null };
  }
};

export const deleteClassInvite = async (id: string): Promise<void> => {
  await apiDelete(`/api/class-invites/${id}`);
};

export const isInviteCode = (code: string): boolean =>
  code.toUpperCase().startsWith("CLS-");
