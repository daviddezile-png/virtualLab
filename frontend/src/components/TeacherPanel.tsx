import React, { useState, useRef, useContext, createContext, useEffect } from "react";
import {
  LayoutDashboard, TestTubes, ClipboardList, Users, BarChart2,
  ClipboardCheck, Megaphone, Settings, ArrowLeft, Sun, Moon, Menu,
  Plus, Download, Edit, Trash2, Search, Upload, Send, Copy, Eye,
  GripVertical, TrendingUp, Award, Clock, FileText, Bell,
  FlaskConical, FlaskRound, Beaker, User, BookOpen, Shield,
  LogOut, CheckCircle, AlertCircle, Activity, UserPlus, Filter,
  Save, RefreshCw, LucideIcon, Key, Hash, Calculator, Zap,
} from "lucide-react";
import {
  Assignment, PracticalId, BASE_RECIPES,
  getAllAssignments, saveAssignment, deleteAssignment, generateToken, isCodeExpired,
} from "../utils/assignmentStore";
import { getAllUsers, registerUser } from "../utils/userStore";
import { getAllSubmissions, getStats, LabSubmission } from "../utils/submissionStore";
import {
  getAllQuestions, saveQuestion, deleteQuestion,
  QAQuestion, QAPractical, getAllAnswers,
} from "../utils/qaStore";
import {
  getAllAnnouncements, saveAnnouncement, deleteAnnouncement,
  Announcement as StoredAnnouncement,
} from "../utils/announcementStore";

// Persistent settings helpers
const SETTINGS_KEY = "vlab_teacher_settings";
const loadSettings = () => {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}"); }
  catch { return {}; }
};
const persistSettings = (s: Record<string, unknown>) =>
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));

// Helper: students who have registered in the app
const getAllRegisteredStudents = () =>
  getAllUsers().filter(u => u.role === "student");

// ─────────────────────────────────────────────────────────────────────────────
// Theme tokens
// ─────────────────────────────────────────────────────────────────────────────

const DARK = {
  bg:        "#060d18",
  sidebar:   "#080f1e",
  surface:   "#0a1628",
  card:      "#0d1b2e",
  border:    "#1e293b",
  border2:   "#334155",
  txtPri:    "#e2e8f0",
  txtSec:    "#94a3b8",
  txtMut:    "#475569",
  accent:    "#3b82f6",
  accentHov: "#2563eb",
  green:     "#22c55e",
  red:       "#ef4444",
  amber:     "#f59e0b",
  purple:    "#a78bfa",
  shadow:    "rgba(0,0,0,0.55)",
  headerBg:  "rgba(8,15,30,0.98)",
} as const;

const LIGHT = {
  bg:        "#f1f5f9",
  sidebar:   "#ffffff",
  surface:   "#f8fafc",
  card:      "#ffffff",
  border:    "#e2e8f0",
  border2:   "#cbd5e1",
  txtPri:    "#0f172a",
  txtSec:    "#475569",
  txtMut:    "#94a3b8",
  accent:    "#2563eb",
  accentHov: "#1d4ed8",
  green:     "#16a34a",
  red:       "#dc2626",
  amber:     "#d97706",
  purple:    "#7c3aed",
  shadow:    "rgba(0,0,0,0.10)",
  headerBg:  "rgba(255,255,255,0.98)",
} as const;

type Theme = typeof DARK;

const ThemeCtx = createContext<{ C: Theme; isDark: boolean; toggle: () => void }>({
  C: DARK, isDark: true, toggle: () => {},
});
const useTheme = () => useContext(ThemeCtx);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Section =
  | "dashboard" | "questions" | "students"
  | "analytics" | "submissions" | "announcements" | "settings";

interface Student {
  id: string; name: string; email: string; enrolled: string;
  completed: number; lastActive: string; avgScore: number;
  status: "active" | "inactive";
}
interface Submission {
  id: string; student: string; practical: string; submittedAt: string;
  score: number; status: "graded" | "pending" | "failed"; duration: string;
}
interface Practical {
  id: string; name: string; type: string; status: "active" | "inactive" | "draft";
  enrolled: number; submissions: number; avgScore: number;
  lastActivity: string; Icon: LucideIcon; color: string;
}
interface Question {
  id: string; text: string; type: "mcq" | "short" | "long";
  points: number; options?: string[];
}
interface Announcement {
  id: string; title: string; body: string; target: string;
  sentAt: string; read: number; total: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────────────────────────────────────

const STUDENTS: Student[] = [
  { id:"s1",  name:"Amara Nkosi",    email:"amara@school.edu",  enrolled:"2026-01-10", completed:2, lastActive:"2 hours ago",  avgScore:88, status:"active"   },
  { id:"s2",  name:"Brian Odhiambo", email:"brian@school.edu",  enrolled:"2026-01-10", completed:1, lastActive:"1 day ago",    avgScore:74, status:"active"   },
  { id:"s3",  name:"Chloe Mwangi",   email:"chloe@school.edu",  enrolled:"2026-01-12", completed:2, lastActive:"3 hours ago",  avgScore:92, status:"active"   },
  { id:"s4",  name:"David Kamau",    email:"david@school.edu",  enrolled:"2026-01-12", completed:0, lastActive:"5 days ago",   avgScore:0,  status:"inactive" },
  { id:"s5",  name:"Eva Njoroge",    email:"eva@school.edu",    enrolled:"2026-01-14", completed:2, lastActive:"30 min ago",   avgScore:95, status:"active"   },
  { id:"s6",  name:"Felix Otieno",   email:"felix@school.edu",  enrolled:"2026-01-14", completed:1, lastActive:"2 days ago",   avgScore:67, status:"active"   },
  { id:"s7",  name:"Grace Wanjiru",  email:"grace@school.edu",  enrolled:"2026-01-15", completed:2, lastActive:"1 hour ago",   avgScore:81, status:"active"   },
  { id:"s8",  name:"Hassan Ali",     email:"hassan@school.edu", enrolled:"2026-01-15", completed:1, lastActive:"4 days ago",   avgScore:71, status:"inactive" },
  { id:"s9",  name:"Irene Chebet",   email:"irene@school.edu",  enrolled:"2026-01-18", completed:2, lastActive:"45 min ago",   avgScore:89, status:"active"   },
  { id:"s10", name:"James Mutua",    email:"james@school.edu",  enrolled:"2026-01-18", completed:0, lastActive:"1 week ago",   avgScore:0,  status:"inactive" },
];

const SUBMISSIONS: Submission[] = [
  { id:"sub1",  student:"Amara Nkosi",    practical:"Vanishing Cream", submittedAt:"2026-05-10 14:22", score:88, status:"graded",  duration:"52 min" },
  { id:"sub2",  student:"Chloe Mwangi",   practical:"Vanishing Cream", submittedAt:"2026-05-10 13:55", score:92, status:"graded",  duration:"47 min" },
  { id:"sub3",  student:"Eva Njoroge",    practical:"Cold Cream",      submittedAt:"2026-05-10 12:30", score:95, status:"graded",  duration:"44 min" },
  { id:"sub4",  student:"Brian Odhiambo", practical:"Vanishing Cream", submittedAt:"2026-05-09 16:10", score:74, status:"graded",  duration:"68 min" },
  { id:"sub5",  student:"Grace Wanjiru",  practical:"Cold Cream",      submittedAt:"2026-05-09 15:40", score:81, status:"graded",  duration:"59 min" },
  { id:"sub6",  student:"Irene Chebet",   practical:"Vanishing Cream", submittedAt:"2026-05-09 11:20", score:89, status:"graded",  duration:"50 min" },
  { id:"sub7",  student:"Felix Otieno",   practical:"Cold Cream",      submittedAt:"2026-05-08 14:05", score:67, status:"graded",  duration:"73 min" },
  { id:"sub8",  student:"Hassan Ali",     practical:"Vanishing Cream", submittedAt:"2026-05-08 10:30", score:71, status:"pending", duration:"65 min" },
  { id:"sub9",  student:"Amara Nkosi",    practical:"Cold Cream",      submittedAt:"2026-05-07 15:00", score:85, status:"graded",  duration:"48 min" },
  { id:"sub10", student:"Chloe Mwangi",   practical:"Cold Cream",      submittedAt:"2026-05-07 14:20", score:94, status:"graded",  duration:"42 min" },
];

const PRACTICALS: Practical[] = [
  { id:"vanishing-cream", name:"Vanishing Cream",    type:"O/W Emulsion", status:"active", enrolled:10, submissions:7, avgScore:82, lastActivity:"2 hours ago", Icon:FlaskConical, color:"#2563eb" },
  { id:"cold-cream",      name:"Cold Cream",          type:"W/O Emulsion", status:"active", enrolled:10, submissions:5, avgScore:84, lastActivity:"3 hours ago", Icon:FlaskRound,   color:"#7c3aed" },
  { id:"acid-base",       name:"Acid-Base Titration", type:"Titration",    status:"draft",  enrolled:0,  submissions:0, avgScore:0,  lastActivity:"—",           Icon:Beaker,       color:"#0f766e" },
];

const QUESTIONS_VC: Question[] = [
  { id:"q1", text:"What type of emulsion is vanishing cream? Explain the phase arrangement.", type:"short", points:5 },
  { id:"q2", text:"Which of the following is the primary emulsifier in vanishing cream?", type:"mcq", points:2, options:["Glycerin","Potassium stearate","Liquid paraffin","Distilled water"] },
  { id:"q3", text:"Why must both phases be heated to 75°C before mixing?", type:"short", points:5 },
  { id:"q4", text:"What is the acceptable pH range for the finished vanishing cream?", type:"mcq", points:2, options:["3.0–4.5","5.0–7.0","7.5–9.0","9.5–11.0"] },
  { id:"q5", text:"Describe the role of the ice bucket step and explain why controlled cooling improves emulsion stability.", type:"long", points:10 },
];

const ANNOUNCEMENTS: Announcement[] = [
  { id:"a1", title:"Practical 1 Now Live",  body:"Vanishing Cream practical is now open. Please complete it before Friday.", target:"All Students", sentAt:"2026-05-08 09:00", read:8, total:10 },
  { id:"a2", title:"Cold Cream Lab Open",   body:"Cold Cream W/O emulsion practical is available. Refer to your pre-lab notebook.", target:"All Students", sentAt:"2026-05-09 08:30", read:6, total:10 },
  { id:"a3", title:"Submission Reminder",   body:"Reminder: all submissions for Practical 1 are due tomorrow at 5 PM.", target:"All Students", sentAt:"2026-05-09 16:00", read:9, total:10 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Micro-components
// ─────────────────────────────────────────────────────────────────────────────

type BadgeStatus = "active"|"inactive"|"draft"|"graded"|"pending"|"failed";

const StatusBadge: React.FC<{ status: BadgeStatus }> = ({ status }) => {
  const { C } = useTheme();
  const map: Record<BadgeStatus,[string,string]> = {
    active:   [C.green,  `${C.green}18`],
    inactive: [C.txtSec, C.surface],
    draft:    [C.amber,  `${C.amber}18`],
    graded:   [C.green,  `${C.green}18`],
    pending:  [C.amber,  `${C.amber}18`],
    failed:   [C.red,    `${C.red}18`],
  };
  const [color, bg] = map[status];
  return (
    <span style={{ background:bg, color, borderRadius:20,
      padding:"2px 10px", fontSize:11, fontWeight:700, letterSpacing:0.3 }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const ScoreBar: React.FC<{ score: number }> = ({ score }) => {
  const { C } = useTheme();
  const bar = score>=80 ? C.green : score>=60 ? C.amber : C.red;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ flex:1, height:6, background:C.border, borderRadius:3, overflow:"hidden" }}>
        <div style={{ width:`${score}%`, height:"100%", background:bar, borderRadius:3 }} />
      </div>
      <span style={{ color:C.txtSec, fontSize:12, minWidth:32, textAlign:"right" }}>{score}%</span>
    </div>
  );
};

const StatCard: React.FC<{
  label:string; value:string|number; sub?:string;
  Icon: LucideIcon; accent:string;
}> = ({ label, value, sub, Icon, accent }) => {
  const { C } = useTheme();
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
      padding:"18px 20px", display:"flex", gap:14, alignItems:"flex-start",
      boxShadow:`0 1px 4px ${C.shadow}` }}>
      <div style={{ width:44, height:44, borderRadius:12, background:`${accent}18`,
        display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <Icon size={22} color={accent} strokeWidth={1.8} />
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

const SectionHeading: React.FC<{ title:string; sub?:string; action?:React.ReactNode }> = ({ title, sub, action }) => {
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

const Btn: React.FC<{
  label:string; onClick?:()=>void; variant?:"primary"|"ghost"|"danger";
  Icon?: LucideIcon; small?:boolean;
}> = ({ label, onClick, variant="primary", Icon: IconComp, small }) => {
  const { C } = useTheme();
  const map: Record<string,React.CSSProperties> = {
    primary: { background:C.accent,     color:"white",  border:"none" },
    ghost:   { background:"transparent",color:C.txtSec, border:`1px solid ${C.border2}` },
    danger:  { background:`${C.red}12`, color:C.red,    border:`1px solid ${C.red}44`  },
  };
  return (
    <button onClick={onClick} style={{
      ...map[variant], borderRadius:8,
      padding: small ? "6px 12px" : "9px 18px",
      fontSize: small ? 12 : 13, fontWeight:600, cursor:"pointer",
      display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap",
    }}>
      {IconComp && <IconComp size={small ? 13 : 15} strokeWidth={2} />}
      {label}
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

const TInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
  const { C } = useTheme();
  return (
    <input {...props} style={{
      width:"100%", background:C.surface, border:`1px solid ${C.border2}`,
      color:C.txtPri, borderRadius:8, padding:"9px 12px", fontSize:13,
      boxSizing:"border-box", outline:"none", fontFamily:"inherit",
      ...props.style,
    }} />
  );
};

const TTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => {
  const { C } = useTheme();
  return (
    <textarea {...props} style={{
      width:"100%", background:C.surface, border:`1px solid ${C.border2}`,
      color:C.txtPri, borderRadius:8, padding:"10px 12px", fontSize:13,
      boxSizing:"border-box", outline:"none", resize:"vertical",
      fontFamily:"inherit", ...props.style,
    }} />
  );
};

// Avatar circle with initials
const Avatar: React.FC<{ name:string; size?:number }> = ({ name, size=32 }) => (
  <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0,
    background:`hsl(${name.charCodeAt(0)*7%360},55%,38%)`,
    display:"flex", alignItems:"center", justifyContent:"center",
    color:"white", fontWeight:700, fontSize:size*0.4 }}>
    {name[0]}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────

const resultBadge = (r: "PASS"|"AVERAGE"|"FAIL", C: ReturnType<typeof useTheme>["C"]) => {
  const map = {
    PASS:    [C.green,  `${C.green}18`],
    AVERAGE: [C.amber,  `${C.amber}18`],
    FAIL:    [C.red,    `${C.red}18`],
  } as Record<string, [string,string]>;
  const [color, bg] = map[r] ?? [C.txtSec, C.surface];
  return (
    <span style={{ background:bg, color, borderRadius:20,
      padding:"2px 10px", fontSize:11, fontWeight:700 }}>{r}</span>
  );
};

const Dashboard: React.FC = () => {
  const { C } = useTheme();
  const stats    = getStats();
  const allSubs  = getAllSubmissions()
    .sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  const students = getAllRegisteredStudents();

  const quickActions = [
    { Icon:ClipboardList, label:"Create Assignment",   color:C.accent  },
    { Icon:Megaphone,     label:"Send Announcement",   color:C.purple  },
    { Icon:Download,      label:"Export Analytics",    color:C.amber   },
    { Icon:RefreshCw,     label:"Refresh Data",        color:C.green   },
  ];

  return (
    <div>
      <SectionHeading title="Dashboard" sub="Real-time overview of your lab sessions." />

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:16, marginBottom:28 }}>
        <StatCard label="Registered Students" value={students.length} sub="Self-registered accounts"   Icon={Users}         accent={C.accent} />
        <StatCard label="Total Submissions"   value={stats.total}     sub={`${stats.todayCount} today`} Icon={ClipboardCheck} accent={C.green}  />
        <StatCard label="Class Average"       value={stats.total > 0 ? `${stats.classAvg}%` : "—"} sub="Based on real evals" Icon={TrendingUp} accent={C.amber} />
        <StatCard label="Avg Duration"        value={stats.total > 0 ? `${stats.avgDur} min` : "—"} sub="Time per practical" Icon={Clock}      accent="#7c3aed" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:20, alignItems:"start" }}>
        {/* Recent real submissions */}
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
          overflow:"hidden", boxShadow:`0 1px 4px ${C.shadow}` }}>
          <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.border}`,
            display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ color:C.txtPri, fontWeight:700, fontSize:14 }}>Recent Submissions</span>
            <span style={{ color:C.txtMut, fontSize:12 }}>{allSubs.length} total</span>
          </div>
          {allSubs.length === 0 ? (
            <div style={{ padding:"32px 20px", textAlign:"center", color:C.txtMut }}>
              <ClipboardCheck size={28} style={{ marginBottom:8, opacity:0.3 }} />
              <div style={{ fontSize:13 }}>No submissions yet. Students will appear here after evaluating a practical.</div>
            </div>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <TableHead cols={["Student","Practical","Score","Result","Duration"]} />
              <tbody>
                {allSubs.slice(0,6).map((s,i) => (
                  <tr key={s.id} style={{ background: i%2===0?"transparent":`${C.surface}88` }}>
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
                    <td style={{ padding:"10px 14px", minWidth:110 }}><ScoreBar score={s.scorePct} /></td>
                    <td style={{ padding:"10px 14px" }}>{resultBadge(s.result, C)}</td>
                    <td style={{ padding:"10px 14px", color:C.txtMut, fontSize:12 }}>
                      {s.durationSec > 0 ? `${Math.round(s.durationSec/60)} min` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick actions */}
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
          padding:18, boxShadow:`0 1px 4px ${C.shadow}` }}>
          <div style={{ color:C.txtPri, fontWeight:700, fontSize:14, marginBottom:14 }}>Quick Actions</div>
          {quickActions.map(({ Icon:Ic, label, color }) => (
            <button key={label} style={{ width:"100%", display:"flex", alignItems:"center", gap:10,
              background:"transparent", border:`1px solid ${C.border}`, borderRadius:8,
              padding:"10px 12px", marginBottom:8, cursor:"pointer", color:C.txtSec,
              fontSize:13, fontWeight:600 }}>
              <span style={{ width:30, height:30, borderRadius:8, background:`${color}18`,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Ic size={16} color={color} strokeWidth={2} />
              </span>
              {label}
            </button>
          ))}

          {/* Pass/Average/Fail breakdown */}
          {stats.total > 0 && (
            <div style={{ marginTop:16, paddingTop:16, borderTop:`1px solid ${C.border}` }}>
              <div style={{ color:C.txtMut, fontSize:11, fontWeight:700, textTransform:"uppercase",
                letterSpacing:0.8, marginBottom:10 }}>Result Breakdown</div>
              {([
                { label:"Pass",    count:stats.passed,  color:C.green },
                { label:"Average", count:stats.average, color:C.amber },
                { label:"Fail",    count:stats.failed,  color:C.red   },
              ]).map(r => (
                <div key={r.label} style={{ marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                    <span style={{ color:C.txtSec, fontSize:12 }}>{r.label}</span>
                    <span style={{ color:r.color, fontWeight:700, fontSize:12 }}>{r.count}</span>
                  </div>
                  <div style={{ height:5, background:C.surface, borderRadius:3, overflow:"hidden" }}>
                    <div style={{ width:`${stats.total>0?(r.count/stats.total)*100:0}%`,
                      height:"100%", background:r.color, borderRadius:3 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Placeholder kept to avoid removing the original Practicals component references
// (it's no longer in the nav — just remove dead code silently)
const Practicals: React.FC = () => {
  const { C } = useTheme();
  const [list, setList] = useState(PRACTICALS);

  const toggleStatus = (id:string) =>
    setList(prev => prev.map(p =>
      p.id===id ? { ...p, status:(p.status==="active"?"inactive":"active") as Practical["status"] } : p
    ));

  return (
    <div>
      <SectionHeading title="Practicals" sub="Manage all lab practicals and control student access."
        action={<Btn label="Add Practical" Icon={Plus} />} />

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:18 }}>
        {list.map(p => (
          <div key={p.id} style={{ background:C.card, border:`1px solid ${C.border}`,
            borderRadius:14, overflow:"hidden", boxShadow:`0 1px 4px ${C.shadow}` }}>
            <div style={{ height:4, background: p.status==="active" ? p.color : C.border }} />
            <div style={{ padding:20 }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:14 }}>
                <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                  <div style={{ width:46, height:46, borderRadius:12, background:`${p.color}18`,
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <p.Icon size={24} color={p.color} strokeWidth={1.6} />
                  </div>
                  <div>
                    <div style={{ color:C.txtPri, fontWeight:700, fontSize:15 }}>{p.name}</div>
                    <div style={{ color:C.txtMut, fontSize:12 }}>{p.type}</div>
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
                {[
                  { label:"Students",  val:p.enrolled },
                  { label:"Submitted", val:p.submissions },
                  { label:"Avg Score", val: p.avgScore>0 ? `${p.avgScore}%` : "—" },
                ].map(({ label, val }) => (
                  <div key={label} style={{ background:C.surface, borderRadius:8, padding:"8px 10px",
                    textAlign:"center", border:`1px solid ${C.border}` }}>
                    <div style={{ color:C.txtPri, fontWeight:700, fontSize:16 }}>{val}</div>
                    <div style={{ color:C.txtMut, fontSize:10, marginTop:2, textTransform:"uppercase", letterSpacing:0.5 }}>{label}</div>
                  </div>
                ))}
              </div>

              <div style={{ color:C.txtMut, fontSize:11, marginBottom:16, display:"flex", alignItems:"center", gap:5 }}>
                <Activity size={12} color={C.txtMut} />
                Last activity: {p.lastActivity}
              </div>

              <div style={{ display:"flex", gap:8 }}>
                <Btn label="Edit"      Icon={Edit}         variant="ghost" small />
                <Btn label="Questions" Icon={ClipboardList} variant="ghost" small />
                <button onClick={() => toggleStatus(p.id)} style={{
                  marginLeft:"auto",
                  background: p.status==="active" ? `${C.red}10` : `${C.green}10`,
                  color:      p.status==="active" ? C.red : C.green,
                  border:    `1px solid ${p.status==="active" ? `${C.red}44` : `${C.green}44`}`,
                  borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:12, fontWeight:600,
                  display:"flex", alignItems:"center", gap:5,
                }}>
                  {p.status==="active"
                    ? <><AlertCircle size={13} strokeWidth={2} />Deactivate</>
                    : <><CheckCircle size={13} strokeWidth={2} />Activate</>}
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Add card */}
        <div style={{ border:`2px dashed ${C.border2}`, borderRadius:14,
          display:"flex", flexDirection:"column", alignItems:"center",
          justifyContent:"center", minHeight:220, cursor:"pointer", gap:10, color:C.txtMut }}>
          <div style={{ width:52, height:52, borderRadius:14, background:C.surface,
            border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Plus size={24} color={C.txtMut} strokeWidth={1.8} />
          </div>
          <div style={{ fontSize:14, fontWeight:600 }}>New Practical</div>
          <div style={{ fontSize:12 }}>Click to create</div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Questions
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Assignments sub-tab inside Questions
// ─────────────────────────────────────────────────────────────────────────────

const AssignmentsTab: React.FC = () => {
  const { C } = useTheme();

  // Form state
  const [practicalId,       setPracticalId]       = useState<PracticalId>("vanishing-cream");
  const [taskText,          setTaskText]           = useState("");
  const [targetGrams,       setTargetGrams]        = useState<string>("50");
  const [timeLimitMinutes,  setTimeLimitMinutes]   = useState<string>("45");
  const [codeExpiresAt,     setCodeExpiresAt]      = useState<string>("");    // datetime-local value
  const [assignments,       setAssignments]        = useState<Assignment[]>(() => getAllAssignments());
  const [copiedToken,       setCopiedToken]        = useState<string|null>(null);
  const [generated,         setGenerated]          = useState<Assignment|null>(null);

  // Reload from localStorage whenever the tab re-renders
  useEffect(() => { setAssignments(getAllAssignments()); }, []);

  const recipe     = BASE_RECIPES[practicalId];
  const grams      = parseFloat(targetGrams) || 0;
  const timeLimit  = parseInt(timeLimitMinutes, 10) || 0;
  const multiplier = grams > 0 ? +(grams / recipe.totalGrams).toFixed(4) : 0;

  const handleGenerate = () => {
    if (!taskText.trim() || grams <= 0) return;
    const assignment: Assignment = {
      token:            generateToken(practicalId),
      practicalId,
      title:            taskText.trim(),
      targetGrams:      grams,
      timeLimitMinutes: timeLimit,
      codeExpiresAt:    codeExpiresAt ? new Date(codeExpiresAt).toISOString() : null,
      createdAt:        new Date().toISOString(),
      createdBy:        "Teacher",
      uses:             0,
    };
    saveAssignment(assignment);
    setAssignments(getAllAssignments());
    setGenerated(assignment);
    setTaskText("");
    setTargetGrams("50");
    setTimeLimitMinutes("45");
    setCodeExpiresAt("");
  };

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(token).catch(() => {});
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleDelete = (token: string) => {
    deleteAssignment(token);
    setAssignments(getAllAssignments());
    if (generated?.token === token) setGenerated(null);
  };

  const lbl: React.CSSProperties = {
    color: C.txtMut, fontSize: 11, display: "block",
    marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.7,
  };

  const practicalName = practicalId === "vanishing-cream" ? "Vanishing Cream" : "Cold Cream";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

      {/* ── Create assignment ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 14, padding: 22, boxShadow: `0 1px 4px ${C.shadow}` }}>

        <div style={{ color: C.txtPri, fontWeight: 800, fontSize: 15, marginBottom: 18,
          display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={16} color={C.accent} strokeWidth={2} /> Create Volume Assignment
        </div>

        {/* Practical selector */}
        <label style={lbl}>Select Practical</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["vanishing-cream","cold-cream"] as PracticalId[]).map(id => (
            <button key={id} onClick={() => setPracticalId(id)} style={{
              flex: 1, padding: "9px 12px", borderRadius: 8, cursor: "pointer",
              fontWeight: 600, fontSize: 12, border: "none",
              background: practicalId === id ? C.accent : C.surface,
              color:      practicalId === id ? "white" : C.txtSec,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              {id === "vanishing-cream"
                ? <FlaskConical size={14} strokeWidth={2} />
                : <FlaskRound   size={14} strokeWidth={2} />}
              {id === "vanishing-cream" ? "Vanishing Cream" : "Cold Cream"}
            </button>
          ))}
        </div>

        {/* Target volume */}
        <label style={lbl}>Target Volume (grams of cream to prepare)</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <input
            type="number" min={1} max={500} value={targetGrams}
            onChange={e => setTargetGrams(e.target.value)}
            style={{ flex: 1, background: C.surface, border: `1px solid ${C.border2}`,
              color: C.txtPri, borderRadius: 8, padding: "9px 12px", fontSize: 18,
              fontWeight: 700, fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
          />
          <span style={{ color: C.txtMut, fontSize: 14 }}>g</span>
        </div>

        {/* Live multiplier preview */}
        {grams > 0 && (
          <div style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}44`,
            borderRadius: 8, padding: "8px 12px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 8 }}>
            <Calculator size={14} color={C.accent} />
            <span style={{ color: C.txtSec, fontSize: 12 }}>
              Multiplier =
              <strong style={{ color: C.accent, fontFamily: "monospace", marginLeft: 6 }}>
                {grams} ÷ {recipe.totalGrams} = {multiplier}
              </strong>
            </span>
          </div>
        )}

        {/* Reagent preview table */}
        {grams > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: "10px 12px", marginBottom: 16 }}>
            <div style={{ color: C.txtMut, fontSize: 10, textTransform: "uppercase",
              letterSpacing: 0.8, marginBottom: 8, fontWeight: 700 }}>Scaled Reagent Amounts</div>
            {recipe.reagents.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between",
                padding: "4px 0", borderBottom: i < recipe.reagents.length-1 ? `1px solid ${C.border}` : "none" }}>
                <span style={{ color: C.txtSec, fontSize: 12 }}>{r.name}</span>
                <span style={{ color: C.green, fontFamily: "monospace", fontSize: 12, fontWeight: 600 }}>
                  {+(r.amount * multiplier).toFixed(2)} {r.unit}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Time limit */}
        <label style={lbl}>Time Limit for Completion</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <input
            type="number" min={0} max={300} value={timeLimitMinutes}
            onChange={e => setTimeLimitMinutes(e.target.value)}
            style={{ width: 100, background: C.surface, border: `1px solid ${C.border2}`,
              color: C.txtPri, borderRadius: 8, padding: "9px 12px", fontSize: 18,
              fontWeight: 700, fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
          />
          <span style={{ color: C.txtMut, fontSize: 14 }}>minutes</span>
          <span style={{ color: C.txtMut, fontSize: 12 }}>(0 = no limit)</span>
        </div>
        {timeLimit > 0 && (
          <div style={{ background: `${C.amber}10`, border: `1px solid ${C.amber}44`,
            borderRadius: 8, padding: "8px 12px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={14} color={C.amber} />
            <span style={{ color: C.txtSec, fontSize: 12 }}>
              Students will have <strong style={{ color: C.amber }}>{timeLimit} minutes</strong> from
              the moment they enter the lab. Timer starts automatically on entry.
            </span>
          </div>
        )}

        {/* Code expiry date */}
        <label style={lbl}>Code Expiry Date &amp; Time (optional)</label>
        <div style={{ marginBottom: 6 }}>
          <input
            type="datetime-local"
            value={codeExpiresAt}
            onChange={e => setCodeExpiresAt(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            style={{ width: "100%", background: C.surface, border: `1px solid ${C.border2}`,
              color: C.txtPri, borderRadius: 8, padding: "9px 12px", fontSize: 13,
              outline: "none", boxSizing: "border-box", fontFamily: "inherit",
              colorScheme: "dark" }}
          />
        </div>
        {codeExpiresAt && (
          <div style={{ background: `${C.red}10`, border: `1px solid ${C.red}44`,
            borderRadius: 8, padding: "8px 12px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={14} color={C.red} />
            <span style={{ color: C.txtSec, fontSize: 12 }}>
              Code will stop working after{" "}
              <strong style={{ color: C.red }}>
                {new Date(codeExpiresAt).toLocaleString()}
              </strong>
            </span>
          </div>
        )}
        {!codeExpiresAt && (
          <div style={{ color: C.txtMut, fontSize: 11, marginBottom: 16 }}>
            Leave blank for a permanent code (no expiry).
          </div>
        )}

        {/* Task text */}
        <label style={lbl}>Assignment Question / Task Description</label>
        <TTextarea
          value={taskText}
          onChange={e => setTaskText(e.target.value)}
          rows={3}
          placeholder={`e.g. "Prepare ${grams || 50}g of ${practicalName}. Calculate the multiplier and use the correct scaled amounts of each reagent."`}
          style={{ marginBottom: 16 }}
        />

        <Btn
          label="Generate Assignment Code"
          Icon={Key}
          onClick={handleGenerate}
        />

        {/* Newly generated token spotlight */}
        {generated && (
          <div style={{ marginTop: 16, background: `${C.green}10`,
            border: `1px solid ${C.green}44`, borderRadius: 12, padding: 16 }}>
            <div style={{ color: C.green, fontWeight: 700, fontSize: 13, marginBottom: 10,
              display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle size={15} strokeWidth={2.5} /> Assignment Created!
            </div>
            <div style={{ color: C.txtSec, fontSize: 12, marginBottom: 6 }}>
              Share this code with your students:
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <code style={{ flex: 1, background: C.surface, border: `1px solid ${C.border2}`,
                color: C.accent, borderRadius: 8, padding: "10px 14px",
                fontSize: 20, fontWeight: 800, letterSpacing: 3, textAlign: "center",
                display: "block" }}>
                {generated.token}
              </code>
              <button onClick={() => handleCopy(generated.token)} style={{
                background: copiedToken === generated.token ? `${C.green}20` : C.surface,
                border: `1px solid ${copiedToken === generated.token ? C.green : C.border2}`,
                color: copiedToken === generated.token ? C.green : C.txtSec,
                borderRadius: 8, padding: "10px 12px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600,
              }}>
                {copiedToken === generated.token
                  ? <><CheckCircle size={13} strokeWidth={2.5} /> Copied</>
                  : <><Copy size={13} strokeWidth={2} /> Copy</>}
              </button>
            </div>
            <div style={{ color: C.txtMut, fontSize: 11, marginTop: 8 }}>
              Students enter this code on the home screen to start the assignment.
            </div>
          </div>
        )}
      </div>

      {/* ── Assignment list ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ color: C.txtPri, fontWeight: 700, fontSize: 14,
          display: "flex", alignItems: "center", gap: 8 }}>
          <Hash size={15} color={C.accent} strokeWidth={2} />
          Active Assignments ({assignments.length})
        </div>

        {assignments.length === 0 ? (
          <div style={{ background: C.card, border: `2px dashed ${C.border2}`,
            borderRadius: 12, padding: "32px 20px", textAlign: "center", color: C.txtMut }}>
            <Key size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>No assignments yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Generate a code on the left to get started.</div>
          </div>
        ) : (
          assignments.slice().reverse().map(a => {
            const rec    = BASE_RECIPES[a.practicalId];
            const mult   = +(a.targetGrams / rec.totalGrams).toFixed(4);
            const PIcon  = a.practicalId === "vanishing-cream" ? FlaskConical : FlaskRound;
            const pColor = a.practicalId === "vanishing-cream" ? "#2563eb" : "#7c3aed";
            return (
              <div key={a.token} style={{ background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: 16, boxShadow: `0 1px 3px ${C.shadow}` }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8,
                      background: `${pColor}18`, display: "flex",
                      alignItems: "center", justifyContent: "center" }}>
                      <PIcon size={18} color={pColor} strokeWidth={1.8} />
                    </div>
                    <div>
                      <code style={{ color: C.accent, fontWeight: 800, fontSize: 15,
                        letterSpacing: 2 }}>{a.token}</code>
                      <div style={{ color: C.txtMut, fontSize: 11, marginTop: 1 }}>
                        {a.practicalId === "vanishing-cream" ? "Vanishing Cream" : "Cold Cream"}
                        &nbsp;· Created {new Date(a.createdAt).toLocaleDateString()}
                        &nbsp;· {a.uses} use{a.uses !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => handleCopy(a.token)} style={{
                      background: copiedToken === a.token ? `${C.green}18` : "transparent",
                      border: `1px solid ${copiedToken === a.token ? C.green : C.border}`,
                      color: copiedToken === a.token ? C.green : C.txtMut,
                      borderRadius: 6, padding: "5px 8px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 4, fontSize: 12,
                    }}>
                      {copiedToken === a.token
                        ? <><CheckCircle size={12} strokeWidth={2.5} /> Copied</>
                        : <><Copy size={12} strokeWidth={2} /> Copy</>}
                    </button>
                    <button onClick={() => handleDelete(a.token)} style={{
                      background: `${C.red}10`, border: "none",
                      color: C.red, borderRadius: 6, padding: "5px 8px",
                      cursor: "pointer", display: "flex", alignItems: "center",
                    }}>
                      <Trash2 size={13} strokeWidth={2} />
                    </button>
                  </div>
                </div>

                {/* Task text */}
                <div style={{ color: C.txtSec, fontSize: 13, lineHeight: 1.6,
                  marginBottom: 10, borderLeft: `3px solid ${pColor}`,
                  paddingLeft: 10 }}>{a.title}</div>

                {/* Target + multiplier + time chips */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ background: `${C.green}12`, border: `1px solid ${C.green}44`,
                    color: C.green, borderRadius: 6, padding: "3px 10px",
                    fontSize: 11, fontWeight: 700 }}>
                    Target: {a.targetGrams} g
                  </span>
                  <span style={{ background: `${C.accent}12`, border: `1px solid ${C.accent}44`,
                    color: C.accent, borderRadius: 6, padding: "3px 10px",
                    fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>
                    × {mult}
                  </span>
                  <span style={{ background: C.surface, border: `1px solid ${C.border}`,
                    color: C.txtMut, borderRadius: 6, padding: "3px 10px", fontSize: 11 }}>
                    Base: {rec.totalGrams} g
                  </span>
                  {/* Session time limit */}
                  <span style={{
                    background: a.timeLimitMinutes > 0 ? `${C.amber}12` : C.surface,
                    border: `1px solid ${a.timeLimitMinutes > 0 ? `${C.amber}44` : C.border}`,
                    color: a.timeLimitMinutes > 0 ? C.amber : C.txtMut,
                    borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700,
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <Clock size={11} strokeWidth={2.5} />
                    {a.timeLimitMinutes > 0 ? `${a.timeLimitMinutes} min` : "No time limit"}
                  </span>
                  {/* Code expiry */}
                  {a.codeExpiresAt ? (
                    <span style={{
                      background: isCodeExpired(a) ? `${C.red}12` : `${C.purple}12`,
                      border: `1px solid ${isCodeExpired(a) ? `${C.red}44` : `${C.purple}44`}`,
                      color: isCodeExpired(a) ? C.red : C.purple,
                      borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700,
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                      <AlertCircle size={11} strokeWidth={2.5} />
                      {isCodeExpired(a)
                        ? "Code expired"
                        : `Expires ${new Date(a.codeExpiresAt).toLocaleDateString()}`}
                    </span>
                  ) : (
                    <span style={{ background: C.surface, border: `1px solid ${C.border}`,
                      color: C.txtMut, borderRadius: 6, padding: "3px 10px", fontSize: 11,
                      display: "flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle size={11} strokeWidth={2.5} color={C.green} />
                      Permanent code
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Questions section (tabbed: Assignments + Q&A Bank)
// ─────────────────────────────────────────────────────────────────────────────

const Questions: React.FC = () => {
  const { C } = useTheme();
  const [tab,          setTab]          = useState<"assignments"|"bank">("assignments");
  const [bankPractical,setBankPractical]= useState<QAPractical>("vanishing-cream");
  const [addingNew,    setAddingNew]    = useState(false);
  const [dragging,     setDragging]     = useState<string|null>(null);
  const [refresh,      setRefresh]      = useState(0);

  // Load questions from persistent store
  const questions = getAllQuestions().filter(q =>
    q.practicalId === bankPractical || q.practicalId === "all"
  );

  const [newQ, setNewQ] = useState<{
    text:string; type:"mcq"|"short"; points:number;
    options:string[]; correctAnswer:string; practicalId:QAPractical;
  }>({ text:"", type:"mcq", points:2, options:["","","",""], correctAnswer:"", practicalId:bankPractical });

  const totalPts = questions.reduce((s,q) => s+q.points, 0);

  const deleteQ = (id:string) => { deleteQuestion(id); setRefresh(r=>r+1); };

  const addQ = () => {
    if (!newQ.text.trim()) return;
    if (newQ.type === "mcq") {
      const validOpts = newQ.options.filter(Boolean);
      if (validOpts.length < 2) return;
      if (!newQ.correctAnswer) return;
    }
    const q: QAQuestion = {
      id:            `qab_${Date.now()}`,
      practicalId:   newQ.practicalId,
      text:          newQ.text.trim(),
      type:          newQ.type,
      options:       newQ.type === "mcq" ? newQ.options.filter(Boolean) : [],
      correctAnswer: newQ.correctAnswer.trim(),
      points:        newQ.points,
      createdAt:     new Date().toISOString(),
      createdBy:     "Teacher",
    };
    saveQuestion(q);
    setRefresh(r=>r+1);
    setNewQ({ text:"", type:"mcq", points:2, options:["","","",""], correctAnswer:"", practicalId:newQ.practicalId });
    setAddingNew(false);
  };

  const typeColor = { mcq:C.accent, short:C.green };

  // Answer stats for each question
  const allAnswers = getAllAnswers();
  const answerCount = (qid:string) => allAnswers.filter(a => a.questionId === qid).length;
  const correctCount = (qid:string) => allAnswers.filter(a => a.questionId === qid && a.isCorrect).length;

  return (
    <div>
      <SectionHeading
        title="Assignments & Q&A Bank"
        sub="Create volume-based assignments, or build a Q&A question bank for each practical."
        action={tab === "bank" ? <Btn label="Add Question" Icon={Plus} onClick={() => setAddingNew(true)} /> : undefined}
      />

      {/* Tab switcher */}
      <div style={{ display:"flex", gap:4, marginBottom:24,
        background:C.surface, padding:4, borderRadius:10,
        width:"fit-content", border:`1px solid ${C.border}` }}>
        {([
          { id:"assignments", label:"Volume Assignments", Icon:Key          },
          { id:"bank",        label:"Q&A Bank",           Icon:ClipboardList },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:"8px 16px", borderRadius:8, cursor:"pointer", border:"none",
            fontWeight:600, fontSize:13,
            background: tab===t.id ? C.accent : "transparent",
            color:      tab===t.id ? "white"  : C.txtSec,
            display:"flex", alignItems:"center", gap:6, transition:"background .15s",
          }}>
            <t.Icon size={14} strokeWidth={2} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "assignments" && <AssignmentsTab />}

      {tab === "bank" && (
        <div>
          {/* Practical selector */}
          <div style={{ display:"flex", gap:8, marginBottom:20 }}>
            {([
              { id:"vanishing-cream", label:"Vanishing Cream", Icon:FlaskConical, color:"#2563eb" },
              { id:"cold-cream",      label:"Cold Cream",      Icon:FlaskRound,   color:"#7c3aed" },
              { id:"all",             label:"All Practicals",  Icon:Beaker,       color:C.green   },
            ] as {id:QAPractical;label:string;Icon:LucideIcon;color:string}[]).map(p => (
              <button key={p.id} onClick={() => { setBankPractical(p.id); setRefresh(r=>r+1); }}
                style={{ padding:"8px 16px", borderRadius:8, cursor:"pointer",
                  fontWeight:600, fontSize:12, border:"none",
                  background: bankPractical===p.id ? p.color : C.card,
                  color: bankPractical===p.id ? "white" : C.txtSec,
                  display:"flex", alignItems:"center", gap:6 }}>
                <p.Icon size={13} strokeWidth={2} /> {p.label}
              </button>
            ))}
          </div>

          {/* Question list */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <span style={{ color:C.txtSec, fontSize:13 }}>
              {questions.length} question{questions.length!==1?"s":""} · {totalPts} total pts
            </span>
          </div>

          {questions.length === 0 && !addingNew && (
            <div style={{ background:C.card, border:`2px dashed ${C.border2}`, borderRadius:12,
              padding:"32px 20px", textAlign:"center", color:C.txtMut, marginBottom:14 }}>
              <ClipboardList size={30} style={{ marginBottom:8, opacity:0.3 }} />
              <div style={{ fontSize:13 }}>No questions yet. Click "Add Question" to create one.</div>
            </div>
          )}

          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {questions.map((q,i) => {
              const ac = answerCount(q.id);
              const cc = correctCount(q.id);
              return (
                <div key={q.id} draggable
                  onDragStart={() => setDragging(q.id)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => setDragging(null)}
                  style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12,
                    padding:"14px 16px", display:"flex", gap:14, alignItems:"flex-start",
                    opacity: dragging===q.id ? 0.4 : 1, boxShadow:`0 1px 3px ${C.shadow}` }}>
                  <div style={{ color:C.txtMut, marginTop:2, cursor:"grab", flexShrink:0 }}>
                    <GripVertical size={16} strokeWidth={1.8} />
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
                      <span style={{ color:C.txtMut, fontSize:12 }}>Q{i+1}</span>
                      <span style={{ background:`${typeColor[q.type]}18`, color:typeColor[q.type],
                        borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700 }}>
                        {q.type === "mcq" ? "Multiple Choice" : "Short Answer"}
                      </span>
                      <span style={{ color:C.txtMut, fontSize:12 }}>{q.points} pt{q.points>1?"s":""}</span>
                      {/* Stats */}
                      {ac > 0 && (
                        <span style={{ color:C.txtMut, fontSize:11, marginLeft:"auto" }}>
                          {ac} answered · {q.type==="mcq" ? `${cc}/${ac} correct` : "pending review"}
                        </span>
                      )}
                    </div>
                    <div style={{ color:C.txtPri, fontSize:13, lineHeight:1.6, marginBottom:8 }}>{q.text}</div>

                    {/* MCQ options with correct highlighted */}
                    {q.type === "mcq" && q.options.length > 0 && (
                      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                        {q.options.map((opt, oi) => {
                          const isCorrect = opt === q.correctAnswer;
                          return (
                            <div key={oi} style={{
                              display:"flex", alignItems:"center", gap:8,
                              padding:"6px 10px", borderRadius:7,
                              background: isCorrect ? `${C.green}12` : C.surface,
                              border: `1px solid ${isCorrect ? `${C.green}44` : C.border}`,
                            }}>
                              <span style={{
                                width:20, height:20, borderRadius:"50%", flexShrink:0,
                                background: isCorrect ? C.green : C.border2,
                                display:"flex", alignItems:"center", justifyContent:"center",
                              }}>
                                {isCorrect
                                  ? <CheckCircle size={13} color="white" strokeWidth={3} />
                                  : <span style={{ color:C.txtMut, fontSize:10, fontWeight:700 }}>
                                      {String.fromCharCode(65+oi)}
                                    </span>}
                              </span>
                              <span style={{ color: isCorrect ? C.green : C.txtSec, fontSize:12,
                                fontWeight: isCorrect ? 700 : 400 }}>
                                {opt}
                              </span>
                              {isCorrect && (
                                <span style={{ marginLeft:"auto", color:C.green, fontSize:10,
                                  fontWeight:700, textTransform:"uppercase", letterSpacing:0.5 }}>
                                  Correct
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Short answer model */}
                    {q.type === "short" && q.correctAnswer && (
                      <div style={{ background:`${C.purple}10`, border:`1px solid ${C.purple}44`,
                        borderRadius:8, padding:"7px 12px", fontSize:12, color:C.purple, marginTop:4 }}>
                        <strong>Model answer:</strong> {q.correctAnswer}
                      </div>
                    )}
                  </div>
                  <button onClick={() => deleteQ(q.id)}
                    style={{ background:`${C.red}10`, border:"none", color:C.red,
                      borderRadius:6, padding:"5px 8px", cursor:"pointer",
                      display:"flex", alignItems:"center", flexShrink:0 }}>
                    <Trash2 size={13} strokeWidth={2} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add question form */}
          {addingNew && (
            <div style={{ marginTop:14, background:C.card, border:`1px solid ${C.accent}55`,
              borderRadius:14, padding:22, boxShadow:`0 2px 8px ${C.shadow}` }}>
              <div style={{ color:C.txtPri, fontWeight:800, fontSize:15, marginBottom:16 }}>
                New Question
              </div>

              {/* Type + practical + points row */}
              <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
                {(["mcq","short"] as const).map(t => (
                  <button key={t} type="button" onClick={() => setNewQ(p => ({ ...p, type:t, correctAnswer:"" }))}
                    style={{ padding:"7px 16px", borderRadius:8, cursor:"pointer",
                      fontSize:12, fontWeight:600, border:"none",
                      background: newQ.type===t ? C.accent : C.surface,
                      color: newQ.type===t ? "white" : C.txtSec }}>
                    {t === "mcq" ? "Multiple Choice" : "Short Answer"}
                  </button>
                ))}
                <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
                  <label style={{ color:C.txtMut, fontSize:12 }}>Points</label>
                  <input type="number" min={1} value={newQ.points}
                    onChange={e => setNewQ(p => ({ ...p, points:+e.target.value }))}
                    style={{ width:60, background:C.surface, border:`1px solid ${C.border2}`,
                      color:C.txtPri, borderRadius:6, padding:"5px 8px", fontSize:13, textAlign:"center" }} />
                </div>
              </div>

              {/* Practical scope */}
              <div style={{ marginBottom:14 }}>
                <label style={{ color:C.txtMut, fontSize:11, fontWeight:700, display:"block",
                  marginBottom:6, textTransform:"uppercase", letterSpacing:0.7 }}>Practical</label>
                <div style={{ display:"flex", gap:6 }}>
                  {(["vanishing-cream","cold-cream","all"] as QAPractical[]).map(p => (
                    <button key={p} type="button"
                      onClick={() => setNewQ(prev => ({ ...prev, practicalId:p }))}
                      style={{ padding:"6px 12px", borderRadius:7, cursor:"pointer",
                        fontSize:11, fontWeight:600, border:"none",
                        background: newQ.practicalId===p ? C.accent : C.surface,
                        color: newQ.practicalId===p ? "white" : C.txtSec }}>
                      {p === "vanishing-cream" ? "Vanishing" : p === "cold-cream" ? "Cold Cream" : "All"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question text */}
              <label style={{ color:C.txtMut, fontSize:11, fontWeight:700, display:"block",
                marginBottom:6, textTransform:"uppercase", letterSpacing:0.7 }}>Question</label>
              <TTextarea placeholder="Enter your question…" value={newQ.text} rows={3}
                onChange={e => setNewQ(p => ({ ...p, text:e.target.value }))}
                style={{ marginBottom:14 }} />

              {/* MCQ options + correct answer */}
              {newQ.type === "mcq" && (
                <div style={{ marginBottom:14 }}>
                  <label style={{ color:C.txtMut, fontSize:11, fontWeight:700, display:"block",
                    marginBottom:8, textTransform:"uppercase", letterSpacing:0.7 }}>
                    Options — click the circle to mark the correct answer
                  </label>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {newQ.options.map((opt, oi) => {
                      const isCorrect = newQ.correctAnswer === opt && opt.trim() !== "";
                      return (
                        <div key={oi} style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <button type="button"
                            onClick={() => opt.trim() && setNewQ(p => ({ ...p, correctAnswer: opt }))}
                            title="Mark as correct answer"
                            style={{
                              width:28, height:28, borderRadius:"50%", border:"none",
                              flexShrink:0, cursor: opt.trim() ? "pointer" : "default",
                              background: isCorrect ? C.green : C.border2,
                              display:"flex", alignItems:"center", justifyContent:"center",
                              transition:"background .15s",
                            }}>
                            {isCorrect
                              ? <CheckCircle size={15} color="white" strokeWidth={3} />
                              : <span style={{ color:C.txtPri, fontSize:11, fontWeight:700 }}>
                                  {String.fromCharCode(65+oi)}
                                </span>}
                          </button>
                          <TInput
                            placeholder={`Option ${String.fromCharCode(65+oi)}`}
                            value={opt}
                            style={{ flex:1 }}
                            onChange={e => {
                              const opts = [...newQ.options];
                              const oldVal = opts[oi];
                              opts[oi] = e.target.value;
                              // If this was the correct answer, update it
                              const newCorrect = newQ.correctAnswer === oldVal ? e.target.value : newQ.correctAnswer;
                              setNewQ(p => ({ ...p, options:opts, correctAnswer:newCorrect }));
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  {!newQ.correctAnswer && newQ.options.some(Boolean) && (
                    <div style={{ color:C.amber, fontSize:12, marginTop:8,
                      display:"flex", alignItems:"center", gap:5 }}>
                      <AlertCircle size={13} /> Click the circle next to the correct option to mark it.
                    </div>
                  )}
                  {newQ.correctAnswer && (
                    <div style={{ color:C.green, fontSize:12, marginTop:8,
                      display:"flex", alignItems:"center", gap:5 }}>
                      <CheckCircle size={13} strokeWidth={2.5} /> Correct answer: <strong>{newQ.correctAnswer}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Short answer: model answer (optional) */}
              {newQ.type === "short" && (
                <div style={{ marginBottom:14 }}>
                  <label style={{ color:C.txtMut, fontSize:11, fontWeight:700, display:"block",
                    marginBottom:6, textTransform:"uppercase", letterSpacing:0.7 }}>
                    Model / Expected Answer <span style={{ color:C.txtMut, fontWeight:400 }}>(optional — shown to student after submit)</span>
                  </label>
                  <TTextarea
                    placeholder="e.g. O/W emulsion — oil droplets dispersed in water phase…"
                    value={newQ.correctAnswer} rows={2}
                    onChange={e => setNewQ(p => ({ ...p, correctAnswer:e.target.value }))}
                  />
                </div>
              )}

              <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:6 }}>
                <Btn label="Cancel"       Icon={RefreshCw} variant="ghost" small onClick={() => setAddingNew(false)} />
                <Btn label="Save Question" Icon={Save}      small onClick={addQ} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Students
// ─────────────────────────────────────────────────────────────────────────────

// Real students are read directly from the auth user store
const Students: React.FC = () => {
  const { C } = useTheme();
  const [search,      setSearch]      = useState("");
  const [refresh,     setRefresh]     = useState(0);
  const [showAdd,     setShowAdd]     = useState(false);
  const [newName,     setNewName]     = useState("");
  const [newEmail,    setNewEmail]    = useState("");
  const [newReg,      setNewReg]      = useState("");
  const [newPass,     setNewPass]     = useState("");
  const [addError,    setAddError]    = useState<string|null>(null);
  const [addOk,       setAddOk]       = useState(false);

  const allStudents = getAllRegisteredStudents();
  const filtered = allStudents.filter(u =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.regNumber ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const removeStudent = (id: string) => {
    const users = getAllUsers().filter(u => u.id !== id);
    localStorage.setItem("vlab_users", JSON.stringify(users));
    setRefresh(r => r + 1);
  };

  const resetForm = () => {
    setNewName(""); setNewEmail(""); setNewReg(""); setNewPass(""); setAddError(null);
  };

  const handleAddStudent = () => {
    setAddError(null);
    const result = registerUser({
      role: "student", fullName: newName, email: newEmail,
      password: newPass, regNumber: newReg,
    });
    if (!result.ok) { setAddError(result.error ?? "Failed"); return; }
    resetForm();
    setAddOk(true);
    setRefresh(r => r + 1);
    setTimeout(() => { setAddOk(false); setShowAdd(false); }, 2000);
  };

  const inp: React.CSSProperties = {
    width:"100%", background:C.surface, border:`1px solid ${C.border2}`,
    color:C.txtPri, borderRadius:8, padding:"9px 12px", fontSize:13,
    boxSizing:"border-box", outline:"none",
  };
  const lbl: React.CSSProperties = {
    color:C.txtMut, fontSize:11, fontWeight:700, display:"block",
    marginBottom:5, textTransform:"uppercase", letterSpacing:0.7,
  };

  return (
    <div>
      <SectionHeading
        title="Students"
        sub={`${allStudents.length} student${allStudents.length !== 1 ? "s" : ""} in the system.`}
        action={
          <div style={{ display:"flex", gap:8 }}>
            <Btn label="Add Student" Icon={UserPlus} small
              onClick={() => { resetForm(); setShowAdd(v => !v); }} />
            <Btn label="Refresh" Icon={RefreshCw} variant="ghost" small
              onClick={() => setRefresh(r => r + 1)} />
            <Btn label="Export CSV" Icon={Download} variant="ghost" small />
          </div>
        }
      />

      {/* ── Add Student inline form ── */}
      {showAdd && (
        <div style={{ background:C.card, border:`1px solid ${C.accent}55`,
          borderRadius:12, padding:"18px 20px", marginBottom:20,
          boxShadow:`0 2px 10px ${C.shadow}` }}>
          <div style={{ color:C.txtPri, fontWeight:800, fontSize:14, marginBottom:14,
            display:"flex", alignItems:"center", gap:8 }}>
            <UserPlus size={15} color={C.accent} strokeWidth={2} />
            Register New Student
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12, marginBottom:12 }}>
            <div>
              <label style={lbl}>Full Name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Amara Nkosi" style={inp} />
            </div>
            <div>
              <label style={lbl}>Reg Number</label>
              <input value={newReg} onChange={e => setNewReg(e.target.value)}
                placeholder="T24-001" style={inp} />
            </div>
            <div>
              <label style={lbl}>Email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder="student@school.edu" style={inp} />
            </div>
            <div>
              <label style={lbl}>Password (min 6 chars)</label>
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
                placeholder="••••••••" style={inp} />
            </div>
          </div>
          {addError && (
            <div style={{ color:"#f87171", fontSize:12, marginBottom:10,
              display:"flex", alignItems:"center", gap:6 }}>
              <AlertCircle size={13} /> {addError}
            </div>
          )}
          {addOk && (
            <div style={{ color:C.green, fontSize:12, marginBottom:10,
              display:"flex", alignItems:"center", gap:6 }}>
              <CheckCircle size={13} strokeWidth={2.5} /> Student account created successfully!
            </div>
          )}
          <div style={{ display:"flex", gap:8 }}>
            <Btn label="Create Student" Icon={UserPlus} small onClick={handleAddStudent} />
            <Btn label="Cancel" variant="ghost" small Icon={RefreshCw}
              onClick={() => { setShowAdd(false); resetForm(); }} />
          </div>
          <div style={{ color:C.txtMut, fontSize:11, marginTop:10 }}>
            The student will log in with the email and password you set. Share their credentials with them directly.
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ display:"flex", gap:10, marginBottom:18 }}>
        <div style={{ flex:1, position:"relative" }}>
          <span style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)",
            pointerEvents:"none", display:"flex" }}>
            <Search size={15} color={C.txtMut} />
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or reg number…"
            style={{ width:"100%", background:C.card, border:`1px solid ${C.border}`,
              color:C.txtPri, borderRadius:8, padding:"9px 12px 9px 34px",
              fontSize:13, boxSizing:"border-box", outline:"none" }} />
        </div>
      </div>

      {allStudents.length === 0 ? (
        <div style={{ background:C.card, border:`2px dashed ${C.border2}`, borderRadius:14,
          padding:"48px 20px", textAlign:"center" }}>
          <Users size={36} color={C.txtMut} style={{ marginBottom:12, opacity:0.4 }} />
          <div style={{ color:C.txtPri, fontWeight:700, fontSize:15, marginBottom:6 }}>
            No students yet
          </div>
          <div style={{ color:C.txtMut, fontSize:13 }}>
            Add students above or ask them to self-register on the app.
          </div>
        </div>
      ) : (
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
          overflow:"hidden", boxShadow:`0 1px 4px ${C.shadow}` }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <TableHead cols={["Student","Email","Reg Number","Joined",""]} />
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} style={{ background: i%2===0 ? "transparent" : `${C.surface}88`,
                  borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:"12px 14px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <Avatar name={u.fullName} />
                      <span style={{ color:C.txtPri, fontSize:13, fontWeight:600 }}>{u.fullName}</span>
                    </div>
                  </td>
                  <td style={{ padding:"12px 14px", color:C.txtSec, fontSize:12 }}>{u.email}</td>
                  <td style={{ padding:"12px 14px" }}>
                    {u.regNumber
                      ? <code style={{ background:`${C.green}12`, color:C.green,
                          border:`1px solid ${C.green}44`, borderRadius:5,
                          padding:"2px 8px", fontSize:12, fontWeight:700 }}>
                          {u.regNumber}
                        </code>
                      : <span style={{ color:C.txtMut, fontSize:12 }}>—</span>}
                  </td>
                  <td style={{ padding:"12px 14px", color:C.txtMut, fontSize:12 }}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding:"12px 14px" }}>
                    <div style={{ display:"flex", gap:6 }}>
                      <span style={{ background:`${C.green}12`, border:`1px solid ${C.green}44`,
                        color:C.green, borderRadius:20, padding:"2px 10px",
                        fontSize:11, fontWeight:700 }}>Active</span>
                      <button onClick={() => removeStudent(u.id)}
                        style={{ background:"rgba(239,68,68,0.1)", border:"none", color:"#f87171",
                          borderRadius:6, padding:"5px 8px", cursor:"pointer",
                          display:"flex", alignItems:"center" }}>
                        <Trash2 size={13} strokeWidth={2} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding:32, textAlign:"center", color:C.txtMut }}>
              No students match your search.
            </div>
          )}
        </div>
      )}
      <div style={{ color:C.txtMut, fontSize:12, marginTop:10 }}>
        Showing {filtered.length} of {allStudents.length} registered students
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────────────────────────────────────

const Analytics: React.FC = () => {
  const { C } = useTheme();
  const [pFilter, setPFilter] = useState("all");

  const allSubs = getAllSubmissions();
  const filtered = pFilter === "all" ? allSubs : allSubs.filter(s => s.practicalId === pFilter);
  const stats    = getStats();

  // Per-practical averages from real data
  const vcSubs = allSubs.filter(s => s.practicalId === "vanishing-cream");
  const ccSubs = allSubs.filter(s => s.practicalId === "cold-cream");
  const vcAvg  = vcSubs.length > 0 ? Math.round(vcSubs.reduce((a,s) => a+s.scorePct,0)/vcSubs.length) : 0;
  const ccAvg  = ccSubs.length > 0 ? Math.round(ccSubs.reduce((a,s) => a+s.scorePct,0)/ccSubs.length) : 0;

  // Score distribution from real data
  const ranges = [
    { range:"90–100", min:90, max:101, color:C.green  },
    { range:"80–89",  min:80, max:90,  color:"#4ade80" },
    { range:"70–79",  min:70, max:80,  color:C.amber  },
    { range:"60–69",  min:60, max:70,  color:"#fb923c" },
    { range:"< 60",   min:0,  max:60,  color:C.red    },
  ].map(r => ({ ...r, count: filtered.filter(s => s.scorePct >= r.min && s.scorePct < r.max).length }));
  const maxC = Math.max(...ranges.map(d => d.count), 1);

  // Top performers / needs attention from real submissions
  const studentAvgs = new Map<string, { name:string; reg?:string; scores:number[] }>();
  filtered.forEach(s => {
    const cur = studentAvgs.get(s.studentId) ?? { name:s.studentName, reg:s.studentReg, scores:[] };
    cur.scores.push(s.scorePct);
    studentAvgs.set(s.studentId, cur);
  });
  const studentList = Array.from(studentAvgs.entries()).map(([id,v]) => ({
    id, name:v.name, reg:v.reg,
    avg: Math.round(v.scores.reduce((a,b)=>a+b,0)/v.scores.length),
    count: v.scores.length,
  }));
  const topStudents  = studentList.filter(s => s.avg >= 80).sort((a,b) => b.avg-a.avg);
  const needsHelp    = studentList.filter(s => s.avg < 70).sort((a,b) => a.avg-b.avg);

  return (
    <div>
      <SectionHeading title="Analytics" sub="Real performance data from student lab sessions."
        action={<Btn label="Refresh" Icon={RefreshCw} variant="ghost" small onClick={() => setPFilter(f=>f)} />} />

      <div style={{ display:"flex", gap:8, marginBottom:24 }}>
        {["all","vanishing-cream","cold-cream"].map(f => (
          <button key={f} onClick={() => setPFilter(f)} style={{
            padding:"7px 16px", borderRadius:8, cursor:"pointer", fontWeight:600,
            fontSize:12, border:"none",
            background: pFilter===f ? C.accent : C.card,
            color: pFilter===f ? "white" : C.txtSec,
          }}>{f==="all"?"All Practicals":f.replace("-"," ").replace(/\b\w/g,(c:string)=>c.toUpperCase())}</button>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:28 }}>
        <StatCard label="Total Submissions" value={filtered.length} sub={`${stats.todayCount} today`} Icon={ClipboardCheck} accent={C.accent} />
        <StatCard label="Class Average"     value={filtered.length>0 ? `${Math.round(filtered.reduce((a,s)=>a+s.scorePct,0)/filtered.length)}%` : "—"} sub="All evaluated sessions" Icon={TrendingUp} accent={C.green} />
        <StatCard label="Pass Rate"         value={filtered.length>0 ? `${Math.round(filtered.filter(s=>s.result==="PASS").length/filtered.length*100)}%` : "—"} sub="PASS result" Icon={CheckCircle} accent="#7c3aed" />
        <StatCard label="Avg Duration"      value={stats.avgDur > 0 ? `${stats.avgDur} min` : "—"} sub="Per session" Icon={Clock} accent={C.amber} />
      </div>

      {allSubs.length === 0 ? (
        <div style={{ background:C.card, border:`2px dashed ${C.border2}`, borderRadius:14,
          padding:"48px 20px", textAlign:"center" }}>
          <BarChart2 size={36} color={C.txtMut} style={{ marginBottom:12, opacity:0.3 }} />
          <div style={{ color:C.txtPri, fontWeight:700, fontSize:15, marginBottom:6 }}>No data yet</div>
          <div style={{ color:C.txtMut, fontSize:13 }}>Analytics will populate as students evaluate their practicals.</div>
        </div>
      ) : (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
            {/* Score by practical */}
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
              padding:20, boxShadow:`0 1px 4px ${C.shadow}` }}>
              <div style={{ color:C.txtPri, fontWeight:700, fontSize:14, marginBottom:18,
                display:"flex", alignItems:"center", gap:8 }}>
                <BarChart2 size={16} color={C.accent} strokeWidth={2} /> Average Score by Practical
              </div>
              {[
                { label:"Vanishing Cream", score:vcAvg, color:"#2563eb", count:vcSubs.length },
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
                  <div style={{ color:C.txtMut, fontSize:11, marginTop:4 }}>{d.count} submission{d.count!==1?"s":""}</div>
                </div>
              ))}
            </div>

            {/* Score distribution */}
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
              padding:20, boxShadow:`0 1px 4px ${C.shadow}` }}>
              <div style={{ color:C.txtPri, fontWeight:700, fontSize:14, marginBottom:18,
                display:"flex", alignItems:"center", gap:8 }}>
                <Activity size={16} color={C.accent} strokeWidth={2} /> Score Distribution
              </div>
              <div style={{ display:"flex", gap:10, alignItems:"flex-end", height:120 }}>
                {ranges.map(d => (
                  <div key={d.range} style={{ flex:1, display:"flex", flexDirection:"column",
                    alignItems:"center", gap:4 }}>
                    <span style={{ color:C.txtSec, fontSize:11 }}>{d.count}</span>
                    <div style={{ width:"100%", borderRadius:"4px 4px 0 0",
                      background: d.count>0 ? d.color : C.border,
                      height: `${(d.count/maxC)*90}px`,
                      minHeight: d.count>0 ? 8 : 4 }} />
                    <span style={{ color:C.txtMut, fontSize:10, textAlign:"center", lineHeight:1.2 }}>{d.range}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top performers / needs attention */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
            {[
              { title:"Top Performers",  list:topStudents, color:C.green, Icon:Award        },
              { title:"Needs Attention", list:needsHelp,   color:C.amber, Icon:AlertCircle  },
            ].map(({ title, list, color, Icon:Ic }) => (
              <div key={title} style={{ background:C.card, border:`1px solid ${C.border}`,
                borderRadius:14, padding:18, boxShadow:`0 1px 4px ${C.shadow}` }}>
                <div style={{ color:C.txtPri, fontWeight:700, fontSize:14, marginBottom:14,
                  display:"flex", alignItems:"center", gap:8 }}>
                  <Ic size={15} color={color} strokeWidth={2} /> {title}
                </div>
                {list.length===0
                  ? <div style={{ color:C.txtMut, fontSize:13 }}>None at this time.</div>
                  : list.map(s => (
                    <div key={s.id} style={{ display:"flex", justifyContent:"space-between",
                      alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <Avatar name={s.name} size={28} />
                        <div>
                          <div style={{ color:C.txtSec, fontSize:13 }}>{s.name}</div>
                          {s.reg && <div style={{ color:C.txtMut, fontSize:10 }}>{s.reg} · {s.count} eval{s.count!==1?"s":""}</div>}
                        </div>
                      </div>
                      <span style={{ color, fontWeight:700, fontSize:14 }}>{s.avg}%</span>
                    </div>
                  ))
                }
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Submissions
// ─────────────────────────────────────────────────────────────────────────────

const Submissions: React.FC = () => {
  const { C } = useTheme();
  const [practicalFilter, setPracticalFilter] = useState("all");
  const [resultFilter,    setResultFilter]    = useState<"all"|"PASS"|"AVERAGE"|"FAIL">("all");
  const [modeFilter,      setModeFilter]      = useState<"all"|"assignment"|"practice">("all");
  const [search,          setSearch]          = useState("");
  const [refresh,         setRefresh]         = useState(0);

  const allSubs = getAllSubmissions()
    .sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  const filtered = allSubs.filter(s =>
    (practicalFilter === "all" || s.practicalId === practicalFilter) &&
    (resultFilter    === "all" || s.result      === resultFilter)    &&
    (modeFilter      === "all" || s.mode        === modeFilter)      &&
    (s.studentName.toLowerCase().includes(search.toLowerCase()) ||
     (s.studentReg ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <SectionHeading title="Submissions" sub="All evaluated lab sessions from real students."
        action={<Btn label="Refresh" Icon={RefreshCw} variant="ghost" small onClick={() => setRefresh(r=>r+1)} />} />

      {/* Filters */}
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        <div style={{ position:"relative", flex:1, minWidth:200 }}>
          <span style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)",
            pointerEvents:"none", display:"flex" }}>
            <Search size={15} color={C.txtMut} />
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or reg number…"
            style={{ width:"100%", background:C.card, border:`1px solid ${C.border}`,
              color:C.txtPri, borderRadius:8, padding:"8px 12px 8px 34px",
              fontSize:13, boxSizing:"border-box", outline:"none" }} />
        </div>
        <select value={practicalFilter} onChange={e => setPracticalFilter(e.target.value)}
          style={{ background:C.card, border:`1px solid ${C.border}`, color:C.txtSec,
            borderRadius:8, padding:"8px 12px", fontSize:13, cursor:"pointer", outline:"none" }}>
          <option value="all">All Practicals</option>
          <option value="vanishing-cream">Vanishing Cream</option>
          <option value="cold-cream">Cold Cream</option>
        </select>
        {(["all","PASS","AVERAGE","FAIL"] as const).map(f => (
          <button key={f} onClick={() => setResultFilter(f)} style={{
            padding:"7px 12px", borderRadius:8, cursor:"pointer", fontWeight:600,
            fontSize:12, border:"none",
            background: resultFilter===f ? C.accent : C.card,
            color: resultFilter===f ? "white" : C.txtSec,
          }}>{f === "all" ? "All Results" : f}</button>
        ))}
        {(["all","assignment","practice"] as const).map(f => (
          <button key={f} onClick={() => setModeFilter(f)} style={{
            padding:"7px 12px", borderRadius:8, cursor:"pointer", fontWeight:600,
            fontSize:12, border:"none", textTransform:"capitalize",
            background: modeFilter===f ? `${C.purple}55` : C.card,
            color: modeFilter===f ? "white" : C.txtSec,
          }}>{f === "all" ? "All Modes" : f}</button>
        ))}
      </div>

      {allSubs.length === 0 ? (
        <div style={{ background:C.card, border:`2px dashed ${C.border2}`, borderRadius:14,
          padding:"48px 20px", textAlign:"center" }}>
          <ClipboardCheck size={36} color={C.txtMut} style={{ marginBottom:12, opacity:0.3 }} />
          <div style={{ color:C.txtPri, fontWeight:700, fontSize:15, marginBottom:6 }}>No submissions yet</div>
          <div style={{ color:C.txtMut, fontSize:13 }}>
            Submissions appear here automatically when a student clicks "Evaluate Result" in the lab.
          </div>
        </div>
      ) : (
        <>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
            overflow:"hidden", boxShadow:`0 1px 4px ${C.shadow}` }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <TableHead cols={["Student","Practical","Mode","Score","Result","pH","Viscosity","Duration","Submitted"]} />
              <tbody>
                {filtered.map((s,i) => (
                  <tr key={s.id} style={{ background: i%2===0?"transparent":`${C.surface}88`,
                    borderBottom:`1px solid ${C.border}` }}>
                    <td style={{ padding:"11px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <Avatar name={s.studentName} size={28} />
                        <div>
                          <div style={{ color:C.txtPri, fontSize:13 }}>{s.studentName}</div>
                          {s.studentReg && <div style={{ color:C.txtMut, fontSize:10 }}>{s.studentReg}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:"11px 14px", color:C.txtSec, fontSize:12 }}>
                      {s.practicalId === "vanishing-cream" ? "Vanishing Cream" : "Cold Cream"}
                    </td>
                    <td style={{ padding:"11px 14px" }}>
                      <span style={{ background: s.mode==="assignment" ? `${C.accent}18` : C.surface,
                        color: s.mode==="assignment" ? C.accent : C.txtMut,
                        border:`1px solid ${s.mode==="assignment" ? `${C.accent}44` : C.border}`,
                        borderRadius:20, padding:"2px 8px", fontSize:11, fontWeight:700,
                        textTransform:"capitalize" }}>{s.mode}</span>
                    </td>
                    <td style={{ padding:"11px 14px", minWidth:120 }}><ScoreBar score={s.scorePct} /></td>
                    <td style={{ padding:"11px 14px" }}>{resultBadge(s.result, C)}</td>
                    <td style={{ padding:"11px 14px", color:C.txtSec, fontSize:12, fontFamily:"monospace" }}>
                      {s.ph.toFixed(2)}
                    </td>
                    <td style={{ padding:"11px 14px", color:C.txtSec, fontSize:12, fontFamily:"monospace" }}>
                      {s.viscosity} cP
                    </td>
                    <td style={{ padding:"11px 14px", color:C.txtMut, fontSize:12 }}>
                      {s.durationSec > 0 ? `${Math.round(s.durationSec/60)} min` : "—"}
                    </td>
                    <td style={{ padding:"11px 14px", color:C.txtMut, fontSize:11 }}>
                      {new Date(s.submittedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ padding:32, textAlign:"center", color:C.txtMut }}>No submissions match the filters.</div>
            )}
          </div>
          <div style={{ color:C.txtMut, fontSize:12, marginTop:10 }}>
            {filtered.length} of {allSubs.length} submissions
          </div>
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Announcements
// ─────────────────────────────────────────────────────────────────────────────

const Announcements: React.FC = () => {
  const { C } = useTheme();
  const [list,   setList]   = useState<StoredAnnouncement[]>(() => getAllAnnouncements());
  const [title,  setTitle]  = useState("");
  const [body,   setBody]   = useState("");
  const [target, setTarget] = useState("All Students");

  const reload = () => setList(getAllAnnouncements());

  const send = () => {
    if (!title.trim() || !body.trim()) return;
    const a: StoredAnnouncement = {
      id:     `ann_${Date.now()}`,
      title:  title.trim(),
      body:   body.trim(),
      target,
      sentAt: new Date().toLocaleString(),
      read:   0,
      total:  getAllRegisteredStudents().length,
    };
    saveAnnouncement(a);
    reload();
    setTitle(""); setBody("");
  };

  const handleDelete = (id: string) => { deleteAnnouncement(id); reload(); };

  const lbl: React.CSSProperties = { color:C.txtMut, fontSize:11, display:"block",
    marginBottom:5, textTransform:"uppercase", letterSpacing:0.7 };

  return (
    <div>
      <SectionHeading title="Announcements" sub="Broadcast messages to students."
        action={<Btn label="Refresh" Icon={RefreshCw} variant="ghost" small onClick={reload} />} />

      <div style={{ display:"grid", gridTemplateColumns:"1fr 380px", gap:20, alignItems:"start" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {list.length === 0 && (
            <div style={{ background:C.card, border:`2px dashed ${C.border2}`, borderRadius:12,
              padding:"32px 20px", textAlign:"center", color:C.txtMut }}>
              <Megaphone size={28} style={{ marginBottom:8, opacity:0.3 }} />
              <div style={{ fontSize:13 }}>No announcements yet. Compose and send one on the right.</div>
            </div>
          )}
          {list.map(a => (
            <div key={a.id} style={{ background:C.card, border:`1px solid ${C.border}`,
              borderRadius:12, padding:18, boxShadow:`0 1px 4px ${C.shadow}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
                gap:10, marginBottom:8 }}>
                <div>
                  <div style={{ color:C.txtPri, fontWeight:700, fontSize:14 }}>{a.title}</div>
                  <div style={{ color:C.txtMut, fontSize:11, marginTop:2 }}>{a.sentAt} · To: {a.target}</div>
                </div>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <span style={{ background:`${C.green}12`, border:`1px solid ${C.green}44`,
                    borderRadius:8, padding:"4px 8px", color:C.green, fontSize:11, fontWeight:600 }}>
                    {a.total} recipients
                  </span>
                  <button onClick={() => handleDelete(a.id)} style={{
                    background:`${C.red}10`, border:"none", color:C.red,
                    borderRadius:6, padding:"4px 7px", cursor:"pointer",
                    display:"flex", alignItems:"center" }}>
                    <Trash2 size={12} strokeWidth={2} />
                  </button>
                </div>
              </div>
              <p style={{ color:C.txtSec, fontSize:13, margin:0, lineHeight:1.6 }}>{a.body}</p>
            </div>
          ))}
        </div>

        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
          padding:20, position:"sticky", top:20, boxShadow:`0 1px 4px ${C.shadow}` }}>
          <div style={{ color:C.txtPri, fontWeight:700, fontSize:15, marginBottom:18,
            display:"flex", alignItems:"center", gap:8 }}>
            <Megaphone size={16} color={C.accent} strokeWidth={2} /> New Announcement
          </div>
          <label style={lbl}>Title</label>
          <TInput value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Lab opens tomorrow" style={{ marginBottom:14 }} />
          <label style={lbl}>Target Audience</label>
          <select value={target} onChange={e => setTarget(e.target.value)}
            style={{ width:"100%", background:C.surface, border:`1px solid ${C.border2}`,
              color:C.txtSec, borderRadius:8, padding:"9px 12px", fontSize:13,
              cursor:"pointer", outline:"none", marginBottom:14, boxSizing:"border-box" }}>
            <option>All Students</option>
            <option>Vanishing Cream Group</option>
            <option>Cold Cream Group</option>
          </select>
          <label style={lbl}>Message</label>
          <TTextarea value={body} onChange={e => setBody(e.target.value)}
            placeholder="Write your message…" rows={5} style={{ marginBottom:16 }} />
          <Btn label="Send Announcement" Icon={Send} onClick={send} />
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────────

const SettingsPanel: React.FC = () => {
  const { C } = useTheme();
  const stored = loadSettings();

  const [timeLimit,   setTimeLimit]   = useState<number>(stored.timeLimit   ?? 90);
  const [maxAttempts, setMaxAttempts] = useState<number>(stored.maxAttempts ?? 2);
  const [passScore,   setPassScore]   = useState<number>(stored.passScore   ?? 60);
  const [autoGrade,   setAutoGrade]   = useState<boolean>(stored.autoGrade  ?? true);
  const [emailAlerts, setEmailAlerts] = useState<boolean>(stored.emailAlerts ?? true);
  const [regOpen,     setRegOpen]     = useState<boolean>(stored.regOpen    ?? true);
  const [teacherEmail,setTeacherEmail]= useState<string>(stored.teacherEmail ?? "teacher@school.edu");
  const [saved,       setSaved]       = useState(false);

  const save = () => {
    persistSettings({ timeLimit, maxAttempts, passScore, autoGrade, emailAlerts, regOpen, teacherEmail });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const Toggle: React.FC<{ v:boolean; set:(x:boolean)=>void }> = ({ v, set }) => (
    <div onClick={() => set(!v)} style={{ width:44, height:24, borderRadius:12, cursor:"pointer",
      background: v ? C.accent : C.border2, position:"relative", transition:"background .2s", flexShrink:0 }}>
      <div style={{ width:18, height:18, borderRadius:"50%", background:"white", position:"absolute",
        top:3, left: v ? 23 : 3, transition:"left .2s", boxShadow:"0 1px 3px rgba(0,0,0,0.25)" }} />
    </div>
  );

  const Row: React.FC<{ label:string; sub?:string; children:React.ReactNode }> = ({ label, sub, children }) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"14px 0", borderBottom:`1px solid ${C.border}`, gap:16 }}>
      <div>
        <div style={{ color:C.txtPri, fontSize:13, fontWeight:600 }}>{label}</div>
        {sub && <div style={{ color:C.txtMut, fontSize:12, marginTop:2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );

  const Block: React.FC<{ TitleIcon:LucideIcon; title:string; children:React.ReactNode }> =
    ({ TitleIcon, title, children }) => (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
      padding:20, marginBottom:18, boxShadow:`0 1px 4px ${C.shadow}` }}>
      <div style={{ color:C.txtPri, fontWeight:700, fontSize:14, marginBottom:4,
        display:"flex", alignItems:"center", gap:8 }}>
        <TitleIcon size={16} color={C.accent} strokeWidth={2} />{title}
      </div>
      {children}
    </div>
  );

  const numInput = (val:number, set:(v:number)=>void) => (
    <input type="number" value={val} onChange={e => set(+e.target.value)}
      style={{ width:64, background:C.surface, border:`1px solid ${C.border2}`,
        color:C.txtPri, borderRadius:7, padding:"6px 10px", fontSize:13, textAlign:"center" }} />
  );

  return (
    <div style={{ maxWidth:700 }}>
      <SectionHeading title="Settings" sub="Configure lab behaviour, grading, and access controls." />
      <Block TitleIcon={Clock} title="Lab Timing">
        <Row label="Time Limit per Practical" sub="Students are auto-submitted when time expires">
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {numInput(timeLimit, setTimeLimit)}
            <span style={{ color:C.txtMut, fontSize:12 }}>min</span>
          </div>
        </Row>
        <Row label="Maximum Attempts" sub="How many times a student may attempt each practical">
          {numInput(maxAttempts, setMaxAttempts)}
        </Row>
      </Block>

      <Block TitleIcon={BarChart2} title="Grading">
        <Row label="Auto-Grade Submissions" sub="Automatically score objective questions on submission">
          <Toggle v={autoGrade} set={setAutoGrade} />
        </Row>
        <Row label="Passing Score" sub="Minimum score required to pass a practical">
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {numInput(passScore, setPassScore)}
            <span style={{ color:C.txtMut, fontSize:12 }}>%</span>
          </div>
        </Row>
      </Block>

      <Block TitleIcon={Shield} title="Student Access">
        <Row label="Open Registration" sub="Allow new students to self-register with the enrolment code">
          <Toggle v={regOpen} set={setRegOpen} />
        </Row>
        <Row label="Enrolment Code" sub="Share this code with students to join your class">
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <code style={{ background:C.surface, border:`1px solid ${C.border2}`,
              color:C.accent, borderRadius:6, padding:"5px 12px", fontSize:13,
              letterSpacing:1.5, fontWeight:700 }}>VCLAB-2026</code>
            <button
              onClick={() => navigator.clipboard.writeText("VCLAB-2026").catch(()=>{})}
              style={{ background:"transparent", border:`1px solid ${C.border2}`,
                color:C.txtMut, borderRadius:6, padding:"5px 8px", cursor:"pointer",
                display:"flex", alignItems:"center", gap:4, fontSize:12 }}>
              <Copy size={13} strokeWidth={2} /> Copy
            </button>
          </div>
        </Row>
      </Block>

      <Block TitleIcon={Bell} title="Notifications">
        <Row label="Email Alerts" sub="Receive an email when a student submits a practical">
          <Toggle v={emailAlerts} set={setEmailAlerts} />
        </Row>
        <Row label="Teacher Email" sub="Address used for all system notifications">
          <input
            value={teacherEmail}
            onChange={e => setTeacherEmail(e.target.value)}
            style={{ background:C.surface, border:`1px solid ${C.border2}`,
              color:C.txtPri, borderRadius:8, padding:"7px 12px", fontSize:13,
              width:220, outline:"none" }}
          />
        </Row>
      </Block>

      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
        <Btn label="Save Changes" Icon={Save} onClick={save} />
        {saved && (
          <span style={{ color:C.green, fontSize:13, fontWeight:600,
            display:"flex", alignItems:"center", gap:5 }}>
            <CheckCircle size={14} strokeWidth={2.5} /> Saved
          </span>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar nav config
// ─────────────────────────────────────────────────────────────────────────────

const NAV: { id:Section; label:string; Icon:LucideIcon }[] = [
  { id:"dashboard",     label:"Dashboard",     Icon:LayoutDashboard },
  { id:"questions",     label:"Assignments",   Icon:ClipboardList   },
  { id:"students",      label:"Students",      Icon:Users           },
  { id:"analytics",     label:"Analytics",     Icon:BarChart2       },
  { id:"submissions",   label:"Submissions",   Icon:ClipboardCheck  },
  { id:"announcements", label:"Announcements", Icon:Megaphone       },
  { id:"settings",      label:"Settings",      Icon:Settings        },
];

const LABELS: Record<Section,string> = {
  dashboard:"Dashboard", questions:"Assignments",
  students:"Students", analytics:"Analytics", submissions:"Submissions",
  announcements:"Announcements", settings:"Settings",
};

// ─────────────────────────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────────────────────────

interface Props { onBack: () => void; }

const TeacherPanel: React.FC<Props> = ({ onBack }) => {
  const [isDark,  setIsDark]  = useState(true);
  const [section, setSection] = useState<Section>("dashboard");
  const [sbOpen,  setSbOpen]  = useState(true);

  const C      = isDark ? DARK : LIGHT;
  const toggle = () => setIsDark(v => !v);

  const renderSection = () => {
    switch (section) {
      case "dashboard":     return <Dashboard />;
      case "questions":     return <Questions />;
      case "students":      return <Students />;
      case "analytics":     return <Analytics />;
      case "submissions":   return <Submissions />;
      case "announcements": return <Announcements />;
      case "settings":      return <SettingsPanel />;
    }
  };

  return (
    <ThemeCtx.Provider value={{ C, isDark, toggle }}>
      <div style={{ display:"flex", height:"100vh", background:C.bg,
        fontFamily:"system-ui,-apple-system,sans-serif", overflow:"hidden",
        transition:"background .25s ease" }}>

        {/* ── Sidebar ── */}
        <aside style={{ width: sbOpen?240:64, minWidth: sbOpen?240:64,
          background:C.sidebar, borderRight:`1px solid ${C.border}`,
          display:"flex", flexDirection:"column",
          transition:"width .2s ease,min-width .2s ease",
          overflow:"hidden", flexShrink:0,
          boxShadow:`2px 0 8px ${C.shadow}` }}>

          {/* Logo row */}
          <div style={{ padding: sbOpen?"16px 18px":"16px 12px", borderBottom:`1px solid ${C.border}`,
            display:"flex", alignItems:"center", justifyContent:"space-between",
            minHeight:60, gap:8 }}>
            <div style={{ width:34, height:34, borderRadius:10, flexShrink:0,
              background:"linear-gradient(135deg,#2563eb,#7c3aed)",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <FlaskConical size={18} color="white" strokeWidth={2} />
            </div>
            {sbOpen && (
              <>
                <div style={{ flex:1, overflow:"hidden" }}>
                  <div style={{ color:C.txtPri, fontWeight:800, fontSize:13, whiteSpace:"nowrap" }}>VirtualLab</div>
                  <div style={{ color:C.txtMut, fontSize:10, whiteSpace:"nowrap" }}>Teacher Panel</div>
                </div>
                <button onClick={() => setSbOpen(false)}
                  style={{ background:"transparent", border:"none", color:C.txtMut,
                    cursor:"pointer", padding:4, display:"flex", alignItems:"center" }}>
                  <Menu size={16} strokeWidth={2} />
                </button>
              </>
            )}
            {!sbOpen && (
              <button onClick={() => setSbOpen(true)} style={{ position:"absolute", left:12,
                top:20, background:"transparent", border:"none", color:C.txtMut,
                cursor:"pointer", display:"flex", alignItems:"center" }}>
              </button>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex:1, padding:"10px 8px", overflowY:"auto" }}>
            {NAV.map(item => {
              const active = section===item.id;
              return (
                <button key={item.id} onClick={() => setSection(item.id)} style={{
                  width:"100%", display:"flex", alignItems:"center",
                  gap: sbOpen?10:0, justifyContent: sbOpen?"flex-start":"center",
                  padding: sbOpen?"10px 12px":"11px 0",
                  borderRadius:9, border:"none", cursor:"pointer", marginBottom:3,
                  background: active ? `${C.accent}20` : "transparent",
                  color: active ? C.accent : C.txtSec,
                  fontWeight: active ? 700 : 500, fontSize:13,
                  transition:"background .15s,color .15s",
                }}>
                  <item.Icon size={17} strokeWidth={active?2.2:1.8} />
                  {sbOpen && <span style={{ overflow:"hidden", whiteSpace:"nowrap" }}>{item.label}</span>}
                  {active && sbOpen && (
                    <span style={{ marginLeft:"auto", width:6, height:6, borderRadius:"50%",
                      background:C.accent, flexShrink:0 }} />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Logout */}
          <div style={{ padding:"10px 8px", borderTop:`1px solid ${C.border}` }}>
            <button onClick={onBack}
              title="Logout"
              style={{
                width:"100%", display:"flex", alignItems:"center",
                gap: sbOpen?10:0, justifyContent: sbOpen?"flex-start":"center",
                padding: sbOpen?"11px 14px":"11px 0",
                borderRadius:9, border:`1px solid ${C.red}33`, cursor:"pointer",
                background:`${C.red}10`,
                color:C.red, fontSize:13, fontWeight:700,
                transition:"background .15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = `${C.red}20`)}
              onMouseLeave={e => (e.currentTarget.style.background = `${C.red}10`)}
            >
              <LogOut size={16} strokeWidth={2} />
              {sbOpen && <span>Logout</span>}
            </button>
          </div>
        </aside>

        {/* ── Main ── */}
        <div style={{ flex:1, display:"flex", flexDirection:"column",
          overflow:"hidden", minWidth:0, transition:"background .25s ease" }}>

          {/* Header */}
          <header style={{ height:60, borderBottom:`1px solid ${C.border}`,
            background:C.headerBg, display:"flex", alignItems:"center",
            justifyContent:"space-between", padding:"0 22px", flexShrink:0,
            boxShadow:`0 1px 4px ${C.shadow}`, transition:"background .25s,border-color .25s" }}>

            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              {!sbOpen && (
                <button onClick={() => setSbOpen(true)}
                  style={{ background:"transparent", border:"none", color:C.txtSec,
                    cursor:"pointer", display:"flex", alignItems:"center", marginRight:4 }}>
                  <Menu size={20} strokeWidth={2} />
                </button>
              )}
              <span style={{ color:C.txtMut, fontSize:12 }}>Teacher Panel</span>
              <span style={{ color:C.txtMut, fontSize:14 }}>›</span>
              <span style={{ color:C.txtPri, fontWeight:700, fontSize:14 }}>{LABELS[section]}</span>
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              {/* Live badge */}
              <div style={{ background:`${C.green}15`, border:`1px solid ${C.green}40`,
                borderRadius:20, padding:"3px 12px", color:C.green, fontSize:11,
                fontWeight:700, display:"flex", alignItems:"center", gap:5 }}>
                <Activity size={10} strokeWidth={2.5} /> Live
              </div>

              {/* ── Theme toggle ── */}
              <button onClick={toggle}
                title={isDark?"Switch to light mode":"Switch to dark mode"}
                style={{ width:38, height:38, borderRadius:10, cursor:"pointer",
                  background: isDark ? "#1e293b" : "#f1f5f9",
                  border:`1px solid ${C.border2}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  color: isDark ? "#e2e8f0" : "#0f172a",
                  transition:"background .2s,border-color .2s,color .2s", flexShrink:0 }}>
                {isDark
                  ? <Sun  size={17} strokeWidth={2} />
                  : <Moon size={17} strokeWidth={2} />}
              </button>

              {/* Avatar */}
              <div style={{ width:34, height:34, borderRadius:"50%", flexShrink:0,
                background:"linear-gradient(135deg,#2563eb,#7c3aed)",
                display:"flex", alignItems:"center", justifyContent:"center",
                color:"white", fontWeight:800, fontSize:14, cursor:"pointer" }}>
                <User size={16} strokeWidth={2.5} color="white" />
              </div>
            </div>
          </header>

          {/* Scrollable content */}
          <main style={{ flex:1, overflowY:"auto", padding:"28px 28px 48px",
            background:C.bg, transition:"background .25s ease" }}>
            {renderSection()}
          </main>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
};

export default TeacherPanel;
