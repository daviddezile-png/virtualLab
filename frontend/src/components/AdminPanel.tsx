import React, { useState, useEffect, useContext, createContext } from "react";
import {
  LayoutDashboard, Users, ClipboardCheck,
  BarChart2, Settings, LogOut, Sun, Moon, Menu, Search,
  Trash2, Shield, Activity, TrendingUp, CheckCircle, AlertCircle,
  GraduationCap, User as UserIcon, Key,
  RefreshCw, Download, Lock, Unlock, Clock, Award, Database,
  AlertTriangle, ChevronRight, LucideIcon, Wifi, Server,
  UserCheck, BarChart, FileCheck, Filter,
} from "lucide-react";
import {
  getAllUsers, User, createAdminUser, registerUser,
  getPendingTeachers, approveTeacher, rejectTeacher,
  deleteUserById, toggleSuspend as toggleSuspendUser,
  getStoredTheme, storeTheme,
} from "../utils/userStore";
import { getAllSubmissions, getStats } from "../utils/submissionStore";
import { getAuditLog, clearAuditLog } from "../utils/auditStore";

// ─────────────────────────────────────────────────────────────────────────────
// Theme tokens — pure black/white + green
// ─────────────────────────────────────────────────────────────────────────────
const DARK = {
  bg:"#0a0a0a", sidebar:"#111111", surface:"#161616", card:"#1a1a1a",
  border:"#2a2a2a", border2:"#3a3a3a",
  txtPri:"#f5f5f5", txtSec:"#c4c4c4", txtMut:"#9ca3af",
  accent:"#3b82f6", accentHi:"#2563eb", accentBg:"rgba(59,130,246,0.10)",
  red:"#ef4444", amber:"#f59e0b", blue:"#3b82f6",
  shadow:"rgba(0,0,0,0.6)", headerBg:"rgba(10,10,10,0.95)",
} as const;

const LIGHT = {
  bg:"#f8fafc", sidebar:"#ffffff", surface:"#f1f5f9", card:"#ffffff",
  border:"#e2e8f0", border2:"#cbd5e1",
  txtPri:"#0f172a", txtSec:"#334155", txtMut:"#64748b",
  accent:"#2563eb", accentHi:"#1d4ed8", accentBg:"rgba(37,99,235,0.08)",
  red:"#dc2626", amber:"#d97706", blue:"#2563eb",
  shadow:"rgba(0,0,0,0.08)", headerBg:"rgba(255,255,255,0.97)",
} as const;

type C = typeof DARK;
const ThemeCtx = createContext<{ C:C; isDark:boolean; toggle:()=>void }>({ C:DARK, isDark:true, toggle:()=>{} });
const useTheme = () => useContext(ThemeCtx);

// ─────────────────────────────────────────────────────────────────────────────
// Section type
// ─────────────────────────────────────────────────────────────────────────────
type Section = "dashboard"|"users"|"approvals"|"analytics"|"settings"|"auditlog";

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
  const [users,   setUsers]   = useState<User[]>([]);
  const [subs,    setSubs]    = useState<any[]>([]);
  const [stats,   setStats]   = useState<any>({ total:0, todayCount:0, classAvg:0, passed:0, average:0, failed:0, avgDur:0 });

  useEffect(() => {
    getAllUsers().then(setUsers);
    getAllSubmissions().then(setSubs);
    getStats().then(setStats);
  }, []);

  const admins   = users.filter(u => u.role === "admin").length;
  const teachers = users.filter(u => u.role === "teacher").length;
  const students = users.filter(u => u.role === "student").length;
  const recentSubs = [...subs].sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).slice(0,6);

  return (
    <div>
      <SectionHeading title="Admin Dashboard" sub="Full platform overview — all users, all sessions." />

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:14, marginBottom:28 }}>
        <StatCard label="Total Users"     value={users.length}   sub={`${admins} admin · ${teachers} teachers · ${students} students`} Icon={Users}         color={C.accent} />
        <StatCard label="Total Submissions" value={stats.total}  sub={`${stats.todayCount} today`}             Icon={ClipboardCheck} color={C.blue}   />
        <StatCard label="Platform Average" value={stats.total > 0 ? `${stats.classAvg}%` : "—"} sub="Across all sessions" Icon={TrendingUp}  color={C.amber}  />
        <StatCard label="Pass Rate"       value={stats.total > 0 ? `${Math.round(stats.passed/stats.total*100)}%` : "—"} sub="PASS result" Icon={CheckCircle} color="#7c3aed" />
      </div>

      <div className="ap-grid-dash" style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:20 }}>
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
            <div className="ap-table-wrap"><table style={{ width:"100%", borderCollapse:"collapse" }}>
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
            </table></div>
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

  const [allUsers, setAllUsers] = useState<User[]>([]);
  useEffect(() => { getAllUsers().then(setAllUsers); }, [refresh]);

  const filtered = allUsers.filter(u =>
    (roleFilter === "all" || u.role === roleFilter) &&
    (u.fullName.toLowerCase().includes(search.toLowerCase()) ||
     u.email.toLowerCase().includes(search.toLowerCase()) ||
     (u.regNumber ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  const handleToggleSuspend = async (clientId: string) => {
    await toggleSuspendUser(clientId);
    setRefresh(r => r + 1);
  };

  const deleteUser = async (clientId: string) => {
    const u = allUsers.find(x => x.clientId === clientId);
    if (u?.seeded) return;
    await deleteUserById(clientId);
    setRefresh(r => r + 1);
  };

  const resetForm = () => {
    setNewName(""); setNewEmail(""); setNewPass(""); setNewReg("");
    setAddError(null);
  };

  const handleAddUser = async () => {
    setAddError(null);
    let result;
    if (newRole === "admin") {
      result = await createAdminUser(newName, newEmail, newPass);
    } else {
      result = await registerUser({ role: newRole, fullName: newName, email: newEmail,
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
        <div className="ap-table-wrap"><table style={{ width:"100%", borderCollapse:"collapse" }}>
          <TableHead cols={["User","Email","Role","Reg No.","Joined","Status",""]} />
          <tbody>
            {filtered.map((u,i) => (
              <tr key={u.clientId} style={{ background:i%2===0?"transparent":`${C.surface}88`,
                borderBottom:`1px solid ${C.border}`,
                opacity: u.suspended ? 0.5 : 1 }}>
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
                  {new Date(u.createdAt ?? "").toLocaleDateString()}
                </td>
                <td style={{ padding:"11px 14px" }}>
                  <span style={{
                    background: u.suspended ? `${C.red}12` : `${C.accent}12`,
                    color: u.suspended ? C.red : C.accent,
                    border: `1px solid ${u.suspended ? `${C.red}44` : `${C.accent}44`}`,
                    borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700,
                  }}>{u.suspended ? "Suspended" : "Active"}</span>
                </td>
                <td style={{ padding:"11px 14px" }}>
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={() => handleToggleSuspend(u.clientId)} title={u.suspended?"Unsuspend":"Suspend"}
                      style={{ background:"transparent", border:`1px solid ${C.border}`,
                        color: u.suspended ? C.accent : C.amber,
                        borderRadius:6, padding:"5px 8px", cursor:"pointer",
                        display:"flex", alignItems:"center" }}>
                      {u.suspended ? <Unlock size={13}/> : <Lock size={13}/>}
                    </button>
                    {u.seeded ? (
                      <span title="Seeded admin — cannot be deleted"
                        style={{ background:C.surface, border:`1px solid ${C.border}`,
                          color:C.txtMut, borderRadius:6, padding:"5px 8px",
                          display:"flex", alignItems:"center", opacity:0.5 }}>
                        <Shield size={13} strokeWidth={2} />
                      </span>
                    ) : (
                      <button onClick={() => deleteUser(u.clientId)} title="Delete user"
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
        </table></div>
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
// Analytics — System Usage, Health, User Adoption, Data Integrity
// ─────────────────────────────────────────────────────────────────────────────
const AdminAnalytics: React.FC = () => {
  const { C } = useTheme();
  const [users,   setUsers]   = useState<User[]>([]);
  const [subs,    setSubs]    = useState<any[]>([]);
  const [log,     setLog]     = useState<any[]>([]);
  const [health,  setHealth]  = useState<"ok"|"degraded"|"unknown">("unknown");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    getAllUsers().then(setUsers);
    getAllSubmissions().then(setSubs);
    getAuditLog().then(setLog);
    fetch("/health").then(r => r.json()).then(d => setHealth(d.status === "OK" ? "ok" : "degraded")).catch(() => setHealth("degraded"));
  }, [refresh]);

  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week  = new Date(today.getTime() - 6 * 86400000);

  const students      = users.filter(u => u.role === "student");
  const teachers      = users.filter(u => u.role === "teacher");
  const todaySubs     = subs.filter(s => new Date(s.submittedAt) >= today);
  const weekSubs      = subs.filter(s => new Date(s.submittedAt) >= week);
  const todayUsers    = log.filter(e => new Date(e.timestamp) >= today && e.action === "user_login").length;
  const weekUsers     = log.filter(e => new Date(e.timestamp) >= week  && e.action === "user_login").length;
  const passCount     = subs.filter(s => s.result === "PASS").length;
  const avgScore      = subs.length > 0 ? Math.round(subs.reduce((a,s) => a+s.scorePct, 0) / subs.length) : 0;
  const avgDurMin     = subs.length > 0 ? Math.round(subs.reduce((a,s) => a + (s.durationSec||0), 0) / subs.length / 60) : 0;
  const validSubs     = subs.filter(s => s.scorePct >= 0 && s.scorePct <= 100 && ["PASS","AVERAGE","FAIL"].includes(s.result)).length;
  const integrityPct  = subs.length > 0 ? Math.round((validSubs / subs.length) * 100) : 100;

  // Activity heatmap — sessions per day last 7 days
  const dailyCounts = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getTime() - (6 - i) * 86400000);
    const next = new Date(d.getTime() + 86400000);
    return {
      label: d.toLocaleDateString(undefined, { weekday:"short" }),
      count: subs.filter(s => { const t = new Date(s.submittedAt); return t >= d && t < next; }).length,
    };
  });
  const maxDay = Math.max(...dailyCounts.map(d => d.count), 1);

  const Section: React.FC<{ title:string; Icon:LucideIcon; color:string; children:React.ReactNode }> = ({ title, Icon:Ic, color, children }) => (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
      padding:20, boxShadow:`0 1px 4px ${C.shadow}` }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:18, paddingBottom:12, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ width:34, height:34, borderRadius:9, background:`${color}18`,
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Ic size={17} color={color} strokeWidth={2} />
        </div>
        <span style={{ color:C.txtPri, fontWeight:800, fontSize:14 }}>{title}</span>
      </div>
      {children}
    </div>
  );

  const Metric: React.FC<{ label:string; value:string|number; sub?:string; color?:string }> = ({ label, value, sub, color }) => (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
        <span style={{ color:C.txtSec, fontSize:13 }}>{label}</span>
        <span style={{ color:color ?? C.txtPri, fontWeight:800, fontSize:18, fontFamily:"monospace" }}>{value}</span>
      </div>
      {sub && <div style={{ color:C.txtMut, fontSize:11 }}>{sub}</div>}
      <div style={{ height:3, background:C.surface, borderRadius:2, marginTop:6 }}>
        <div style={{ width:"100%", height:"100%", background:`${color ?? C.accent}22`, borderRadius:2 }} />
      </div>
    </div>
  );

  return (
    <div>
      <SectionHeading
        title="System Analytics"
        sub="Platform health, usage, adoption, and data integrity."
        action={<Btn label="Refresh" Icon={RefreshCw} variant="ghost" small onClick={() => setRefresh(r=>r+1)} />}
      />

      {/* ── Top KPIs ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:24 }}>
        <StatCard label="Total Users"       value={users.length}   sub={`${students.length} students · ${teachers.length} teachers`}         Icon={Users}         color={C.accent} />
        <StatCard label="Total Sessions"    value={subs.length}    sub={`${todaySubs.length} today · ${weekSubs.length} this week`}           Icon={Activity}      color={C.blue}   />
        <StatCard label="Platform Score"    value={subs.length > 0 ? `${avgScore}%` : "—"} sub={`${passCount} PASS of ${subs.length}`}       Icon={TrendingUp}    color={C.amber}  />
        <StatCard label="System"            value={health === "ok" ? "Online" : "Degraded"} sub="MongoDB connected"                          Icon={Server}        color={health === "ok" ? C.accent : C.red} />
      </div>

      <div className="ap-grid-2col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>

        {/* System Usage */}
        <Section title="System Usage" Icon={BarChart} color={C.blue}>
          <Metric label="Sessions Today"       value={todaySubs.length}  sub="Evaluations submitted" color={C.blue} />
          <Metric label="Sessions This Week"   value={weekSubs.length}   sub="7-day rolling window"  color={C.blue} />
          <Metric label="Avg Session Duration" value={avgDurMin > 0 ? `${avgDurMin} min` : "—"} sub="Time per practical" color={C.amber} />
          <Metric label="Vanishing Cream"      value={subs.filter(s=>s.practicalId==="vanishing-cream").length} sub="sessions total" />
          <Metric label="Cold Cream"           value={subs.filter(s=>s.practicalId==="cold-cream").length} sub="sessions total" />
        </Section>

        {/* System Health & Performance */}
        <Section title="System Health & Performance" Icon={Server} color={C.accent}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, padding:"10px 14px",
            background: health === "ok" ? `${C.accent}10` : `${C.red}10`,
            border:`1px solid ${health === "ok" ? `${C.accent}33` : `${C.red}33`}`, borderRadius:9 }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background: health === "ok" ? C.accent : C.red,
              boxShadow:`0 0 6px ${health === "ok" ? C.accent : C.red}` }} />
            <span style={{ color: health === "ok" ? C.accent : C.red, fontWeight:700, fontSize:13 }}>
              {health === "ok" ? "All systems operational" : "Service degraded"}
            </span>
          </div>
          <Metric label="API Status"       value={health === "ok" ? "200 OK" : "Error"} color={health === "ok" ? C.accent : C.red} />
          <Metric label="Database"         value="Connected" sub="MongoDB Atlas" color={C.accent} />
          <Metric label="Pass Rate"        value={subs.length > 0 ? `${Math.round(passCount/subs.length*100)}%` : "—"} sub="Quality indicator" color={C.accent} />
          <Metric label="Avg Score"        value={avgScore > 0 ? `${avgScore}%` : "—"} sub="Platform-wide" color={C.amber} />
        </Section>

        {/* User Adoption & Traffic */}
        <Section title="User Adoption & Traffic" Icon={UserCheck} color="#7c3aed">
          <Metric label="Active Today (logins)"  value={todayUsers}  color="#7c3aed" />
          <Metric label="Active This Week"       value={weekUsers}   color="#7c3aed" />
          <Metric label="Total Registered"       value={users.length} sub={`${users.filter(u=>u.status==="active").length} active accounts`} />
          <Metric label="Student : Teacher Ratio" value={teachers.length > 0 ? `${Math.round(students.length/teachers.length)}:1` : "—"} sub="Students per teacher" />

          {/* 7-day activity heatmap */}
          <div style={{ marginTop:14 }}>
            <div style={{ color:C.txtMut, fontSize:10, fontWeight:700, letterSpacing:0.8, textTransform:"uppercase", marginBottom:8 }}>7-Day Session Activity</div>
            <div style={{ display:"flex", gap:6, alignItems:"flex-end", height:60 }}>
              {dailyCounts.map(d => (
                <div key={d.label} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                  <div style={{ width:"100%", borderRadius:"3px 3px 0 0",
                    background: d.count > 0 ? "#7c3aed" : C.border,
                    height:`${Math.max(4, (d.count / maxDay) * 52)}px`,
                    minHeight: d.count > 0 ? 6 : 3, transition:"height .3s" }} />
                  <span style={{ color:C.txtMut, fontSize:8 }}>{d.label}</span>
                  <span style={{ color:C.txtSec, fontSize:9, fontWeight:700 }}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Data Pipeline & Integrity */}
        <Section title="Data Pipeline & Integrity" Icon={FileCheck} color={C.amber}>
          <Metric label="Total Records"        value={subs.length}     sub="Submission records in DB" color={C.amber} />
          <Metric label="Valid Records"        value={validSubs}       sub="Pass schema validation" />
          <Metric label="Data Integrity"       value={`${integrityPct}%`} sub="Valid / total records"
            color={integrityPct >= 98 ? C.accent : integrityPct >= 90 ? C.amber : C.red} />
          <Metric label="Assignment Mode"      value={subs.filter(s=>s.mode==="assignment").length} sub="From assignment codes" />
          <Metric label="Practice Mode"        value={subs.filter(s=>s.mode==="practice").length}   sub="Self-practice sessions" />
          <div style={{ marginTop:10, padding:"10px 12px",
            background: integrityPct >= 98 ? `${C.accent}10` : `${C.amber}10`,
            border:`1px solid ${integrityPct >= 98 ? `${C.accent}33` : `${C.amber}33`}`, borderRadius:8 }}>
            <span style={{ color:integrityPct >= 98 ? C.accent : C.amber, fontSize:12, fontWeight:700 }}>
              {integrityPct >= 98 ? "✓ Data pipeline healthy" : "⚠ Some records may need review"}
            </span>
          </div>
        </Section>
      </div>
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
  const [totalUsers,  setTotalUsers]  = useState(0);

  useEffect(() => { getAllUsers().then(us => setTotalUsers(us.length)); }, []);

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

  const handleExportJSON = async () => {
    const [users, submissions, auditLog] = await Promise.all([
      getAllUsers(),
      getAllSubmissions(),
      getAuditLog(),
    ]);
    const data = {
      users: users.map(u => ({ ...u, passwordHash:"[hidden]" })),
      submissions,
      auditLog,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `vlab-export-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAuditLog = async () => {
    await clearAuditLog();
    alert("Audit log cleared.");
  };

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
          <span style={{ color:C.accent, fontWeight:700, fontSize:14 }}>{totalUsers}</span>
        </Row>
      </Block>

      <Block TitleIcon={Database} title="Data Management">
        <Row label="Clear Audit Log" sub="Permanently delete all activity log entries">
          <button onClick={handleClearAuditLog}
            style={{ background:`${C.red}10`, border:`1px solid ${C.red}44`,
              color:C.red, borderRadius:8, padding:"7px 14px", cursor:"pointer",
              fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
            <Trash2 size={13} strokeWidth={2} /> Clear Log
          </button>
        </Row>
        <Row label="Export Full Data" sub="Download all platform data as JSON">
          <button onClick={handleExportJSON}
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
  const [search,     setSearch]     = useState("");
  const [roleFilter, setRoleFilter] = useState<"all"|"admin"|"teacher"|"student">("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [refresh,    setRefresh]    = useState(0);
  const [log,        setLog]        = useState<any[]>([]);

  useEffect(() => { getAuditLog().then(setLog); }, [refresh]);

  const actionColor: Record<string,string> = {
    user_registered:      C.accent,
    user_login:           C.blue,
    user_deleted:         C.red,
    lab_started:          C.amber,
    code_entered:         "#7c3aed",
    submission_evaluated: C.amber,
    admin_action:         "#ec4899",
  };

  const allActions = Array.from(new Set(log.map(e => e.action))).sort();

  const filtered = log.filter(e =>
    (roleFilter   === "all" || e.actorRole  === roleFilter)   &&
    (actionFilter === "all" || e.action     === actionFilter) &&
    (e.detail.toLowerCase().includes(search.toLowerCase()) ||
     e.actorName.toLowerCase().includes(search.toLowerCase()) ||
     e.action.toLowerCase().includes(search.toLowerCase()))
  );

  // Most active users — count events per actor
  const userActivity = Array.from(
    log.reduce((map, e) => {
      const key = e.actorName;
      const cur = map.get(key) ?? { name: key, role: e.actorRole, count: 0 };
      cur.count += 1;
      map.set(key, cur);
      return map;
    }, new Map<string, { name:string; role:string; count:number }>())
  ).map(([, v]) => v).sort((a, b) => b.count - a.count).slice(0, 6);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}`;
  };

  const selStyle = {
    background:C.card, border:`1px solid ${C.border}`, color:C.txtSec,
    borderRadius:8, padding:"8px 12px", fontSize:12, cursor:"pointer", outline:"none",
  };

  return (
    <div>
      <SectionHeading title="Audit Log"
        sub={`${log.length} recorded events · tracking all user activity.`}
        action={
          <div style={{ display:"flex", gap:8 }}>
            <Btn label="Refresh" Icon={RefreshCw} variant="ghost" small onClick={() => setRefresh(r=>r+1)} />
            <Btn label="Clear Log" Icon={Trash2} variant="danger" small onClick={async () => { await clearAuditLog(); setRefresh(r=>r+1); }} />
          </div>
        } />

      {/* Most Active Users panel */}
      {userActivity.length > 0 && (
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
          padding:18, marginBottom:20, boxShadow:`0 1px 4px ${C.shadow}` }}>
          <div style={{ color:C.txtPri, fontWeight:700, fontSize:14, marginBottom:14,
            display:"flex", alignItems:"center", gap:8 }}>
            <Award size={15} color={C.accent} strokeWidth={2} /> Most Active Users
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:10 }}>
            {userActivity.map((u, i) => (
              <div key={u.name} style={{ display:"flex", alignItems:"center", gap:10,
                background:C.surface, borderRadius:9, padding:"10px 12px",
                border:`1px solid ${C.border}` }}>
                <span style={{ color:C.txtMut, fontWeight:800, fontSize:13, minWidth:20 }}>#{i+1}</span>
                <Avatar name={u.name} size={28} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:C.txtPri, fontSize:12, fontWeight:600,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.name}</div>
                  <RoleBadge role={u.role} />
                </div>
                <span style={{ color:C.accent, fontWeight:800, fontSize:14 }}>{u.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters row */}
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ position:"relative", flex:1, minWidth:200 }}>
          <span style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)",
            pointerEvents:"none", display:"flex" }}>
            <Search size={14} color={C.txtMut} />
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by action, user, or detail…"
            style={{ width:"100%", background:C.card, border:`1px solid ${C.border}`,
              color:C.txtPri, borderRadius:8, padding:"8px 12px 8px 32px",
              fontSize:13, boxSizing:"border-box", outline:"none" }} />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)} style={selStyle}>
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="teacher">Teacher</option>
          <option value="student">Student</option>
        </select>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={selStyle}>
          <option value="all">All Actions</option>
          {allActions.map(a => (
            <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {log.length === 0 ? (
        <div style={{ background:C.card, border:`2px dashed ${C.border2}`, borderRadius:14,
          padding:"40px 20px", textAlign:"center", color:C.txtMut }}>
          <Activity size={30} style={{ marginBottom:10, opacity:0.3 }} />
          <div>No audit events recorded yet.</div>
        </div>
      ) : (
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
          overflow:"hidden", boxShadow:`0 1px 4px ${C.shadow}` }}>
          <div className="ap-table-wrap">
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <TableHead cols={["Time","Action","Actor","Role","Detail"]} />
            <tbody>
              {filtered.map((e, i) => (
                <tr key={`${e.id ?? i}`} style={{ background:i%2===0?"transparent":`${C.surface}88`,
                  borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:"10px 14px", color:C.txtMut, fontSize:11, whiteSpace:"nowrap" }}>
                    {formatTime(e.timestamp)}
                  </td>
                  <td style={{ padding:"10px 14px" }}>
                    <span style={{ background:`${actionColor[e.action] ?? C.txtMut}18`,
                      color:actionColor[e.action] ?? C.txtMut,
                      borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
                      {e.action.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td style={{ padding:"10px 14px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <Avatar name={e.actorName} size={24} />
                      <span style={{ color:C.txtPri, fontSize:13 }}>{e.actorName}</span>
                    </div>
                  </td>
                  <td style={{ padding:"10px 14px" }}><RoleBadge role={e.actorRole} /></td>
                  <td style={{ padding:"10px 14px", color:C.txtSec, fontSize:12 }}>{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {filtered.length === 0 && (
            <div style={{ padding:32, textAlign:"center", color:C.txtMut }}>No log entries match the filters.</div>
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
  const [refresh,     setRefresh]     = useState(0);
  const [allTeachers, setAllTeachers] = useState<User[]>([]);

  useEffect(() => {
    getAllUsers().then(us => setAllTeachers(us.filter(u => u.role === "teacher")));
  }, [refresh]);

  const pending  = allTeachers.filter(u => u.status === "pending");
  const rejected = allTeachers.filter(u => u.status === "rejected");
  const approved = allTeachers.filter(u => (u.status ?? "active") === "active");

  const handleApprove = async (clientId: string) => {
    await approveTeacher(clientId);
    setRefresh(r => r + 1);
  };

  const handleReject = async (clientId: string) => {
    await rejectTeacher(clientId);
    setRefresh(r => r + 1);
  };

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
            <div key={u.clientId} style={{
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
                  Registered: {new Date(u.createdAt ?? "").toLocaleString()}
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
                <button onClick={() => handleApprove(u.clientId)} style={{
                  display:"flex", alignItems:"center", gap:6,
                  background:`${C.accent}18`, border:`1px solid ${C.accent}66`,
                  color:C.accent, borderRadius:8, padding:"8px 16px",
                  fontSize:13, fontWeight:700, cursor:"pointer",
                }}>
                  <CheckCircle size={14} strokeWidth={2.5} /> Approve
                </button>
                <button onClick={() => handleReject(u.clientId)} style={{
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
              <div key={u.clientId} style={{
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
                <button onClick={() => handleApprove(u.clientId)} style={{
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
            <div className="ap-table-wrap"><table style={{ width:"100%", borderCollapse:"collapse" }}>
              <TableHead cols={["Teacher","Email","Joined","Status"]} />
              <tbody>
                {approved.map((u, i) => (
                  <tr key={u.clientId} style={{ background:i%2===0?"transparent":`${C.surface}88`,
                    borderBottom:`1px solid ${C.border}` }}>
                    <td style={{ padding:"11px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <Avatar name={u.fullName} />
                        <span style={{ color:C.txtPri, fontSize:13, fontWeight:600 }}>{u.fullName}</span>
                      </div>
                    </td>
                    <td style={{ padding:"11px 14px", color:C.txtSec, fontSize:12 }}>{u.email}</td>
                    <td style={{ padding:"11px 14px", color:C.txtMut, fontSize:12 }}>
                      {new Date(u.createdAt ?? "").toLocaleDateString()}
                    </td>
                    <td style={{ padding:"11px 14px" }}>
                      <span style={{ background:`${C.accent}12`, border:`1px solid ${C.accent}44`,
                        color:C.accent, borderRadius:20, padding:"2px 10px",
                        fontSize:11, fontWeight:700 }}>✓ Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </>
      )}
    </div>
  );
};

// NAV
// ─────────────────────────────────────────────────────────────────────────────
const NAV: { id:Section; label:string; Icon:LucideIcon }[] = [
  { id:"dashboard",   label:"Dashboard",        Icon:LayoutDashboard },
  { id:"users",       label:"Users",            Icon:Users           },
  { id:"approvals",   label:"Teacher Approvals",Icon:GraduationCap   },
  { id:"analytics",   label:"Analytics",        Icon:BarChart2       },
  { id:"settings",    label:"Settings",         Icon:Settings        },
  { id:"auditlog",    label:"Audit Log",        Icon:Activity        },
];

const LABELS: Record<Section,string> = {
  dashboard:"Dashboard", users:"Users", approvals:"Teacher Approvals",
  analytics:"Analytics", settings:"Settings",
  auditlog:"Audit Log",
};

// ─────────────────────────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────────────────────────
interface Props { onLogout: () => void; }

const AdminPanel: React.FC<Props> = ({ onLogout }) => {
  const [isDark,       setIsDark]       = useState(getStoredTheme() === "dark");
  const [section,      setSection]      = useState<Section>("dashboard");
  const [sbOpen,       setSbOpen]       = useState(window.innerWidth >= 768);
  const [isMobile,     setIsMobile]     = useState(window.innerWidth < 768);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSbOpen(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    getPendingTeachers().then(list => setPendingCount(list.length));
  }, [section]);

  const C      = isDark ? DARK : LIGHT;
  const toggle = () => {
    setIsDark(v => { const next = !v; storeTheme(next?"dark":"light"); return next; });
  };

  const navTo = (s: Section) => {
    setSection(s);
    if (isMobile) setSbOpen(false);
  };

  const render = () => {
    switch (section) {
      case "dashboard":  return <Dashboard />;
      case "users":      return <UserManager />;
      case "approvals":  return <TeacherApprovals />;
      case "analytics":  return <AdminAnalytics />;
      case "settings":   return <AdminSettings />;
      case "auditlog":   return <AuditLog />;
    }
  };

  return (
    <ThemeCtx.Provider value={{ C: C as C, isDark, toggle }}>
      <div style={{ display:"flex", height:"100vh", background:C.bg,
        fontFamily:"system-ui,-apple-system,sans-serif", overflow:"hidden",
        transition:"background .25s", color:C.txtPri, position:"relative" }}>

        {/* ── Mobile backdrop ── */}
        {isMobile && sbOpen && (
          <div onClick={() => setSbOpen(false)} style={{
            position:"fixed", inset:0, background:"rgba(0,0,0,0.55)",
            zIndex:198, backdropFilter:"blur(2px)",
          }} />
        )}

        {/* ── Sidebar ── */}
        <aside style={{
          background: C.sidebar, borderRight:`1px solid ${C.border}`,
          display:"flex", flexDirection:"column", overflow:"hidden",
          boxShadow:`2px 0 8px ${C.shadow}`,
          ...(isMobile ? {
            position:"fixed", top:0, left:0, height:"100vh", zIndex:199,
            width:240, minWidth:240,
            transform: sbOpen ? "translateX(0)" : "translateX(-100%)",
            transition:"transform .25s ease",
          } : {
            width: sbOpen ? 240 : 64, minWidth: sbOpen ? 240 : 64,
            transition:"width .2s,min-width .2s", flexShrink:0,
          }),
        }}>
          {/* Logo */}
          <div style={{
            padding: sbOpen ? "16px 18px" : "16px 0",
            borderBottom:`1px solid ${C.border}`,
            display:"flex", alignItems:"center",
            justifyContent: sbOpen ? "space-between" : "center",
            minHeight:60, gap:8,
          }}>
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
                <button onClick={() => setSbOpen(false)} title="Collapse sidebar" style={{
                  background:"transparent", border:"none", color:C.txtMut,
                  cursor:"pointer", padding:4, display:"flex", alignItems:"center", flexShrink:0 }}>
                  <Menu size={16} strokeWidth={2} />
                </button>
              </>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex:1, padding:"10px 8px", overflowY:"auto" }}>
            {NAV.map(item => {
              const active = section === item.id;
              const badgeN = item.id === "approvals" ? pendingCount : 0;
              return (
                <button key={item.id} onClick={() => navTo(item.id)}
                  title={!sbOpen ? item.label : undefined}
                  style={{
                    width:"100%", display:"flex", alignItems:"center",
                    justifyContent: sbOpen ? "flex-start" : "center",
                    gap: sbOpen ? 10 : 0,
                    padding: sbOpen ? "10px 12px" : "10px 0",
                    borderRadius:9, border:"none", cursor:"pointer", marginBottom:3,
                    background: active ? `${C.accent}18` : "transparent",
                    color: active ? C.accent : C.txtSec,
                    fontWeight: active ? 700 : 500, fontSize:13,
                    transition:"background .15s,color .15s",
                  }}>
                  {/* Icon with badge dot */}
                  <div style={{ position:"relative", flexShrink:0 }}>
                    <item.Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
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

                  {/* Label + trailing elements — hidden when collapsed */}
                  {sbOpen && (
                    <>
                      <span style={{ whiteSpace:"nowrap", flex:1, textAlign:"left" }}>{item.label}</span>
                      {badgeN > 0 && (
                        <span style={{
                          background:"#dc2626", color:"white", borderRadius:10,
                          padding:"1px 7px", fontSize:10, fontWeight:800, flexShrink:0,
                        }}>{badgeN}</span>
                      )}
                      {active && badgeN === 0 && (
                        <span style={{ width:6, height:6, borderRadius:"50%",
                          background:C.accent, flexShrink:0 }} />
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Logout */}
          <div style={{ padding:"10px 8px", borderTop:`1px solid ${C.border}` }}>
            <button onClick={onLogout} title="Logout" style={{
              width:"100%", display:"flex", alignItems:"center",
              justifyContent: sbOpen ? "flex-start" : "center",
              gap: sbOpen ? 10 : 0,
              padding: sbOpen ? "11px 14px" : "11px 0",
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
            justifyContent:"space-between", padding:"0 16px", flexShrink:0,
            boxShadow:`0 1px 4px ${C.shadow}`,
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <button onClick={() => setSbOpen(v => !v)} style={{
                background:"transparent", border:"none", color:C.txtSec,
                cursor:"pointer", display:"flex", alignItems:"center", padding:4 }}>
                <Menu size={20} strokeWidth={2} />
              </button>
              {!isMobile && <span style={{ color:C.txtMut, fontSize:12 }}>Super Admin</span>}
              {!isMobile && <ChevronRight size={14} color={C.txtMut} />}
              <span style={{ color:C.txtPri, fontWeight:700, fontSize:14 }}>{LABELS[section]}</span>
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {!isMobile && (
                <div style={{ background:`${C.accent}15`, border:`1px solid ${C.accent}44`,
                  borderRadius:20, padding:"3px 12px", color:C.accent,
                  fontSize:11, fontWeight:700, display:"flex", alignItems:"center", gap:5 }}>
                  <Shield size={11} strokeWidth={2.5} /> Super Admin
                </div>
              )}
              <button onClick={toggle} aria-label="Toggle theme" style={{
                width:36, height:36, borderRadius:9, cursor:"pointer",
                background: isDark ? "#1e1e1e" : "#f1f5f9",
                border:`1px solid ${C.border2}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                color: isDark ? "#f5f5f5" : "#0a0a0a",
              }}>
                {isDark ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
              </button>
              <div style={{ width:34, height:34, borderRadius:"50%",
                background:C.accent, display:"flex", alignItems:"center",
                justifyContent:"center", flexShrink:0 }}>
                <Shield size={16} strokeWidth={2.5} color="white" />
              </div>
            </div>
          </header>

          {/* Content */}
          <main style={{ flex:1, overflowY:"auto",
            padding: isMobile ? "16px 14px 48px" : "28px 28px 48px",
            background:C.bg, transition:"background .25s" }}>
            {render()}
          </main>
        </div>
      </div>

      {/* ── Responsive helpers ── */}
      <style>{`
        @media (max-width: 640px) {
          .ap-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .ap-grid-2col  { grid-template-columns: 1fr !important; }
          .ap-grid-dash  { grid-template-columns: 1fr !important; }
          .ap-hide-sm    { display: none !important; }
          .ap-form-grid  { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 900px) {
          .ap-grid-dash  { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </ThemeCtx.Provider>
  );
};

export default AdminPanel;
