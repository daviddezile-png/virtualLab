import { apiGet, apiPost, apiDelete } from "./apiClient";

export interface ClassInvite {
  _id?:        string;
  token:       string;
  teacherId:   string;
  teacherName: string;
  useCount:    number;
  createdAt?:  string;
}

export interface InviteRedeemResult {
  success?:        boolean;
  alreadyAssigned?: boolean;
  teacherName:     string;
  teacherId:       string;
  message:         string;
}

export const getClassInvites = async (): Promise<ClassInvite[]> => {
  try {
    const res = await apiGet<{ invites: ClassInvite[] }>("/api/class-invites");
    return res.invites;
  } catch { return []; }
};

export const generateClassInvite = async (): Promise<ClassInvite> => {
  const res = await apiPost<{ invite: ClassInvite }>("/api/class-invites", {});
  return res.invite;
};

export const redeemClassInvite = async (token: string): Promise<InviteRedeemResult> => {
  return apiPost<InviteRedeemResult>("/api/class-invites/redeem", { token });
};

export const getMyTeacher = async (): Promise<{ assignedTeacherId: string | null; assignedTeacherName: string | null }> => {
  try {
    return await apiGet("/api/class-invites/my-teacher");
  } catch { return { assignedTeacherId: null, assignedTeacherName: null }; }
};

export const deleteClassInvite = async (id: string): Promise<void> => {
  await apiDelete(`/api/class-invites/${id}`);
};

export const isInviteCode = (code: string): boolean =>
  code.toUpperCase().startsWith("CLS-");
