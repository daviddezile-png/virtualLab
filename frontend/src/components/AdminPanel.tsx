import React, { useState, useEffect, useContext, createContext } from "react";
import {
  LayoutDashboard, Users, BookOpen, ClipboardList, ClipboardCheck,
  Megaphone, BarChart2, Settings, LogOut, Sun, Moon, Menu, Search,
  Trash2, Shield, Activity, TrendingUp, CheckCircle, AlertCircle,
  GraduationCap, User as UserIcon, FlaskConical, Key, Bell, Eye,
  RefreshCw, Download, Lock, Unlock, Clock, Award, Database,
  FileText, AlertTriangle, ChevronRight, LucideIcon,
} from "lucide-react";
import {
  getAllUsers, User, logoutUser, createAdminUser, registerUser,
  getPendingTeachers, approveTeacher, rejectTeacher,
  ThemeMode, getStoredTheme, storeTheme,
} from "../utils/userStore";
import { getAllSubmissions, getStats } from "../utils/submissionStore";
import { getAllAssignments, isCodeExpired, deleteAssignment } from "../utils/assignmentStore";
import { getAllQuestions, getAllAnswers, deleteQuestion } from "../utils/qaStore";
import { getAllAnnouncements, deleteAnnouncement } from "../utils/announcementStore";
import { getAuditLog, clearAuditLog } from "../utils/auditStore";

// ─────────────────────────────────────────────────────────────────────────────
// Theme tokens — pure black/white + green
// ─────────────────────────────────────────────────────────────────────────────
const DARK = {
  bg:"#0a0a0a", sidebar:"#111111", surface:"#161616", card:"#1a1a1a",
  border:"#2a2a2a", border2:"#3a3a3a",
  txtPri:"#f5f5f5", txtSec:"#a3a3a3", txtMut:"#666666",
  accent:"#22c55e", accentHi:"#16a34a", accentBg:"rgba(34,197,94,0.10)",
  red:"#ef4444", amber:"#f59e0b", blue:"#3b82f6",
  shadow:"rgba(0,0,0,0.6)", headerBg:"rgba(10,10,10,0.95)",
} as const;

const LIGHT = {
  bg:"#f8fafc", sidebar:"#ffffff", surface:"#f1f5f9", card:"#ffffff",
  border:"#e2e8f0", border2:"#cbd5e1",
  txtPri:"#0f172a", txtSec:"#475569", txtMut:"#94a3b8",
  accent:"#16a34a", accentHi:"#15803d", accentBg:"rgba(22,163,74,0.08)",
  red:"#dc2626", amber:"#d97706", blue:"#2563eb",
  shadow:"rgba(0,0,0,0.08)", headerBg:"rgba(255,255,255,0.97)",
} as const;

type C = typeof DARK;
const ThemeCtx = createContext<{ C:C; isDark:boolean; toggle:()=>void }>({ C:DARK, isDark:true, toggle:()=>{} });
const useTheme = () => useContext(ThemeCtx);

// ─────────────────────────────────────────────────────────────────────────────
// Section type
// ─────────────────────────────────────────────────────────────────────────────
type Section = "dashboard"|"users"|"approvals"|"assignments"|"submissions"|"questions"
             |"announcements"|"analytics"|"settings"|"auditlog";

// ─────────────────────────────────────────────────────────────────────────────
// Shared micro-components
// ─────────────────────────────────────────────────────────────────────────────
const StatCard: React.FC<{ label:string; value:string|number; sub?:string; Icon:LucideIcon; color:string }> =
({ label, value, sub, Icon, color }) => {
  const { C } = useTheme();
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
      padding:"18px 20px", display:"flex", gap:14, alignItems:"flex-start",
      boxShadow:`0 1px 4px ${C.shadow}` }}>
      <div style={{ width:44, height:44, borderRadius:12, background:`${color}18`,
        display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <Icon size={22} color={color} strokeWidth={1.8} />
      </div>
      <div>
        <div style={{ color:C.txtMut, fontSize:11, fontWeight:600, textTransform:"uppercase",
          letterSpacing:0.8, marginBottom:4 }}>{label}</div>
        <div style={{ color:C.txtPri, fontSize:26, fontWeight:800, lineHeight:1 }}>{value}</div>
        {sub && <div style={{ color:C.txtSec, fontSize:12, marginTop:4 }}>{sub}</div>}
      </div>
    </div>
  );
};

const SectionHeading: React.FC<{ title:string; sub?:string; action?:React.ReactNode }> =
({ title, sub, action }) => {
  const { C } = useTheme();
  return (
    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between",
      marginBottom:24, flexWrap:"wrap", gap:12 }}>
      <div>
        <h2 style={{ color:C.txtPri, fontSize:20, fontWeight:800, margin:0 }}>{title}</h2>
        {sub && <p style={{ color:C.txtSec, fontSize:13, margin:"4px 0 0" }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
};

const Btn: React.FC<{ label:string; onClick?:()=>void; variant?:"primary"|"ghost"|"danger"; Icon?:LucideIcon; small?:boolean }> =
({ label, onClick, variant="primary", Icon:Ic, small }) => {
  const { C } = useTheme();
  const styles: Record<string,React.CSSProperties> = {
    primary: { background:C.accent, color:"white", border:"none" },
    ghost:   { background:"transparent", color:C.txtSec, border:`1px solid ${C.border2}` },
    danger:  { background:`${C.red}12`, color:C.red, border:`1px solid ${C.red}44` },
  };
  return (
    <button onClick={onClick} style={{
      ...styles[variant], borderRadius:8, fontWeight:600, cursor:"pointer",
      padding: small?"6px 12px":"9px 18px", fontSize: small?12:13,
      display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap",
    }}>
      {Ic && <Ic size={small?13:15} strokeWidth={2} />} {label}
    </button>
  );
};

const TableHead: React.FC<{ cols:string[] }> = ({ cols }) => {
  const { C } = useTheme();
  return (
    <thead>
      <tr>
        {cols.map(c => (
          <th key={c} style={{ color:C.txtMut, fontSize:11, fontWeight:700, textAlign:"left",
            padding:"10px 14px", textTransform:"uppercase", letterSpacing:0.8,
            borderBottom:`1px solid ${C.border}`, background:C.surface, whiteSpace:"nowrap" }}>
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
};

const Avatar: React.FC<{ name:string; size?:number }> = ({ name, size=32 }) => (
  <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0,
    background:`hsl(${name.charCodeAt(0)*7%360},50%,40%)`,
    display:"flex", alignItems:"center", justifyContent:"center",
    color:"white", fontWeight:700, fontSize:size*0.4 }}>
    {name[0]?.toUpperCase()}
  </div>
);

const RoleBadge: React.FC<{ role:string }> = ({ role }) => {
  const { C } = useTheme();
  const cfg: Record<string,[string,string]> = {
    admin:   ["#7c3aed","rgba(124,58,237,0.12)"],
    teacher: [C.accent, C.accentBg],
    student: [C.blue,   "rgba(59,130,246,0.10)"],
  };
  const [color,bg] = cfg[role] ?? [C.txtMut,C.surface];
  return (
    <span style={{ background:bg, color, borderRadius:20, padding:"2px 10px",
      fontSize:11, fontWeight:700, textTransform:"capitalize", letterSpacing:0.3 }}>
      {role}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const { C } = useTheme();
  const users   = getAllUsers();
  const subs    = getAllSubmissions();
  const assigns = getAllAssignments();
  const stats   = getStats();

  const admins   = users.filter(u => u.role === "admin").length;
  const teachers = users.filter(u => u.role === "teacher").length;
  const students = users.filter(u => u.role === "student").length;
  const recentSubs = subs.sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).slice(0,6);

  return (
    <div>
      <SectionHeading title="Admin Dashboard" sub="Full platform overview — all users, all sessions." />

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:14, marginBottom:28 }}>
        <StatCard label="Total Users"     value={users.length}   sub={`${admins} admin · ${teachers} teachers · ${students} students`} Icon={Users}         color={C.accent} />
        <StatCard label="Total Submissions" value={stats.total}  sub={`${stats.todayCount} today`}             Icon={ClipboardCheck} color={C.blue}   />
        <StatCard label="Class Average"   value={stats.total > 0 ? `${stats.classAvg}%` : "—"} sub="Across all sessions" Icon={TrendingUp}  color={C.amber}  />
        <StatCard label="Assignments"     value={assigns.length} sub={`${assigns.filter(isCodeExpired).length} expired`} Icon={Key} color="#7c3aed" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:20 }}>
        {/* Recent submissions */}
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
          overflow:"hidden", boxShadow:`0 1px 4px ${C.shadow}` }}>
          <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.border}`,
            display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ color:C.txtPri, fontWeight:700, fontSize:14 }}>Recent Submissions</span>
            <span style={{ color:C.txtMut, fontSize:12 }}>{subs.length} total</span>
          </div>
          {recentSubs.length === 0 ? (
            <div style={{ padding:"32px 20px", textAlign:"center", color:C.txtMut, fontSize:13 }}>
              No submissions yet.
            </div>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <TableHead cols={["Student","Practical","Score","Result"]} />
              <tbody>
                {recentSubs.map((s,i) => (
                  <tr key={s.id} style={{ background:i%2===0?"transparent":`${C.surface}88` }}>
                    <td style={{ padding:"10px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <Avatar name={s.studentName} size={26} />
                        <div>
                          <div style={{ color:C.txtPri, fontSize:13 }}>{s.studentName}</div>
                          {s.studentReg && <div style={{ color:C.txtMut, fontSize:10 }}>{s.studentReg}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:"10px 14px", color:C.txtSec, fontSize:12 }}>
                      {s.practicalId === "vanishing-cream" ? "Vanishing Cream" : "Cold Cream"}
                    </td>
                    <td style={{ padding:"10px 14px", color:C.txtPri, fontSize:13, fontWeight:700 }}>
                      {s.scorePct}%
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <span style={{
                        background: s.result==="PASS" ? `${C.accent}18` : s.result==="AVERAGE" ? `${C.amber}18` : `${C.red}18`,
                        color: s.result==="PASS" ? C.accent : s.result==="AVERAGE" ? C.amber : C.red,
                        borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700,
                      }}>{s.result}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* User breakdown */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
            padding:18, boxShadow:`0 1px 4px ${C.shadow}` }}>
            <div style={{ color:C.txtPri, fontWeight:700, fontSize:14, marginBottom:16 }}>User Breakdown</div>
            {[
              { label:"Admins",   count:admins,   color:"#7c3aed", Icon:Shield },
              { label:"Teachers", count:teachers, color:C.accent,  Icon:GraduationCap },
              { label:"Students", count:students, color:C.blue,    Icon:UserIcon },
            ].map(({ label, count, color, Icon:Ic }) => (
              <div key={label} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                <div style={{ width:34, height:34, borderRadius:9, background:`${color}18`,
                  display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <Ic size={17} color={color} strokeWidth={2} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                    <span style={{ color:C.txtSec, fontSize:13 }}>{label}</span>
                    <span style={{ color:C.txtPri, fontWeight:700, fontSize:13 }}>{count}</span>
                  </div>
                  <div style={{ height:5, background:C.surface, borderRadius:3, overflow:"hidden" }}>
                    <div style={{ width:`${users.length > 0 ? (count/users.length)*100 : 0}%`,
                      height:"100%", background:color, borderRadius:3 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
            padding:18, boxShadow:`0 1px 4px ${C.shadow}` }}>
            <div style={{ color:C.txtPri, fontWeight:700, fontSize:14, marginBottom:14 }}>Result Breakdown</div>
            {[
              { label:"Pass",    count:stats.passed,  color:C.accent },
              { label:"Average", count:stats.average, color:C.amber  },
              { label:"Fail",    count:stats.failed,  color:C.red    },
            ].map(r => (
              <div key={r.label} style={{ display:"flex", justifyContent:"space-between",
                alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                <span style={{ color:C.txtSec, fontSize:13 }}>{r.label}</span>
                <span style={{ color:r.color, fontWeight:700, fontSize:14 }}>{r.count}</span>
              </div>
            ))}
            <div style={{ borderBottom:"none", display:"flex", justifyContent:"space-between",
              alignItems:"center", padding:"8px 0 0" }}>
              <span style={{ color:C.txtMut, fontSize:12 }}>Total</span>
              <span style={{ color:C.txtPri, fontWeight:800, fontSize:14 }}>{stats.total}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────────────────────
const UserManager: React.FC = () => {
  const { C } = useTheme();
  const [search,    setSearch]    = useState("");
  const [roleFilter,setRoleFilter]= useState<"all"|"admin"|"teacher"|"student">("all");
  const [refresh,   setRefresh]   = useState(0);
  const [showAddUser,  setShowAddUser]  = useState(false);
  const [newRole,      setNewRole]      = useState<"admin"|"teacher"|"student">("student");
  const [newName,      setNewName]      = useState("");
  const [newEmail,     setNewEmail]     = useState("");
  const [newPass,      setNewPass]      = useState("");
  const [newReg,       setNewReg]       = useState("");
  const [addError,     setAddError]     = useState<string|null>(null);
  const [addOk,        setAddOk]        = useState(false);
  const [suspended, setSuspended] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("vlab_suspended") ?? "[]")); }
    catch { return new Set(); }
  });

  const allUsers = getAllUsers();
  const filtered = allUsers.filter(u =>
    (roleFilter === "all" || u.role === roleFilter) &&
    (u.fullName.toLowerCase().includes(search.toLowerCase()) ||
     u.email.toLowerCase().includes(search.toLowerCase()) ||
     (u.regNumber ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  const toggleSuspend = (id: string) => {
    const next = new Set(suspended);
    next.has(id) ? next.delete(id) : next.add(id);
    setSuspended(next);
    localStorage.setItem("vlab_suspended", JSON.stringify([...next]));
  };

  const deleteUser = (id: string) => {
    const u = getAllUsers().find(x => x.id === id);
    if (u?.seeded) return;
    localStorage.setItem("vlab_users", JSON.stringify(getAllUsers().filter(x => x.id !== id)));
    setRefresh(r => r+1);
  };

  const resetForm = () => {
    setNewName(""); setNewEmail(""); setNewPass(""); setNewReg("");
    setAddError(null);
  };

  const handleAddUser = () => {
    setAddError(null);
    let result;
    if (newRole === "admin") {
      result = createAdminUser(newName, newEmail, newPass);
    } else {
      result = registerUser({ role: newRole, fullName: newName, email: newEmail,
        password: newPass, regNumber: newRole === "student" ? newReg : undefined,
        forceActive: true });   // admin-created accounts are active immediately
    }
    if (!result.ok) { setAddError(result.error ?? "Failed"); return; }
    resetForm();
    setAddOk(true);
    setRefresh(r => r+1);
    setTimeout(() => { setAddOk(false); setShowAddUser(false); }, 2000);
  };

  const roleAccent: Record<string,string> = {
    admin:"#7c3aed", teacher:"#2563eb", student:C.accent,
  };

  const lbl: React.CSSProperties = {
    color:C.txtMut, fontSize:11, fontWeight:700, display:"block",
    marginBottom:5, textTransform:"uppercase", letterSpacing:0.7,
  };

  const inp: React.CSSProperties = {
    width:"100%", background:C.surface, border:`1px solid ${C.border2}`,
    color:C.txtPri, borderRadius:8, padding:"9px 12px", fontSize:13,
    boxSizing:"border-box", outline:"none",
  };

  return (
    <div>
      <SectionHeading title="User Management" sub={`${allUsers.length} registered users across all roles.`}
        action={
          <div style={{ display:"flex", gap:8 }}>
            <Btn label="Add User" Icon={UserIcon} small onClick={() => { resetForm(); setShowAddUser(v=>!v); }} />
            <Btn label="Refresh"   Icon={RefreshCw} variant="ghost" small onClick={() => setRefresh(r=>r+1)} />
            <Btn label="Export CSV" Icon={Download} variant="ghost" small />
          </div>
        } />

      {/* ── Add User inline form ── */}
      {showAddUser && (
        <div style={{ background:C.card, border:`1px solid ${roleAccent[newRole]}55`,
          borderRadius:12, padding:"18px 20px", marginBottom:20,
          boxShadow:`0 2px 10px ${C.shadow}` }}>
          <div style={{ color:C.txtPri, fontWeight:800, fontSize:14, marginBottom:14,
            display:"flex", alignItems:"center", gap:8 }}>
            <UserIcon size={15} color={roleAccent[newRole]} strokeWidth={2} />
            Create New Account
          </div>

          {/* Role selector */}
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            {(["student","teacher","admin"] as const).map(r => (
              <button key={r} onClick={() => { setNewRole(r); setAddError(null); }}
                style={{ padding:"7px 18px", borderRadius:8, cursor:"pointer", fontWeight:700,
                  fontSize:12, border:`1.5px solid ${newRole===r ? roleAccent[r] : C.border}`,
                  background: newRole===r ? `${roleAccent[r]}18` : "transparent",
                  color: newRole===r ? roleAccent[r] : C.txtMut,
                  textTransform:"capitalize" }}>
                {r === "admin" ? "🛡 Admin" : r === "teacher" ? "🎓 Teacher" : "👤 Student"}
              </button>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12, marginBottom:12 }}>
            <div>
              <label style={lbl}>Full Name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Jane Doe" style={inp} />
            </div>
            <div>
              <label style={lbl}>Email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder="user@school.edu" style={inp} />
            </div>
            {newRole === "student" && (
              <div>
                <label style={lbl}>Reg Number</label>
                <input value={newReg} onChange={e => setNewReg(e.target.value)}
                  placeholder="T24-001" style={inp} />
              </div>
            )}
            <div>
              <label style={lbl}>Password (min 6 chars)</label>
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
                placeholder="••••••••" style={inp} />
            </div>
          </div>

          {addError && (
            <div style={{ color:C.red, fontSize:12, marginBottom:10,
              display:"flex", alignItems:"center", gap:6 }}>
              <AlertCircle size={13} /> {addError}
            </div>
          )}
          {addOk && (
            <div style={{ color:C.accent, fontSize:12, marginBottom:10,
              display:"flex", alignItems:"center", gap:6 }}>
              <CheckCircle size={13} strokeWidth={2.5} /> Account created successfully!
            </div>
          )}
          <div style={{ display:"flex", gap:8 }}>
            <Btn label={`Create ${newRole.charAt(0).toUpperCase()+newRole.slice(1)}`}
              Icon={newRole==="admin"?Shield:UserIcon} small onClick={handleAddUser} />
            <Btn label="Cancel" variant="ghost" small Icon={RefreshCw}
              onClick={() => { setShowAddUser(false); resetForm(); }} />
          </div>
          <div style={{ color:C.txtMut, fontSize:11, marginTop:10 }}>
            The new user will log in with the email and password you set here.
          </div>
        </div>
      )}

      <div style={{ display:"flex", gap:10, marginBottom:18, flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:220, position:"relative" }}>
          <span style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)",
            pointerEvents:"none", display:"flex" }}>
            <Search size={15} color={C.txtMut} />
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, reg…"
            style={{ width:"100%", background:C.card, border:`1px solid ${C.border}`,
              color:C.txtPri, borderRadius:8, padding:"9px 12px 9px 34px",
              fontSize:13, boxSizing:"border-box", outline:"none" }} />
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {(["all","admin","teacher","student"] as const).map(r => (
            <button key={r} onClick={() => setRoleFilter(r)} style={{
              padding:"8px 14px", borderRadius:8, cursor:"pointer", fontWeight:600,
              fontSize:12, border:"none", textTransform:"capitalize",
              background: roleFilter===r ? C.accent : C.card,
              color: roleFilter===r ? "white" : C.txtSec,
            }}>{r === "all" ? "All Roles" : r}</button>
          ))}
        </div>
      </div>

      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
        overflow:"hidden", boxShadow:`0 1px 4px ${C.shadow}` }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <TableHead cols={["User","Email","Role","Reg No.","Joined","Status",""]} />
          <tbody>
            {filtered.map((u,i) => (
              <tr key={u.id} style={{ background:i%2===0?"transparent":`${C.surface}88`,
                borderBottom:`1px solid ${C.border}`,
                opacity: suspended.has(u.id) ? 0.5 : 1 }}>
                <td style={{ padding:"11px 14px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <Avatar name={u.fullName} />
                    <div>
                      <span style={{ color:C.txtPri, fontSize:13, fontWeight:600 }}>{u.fullName}</span>
                      {u.seeded && (
                        <span style={{ marginLeft:6, background:"rgba(124,58,237,0.12)",
                          color:"#7c3aed", borderRadius:20, padding:"1px 7px",
                          fontSize:10, fontWeight:700 }}>Seeded</span>
                      )}
                    </div>
                  </div>
                </td>
                <td style={{ padding:"11px 14px", color:C.txtSec, fontSize:12 }}>{u.email}</td>
                <td style={{ padding:"11px 14px" }}><RoleBadge role={u.role} /></td>
                <td style={{ padding:"11px 14px" }}>
                  {u.regNumber
                    ? <code style={{ background:C.accentBg, color:C.accent, borderRadius:5,
                        padding:"2px 8px", fontSize:12 }}>{u.regNumber}</code>
                    : <span style={{ color:C.txtMut }}>—</span>}
                </td>
                <td style={{ padding:"11px 14px", color:C.txtMut, fontSize:12 }}>
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding:"11px 14px" }}>
                  <span style={{
                    background: suspended.has(u.id) ? `${C.red}12` : `${C.accent}12`,
                    color: suspended.has(u.id) ? C.red : C.accent,
                    border: `1px solid ${suspended.has(u.id) ? `${C.red}44` : `${C.accent}44`}`,
                    borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700,
                  }}>{suspended.has(u.id) ? "Suspended" : "Active"}</span>
                </td>
                <td style={{ padding:"11px 14px" }}>
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={() => toggleSuspend(u.id)} title={suspended.has(u.id)?"Unsuspend":"Suspend"}
                      style={{ background:"transparent", border:`1px solid ${C.border}`,
                        color: suspended.has(u.id) ? C.accent : C.amber,
                        borderRadius:6, padding:"5px 8px", cursor:"pointer",
                        display:"flex", alignItems:"center" }}>
                      {suspended.has(u.id) ? <Unlock size={13}/> : <Lock size={13}/>}
                    </button>
                    {u.seeded ? (
                      <span title="Seeded admin — cannot be deleted"
                        style={{ background:C.surface, border:`1px solid ${C.border}`,
                          color:C.txtMut, borderRadius:6, padding:"5px 8px",
                          display:"flex", alignItems:"center", opacity:0.5 }}>
                        <Shield size={13} strokeWidth={2} />
                      </span>
                    ) : (
                      <button onClick={() => deleteUser(u.id)} title="Delete user"
                        style={{ background:`${C.red}10`, border:"none", color:C.red,
                          borderRadius:6, padding:"5px 8px", cursor:"pointer",
                          display:"flex", alignItems:"center" }}>
                        <Trash2 size={13} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding:36, textAlign:"center", color:C.txtMut }}>No users found.</div>
        )}
      </div>
      <div style={{ color:C.txtMut, fontSize:12, marginTop:10 }}>
        {filtered.length} of {allUsers.length} users
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Assignments
// ─────────────────────────────────────────────────────────────────────────────
const AdminAssignments: React.FC = () => {
  const { C } = useTheme();
  const [search, setSearch] = useState("");
  const [refresh, setRefresh] = useState(0);

  const all = getAllAssignments()
    .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filtered = all.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.token.toLowerCase().includes(search.toLowerCase()) ||
    a.practicalId.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (token: string) => { deleteAssignment(token); setRefresh(r=>r+1); };

  return (
    <div>
      <SectionHeading title="All Assignments" sub={`${all.length} total assignments across all teachers.`}
        action={<Btn label="Refresh" Icon={RefreshCw} variant="ghost" small onClick={() => setRefresh(r=>r+1)} />} />

      <div style={{ position:"relative", marginBottom:18 }}>
        <span style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)",
          pointerEvents:"none", display:"flex" }}>
          <Search size={15} color={C.txtMut} />
        </span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title, code, or practical…"
          style={{ width:"100%", background:C.card, border:`1px solid ${C.border}`,
            color:C.txtPri, borderRadius:8, padding:"9px 12px 9px 34px",
            fontSize:13, boxSizing:"border-box", outline:"none" }} />
      </div>

      {all.length === 0 ? (
        <div style={{ background:C.card, border:`2px dashed ${C.border2}`, borderRadius:14,
          padding:"40px 20px", textAlign:"center", color:C.txtMut }}>
          <Key size={30} style={{ marginBottom:10, opacity:0.3 }} />
          <div>No assignments created yet.</div>
        </div>
      ) : (
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
          overflow:"hidden", boxShadow:`0 1px 4px ${C.shadow}` }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <TableHead cols={["Code","Practical","Target","Time Limit","Expires","Uses","Status",""]} />
            <tbody>
              {filtered.map((a,i) => {
                const expired = isCodeExpired(a);
                return (
                  <tr key={a.token} style={{ background:i%2===0?"transparent":`${C.surface}88`,
                    borderBottom:`1px solid ${C.border}` }}>
                    <td style={{ padding:"11px 14px" }}>
                      <code style={{ color:C.accent, fontWeight:700, fontSize:14, letterSpacing:1 }}>
                        {a.token}
                      </code>
                      <div style={{ color:C.txtMut, fontSize:11, marginTop:2 }}
                        title={a.title}>{a.title.slice(0,40)}{a.title.length>40?"…":""}</div>
                    </td>
                    <td style={{ padding:"11px 14px", color:C.txtSec, fontSize:12 }}>
                      {a.practicalId === "vanishing-cream" ? "Vanishing Cream" : "Cold Cream"}
                    </td>
                    <td style={{ padding:"11px 14px", color:C.txtPri, fontSize:13, fontWeight:700 }}>
                      {a.targetGrams} g
                    </td>
                    <td style={{ padding:"11px 14px", color:C.txtMut, fontSize:12 }}>
                      {a.timeLimitMinutes > 0 ? `${a.timeLimitMinutes} min` : "—"}
                    </td>
                    <td style={{ padding:"11px 14px", color:C.txtMut, fontSize:12 }}>
                      {a.codeExpiresAt
                        ? <span style={{ color: expired ? C.red : C.txtSec }}>
                            {new Date(a.codeExpiresAt).toLocaleDateString()}
                          </span>
                        : <span style={{ color:C.txtMut }}>Never</span>}
                    </td>
                    <td style={{ padding:"11px 14px", color:C.txtPri, fontSize:13 }}>{a.uses}</td>
                    <td style={{ padding:"11px 14px" }}>
                      <span style={{
                        background: expired ? `${C.red}12` : `${C.accent}12`,
                        color: expired ? C.red : C.accent,
                        border: `1px solid ${expired ? `${C.red}44` : `${C.accent}44`}`,
                        borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700,
                      }}>{expired ? "Expired" : "Active"}</span>
                    </td>
                    <td style={{ padding:"11px 14px" }}>
                      <button onClick={() => handleDelete(a.token)} title="Delete assignment"
                        style={{ background:`${C.red}10`, border:"none", color:C.red,
                          borderRadius:6, padding:"5px 8px", cursor:"pointer",
                          display:"flex", alignItems:"center" }}>
                        <Trash2 size={13} strokeWidth={2} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding:32, textAlign:"center", color:C.txtMut }}>No assignments match.</div>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Submissions
// ─────────────────────────────────────────────────────────────────────────────
const AdminSubmissions: React.FC = () => {
  const { C } = useTheme();
  const [search, setSearch] = useState("");
  const [result, setResult] = useState("all");
  const [prac,   setPrac]   = useState("all");

  const all = getAllSubmissions()
    .sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  const filtered = all.filter(s =>
    (result === "all" || s.result === result) &&
    (prac   === "all" || s.practicalId === prac) &&
    (s.studentName.toLowerCase().includes(search.toLowerCase()) ||
     (s.studentReg ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <SectionHeading title="All Submissions" sub={`${all.length} total lab evaluations platform-wide.`}
        action={<Btn label="Export CSV" Icon={Download} variant="ghost" small />} />

      <div style={{ display:"flex", gap:10, marginBottom:18, flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:200, position:"relative" }}>
          <span style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)",
            pointerEvents:"none", display:"flex" }}>
            <Search size={15} color={C.txtMut} />
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student…"
            style={{ width:"100%", background:C.card, border:`1px solid ${C.border}`,
              color:C.txtPri, borderRadius:8, padding:"8px 12px 8px 32px",
              fontSize:13, boxSizing:"border-box", outline:"none" }} />
        </div>
        <select value={prac} onChange={e => setPrac(e.target.value)}
          style={{ background:C.card, border:`1px solid ${C.border}`, color:C.txtSec,
            borderRadius:8, padding:"8px 12px", fontSize:13, cursor:"pointer", outline:"none" }}>
          <option value="all">All Practicals</option>
          <option value="vanishing-cream">Vanishing Cream</option>
          <option value="cold-cream">Cold Cream</option>
        </select>
        {["all","PASS","AVERAGE","FAIL"].map(r => (
          <button key={r} onClick={() => setResult(r)} style={{
            padding:"7px 12px", borderRadius:8, cursor:"pointer", fontWeight:600,
            fontSize:12, border:"none",
            background: result===r ? C.accent : C.card,
            color: result===r ? "white" : C.txtSec,
          }}>{r === "all" ? "All" : r}</button>
        ))}
      </div>

      {all.length === 0 ? (
        <div style={{ background:C.card, border:`2px dashed ${C.border2}`, borderRadius:14,
          padding:"40px 20px", textAlign:"center", color:C.txtMut }}>
          <ClipboardCheck size={30} style={{ marginBottom:10, opacity:0.3 }} />
          <div>No submissions yet.</div>
        </div>
      ) : (
        <>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
            overflow:"hidden", boxShadow:`0 1px 4px ${C.shadow}` }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <TableHead cols={["Student","Practical","Mode","Score","Result","pH","Viscosity","Duration","Date"]} />
              <tbody>
                {filtered.map((s,i) => (
                  <tr key={s.id} style={{ background:i%2===0?"transparent":`${C.surface}88`,
                    borderBottom:`1px solid ${C.border}` }}>
                    <td style={{ padding:"10px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <Avatar name={s.studentName} size={26} />
                        <div>
                          <div style={{ color:C.txtPri, fontSize:13 }}>{s.studentName}</div>
                          {s.studentReg && <div style={{ color:C.txtMut, fontSize:10 }}>{s.studentReg}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:"10px 14px", color:C.txtSec, fontSize:12 }}>
                      {s.practicalId === "vanishing-cream" ? "Vanishing" : "Cold Cream"}
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <span style={{
                        background: s.mode==="assignment" ? `${C.blue}18` : C.surface,
                        color: s.mode==="assignment" ? C.blue : C.txtMut,
                        borderRadius:20, padding:"2px 8px", fontSize:11, fontWeight:700, textTransform:"capitalize",
                      }}>{s.mode}</span>
                    </td>
                    <td style={{ padding:"10px 14px", color:C.txtPri, fontSize:13, fontWeight:700 }}>
                      {s.scorePct}%
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <span style={{
                        background: s.result==="PASS" ? `${C.accent}18` : s.result==="AVERAGE" ? `${C.amber}18` : `${C.red}18`,
                        color: s.result==="PASS" ? C.accent : s.result==="AVERAGE" ? C.amber : C.red,
                        borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700,
                      }}>{s.result}</span>
                    </td>
                    <td style={{ padding:"10px 14px", color:C.txtSec, fontSize:12, fontFamily:"monospace" }}>
                      {s.ph.toFixed(2)}
                    </td>
                    <td style={{ padding:"10px 14px", color:C.txtSec, fontSize:12, fontFamily:"monospace" }}>
                      {s.viscosity} cP
                    </td>
                    <td style={{ padding:"10px 14px", color:C.txtMut, fontSize:12 }}>
                      {s.durationSec > 0 ? `${Math.round(s.durationSec/60)} min` : "—"}
                    </td>
                    <td style={{ padding:"10px 14px", color:C.txtMut, fontSize:11 }}>
                      {new Date(s.submittedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ padding:32, textAlign:"center", color:C.txtMut }}>No submissions match.</div>
            )}
          </div>
          <div style={{ color:C.txtMut, fontSize:12, marginTop:10 }}>
            {filtered.length} of {all.length} submissions
          </div>
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Q&A Management
// ─────────────────────────────────────────────────────────────────────────────
const AdminQA: React.FC = () => {
  const { C } = useTheme();
  const [refresh, setRefresh] = useState(0);
  const questions = getAllQuestions();
  const answers   = getAllAnswers();

  const deleteQ = (id: string) => { deleteQuestion(id); setRefresh(r=>r+1); };

  return (
    <div>
      <SectionHeading title="Q&A Management"
        sub={`${questions.length} questions · ${answers.length} student answers recorded.`}
        action={<Btn label="Refresh" Icon={RefreshCw} variant="ghost" small onClick={() => setRefresh(r=>r+1)} />} />

      {questions.length === 0 ? (
        <div style={{ background:C.card, border:`2px dashed ${C.border2}`, borderRadius:14,
          padding:"40px 20px", textAlign:"center", color:C.txtMut }}>
          <ClipboardList size={30} style={{ marginBottom:10, opacity:0.3 }} />
          <div>No Q&A questions created yet. Teachers create questions in their Assignments panel.</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {questions.map((q, i) => {
            const qAnswers  = answers.filter(a => a.questionId === q.id);
            const correct   = qAnswers.filter(a => a.isCorrect === true).length;
            const incorrect = qAnswers.filter(a => a.isCorrect === false).length;
            const pending   = qAnswers.filter(a => a.isCorrect === null).length;
            return (
              <div key={q.id} style={{ background:C.card, border:`1px solid ${C.border}`,
                borderRadius:12, padding:"16px 18px", boxShadow:`0 1px 3px ${C.shadow}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8, flexWrap:"wrap" }}>
                      <span style={{ color:C.txtMut, fontSize:12 }}>Q{i+1}</span>
                      <span style={{
                        background: q.type==="mcq" ? `${C.blue}18` : `${C.accent}18`,
                        color: q.type==="mcq" ? C.blue : C.accent,
                        borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700,
                      }}>{q.type === "mcq" ? "MCQ" : "Short Answer"}</span>
                      <span style={{ background:C.surface, border:`1px solid ${C.border}`,
                        color:C.txtMut, borderRadius:20, padding:"2px 10px", fontSize:11 }}>
                        {q.practicalId === "all" ? "All Practicals"
                          : q.practicalId === "vanishing-cream" ? "Vanishing Cream" : "Cold Cream"}
                      </span>
                      <span style={{ color:C.txtMut, fontSize:12 }}>{q.points} pts</span>
                    </div>
                    <div style={{ color:C.txtPri, fontSize:14, lineHeight:1.6 }}>{q.text}</div>
                    {q.type === "mcq" && q.options.length > 0 && (
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
                        {q.options.map((opt, oi) => (
                          <span key={oi} style={{
                            background: opt === q.correctAnswer ? `${C.accent}18` : C.surface,
                            border: `1px solid ${opt === q.correctAnswer ? `${C.accent}44` : C.border}`,
                            color: opt === q.correctAnswer ? C.accent : C.txtSec,
                            borderRadius:6, padding:"3px 10px", fontSize:12, fontWeight: opt === q.correctAnswer ? 700 : 400,
                          }}>
                            {String.fromCharCode(65+oi)}. {opt}
                            {opt === q.correctAnswer && " ✓"}
                          </span>
                        ))}
                      </div>
                    )}
                    {qAnswers.length > 0 && (
                      <div style={{ marginTop:10, display:"flex", gap:10, flexWrap:"wrap" }}>
                        {[
                          { label:`${correct} Correct`,  color:C.accent },
                          { label:`${incorrect} Wrong`,   color:C.red   },
                          { label:`${pending} Pending`,   color:C.amber },
                        ].map(({ label, color }) => (
                          <span key={label} style={{ color, fontSize:12, fontWeight:600 }}>{label}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => deleteQ(q.id)}
                    style={{ background:`${C.red}10`, border:"none", color:C.red,
                      borderRadius:6, padding:"7px 10px", cursor:"pointer",
                      display:"flex", alignItems:"center", flexShrink:0 }}>
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Announcements
// ─────────────────────────────────────────────────────────────────────────────
const AdminAnnouncements: React.FC = () => {
  const { C } = useTheme();
  const [list,    setList]   = useState(getAllAnnouncements());
  const [refresh, setRefresh]= useState(0);

  const reload = () => setList(getAllAnnouncements());
  const handleDelete = (id:string) => { deleteAnnouncement(id); reload(); };

  return (
    <div>
      <SectionHeading title="All Announcements"
        sub="View and moderate all announcements from all teachers."
        action={<Btn label="Refresh" Icon={RefreshCw} variant="ghost" small onClick={reload} />} />

      {list.length === 0 ? (
        <div style={{ background:C.card, border:`2px dashed ${C.border2}`, borderRadius:14,
          padding:"40px 20px", textAlign:"center", color:C.txtMut }}>
          <Megaphone size={30} style={{ marginBottom:10, opacity:0.3 }} />
          <div>No announcements have been sent yet.</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {list.map(a => (
            <div key={a.id} style={{ background:C.card, border:`1px solid ${C.border}`,
              borderRadius:12, padding:18, boxShadow:`0 1px 3px ${C.shadow}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ color:C.txtPri, fontWeight:700, fontSize:14 }}>{a.title}</div>
                  <div style={{ color:C.txtMut, fontSize:11, marginTop:2 }}>
                    {a.sentAt} · To: {a.target} · {a.total} recipients
                  </div>
                  <p style={{ color:C.txtSec, fontSize:13, margin:"8px 0 0", lineHeight:1.6 }}>{a.body}</p>
                </div>
                <button onClick={() => handleDelete(a.id)}
                  style={{ background:`${C.red}10`, border:"none", color:C.red,
                    borderRadius:6, padding:"7px 10px", cursor:"pointer",
                    display:"flex", alignItems:"center", flexShrink:0 }}>
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────────────────────────────────────
const AdminAnalytics: React.FC = () => {
  const { C } = useTheme();
  const subs  = getAllSubmissions();
  const stats = getStats();

  const vcSubs = subs.filter(s => s.practicalId === "vanishing-cream");
  const ccSubs = subs.filter(s => s.practicalId === "cold-cream");
  const vcAvg  = vcSubs.length > 0 ? Math.round(vcSubs.reduce((a,s)=>a+s.scorePct,0)/vcSubs.length) : 0;
  const ccAvg  = ccSubs.length > 0 ? Math.round(ccSubs.reduce((a,s)=>a+s.scorePct,0)/ccSubs.length) : 0;

  const dist = [
    { range:"90–100", min:90, max:101, color:C.accent  },
    { range:"80–89",  min:80, max:90,  color:"#4ade80"  },
    { range:"70–79",  min:70, max:80,  color:C.amber    },
    { range:"60–69",  min:60, max:70,  color:"#fb923c"  },
    { range:"< 60",   min:0,  max:60,  color:C.red      },
  ].map(r => ({ ...r, count: subs.filter(s => s.scorePct >= r.min && s.scorePct < r.max).length }));
  const maxC = Math.max(...dist.map(d=>d.count), 1);

  const topStudents = (() => {
    const map = new Map<string,{name:string;scores:number[]}>();
    subs.forEach(s => {
      const cur = map.get(s.studentId) ?? {name:s.studentName,scores:[]};
      cur.scores.push(s.scorePct);
      map.set(s.studentId, cur);
    });
    return Array.from(map.values())
      .map(v => ({ name:v.name, avg:Math.round(v.scores.reduce((a,b)=>a+b,0)/v.scores.length) }))
      .sort((a,b) => b.avg - a.avg)
      .slice(0,5);
  })();

  return (
    <div>
      <SectionHeading title="Platform Analytics" sub="Performance data across all teachers and students."
        action={<Btn label="Export Report" Icon={Download} variant="ghost" />} />

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:28 }}>
        <StatCard label="Total Sessions"  value={stats.total}    sub={`${stats.todayCount} today`}             Icon={ClipboardCheck} color={C.accent} />
        <StatCard label="Platform Avg"    value={stats.total>0?`${stats.classAvg}%`:"—"} sub="All evaluations" Icon={TrendingUp}     color={C.blue}   />
        <StatCard label="Pass Rate"       value={stats.total>0?`${Math.round(stats.passed/stats.total*100)}%`:"—"} sub="PASS result" Icon={CheckCircle} color={"#7c3aed"} />
        <StatCard label="Avg Duration"    value={stats.avgDur>0?`${stats.avgDur} min`:"—"} sub="Per session"   Icon={Clock}         color={C.amber}  />
      </div>

      {subs.length === 0 ? (
        <div style={{ background:C.card, border:`2px dashed ${C.border2}`, borderRadius:14,
          padding:"40px 20px", textAlign:"center", color:C.txtMut }}>
          <BarChart2 size={30} style={{ marginBottom:10, opacity:0.3 }} />
          <div>Analytics will appear once students start evaluating practicals.</div>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
          {/* Score by practical */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
            padding:20, boxShadow:`0 1px 4px ${C.shadow}` }}>
            <div style={{ color:C.txtPri, fontWeight:700, fontSize:14, marginBottom:18 }}>
              Average Score by Practical
            </div>
            {[
              { label:"Vanishing Cream", score:vcAvg, color:C.blue,   count:vcSubs.length },
              { label:"Cold Cream",      score:ccAvg, color:"#7c3aed", count:ccSubs.length },
            ].map(d => (
              <div key={d.label} style={{ marginBottom:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ color:C.txtSec, fontSize:13 }}>{d.label}</span>
                  <span style={{ color:C.txtPri, fontWeight:700, fontSize:13 }}>
                    {d.count > 0 ? `${d.score}%` : "No data"}
                  </span>
                </div>
                <div style={{ height:10, background:C.surface, borderRadius:5, overflow:"hidden",
                  border:`1px solid ${C.border}` }}>
                  <div style={{ width:`${d.score}%`, height:"100%", background:d.color, borderRadius:5 }} />
                </div>
                <div style={{ color:C.txtMut, fontSize:11, marginTop:4 }}>{d.count} session{d.count!==1?"s":""}</div>
              </div>
            ))}
          </div>

          {/* Distribution */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
            padding:20, boxShadow:`0 1px 4px ${C.shadow}` }}>
            <div style={{ color:C.txtPri, fontWeight:700, fontSize:14, marginBottom:18 }}>
              Score Distribution
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"flex-end", height:120 }}>
              {dist.map(d => (
                <div key={d.range} style={{ flex:1, display:"flex", flexDirection:"column",
                  alignItems:"center", gap:4 }}>
                  <span style={{ color:C.txtSec, fontSize:11 }}>{d.count}</span>
                  <div style={{ width:"100%", borderRadius:"4px 4px 0 0",
                    background: d.count>0 ? d.color : C.border,
                    height:`${(d.count/maxC)*90}px`, minHeight: d.count>0?6:2 }} />
                  <span style={{ color:C.txtMut, fontSize:10, textAlign:"center" }}>{d.range}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top performers */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
            padding:20, boxShadow:`0 1px 4px ${C.shadow}`, gridColumn:"1 / -1" }}>
            <div style={{ color:C.txtPri, fontWeight:700, fontSize:14, marginBottom:14,
              display:"flex", alignItems:"center", gap:8 }}>
              <Award size={15} color={C.accent} strokeWidth={2} /> Top 5 Students Platform-wide
            </div>
            {topStudents.length === 0 ? (
              <div style={{ color:C.txtMut, fontSize:13 }}>No data yet.</div>
            ) : topStudents.map((s, i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between",
                alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ color:C.txtMut, fontWeight:700, fontSize:14, minWidth:24 }}>#{i+1}</span>
                  <Avatar name={s.name} size={30} />
                  <span style={{ color:C.txtSec, fontSize:13 }}>{s.name}</span>
                </div>
                <span style={{ color:C.accent, fontWeight:800, fontSize:16 }}>{s.avg}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Admin Settings
// ─────────────────────────────────────────────────────────────────────────────
const AdminSettings: React.FC = () => {
  const { C } = useTheme();
  const [maintenance, setMaintenance] = useState(false);
  const [openReg,     setOpenReg]     = useState(true);
  const [maxStudents, setMaxStudents] = useState("500");
  const [saved,       setSaved]       = useState(false);

  const Toggle: React.FC<{v:boolean;set:(x:boolean)=>void}> = ({v,set}) => (
    <div onClick={()=>set(!v)} style={{ width:44, height:24, borderRadius:12, cursor:"pointer",
      background:v?C.accent:C.border2, position:"relative", transition:"background .2s", flexShrink:0 }}>
      <div style={{ width:18, height:18, borderRadius:"50%", background:"white", position:"absolute",
        top:3, left:v?23:3, transition:"left .2s", boxShadow:"0 1px 3px rgba(0,0,0,0.25)" }} />
    </div>
  );

  const Row: React.FC<{label:string;sub?:string;children:React.ReactNode}> = ({label,sub,children}) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"14px 0", borderBottom:`1px solid ${C.border}`, gap:16 }}>
      <div>
        <div style={{ color:C.txtPri, fontSize:13, fontWeight:600 }}>{label}</div>
        {sub && <div style={{ color:C.txtMut, fontSize:12, marginTop:2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );

  const Block: React.FC<{TitleIcon:LucideIcon;title:string;children:React.ReactNode}> =
  ({TitleIcon,title,children}) => (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
      padding:20, marginBottom:18, boxShadow:`0 1px 4px ${C.shadow}` }}>
      <div style={{ color:C.txtPri, fontWeight:700, fontSize:14, marginBottom:4,
        display:"flex", alignItems:"center", gap:8 }}>
        <TitleIcon size={16} color={C.accent} strokeWidth={2} />{title}
      </div>
      {children}
    </div>
  );

  return (
    <div style={{ maxWidth:700 }}>
      <SectionHeading title="System Settings" sub="Global platform configuration managed by the super admin." />

      <Block TitleIcon={Shield} title="Platform Status">
        <Row label="Maintenance Mode" sub="When ON, students and teachers see a maintenance page">
          <Toggle v={maintenance} set={setMaintenance} />
        </Row>
        {maintenance && (
          <div style={{ background:`${C.red}10`, border:`1px solid ${C.red}44`,
            borderRadius:8, padding:"10px 14px", marginTop:8,
            color:C.red, fontSize:13, display:"flex", alignItems:"center", gap:8 }}>
            <AlertTriangle size={15} /> Platform is in maintenance mode. Only admins can access.
          </div>
        )}
        <Row label="Open Registration" sub="Allow new teachers and students to self-register">
          <Toggle v={openReg} set={setOpenReg} />
        </Row>
        <Row label="Admin Invite Code" sub="Secret code required to create admin accounts">
          <code style={{ background:C.surface, border:`1px solid ${C.border2}`,
            color:C.accent, borderRadius:6, padding:"5px 12px", fontSize:13,
            letterSpacing:1.5, fontWeight:700 }}>VLAB-ADMIN-2026</code>
        </Row>
      </Block>

      <Block TitleIcon={Users} title="User Limits">
        <Row label="Max Students" sub="Maximum number of student accounts allowed">
          <input type="number" value={maxStudents} onChange={e => setMaxStudents(e.target.value)}
            style={{ width:80, background:C.surface, border:`1px solid ${C.border2}`,
              color:C.txtPri, borderRadius:7, padding:"6px 10px", fontSize:13, textAlign:"center" }} />
        </Row>
        <Row label="Total Registered" sub="Current user count">
          <span style={{ color:C.accent, fontWeight:700, fontSize:14 }}>{getAllUsers().length}</span>
        </Row>
      </Block>

      <Block TitleIcon={Database} title="Data Management">
        <Row label="Clear Audit Log" sub="Permanently delete all activity log entries">
          <button onClick={() => { clearAuditLog(); alert("Audit log cleared."); }}
            style={{ background:`${C.red}10`, border:`1px solid ${C.red}44`,
              color:C.red, borderRadius:8, padding:"7px 14px", cursor:"pointer",
              fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
            <Trash2 size={13} strokeWidth={2} /> Clear Log
          </button>
        </Row>
        <Row label="Export Full Data" sub="Download all platform data as JSON">
          <button
            onClick={() => {
              const data = {
                users:         getAllUsers().map(u => ({ ...u, passwordHash:"[hidden]" })),
                submissions:   getAllSubmissions(),
                assignments:   getAllAssignments(),
                questions:     getAllQuestions(),
                announcements: getAllAnnouncements(),
                auditLog:      getAuditLog(),
                exportedAt:    new Date().toISOString(),
              };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
              const url  = URL.createObjectURL(blob);
              const a    = document.createElement("a");
              a.href = url; a.download = `vlab-export-${Date.now()}.json`; a.click();
              URL.revokeObjectURL(url);
            }}
            style={{ background:C.accentBg, border:`1px solid ${C.accent}44`,
              color:C.accent, borderRadius:8, padding:"7px 14px", cursor:"pointer",
              fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
            <Download size={13} strokeWidth={2} /> Export JSON
          </button>
        </Row>
      </Block>

      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
        <button onClick={() => { setSaved(true); setTimeout(()=>setSaved(false),2500); }}
          style={{ background:C.accent, color:"white", border:"none", borderRadius:8,
            padding:"10px 20px", fontSize:14, fontWeight:700, cursor:"pointer",
            display:"flex", alignItems:"center", gap:6 }}>
          <CheckCircle size={15} strokeWidth={2.5} /> Save Changes
        </button>
        {saved && <span style={{ color:C.accent, fontSize:13, fontWeight:600 }}>✓ Saved</span>}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Audit Log
// ─────────────────────────────────────────────────────────────────────────────
const AuditLog: React.FC = () => {
  const { C } = useTheme();
  const [search, setSearch] = useState("");
  const [refresh, setRefresh] = useState(0);

  const log = getAuditLog();
  const filtered = log.filter(e =>
    e.detail.toLowerCase().includes(search.toLowerCase()) ||
    e.actorName.toLowerCase().includes(search.toLowerCase()) ||
    e.action.toLowerCase().includes(search.toLowerCase())
  );

  const actionColor: Record<string,string> = {
    user_registered:     C.accent,
    user_login:          C.blue,
    user_deleted:        C.red,
    assignment_created:  "#7c3aed",
    assignment_deleted:  C.red,
    submission_evaluated:C.amber,
    announcement_sent:   C.blue,
    question_created:    C.accent,
    question_deleted:    C.red,
    admin_action:        "#ec4899",
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}`;
  };

  return (
    <div>
      <SectionHeading title="Audit Log"
        sub={`${log.length} recorded events. Newest first.`}
        action={
          <div style={{ display:"flex", gap:8 }}>
            <Btn label="Refresh" Icon={RefreshCw} variant="ghost" small onClick={() => setRefresh(r=>r+1)} />
            <Btn label="Clear Log" Icon={Trash2} variant="danger" small onClick={() => { clearAuditLog(); setRefresh(r=>r+1); }} />
          </div>
        } />

      <div style={{ position:"relative", marginBottom:16 }}>
        <span style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)",
          pointerEvents:"none", display:"flex" }}>
          <Search size={15} color={C.txtMut} />
        </span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by action, user, or detail…"
          style={{ width:"100%", background:C.card, border:`1px solid ${C.border}`,
            color:C.txtPri, borderRadius:8, padding:"9px 12px 9px 34px",
            fontSize:13, boxSizing:"border-box", outline:"none" }} />
      </div>

      {log.length === 0 ? (
        <div style={{ background:C.card, border:`2px dashed ${C.border2}`, borderRadius:14,
          padding:"40px 20px", textAlign:"center", color:C.txtMut }}>
          <Activity size={30} style={{ marginBottom:10, opacity:0.3 }} />
          <div>No audit events recorded yet. Events are logged as users interact with the platform.</div>
        </div>
      ) : (
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
          overflow:"hidden", boxShadow:`0 1px 4px ${C.shadow}` }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <TableHead cols={["Time","Action","Actor","Role","Detail"]} />
            <tbody>
              {filtered.map((e, i) => (
                <tr key={e.id} style={{ background:i%2===0?"transparent":`${C.surface}88`,
                  borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:"10px 14px", color:C.txtMut, fontSize:11, whiteSpace:"nowrap" }}>
                    {formatTime(e.timestamp)}
                  </td>
                  <td style={{ padding:"10px 14px" }}>
                    <span style={{ background:`${actionColor[e.action] ?? C.txtMut}18`,
                      color:actionColor[e.action] ?? C.txtMut,
                      borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700,
                      whiteSpace:"nowrap" }}>
                      {e.action.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td style={{ padding:"10px 14px", color:C.txtPri, fontSize:13 }}>{e.actorName}</td>
                  <td style={{ padding:"10px 14px" }}><RoleBadge role={e.actorRole} /></td>
                  <td style={{ padding:"10px 14px", color:C.txtSec, fontSize:12 }}>{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding:32, textAlign:"center", color:C.txtMut }}>No log entries match.</div>
          )}
        </div>
      )}
      <div style={{ color:C.txtMut, fontSize:12, marginTop:10 }}>
        Showing {filtered.length} of {log.length} log entries
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Teacher Approvals
// ─────────────────────────────────────────────────────────────────────────────
const TeacherApprovals: React.FC = () => {
  const { C } = useTheme();
  const [refresh, setRefresh] = useState(0);
  const pending  = getPendingTeachers();

  const handleApprove = (id: string) => {
    approveTeacher(id);
    setRefresh(r => r + 1);
  };

  const handleReject = (id: string) => {
    rejectTeacher(id);
    setRefresh(r => r + 1);
  };

  // also show recently rejected so admin can reverse
  const allTeachers = getAllUsers().filter(u => u.role === "teacher");
  const rejected    = allTeachers.filter(u => u.status === "rejected");
  const approved    = allTeachers.filter(u => (u.status ?? "active") === "active");

  return (
    <div>
      <SectionHeading
        title="Teacher Approvals"
        sub="Review and approve teacher registrations before they can access the system."
        action={
          <Btn label="Refresh" Icon={RefreshCw} variant="ghost" small
            onClick={() => setRefresh(r => r + 1)} />
        }
      />

      {/* Stats strip */}
      <div style={{ display:"flex", gap:12, marginBottom:24, flexWrap:"wrap" }}>
        {[
          { label:"Pending Review", value:pending.length,   color:"#ca8a04", bg:"rgba(234,179,8,0.1)",   border:"rgba(234,179,8,0.3)"  },
          { label:"Approved",       value:approved.length,  color:C.accent,  bg:`${C.accent}10`,         border:`${C.accent}44`        },
          { label:"Rejected",       value:rejected.length,  color:C.red,     bg:`${C.red}10`,            border:`${C.red}44`           },
        ].map(s => (
          <div key={s.label} style={{ background:s.bg, border:`1px solid ${s.border}`,
            borderRadius:12, padding:"14px 20px", flex:"1 1 140px" }}>
            <div style={{ color:s.color, fontSize:26, fontWeight:900 }}>{s.value}</div>
            <div style={{ color:C.txtMut, fontSize:12, marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Pending ── */}
      <div style={{ color:C.txtMut, fontSize:11, fontWeight:700, letterSpacing:1.5,
        textTransform:"uppercase", marginBottom:10 }}>
        Pending Approval ({pending.length})
      </div>

      {pending.length === 0 ? (
        <div style={{ background:C.card, border:`2px dashed ${C.border2}`, borderRadius:14,
          padding:"40px 20px", textAlign:"center", marginBottom:28 }}>
          <GraduationCap size={36} color={C.txtMut} style={{ marginBottom:10, opacity:0.4 }} />
          <div style={{ color:C.txtPri, fontWeight:700, fontSize:15, marginBottom:5 }}>
            No pending teachers
          </div>
          <div style={{ color:C.txtMut, fontSize:13 }}>
            All teacher registrations have been reviewed.
          </div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:28 }}>
          {pending.map(u => (
            <div key={u.id} style={{
              background:C.card, border:`1px solid rgba(234,179,8,0.4)`,
              borderRadius:12, padding:"16px 18px",
              display:"flex", alignItems:"center", gap:14, flexWrap:"wrap",
              boxShadow:`0 2px 8px ${C.shadow}`,
            }}>
              {/* Avatar */}
              <div style={{
                width:44, height:44, borderRadius:"50%", flexShrink:0,
                background:"rgba(234,179,8,0.15)", border:"2px solid rgba(234,179,8,0.4)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:17, fontWeight:800, color:"#ca8a04",
              }}>
                {u.fullName.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex:1, minWidth:180 }}>
                <div style={{ color:C.txtPri, fontWeight:700, fontSize:14 }}>{u.fullName}</div>
                <div style={{ color:C.txtMut, fontSize:12, marginTop:2 }}>{u.email}</div>
                <div style={{ color:C.txtMut, fontSize:11, marginTop:2 }}>
                  Registered: {new Date(u.createdAt).toLocaleString()}
                </div>
              </div>

              {/* Badge */}
              <div style={{
                background:"rgba(234,179,8,0.1)", border:"1px solid rgba(234,179,8,0.4)",
                borderRadius:20, padding:"4px 12px",
                color:"#ca8a04", fontSize:11, fontWeight:700, flexShrink:0,
              }}>
                ⏳ Pending
              </div>

              {/* Actions */}
              <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                <button onClick={() => handleApprove(u.id)} style={{
                  display:"flex", alignItems:"center", gap:6,
                  background:`${C.accent}18`, border:`1px solid ${C.accent}66`,
                  color:C.accent, borderRadius:8, padding:"8px 16px",
                  fontSize:13, fontWeight:700, cursor:"pointer",
                }}>
                  <CheckCircle size={14} strokeWidth={2.5} /> Approve
                </button>
                <button onClick={() => handleReject(u.id)} style={{
                  display:"flex", alignItems:"center", gap:6,
                  background:`${C.red}10`, border:`1px solid ${C.red}66`,
                  color:C.red, borderRadius:8, padding:"8px 16px",
                  fontSize:13, fontWeight:700, cursor:"pointer",
                }}>
                  <AlertCircle size={14} strokeWidth={2.5} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Rejected (can be reversed) ── */}
      {rejected.length > 0 && (
        <>
          <div style={{ color:C.txtMut, fontSize:11, fontWeight:700, letterSpacing:1.5,
            textTransform:"uppercase", marginBottom:10 }}>
            Rejected ({rejected.length})
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:28 }}>
            {rejected.map(u => (
              <div key={u.id} style={{
                background:C.card, border:`1px solid ${C.red}44`,
                borderRadius:12, padding:"14px 18px",
                display:"flex", alignItems:"center", gap:12, flexWrap:"wrap",
              }}>
                <div style={{
                  width:40, height:40, borderRadius:"50%", flexShrink:0,
                  background:`${C.red}10`, border:`1px solid ${C.red}44`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:15, fontWeight:800, color:C.red,
                }}>
                  {u.fullName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:160 }}>
                  <div style={{ color:C.txtPri, fontWeight:600, fontSize:13 }}>{u.fullName}</div>
                  <div style={{ color:C.txtMut, fontSize:12 }}>{u.email}</div>
                </div>
                <div style={{ background:`${C.red}10`, border:`1px solid ${C.red}44`,
                  borderRadius:20, padding:"3px 12px",
                  color:C.red, fontSize:11, fontWeight:700 }}>
                  ✗ Rejected
                </div>
                <button onClick={() => handleApprove(u.id)} style={{
                  display:"flex", alignItems:"center", gap:5,
                  background:`${C.accent}10`, border:`1px solid ${C.accent}55`,
                  color:C.accent, borderRadius:8, padding:"6px 14px",
                  fontSize:12, fontWeight:700, cursor:"pointer",
                }}>
                  <CheckCircle size={13} /> Reverse — Approve
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Approved teachers ── */}
      {approved.length > 0 && (
        <>
          <div style={{ color:C.txtMut, fontSize:11, fontWeight:700, letterSpacing:1.5,
            textTransform:"uppercase", marginBottom:10 }}>
            Approved Teachers ({approved.length})
          </div>
          <div style={{ background:C.card, border:`1px solid ${C.border}`,
            borderRadius:14, overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <TableHead cols={["Teacher","Email","Joined","Status"]} />
              <tbody>
                {approved.map((u, i) => (
                  <tr key={u.id} style={{ background:i%2===0?"transparent":`${C.surface}88`,
                    borderBottom:`1px solid ${C.border}` }}>
                    <td style={{ padding:"11px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <Avatar name={u.fullName} />
                        <span style={{ color:C.txtPri, fontSize:13, fontWeight:600 }}>{u.fullName}</span>
                      </div>
                    </td>
                    <td style={{ padding:"11px 14px", color:C.txtSec, fontSize:12 }}>{u.email}</td>
                    <td style={{ padding:"11px 14px", color:C.txtMut, fontSize:12 }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding:"11px 14px" }}>
                      <span style={{ background:`${C.accent}12`, border:`1px solid ${C.accent}44`,
                        color:C.accent, borderRadius:20, padding:"2px 10px",
                        fontSize:11, fontWeight:700 }}>✓ Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

// NAV
// ─────────────────────────────────────────────────────────────────────────────
const NAV: { id:Section; label:string; Icon:LucideIcon }[] = [
  { id:"dashboard",     label:"Dashboard",        Icon:LayoutDashboard },
  { id:"users",         label:"Users",            Icon:Users           },
  { id:"approvals",     label:"Teacher Approvals",Icon:GraduationCap   },
  { id:"assignments",   label:"Assignments",      Icon:Key             },
  { id:"submissions",   label:"Submissions",      Icon:ClipboardCheck  },
  { id:"questions",     label:"Q&A",              Icon:ClipboardList   },
  { id:"announcements", label:"Announcements",    Icon:Megaphone       },
  { id:"analytics",     label:"Analytics",        Icon:BarChart2       },
  { id:"settings",      label:"Settings",         Icon:Settings        },
  { id:"auditlog",      label:"Audit Log",        Icon:Activity        },
];

const LABELS: Record<Section,string> = {
  dashboard:"Dashboard", users:"Users", approvals:"Teacher Approvals",
  assignments:"Assignments", submissions:"Submissions", questions:"Q&A",
  announcements:"Announcements", analytics:"Analytics", settings:"Settings",
  auditlog:"Audit Log",
};

// ─────────────────────────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────────────────────────
interface Props { onLogout: () => void; }

const AdminPanel: React.FC<Props> = ({ onLogout }) => {
  const [isDark,   setIsDark]   = useState(getStoredTheme() === "dark");
  const [section,  setSection]  = useState<Section>("dashboard");
  const [sbOpen,   setSbOpen]   = useState(true);

  const C      = isDark ? DARK : LIGHT;
  const toggle = () => {
    setIsDark(v => { const next = !v; storeTheme(next?"dark":"light"); return next; });
  };

  const pendingCount = getPendingTeachers().length;

  const render = () => {
    switch (section) {
      case "dashboard":     return <Dashboard />;
      case "users":         return <UserManager />;
      case "approvals":     return <TeacherApprovals />;
      case "assignments":   return <AdminAssignments />;
      case "submissions":   return <AdminSubmissions />;
      case "questions":     return <AdminQA />;
      case "announcements": return <AdminAnnouncements />;
      case "analytics":     return <AdminAnalytics />;
      case "settings":      return <AdminSettings />;
      case "auditlog":      return <AuditLog />;
    }
  };

  return (
    <ThemeCtx.Provider value={{ C, isDark, toggle }}>
      <div style={{ display:"flex", height:"100vh", background:C.bg,
        fontFamily:"system-ui,-apple-system,sans-serif", overflow:"hidden",
        transition:"background .25s", color:C.txtPri }}>

        {/* ── Sidebar ── */}
        <aside style={{
          width: sbOpen ? 240 : 64, minWidth: sbOpen ? 240 : 64,
          background: C.sidebar, borderRight:`1px solid ${C.border}`,
          display:"flex", flexDirection:"column", overflow:"hidden",
          transition:"width .2s,min-width .2s", flexShrink:0,
          boxShadow:`2px 0 8px ${C.shadow}`,
        }}>
          {/* Logo */}
          <div style={{ padding: sbOpen?"16px 18px":"16px 12px", borderBottom:`1px solid ${C.border}`,
            display:"flex", alignItems:"center", justifyContent:"space-between", minHeight:60, gap:8 }}>
            <div style={{ width:34, height:34, borderRadius:10, flexShrink:0,
              background:C.accent, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Shield size={18} color="white" strokeWidth={2.4} />
            </div>
            {sbOpen && (
              <>
                <div style={{ flex:1, overflow:"hidden" }}>
                  <div style={{ color:C.txtPri, fontWeight:800, fontSize:13, whiteSpace:"nowrap" }}>VirtualLab</div>
                  <div style={{ color:C.txtMut, fontSize:10, whiteSpace:"nowrap", fontWeight:600,
                    textTransform:"uppercase", letterSpacing:0.8 }}>Super Admin</div>
                </div>
                <button onClick={() => setSbOpen(false)} style={{
                  background:"transparent", border:"none", color:C.txtMut,
                  cursor:"pointer", padding:4, display:"flex", alignItems:"center" }}>
                  <Menu size={16} strokeWidth={2} />
                </button>
              </>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex:1, padding:"10px 8px", overflowY:"auto" }}>
            {!sbOpen && (
              <button onClick={() => setSbOpen(true)} style={{
                width:"100%", display:"flex", justifyContent:"center",
                padding:"10px 0", borderRadius:9, border:"none",
                background:"transparent", color:C.txtMut, cursor:"pointer", marginBottom:4,
              }}>
                <Menu size={17} strokeWidth={2} />
              </button>
            )}
            {NAV.map(item => {
              const active  = section === item.id;
              const badgeN  = item.id === "approvals" ? pendingCount : 0;
              return (
                <button key={item.id} onClick={() => setSection(item.id)} style={{
                  width:"100%", display:"flex", alignItems:"center",
                  gap: sbOpen?10:0, justifyContent: sbOpen?"flex-start":"center",
                  padding: sbOpen?"10px 12px":"11px 0",
                  borderRadius:9, border:"none", cursor:"pointer", marginBottom:3,
                  background: active ? `${C.accent}18` : "transparent",
                  color: active ? C.accent : C.txtSec,
                  fontWeight: active ? 700 : 500, fontSize:13, transition:"background .15s,color .15s",
                }}>
                  <div style={{ position:"relative", flexShrink:0 }}>
                    <item.Icon size={17} strokeWidth={active?2.2:1.8} />
                    {badgeN > 0 && (
                      <span style={{
                        position:"absolute", top:-5, right:-6,
                        background:"#dc2626", color:"white",
                        borderRadius:"50%", width:14, height:14,
                        fontSize:9, fontWeight:800,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        lineHeight:1,
                      }}>{badgeN}</span>
                    )}
                  </div>
                  {sbOpen && <span style={{ whiteSpace:"nowrap", flex:1 }}>{item.label}</span>}
                  {sbOpen && badgeN > 0 && (
                    <span style={{
                      background:"#dc2626", color:"white", borderRadius:10,
                      padding:"1px 7px", fontSize:10, fontWeight:800, flexShrink:0,
                    }}>{badgeN}</span>
                  )}
                  {active && sbOpen && badgeN === 0 && (
                    <span style={{ marginLeft:"auto", width:6, height:6, borderRadius:"50%",
                      background:C.accent, flexShrink:0 }} />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Logout */}
          <div style={{ padding:"10px 8px", borderTop:`1px solid ${C.border}` }}>
            <button onClick={onLogout} title="Logout"
              style={{
                width:"100%", display:"flex", alignItems:"center",
                gap: sbOpen?10:0, justifyContent: sbOpen?"flex-start":"center",
                padding: sbOpen?"11px 14px":"11px 0",
                borderRadius:9, border:`1px solid ${C.red}33`,
                background:`${C.red}10`, color:C.red, fontSize:13, fontWeight:700, cursor:"pointer",
              }}
              onMouseEnter={e => (e.currentTarget.style.background=`${C.red}20`)}
              onMouseLeave={e => (e.currentTarget.style.background=`${C.red}10`)}>
              <LogOut size={16} strokeWidth={2} />
              {sbOpen && <span>Logout</span>}
            </button>
          </div>
        </aside>

        {/* ── Main area ── */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>
          {/* Header */}
          <header style={{
            height:60, borderBottom:`1px solid ${C.border}`,
            background:C.headerBg, display:"flex", alignItems:"center",
            justifyContent:"space-between", padding:"0 22px", flexShrink:0,
            boxShadow:`0 1px 4px ${C.shadow}`,
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              {!sbOpen && (
                <button onClick={() => setSbOpen(true)} style={{
                  background:"transparent", border:"none", color:C.txtSec,
                  cursor:"pointer", display:"flex", alignItems:"center", marginRight:4 }}>
                  <Menu size={20} strokeWidth={2} />
                </button>
              )}
              <span style={{ color:C.txtMut, fontSize:12 }}>Super Admin</span>
              <ChevronRight size={14} color={C.txtMut} />
              <span style={{ color:C.txtPri, fontWeight:700, fontSize:14 }}>{LABELS[section]}</span>
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              {/* Admin badge */}
              <div style={{ background:`${C.accent}15`, border:`1px solid ${C.accent}44`,
                borderRadius:20, padding:"3px 12px", color:C.accent,
                fontSize:11, fontWeight:700, display:"flex", alignItems:"center", gap:5 }}>
                <Shield size={11} strokeWidth={2.5} /> Super Admin
              </div>

              {/* Theme toggle */}
              <button onClick={toggle} aria-label="Toggle theme" style={{
                width:38, height:38, borderRadius:10, cursor:"pointer",
                background: isDark ? "#1e1e1e" : "#f1f5f9",
                border:`1px solid ${C.border2}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                color: isDark ? "#f5f5f5" : "#0a0a0a",
                transition:"background .2s",
              }}>
                {isDark ? <Sun size={17} strokeWidth={2} /> : <Moon size={17} strokeWidth={2} />}
              </button>

              {/* Avatar */}
              <div style={{ width:34, height:34, borderRadius:"50%",
                background:C.accent, display:"flex", alignItems:"center",
                justifyContent:"center", color:"white", fontWeight:800, fontSize:14 }}>
                <Shield size={16} strokeWidth={2.5} color="white" />
              </div>
            </div>
          </header>

          {/* Content */}
          <main style={{ flex:1, overflowY:"auto", padding:"28px 28px 48px",
            background:C.bg, transition:"background .25s" }}>
            {render()}
          </main>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
};

export default AdminPanel;
