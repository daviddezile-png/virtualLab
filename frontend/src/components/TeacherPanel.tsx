import React, { useState, useRef, useContext, createContext } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Theme tokens
// ─────────────────────────────────────────────────────────────────────────────

const DARK = {
  bg:      "#060d18",
  sidebar: "#080f1e",
  surface: "#0a1628",
  card:    "#0d1b2e",
  border:  "#1e293b",
  border2: "#334155",
  txtPri:  "#e2e8f0",
  txtSec:  "#94a3b8",
  txtMut:  "#475569",
  accent:  "#3b82f6",
  accentHov:"#2563eb",
  green:   "#22c55e",
  red:     "#ef4444",
  amber:   "#f59e0b",
  purple:  "#a78bfa",
  shadow:  "rgba(0,0,0,0.55)",
  headerBg:"rgba(8,15,30,0.98)",
} as const;

const LIGHT = {
  bg:      "#f1f5f9",
  sidebar: "#ffffff",
  surface: "#f8fafc",
  card:    "#ffffff",
  border:  "#e2e8f0",
  border2: "#cbd5e1",
  txtPri:  "#0f172a",
  txtSec:  "#475569",
  txtMut:  "#94a3b8",
  accent:  "#2563eb",
  accentHov:"#1d4ed8",
  green:   "#16a34a",
  red:     "#dc2626",
  amber:   "#d97706",
  purple:  "#7c3aed",
  shadow:  "rgba(0,0,0,0.10)",
  headerBg:"rgba(255,255,255,0.98)",
} as const;

type Theme = typeof DARK;

// ─────────────────────────────────────────────────────────────────────────────
// Theme context
// ─────────────────────────────────────────────────────────────────────────────

const ThemeCtx = createContext<{ C: Theme; isDark: boolean; toggle: () => void }>({
  C: DARK, isDark: true, toggle: () => {},
});
const useTheme = () => useContext(ThemeCtx);

// ─────────────────────────────────────────────────────────────────────────────
// SVG icons — stroke="currentColor" so they inherit the button's text color
// ─────────────────────────────────────────────────────────────────────────────

const SunIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1"  x2="12" y2="3"  />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22"   x2="5.64" y2="5.64"   />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1"  y1="12" x2="3"  y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36" />
    <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"  />
  </svg>
);

const MoonIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Section =
  | "dashboard" | "practicals" | "questions" | "students"
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
  lastActivity: string; icon: string; color: string;
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
  { id:"s1",  name:"Amara Nkosi",    email:"amara@school.edu",   enrolled:"2026-01-10", completed:2, lastActive:"2 hours ago",  avgScore:88, status:"active"   },
  { id:"s2",  name:"Brian Odhiambo", email:"brian@school.edu",   enrolled:"2026-01-10", completed:1, lastActive:"1 day ago",    avgScore:74, status:"active"   },
  { id:"s3",  name:"Chloe Mwangi",   email:"chloe@school.edu",   enrolled:"2026-01-12", completed:2, lastActive:"3 hours ago",  avgScore:92, status:"active"   },
  { id:"s4",  name:"David Kamau",    email:"david@school.edu",   enrolled:"2026-01-12", completed:0, lastActive:"5 days ago",   avgScore:0,  status:"inactive" },
  { id:"s5",  name:"Eva Njoroge",    email:"eva@school.edu",     enrolled:"2026-01-14", completed:2, lastActive:"30 min ago",   avgScore:95, status:"active"   },
  { id:"s6",  name:"Felix Otieno",   email:"felix@school.edu",   enrolled:"2026-01-14", completed:1, lastActive:"2 days ago",   avgScore:67, status:"active"   },
  { id:"s7",  name:"Grace Wanjiru",  email:"grace@school.edu",   enrolled:"2026-01-15", completed:2, lastActive:"1 hour ago",   avgScore:81, status:"active"   },
  { id:"s8",  name:"Hassan Ali",     email:"hassan@school.edu",  enrolled:"2026-01-15", completed:1, lastActive:"4 days ago",   avgScore:71, status:"inactive" },
  { id:"s9",  name:"Irene Chebet",   email:"irene@school.edu",   enrolled:"2026-01-18", completed:2, lastActive:"45 min ago",   avgScore:89, status:"active"   },
  { id:"s10", name:"James Mutua",    email:"james@school.edu",   enrolled:"2026-01-18", completed:0, lastActive:"1 week ago",   avgScore:0,  status:"inactive" },
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
  { id:"vanishing-cream", name:"Vanishing Cream",     type:"O/W Emulsion", status:"active",   enrolled:10, submissions:7, avgScore:82, lastActivity:"2 hours ago",  icon:"🧴", color:"#2563eb" },
  { id:"cold-cream",      name:"Cold Cream",           type:"W/O Emulsion", status:"active",   enrolled:10, submissions:5, avgScore:84, lastActivity:"3 hours ago",  icon:"🫧", color:"#7c3aed" },
  { id:"acid-base",       name:"Acid-Base Titration",  type:"Titration",    status:"draft",    enrolled:0,  submissions:0, avgScore:0,  lastActivity:"—",            icon:"⚗️", color:"#0f766e" },
];

const QUESTIONS_VC: Question[] = [
  { id:"q1", text:"What type of emulsion is vanishing cream? Explain the phase arrangement.", type:"short", points:5 },
  { id:"q2", text:"Which of the following is the primary emulsifier in vanishing cream?", type:"mcq", points:2, options:["Glycerin","Potassium stearate","Liquid paraffin","Distilled water"] },
  { id:"q3", text:"Why must both phases be heated to 75°C before mixing?", type:"short", points:5 },
  { id:"q4", text:"What is the acceptable pH range for the finished vanishing cream?", type:"mcq", points:2, options:["3.0–4.5","5.0–7.0","7.5–9.0","9.5–11.0"] },
  { id:"q5", text:"Describe the role of the ice bucket step and explain why controlled cooling improves emulsion stability.", type:"long", points:10 },
];

const ANNOUNCEMENTS: Announcement[] = [
  { id:"a1", title:"Practical 1 Now Live",   body:"Vanishing Cream practical is now open. Please complete it before Friday.", target:"All Students", sentAt:"2026-05-08 09:00", read:8, total:10 },
  { id:"a2", title:"Cold Cream Lab Open",    body:"Cold Cream W/O emulsion practical is available. Refer to your pre-lab notebook.", target:"All Students", sentAt:"2026-05-09 08:30", read:6, total:10 },
  { id:"a3", title:"Submission Reminder",    body:"Reminder: all submissions for Practical 1 are due tomorrow at 5 PM.", target:"All Students", sentAt:"2026-05-09 16:00", read:9, total:10 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Shared micro-components — all themed via useTheme()
// ─────────────────────────────────────────────────────────────────────────────

type BadgeStatus = "active" | "inactive" | "draft" | "graded" | "pending" | "failed";

const StatusBadge: React.FC<{ status: BadgeStatus }> = ({ status }) => {
  const { C } = useTheme();
  const map: Record<BadgeStatus, [string, string]> = {
    active:   [C.green,  `${C.green}18`],
    inactive: [C.txtSec, C.surface],
    draft:    [C.amber,  `${C.amber}18`],
    graded:   [C.green,  `${C.green}18`],
    pending:  [C.amber,  `${C.amber}18`],
    failed:   [C.red,    `${C.red}18`],
  };
  const [color, bg] = map[status];
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span style={{ background: bg, color, borderRadius: 20,
      padding: "2px 10px", fontSize: 11, fontWeight: 700, letterSpacing: 0.3 }}>
      {label}
    </span>
  );
};

const ScoreBar: React.FC<{ score: number }> = ({ score }) => {
  const { C } = useTheme();
  const color = score >= 80 ? C.green : score >= 60 ? C.amber : C.red;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ flex:1, height:6, background:C.border, borderRadius:3, overflow:"hidden" }}>
        <div style={{ width:`${score}%`, height:"100%", background:color, borderRadius:3, transition:"width .4s ease" }} />
      </div>
      <span style={{ color:C.txtSec, fontSize:12, minWidth:32, textAlign:"right" }}>{score}%</span>
    </div>
  );
};

const StatCard: React.FC<{ label:string; value:string|number; sub?:string; icon:string; accent:string }> =
  ({ label, value, sub, icon, accent }) => {
  const { C } = useTheme();
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
      padding:"18px 20px", display:"flex", gap:14, alignItems:"flex-start",
      boxShadow:`0 1px 4px ${C.shadow}` }}>
      <div style={{ width:44, height:44, borderRadius:12, background:`${accent}18`,
        display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
        {icon}
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

const Btn: React.FC<{
  label:string; onClick?:()=>void; variant?:"primary"|"ghost"|"danger";
  icon?:string; small?:boolean;
}> = ({ label, onClick, variant="primary", icon, small }) => {
  const { C } = useTheme();
  const styles: Record<string, React.CSSProperties> = {
    primary: { background:C.accent,   color:"white",   border:"none" },
    ghost:   { background:"transparent", color:C.txtSec, border:`1px solid ${C.border2}` },
    danger:  { background:`${C.red}12`, color:C.red,   border:`1px solid ${C.red}44` },
  };
  return (
    <button onClick={onClick} style={{
      ...styles[variant], borderRadius:8,
      padding: small ? "6px 12px" : "9px 18px",
      fontSize: small ? 12 : 13, fontWeight:600, cursor:"pointer",
      display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap",
    }}>
      {icon && <span>{icon}</span>}{label}
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

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
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

const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => {
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

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { C } = useTheme();
  return (
    <div>
      <SectionHeading title="Dashboard" sub="Welcome back. Here's what's happening in your lab today." />

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:16, marginBottom:28 }}>
        <StatCard label="Total Students"    value={10}    sub="2 inactive"          icon="👥" accent={C.accent} />
        <StatCard label="Active Practicals" value={2}     sub="1 draft"             icon="🧪" accent="#7c3aed" />
        <StatCard label="Submissions Today" value={3}     sub="+5 this week"        icon="📋" accent={C.green}  />
        <StatCard label="Class Average"     value="83%"   sub="↑ 4% from last week" icon="📈" accent={C.amber} />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:20, alignItems:"start" }}>
        {/* Recent submissions */}
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
          overflow:"hidden", boxShadow:`0 1px 4px ${C.shadow}` }}>
          <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.border}`,
            display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ color:C.txtPri, fontWeight:700, fontSize:14 }}>Recent Submissions</span>
            <span style={{ color:C.accent, fontSize:12, cursor:"pointer" }}>View all →</span>
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <TableHead cols={["Student","Practical","Score","Status","Time"]} />
            <tbody>
              {SUBMISSIONS.slice(0,5).map((s,i) => (
                <tr key={s.id} style={{ background: i%2===0 ? "transparent" : `${C.surface}88` }}>
                  <td style={{ padding:"11px 14px", color:C.txtPri, fontSize:13 }}>{s.student}</td>
                  <td style={{ padding:"11px 14px", color:C.txtSec, fontSize:12 }}>{s.practical}</td>
                  <td style={{ padding:"11px 14px" }}><ScoreBar score={s.score} /></td>
                  <td style={{ padding:"11px 14px" }}><StatusBadge status={s.status} /></td>
                  <td style={{ padding:"11px 14px", color:C.txtMut, fontSize:12 }}>{s.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Quick actions + activity */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
            padding:18, boxShadow:`0 1px 4px ${C.shadow}` }}>
            <div style={{ color:C.txtPri, fontWeight:700, fontSize:14, marginBottom:14 }}>Quick Actions</div>
            {[
              { icon:"📝", label:"Upload Questions",  color:C.accent  },
              { icon:"👤", label:"Add Student",       color:C.green   },
              { icon:"📣", label:"Send Announcement", color:"#7c3aed" },
              { icon:"📊", label:"Export Analytics",  color:C.amber   },
            ].map(({ icon, label, color }) => (
              <button key={label} style={{ width:"100%", display:"flex", alignItems:"center", gap:10,
                background:"transparent", border:`1px solid ${C.border}`, borderRadius:8,
                padding:"10px 12px", marginBottom:8, cursor:"pointer", color:C.txtSec,
                fontSize:13, fontWeight:600 }}>
                <span style={{ width:28, height:28, borderRadius:6, background:`${color}18`,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>
                  {icon}
                </span>
                {label}
              </button>
            ))}
          </div>

          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
            padding:18, boxShadow:`0 1px 4px ${C.shadow}` }}>
            <div style={{ color:C.txtPri, fontWeight:700, fontSize:14, marginBottom:14 }}>Activity Feed</div>
            {[
              { msg:"Eva Njoroge submitted Cold Cream",      time:"30 min ago", icon:"📋" },
              { msg:"Amara Nkosi started Vanishing Cream",   time:"2 hrs ago",  icon:"🧪" },
              { msg:"Chloe Mwangi scored 94% on Cold Cream", time:"3 hrs ago",  icon:"⭐" },
              { msg:"Announcement sent to all students",     time:"5 hrs ago",  icon:"📣" },
            ].map(({ msg, time, icon }, i) => (
              <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:12 }}>
                <span style={{ fontSize:14, marginTop:1 }}>{icon}</span>
                <div>
                  <div style={{ color:C.txtSec, fontSize:12 }}>{msg}</div>
                  <div style={{ color:C.txtMut, fontSize:11, marginTop:2 }}>{time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Practicals
// ─────────────────────────────────────────────────────────────────────────────

const Practicals: React.FC = () => {
  const { C } = useTheme();
  const [list, setList] = useState(PRACTICALS);

  const toggleStatus = (id: string) =>
    setList(prev => prev.map(p =>
      p.id === id
        ? { ...p, status: (p.status === "active" ? "inactive" : "active") as Practical["status"] }
        : p
    ));

  return (
    <div>
      <SectionHeading title="Practicals" sub="Manage all lab practicals and control student access."
        action={<Btn label="Add Practical" icon="+" />} />

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:18 }}>
        {list.map(p => (
          <div key={p.id} style={{ background:C.card, border:`1px solid ${C.border}`,
            borderRadius:14, overflow:"hidden", boxShadow:`0 1px 4px ${C.shadow}` }}>
            <div style={{ height:4, background: p.status === "active" ? p.color : C.border }} />
            <div style={{ padding:20 }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:14 }}>
                <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:`${p.color}18`,
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
                    {p.icon}
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
                  { label:"Avg Score", val: p.avgScore > 0 ? `${p.avgScore}%` : "—" },
                ].map(({ label, val }) => (
                  <div key={label} style={{ background:C.surface, borderRadius:8, padding:"8px 10px", textAlign:"center",
                    border:`1px solid ${C.border}` }}>
                    <div style={{ color:C.txtPri, fontWeight:700, fontSize:16 }}>{val}</div>
                    <div style={{ color:C.txtMut, fontSize:10, marginTop:2, textTransform:"uppercase", letterSpacing:0.5 }}>{label}</div>
                  </div>
                ))}
              </div>

              <div style={{ color:C.txtMut, fontSize:11, marginBottom:16 }}>Last activity: {p.lastActivity}</div>

              <div style={{ display:"flex", gap:8 }}>
                <Btn label="Edit"      variant="ghost" small icon="✏️" />
                <Btn label="Questions" variant="ghost" small icon="📝" />
                <button onClick={() => toggleStatus(p.id)} style={{
                  marginLeft:"auto",
                  background: p.status==="active" ? `${C.red}10` : `${C.green}10`,
                  color:      p.status==="active" ? C.red : C.green,
                  border:    `1px solid ${p.status==="active" ? `${C.red}44` : `${C.green}44`}`,
                  borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:12, fontWeight:600,
                }}>
                  {p.status==="active" ? "Deactivate" : "Activate"}
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
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:24,
            border:`1px solid ${C.border}` }}>+</div>
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

const Questions: React.FC = () => {
  const { C } = useTheme();
  const [questions, setQuestions] = useState<Question[]>(QUESTIONS_VC);
  const [addingNew, setAddingNew] = useState(false);
  const [newQ, setNewQ] = useState<Partial<Question>>({ type:"short", points:5, text:"", options:["","","",""] });
  const [dragging, setDragging] = useState<string|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const totalPoints = questions.reduce((s,q) => s+q.points, 0);
  const deleteQ = (id:string) => setQuestions(prev => prev.filter(q => q.id !== id));
  const addQ = () => {
    if (!newQ.text?.trim()) return;
    setQuestions(prev => [...prev, {
      id:`q${Date.now()}`, text:newQ.text!, type:newQ.type as Question["type"],
      points:newQ.points??5,
      options: newQ.type==="mcq" ? newQ.options?.filter(Boolean) : undefined,
    }]);
    setNewQ({ type:"short", points:5, text:"", options:["","","",""] });
    setAddingNew(false);
  };

  const typeLabel: Record<Question["type"],string> = { mcq:"MCQ", short:"Short Answer", long:"Long Answer" };
  const typeColor: Record<Question["type"],string> = { mcq:C.accent, short:C.green, long:C.purple };

  return (
    <div>
      <SectionHeading title="Questions" sub="Upload or manually create questions for each practical."
        action={<Btn label="Add Question" icon="+" onClick={() => setAddingNew(true)} />} />

      {/* Practical tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:24 }}>
        {PRACTICALS.filter(p => p.id !== "acid-base").map(p => (
          <button key={p.id} style={{ padding:"8px 18px", borderRadius:8, cursor:"pointer",
            fontWeight:600, fontSize:13, border:"none",
            background: p.id==="vanishing-cream" ? C.accent : C.card,
            color: p.id==="vanishing-cream" ? "white" : C.txtSec,
            boxShadow:`0 1px 3px ${C.shadow}` }}>
            {p.name}
          </button>
        ))}
      </div>

      {/* Upload zone */}
      <div onClick={() => fileRef.current?.click()} style={{
        border:`2px dashed ${C.border2}`, borderRadius:12, padding:"28px 20px",
        textAlign:"center", cursor:"pointer", marginBottom:24,
        background: C.surface, transition:"border-color .2s",
      }}>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" style={{ display:"none" }} />
        <div style={{ fontSize:32, marginBottom:8 }}>📄</div>
        <div style={{ color:C.txtPri, fontWeight:700, fontSize:14 }}>Upload Question Sheet</div>
        <div style={{ color:C.txtSec, fontSize:12, marginTop:4 }}>Drag & drop or click — PDF, DOCX, TXT</div>
        <div style={{ display:"inline-block", marginTop:12, padding:"6px 18px",
          background:C.accent, color:"white", borderRadius:8, fontSize:12, fontWeight:600 }}>
          Choose File
        </div>
      </div>

      {/* List header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <span style={{ color:C.txtSec, fontSize:13 }}>{questions.length} questions · {totalPoints} total points</span>
        <Btn label="Save Order" variant="ghost" small />
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {questions.map((q,i) => (
          <div key={q.id} draggable
            onDragStart={() => setDragging(q.id)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => {
              if (!dragging || dragging===q.id) return;
              const from = questions.findIndex(x => x.id===dragging);
              const arr  = [...questions];
              const [item] = arr.splice(from,1);
              arr.splice(i,0,item);
              setQuestions(arr);
              setDragging(null);
            }}
            style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12,
              padding:"14px 16px", cursor:"grab", display:"flex", gap:14, alignItems:"flex-start",
              opacity: dragging===q.id ? 0.45 : 1, boxShadow:`0 1px 3px ${C.shadow}` }}>
            <span style={{ color:C.txtMut, fontSize:13, minWidth:20, marginTop:2 }}>☰</span>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
                <span style={{ color:C.txtMut, fontSize:12 }}>Q{i+1}</span>
                <span style={{ background:`${typeColor[q.type]}18`, color:typeColor[q.type],
                  borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700 }}>
                  {typeLabel[q.type]}
                </span>
                <span style={{ color:C.txtMut, fontSize:12, marginLeft:"auto" }}>{q.points} pts</span>
              </div>
              <div style={{ color:C.txtPri, fontSize:13, lineHeight:1.6 }}>{q.text}</div>
              {q.options && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
                  {q.options.map((opt,oi) => (
                    <span key={oi} style={{ background:C.surface, border:`1px solid ${C.border}`,
                      borderRadius:6, padding:"3px 10px", fontSize:12, color:C.txtSec }}>
                      {String.fromCharCode(65+oi)}. {opt}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <button style={{ background:"transparent", border:`1px solid ${C.border}`,
                color:C.txtMut, borderRadius:6, padding:"4px 8px", cursor:"pointer", fontSize:12 }}>✏️</button>
              <button onClick={() => deleteQ(q.id)}
                style={{ background:`${C.red}10`, border:"none",
                  color:C.red, borderRadius:6, padding:"4px 8px", cursor:"pointer", fontSize:12 }}>🗑</button>
            </div>
          </div>
        ))}
      </div>

      {/* Add question form */}
      {addingNew && (
        <div style={{ marginTop:16, background:C.card, border:`1px solid ${C.accent}55`,
          borderRadius:14, padding:20, boxShadow:`0 2px 8px ${C.shadow}` }}>
          <div style={{ color:C.txtPri, fontWeight:700, fontSize:14, marginBottom:16 }}>New Question</div>
          <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
            {(["short","mcq","long"] as Question["type"][]).map(t => (
              <button key={t} onClick={() => setNewQ(p => ({ ...p, type:t }))} style={{
                padding:"6px 14px", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:600,
                border:"none", background: newQ.type===t ? C.accent : C.surface,
                color: newQ.type===t ? "white" : C.txtSec,
              }}>{typeLabel[t]}</button>
            ))}
            <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
              <label style={{ color:C.txtMut, fontSize:12 }}>Points</label>
              <input type="number" value={newQ.points??5}
                onChange={e => setNewQ(p => ({ ...p, points:+e.target.value }))}
                style={{ width:60, background:C.surface, border:`1px solid ${C.border2}`,
                  color:C.txtPri, borderRadius:6, padding:"5px 8px", fontSize:13, textAlign:"center" }} />
            </div>
          </div>
          <Textarea placeholder="Enter question text…" value={newQ.text??""} rows={3}
            onChange={e => setNewQ(p => ({ ...p, text:e.target.value }))} />
          {newQ.type==="mcq" && (
            <div style={{ marginTop:12, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {(newQ.options??["","","",""]).map((opt,i) => (
                <Input key={i} placeholder={`Option ${String.fromCharCode(65+i)}`} value={opt}
                  onChange={e => {
                    const opts = [...(newQ.options??["","","",""])];
                    opts[i] = e.target.value;
                    setNewQ(p => ({ ...p, options:opts }));
                  }} />
              ))}
            </div>
          )}
          <div style={{ display:"flex", gap:8, marginTop:14, justifyContent:"flex-end" }}>
            <Btn label="Cancel"       variant="ghost" small onClick={() => setAddingNew(false)} />
            <Btn label="Add Question" small onClick={addQ} />
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Students
// ─────────────────────────────────────────────────────────────────────────────

const Students: React.FC = () => {
  const { C } = useTheme();
  const [students, setStudents] = useState(STUDENTS);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all"|"active"|"inactive">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const filtered = students.filter(s => {
    const ms = s.name.toLowerCase().includes(search.toLowerCase()) ||
               s.email.toLowerCase().includes(search.toLowerCase());
    return ms && (filter==="all" || s.status===filter);
  });

  const addStudent = () => {
    if (!newName.trim() || !newEmail.trim()) return;
    setStudents(prev => [...prev, {
      id:`s${Date.now()}`, name:newName, email:newEmail,
      enrolled: new Date().toISOString().slice(0,10),
      completed:0, lastActive:"Just added", avgScore:0, status:"active",
    }]);
    setNewName(""); setNewEmail(""); setShowAdd(false);
  };

  return (
    <div>
      <SectionHeading title="Students" sub="Manage enrolled students and track their progress."
        action={
          <div style={{ display:"flex", gap:8 }}>
            <Btn label="Export CSV" variant="ghost" icon="⬇️" small />
            <Btn label="Add Student" icon="+" onClick={() => setShowAdd(true)} />
          </div>
        } />

      {showAdd && (
        <div style={{ background:C.card, border:`1px solid ${C.accent}55`, borderRadius:12,
          padding:16, marginBottom:20, display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end",
          boxShadow:`0 2px 8px ${C.shadow}` }}>
          <div style={{ flex:1, minWidth:180 }}>
            <label style={{ color:C.txtMut, fontSize:11, display:"block", marginBottom:5,
              textTransform:"uppercase", letterSpacing:0.7 }}>Full Name</label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Alice Wambua" />
          </div>
          <div style={{ flex:1, minWidth:200 }}>
            <label style={{ color:C.txtMut, fontSize:11, display:"block", marginBottom:5,
              textTransform:"uppercase", letterSpacing:0.7 }}>Email</label>
            <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="student@school.edu" />
          </div>
          <Btn label="Add" small onClick={addStudent} />
          <Btn label="Cancel" variant="ghost" small onClick={() => setShowAdd(false)} />
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display:"flex", gap:10, marginBottom:18, flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:220, position:"relative" }}>
          <span style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)",
            color:C.txtMut, fontSize:14, pointerEvents:"none" }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students…"
            style={{ width:"100%", background:C.card, border:`1px solid ${C.border}`,
              color:C.txtPri, borderRadius:8, padding:"9px 12px 9px 34px",
              fontSize:13, boxSizing:"border-box", outline:"none" }} />
        </div>
        {(["all","active","inactive"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding:"8px 16px", borderRadius:8, cursor:"pointer", fontWeight:600,
            fontSize:12, border:"none", textTransform:"capitalize",
            background: filter===f ? C.accent : C.card,
            color: filter===f ? "white" : C.txtSec,
          }}>{f}</button>
        ))}
      </div>

      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
        overflow:"hidden", boxShadow:`0 1px 4px ${C.shadow}` }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <TableHead cols={["Student","Email","Enrolled","Completed","Avg Score","Last Active","Status",""]} />
          <tbody>
            {filtered.map((s,i) => (
              <tr key={s.id} style={{ background: i%2===0 ? "transparent" : `${C.surface}88`,
                borderBottom:`1px solid ${C.border}` }}>
                <td style={{ padding:"12px 14px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:32, height:32, borderRadius:"50%", flexShrink:0,
                      background:`hsl(${s.name.charCodeAt(0)*7%360},55%,38%)`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      color:"white", fontWeight:700, fontSize:13 }}>{s.name[0]}</div>
                    <span style={{ color:C.txtPri, fontSize:13, fontWeight:600 }}>{s.name}</span>
                  </div>
                </td>
                <td style={{ padding:"12px 14px", color:C.txtSec, fontSize:12 }}>{s.email}</td>
                <td style={{ padding:"12px 14px", color:C.txtMut, fontSize:12 }}>{s.enrolled}</td>
                <td style={{ padding:"12px 14px", color:C.txtPri, fontSize:13, textAlign:"center" }}>{s.completed}/2</td>
                <td style={{ padding:"12px 14px", minWidth:120 }}>
                  {s.avgScore>0 ? <ScoreBar score={s.avgScore}/> : <span style={{ color:C.txtMut, fontSize:12 }}>—</span>}
                </td>
                <td style={{ padding:"12px 14px", color:C.txtMut, fontSize:12 }}>{s.lastActive}</td>
                <td style={{ padding:"12px 14px" }}><StatusBadge status={s.status} /></td>
                <td style={{ padding:"12px 14px" }}>
                  <div style={{ display:"flex", gap:6 }}>
                    <button style={{ background:"transparent", border:`1px solid ${C.border}`,
                      color:C.txtSec, borderRadius:6, padding:"4px 8px", cursor:"pointer", fontSize:12 }}>View</button>
                    <button style={{ background:`${C.red}10`, border:"none",
                      color:C.red, borderRadius:6, padding:"4px 8px", cursor:"pointer", fontSize:12 }}>Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0 && (
          <div style={{ padding:40, textAlign:"center", color:C.txtMut }}>No students found.</div>
        )}
      </div>
      <div style={{ color:C.txtMut, fontSize:12, marginTop:10 }}>
        Showing {filtered.length} of {students.length} students
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────────────────────────────────────

const Analytics: React.FC = () => {
  const { C } = useTheme();
  const [practicalFilter, setPracticalFilter] = useState("all");

  const barData = [
    { label:"Vanishing Cream", score:82, color:"#2563eb", count:7 },
    { label:"Cold Cream",      score:84, color:"#7c3aed", count:5 },
  ];
  const sections = [
    { label:"Context (Understanding)",  avg:88 },
    { label:"Prediction (Pre-lab)",     avg:76 },
    { label:"Protocol (Procedure)",     avg:91 },
    { label:"Correct Temperatures",     avg:84 },
    { label:"Stirring Duration",        avg:72 },
    { label:"pH Measurement",           avg:79 },
    { label:"Viscosity Measurement",    avg:68 },
    { label:"Reflection Questions",     avg:74 },
  ];
  const distribution = [
    { range:"90–100", count:3, color:C.green  },
    { range:"80–89",  count:4, color:"#4ade80" },
    { range:"70–79",  count:2, color:C.amber  },
    { range:"60–69",  count:1, color:"#fb923c" },
    { range:"< 60",   count:0, color:C.red    },
  ];
  const maxCount = Math.max(...distribution.map(d => d.count));

  return (
    <div>
      <SectionHeading title="Analytics" sub="Detailed performance breakdown across all practicals."
        action={<Btn label="Export Report" variant="ghost" icon="📊" />} />

      <div style={{ display:"flex", gap:8, marginBottom:24 }}>
        {["all","vanishing-cream","cold-cream"].map(f => (
          <button key={f} onClick={() => setPracticalFilter(f)} style={{
            padding:"7px 16px", borderRadius:8, cursor:"pointer", fontWeight:600,
            fontSize:12, border:"none", textTransform:"capitalize",
            background: practicalFilter===f ? C.accent : C.card,
            color: practicalFilter===f ? "white" : C.txtSec,
          }}>
            {f==="all" ? "All Practicals" : f.replace("-"," ").replace(/\b\w/g,c=>c.toUpperCase())}
          </button>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:28 }}>
        <StatCard label="Submissions"     value={10}    sub="7 graded · 1 pending" icon="📋" accent={C.accent} />
        <StatCard label="Class Average"   value="83%"   sub="↑ 4% this week"       icon="📈" accent={C.green}  />
        <StatCard label="Completion Rate" value="80%"   sub="8/10 students"         icon="✅" accent="#7c3aed"  />
        <StatCard label="Avg Duration"    value="56m"   sub="Range: 42–73 min"     icon="⏱" accent={C.amber}  />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
        {/* Bar chart */}
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
          padding:20, boxShadow:`0 1px 4px ${C.shadow}` }}>
          <div style={{ color:C.txtPri, fontWeight:700, fontSize:14, marginBottom:18 }}>
            Average Score by Practical
          </div>
          {barData.map(d => (
            <div key={d.label} style={{ marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ color:C.txtSec, fontSize:13 }}>{d.label}</span>
                <span style={{ color:C.txtPri, fontWeight:700, fontSize:13 }}>{d.score}%</span>
              </div>
              <div style={{ height:10, background:C.surface, borderRadius:5, overflow:"hidden",
                border:`1px solid ${C.border}` }}>
                <div style={{ width:`${d.score}%`, height:"100%", background:d.color,
                  borderRadius:5, transition:"width .6s ease" }} />
              </div>
              <div style={{ color:C.txtMut, fontSize:11, marginTop:4 }}>{d.count} submissions</div>
            </div>
          ))}
        </div>

        {/* Distribution */}
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
          padding:20, boxShadow:`0 1px 4px ${C.shadow}` }}>
          <div style={{ color:C.txtPri, fontWeight:700, fontSize:14, marginBottom:18 }}>Score Distribution</div>
          <div style={{ display:"flex", gap:10, alignItems:"flex-end", height:120 }}>
            {distribution.map(d => (
              <div key={d.range} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <span style={{ color:C.txtSec, fontSize:11 }}>{d.count}</span>
                <div style={{ width:"100%", borderRadius:"4px 4px 0 0",
                  background: d.count>0 ? d.color : C.border,
                  height: maxCount>0 ? `${(d.count/maxCount)*90}px` : "4px",
                  minHeight: d.count>0 ? 8 : 4, transition:"height .4s ease" }} />
                <span style={{ color:C.txtMut, fontSize:10, textAlign:"center", lineHeight:1.2 }}>{d.range}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section breakdown */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
        padding:20, marginBottom:20, boxShadow:`0 1px 4px ${C.shadow}` }}>
        <div style={{ color:C.txtPri, fontWeight:700, fontSize:14, marginBottom:16 }}>Performance by Section</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {sections.map(s => (
            <div key={s.label} style={{ display:"grid", gridTemplateColumns:"220px 1fr 46px", gap:12, alignItems:"center" }}>
              <span style={{ color:C.txtSec, fontSize:12 }}>{s.label}</span>
              <div style={{ height:8, background:C.surface, borderRadius:4, overflow:"hidden",
                border:`1px solid ${C.border}` }}>
                <div style={{ width:`${s.avg}%`, height:"100%", borderRadius:4, transition:"width .5s ease",
                  background: s.avg>=85 ? C.green : s.avg>=70 ? C.amber : C.red }} />
              </div>
              <span style={{ color:C.txtPri, fontWeight:700, fontSize:12 }}>{s.avg}%</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        {[
          { title:"Top Performers",  list:STUDENTS.filter(s=>s.avgScore>=88).sort((a,b)=>b.avgScore-a.avgScore), color:C.green },
          { title:"Needs Attention", list:STUDENTS.filter(s=>s.avgScore>0&&s.avgScore<80).sort((a,b)=>a.avgScore-b.avgScore), color:C.amber },
        ].map(({ title, list, color }) => (
          <div key={title} style={{ background:C.card, border:`1px solid ${C.border}`,
            borderRadius:14, padding:18, boxShadow:`0 1px 4px ${C.shadow}` }}>
            <div style={{ color:C.txtPri, fontWeight:700, fontSize:14, marginBottom:14 }}>{title}</div>
            {list.length===0
              ? <div style={{ color:C.txtMut, fontSize:13 }}>None at this time.</div>
              : list.map(s => (
                <div key={s.id} style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:28, height:28, borderRadius:"50%", flexShrink:0,
                      background:`hsl(${s.name.charCodeAt(0)*7%360},55%,38%)`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      color:"white", fontWeight:700, fontSize:12 }}>{s.name[0]}</div>
                    <span style={{ color:C.txtSec, fontSize:13 }}>{s.name}</span>
                  </div>
                  <span style={{ color, fontWeight:700, fontSize:14 }}>{s.avgScore}%</span>
                </div>
              ))
            }
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Submissions
// ─────────────────────────────────────────────────────────────────────────────

const Submissions: React.FC = () => {
  const { C } = useTheme();
  const [statusFilter, setStatusFilter] = useState<"all"|"graded"|"pending"|"failed">("all");
  const [practicalFilter, setPracticalFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = SUBMISSIONS.filter(s => {
    const ms = statusFilter==="all" || s.status===statusFilter;
    const mp = practicalFilter==="all" || s.practical===practicalFilter;
    const mq = s.student.toLowerCase().includes(search.toLowerCase());
    return ms && mp && mq;
  });

  return (
    <div>
      <SectionHeading title="Submissions" sub="View and grade all student practical submissions."
        action={<Btn label="Export All" variant="ghost" icon="⬇️" />} />

      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        <div style={{ position:"relative", flex:1, minWidth:200 }}>
          <span style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)",
            color:C.txtMut, fontSize:13, pointerEvents:"none" }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student…"
            style={{ width:"100%", background:C.card, border:`1px solid ${C.border}`,
              color:C.txtPri, borderRadius:8, padding:"8px 12px 8px 32px",
              fontSize:13, boxSizing:"border-box", outline:"none" }} />
        </div>
        <select value={practicalFilter} onChange={e => setPracticalFilter(e.target.value)}
          style={{ background:C.card, border:`1px solid ${C.border}`, color:C.txtSec,
            borderRadius:8, padding:"8px 12px", fontSize:13, cursor:"pointer", outline:"none" }}>
          <option value="all">All Practicals</option>
          <option value="Vanishing Cream">Vanishing Cream</option>
          <option value="Cold Cream">Cold Cream</option>
        </select>
        {(["all","graded","pending","failed"] as const).map(f => (
          <button key={f} onClick={() => setStatusFilter(f)} style={{
            padding:"8px 14px", borderRadius:8, cursor:"pointer", fontWeight:600,
            fontSize:12, border:"none", textTransform:"capitalize",
            background: statusFilter===f ? C.accent : C.card,
            color: statusFilter===f ? "white" : C.txtSec,
          }}>{f}</button>
        ))}
      </div>

      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
        overflow:"hidden", boxShadow:`0 1px 4px ${C.shadow}` }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <TableHead cols={["Student","Practical","Submitted","Duration","Score","Status","Actions"]} />
          <tbody>
            {filtered.map((s,i) => (
              <tr key={s.id} style={{ background: i%2===0 ? "transparent" : `${C.surface}88`,
                borderBottom:`1px solid ${C.border}` }}>
                <td style={{ padding:"12px 14px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:28, height:28, borderRadius:"50%", flexShrink:0,
                      background:`hsl(${s.student.charCodeAt(0)*7%360},55%,38%)`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      color:"white", fontWeight:700, fontSize:12 }}>{s.student[0]}</div>
                    <span style={{ color:C.txtPri, fontSize:13 }}>{s.student}</span>
                  </div>
                </td>
                <td style={{ padding:"12px 14px", color:C.txtSec, fontSize:12 }}>{s.practical}</td>
                <td style={{ padding:"12px 14px", color:C.txtMut, fontSize:12 }}>{s.submittedAt}</td>
                <td style={{ padding:"12px 14px", color:C.txtMut, fontSize:12 }}>{s.duration}</td>
                <td style={{ padding:"12px 14px", minWidth:110 }}>
                  {s.status!=="pending"
                    ? <ScoreBar score={s.score}/>
                    : <span style={{ color:C.txtMut, fontSize:12 }}>Awaiting grade</span>}
                </td>
                <td style={{ padding:"12px 14px" }}><StatusBadge status={s.status} /></td>
                <td style={{ padding:"12px 14px" }}>
                  <div style={{ display:"flex", gap:6 }}>
                    <button style={{ background:"transparent", border:`1px solid ${C.border}`,
                      color:C.txtSec, borderRadius:6, padding:"4px 10px", cursor:"pointer", fontSize:12 }}>View</button>
                    {s.status==="pending" && (
                      <button style={{ background:`${C.green}10`, border:`1px solid ${C.green}44`,
                        color:C.green, borderRadius:6, padding:"4px 10px", cursor:"pointer", fontSize:12 }}>Grade</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0 && (
          <div style={{ padding:40, textAlign:"center", color:C.txtMut }}>No submissions found.</div>
        )}
      </div>
      <div style={{ color:C.txtMut, fontSize:12, marginTop:10 }}>
        {filtered.length} of {SUBMISSIONS.length} submissions
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Announcements
// ─────────────────────────────────────────────────────────────────────────────

const Announcements: React.FC = () => {
  const { C } = useTheme();
  const [list, setList] = useState(ANNOUNCEMENTS);
  const [title, setTitle] = useState("");
  const [body, setBody]   = useState("");
  const [target, setTarget] = useState("All Students");

  const send = () => {
    if (!title.trim() || !body.trim()) return;
    setList(prev => [{ id:`a${Date.now()}`, title, body, target,
      sentAt: new Date().toLocaleString(), read:0, total:10 }, ...prev]);
    setTitle(""); setBody("");
  };

  const labelStyle: React.CSSProperties = {
    color:C.txtMut, fontSize:11, display:"block", marginBottom:5,
    textTransform:"uppercase", letterSpacing:0.7,
  };

  return (
    <div>
      <SectionHeading title="Announcements" sub="Broadcast messages to students." />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 380px", gap:20, alignItems:"start" }}>

        {/* Past */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {list.map(a => (
            <div key={a.id} style={{ background:C.card, border:`1px solid ${C.border}`,
              borderRadius:12, padding:18, boxShadow:`0 1px 4px ${C.shadow}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10, marginBottom:8 }}>
                <div>
                  <div style={{ color:C.txtPri, fontWeight:700, fontSize:14 }}>{a.title}</div>
                  <div style={{ color:C.txtMut, fontSize:11, marginTop:2 }}>{a.sentAt} · To: {a.target}</div>
                </div>
                <div style={{ background:`${C.green}12`, border:`1px solid ${C.green}44`,
                  borderRadius:8, padding:"4px 10px", whiteSpace:"nowrap",
                  color:C.green, fontSize:11, fontWeight:600 }}>
                  {a.read}/{a.total} read
                </div>
              </div>
              <p style={{ color:C.txtSec, fontSize:13, margin:0, lineHeight:1.6 }}>{a.body}</p>
              <div style={{ marginTop:10, height:4, background:C.surface, borderRadius:2, overflow:"hidden",
                border:`1px solid ${C.border}` }}>
                <div style={{ width:`${(a.read/a.total)*100}%`, height:"100%", background:C.green, borderRadius:2 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Compose */}
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
          padding:20, position:"sticky", top:20, boxShadow:`0 1px 4px ${C.shadow}` }}>
          <div style={{ color:C.txtPri, fontWeight:700, fontSize:15, marginBottom:18 }}>📣 New Announcement</div>

          <label style={labelStyle}>Title</label>
          <Input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Lab opens tomorrow" style={{ marginBottom:14 }} />

          <label style={labelStyle}>Target Audience</label>
          <select value={target} onChange={e => setTarget(e.target.value)}
            style={{ width:"100%", background:C.surface, border:`1px solid ${C.border2}`,
              color:C.txtSec, borderRadius:8, padding:"9px 12px", fontSize:13,
              cursor:"pointer", outline:"none", marginBottom:14, boxSizing:"border-box" }}>
            <option>All Students</option>
            <option>Vanishing Cream Group</option>
            <option>Cold Cream Group</option>
          </select>

          <label style={labelStyle}>Message</label>
          <Textarea value={body} onChange={e => setBody(e.target.value)}
            placeholder="Write your message…" rows={5} style={{ marginBottom:16 }} />

          <Btn label="Send Announcement" icon="📤" onClick={send} />
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────────

const Settings: React.FC = () => {
  const { C } = useTheme();
  const [timeLimit,   setTimeLimit]   = useState(90);
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [passScore,   setPassScore]   = useState(60);
  const [autoGrade,   setAutoGrade]   = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [regOpen,     setRegOpen]     = useState(true);
  const [saved,       setSaved]       = useState(false);

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };

  const Toggle: React.FC<{ value:boolean; onChange:(v:boolean)=>void }> = ({ value, onChange }) => (
    <div onClick={() => onChange(!value)} style={{ width:44, height:24, borderRadius:12, cursor:"pointer",
      background: value ? C.accent : C.border2, position:"relative", transition:"background .2s", flexShrink:0 }}>
      <div style={{ width:18, height:18, borderRadius:"50%", background:"white",
        position:"absolute", top:3, left: value ? 23 : 3, transition:"left .2s",
        boxShadow:"0 1px 3px rgba(0,0,0,0.25)" }} />
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

  const Block: React.FC<{ title:string; children:React.ReactNode }> = ({ title, children }) => (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
      padding:20, marginBottom:18, boxShadow:`0 1px 4px ${C.shadow}` }}>
      <div style={{ color:C.txtPri, fontWeight:700, fontSize:14, marginBottom:4 }}>{title}</div>
      {children}
    </div>
  );

  const numInput = (val: number, set: (v:number)=>void) => (
    <input type="number" value={val} onChange={e => set(+e.target.value)}
      style={{ width:64, background:C.surface, border:`1px solid ${C.border2}`,
        color:C.txtPri, borderRadius:7, padding:"6px 10px", fontSize:13, textAlign:"center" }} />
  );

  return (
    <div style={{ maxWidth:700 }}>
      <SectionHeading title="Settings" sub="Configure lab behaviour, grading, and access controls." />

      <Block title="⏱ Lab Timing">
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

      <Block title="📊 Grading">
        <Row label="Auto-Grade Submissions" sub="Automatically score objective questions on submission">
          <Toggle value={autoGrade} onChange={setAutoGrade} />
        </Row>
        <Row label="Passing Score" sub="Minimum score required to pass a practical">
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {numInput(passScore, setPassScore)}
            <span style={{ color:C.txtMut, fontSize:12 }}>%</span>
          </div>
        </Row>
      </Block>

      <Block title="🔐 Student Access">
        <Row label="Open Registration" sub="Allow new students to self-register with the enrolment code">
          <Toggle value={regOpen} onChange={setRegOpen} />
        </Row>
        <Row label="Enrolment Code" sub="Share this code with students to join your class">
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <code style={{ background:C.surface, border:`1px solid ${C.border2}`,
              color:C.accent, borderRadius:6, padding:"5px 12px", fontSize:13,
              letterSpacing:1.5, fontWeight:700 }}>VCLAB-2026</code>
            <button style={{ background:"transparent", border:`1px solid ${C.border2}`,
              color:C.txtMut, borderRadius:6, padding:"5px 10px", cursor:"pointer", fontSize:12 }}>Copy</button>
          </div>
        </Row>
      </Block>

      <Block title="🔔 Notifications">
        <Row label="Email Alerts" sub="Receive an email when a student submits a practical">
          <Toggle value={emailAlerts} onChange={setEmailAlerts} />
        </Row>
        <Row label="Teacher Email" sub="Address used for all system notifications">
          <input defaultValue="teacher@school.edu"
            style={{ background:C.surface, border:`1px solid ${C.border2}`,
              color:C.txtPri, borderRadius:8, padding:"7px 12px", fontSize:13,
              width:220, outline:"none" }} />
        </Row>
      </Block>

      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
        <Btn label="Save Changes" onClick={save} />
        {saved && <span style={{ color:C.green, fontSize:13, fontWeight:600 }}>✓ Saved</span>}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar nav config
// ─────────────────────────────────────────────────────────────────────────────

const NAV: { id:Section; label:string; icon:string }[] = [
  { id:"dashboard",     label:"Dashboard",     icon:"🏠" },
  { id:"practicals",    label:"Practicals",    icon:"🧪" },
  { id:"questions",     label:"Questions",     icon:"📝" },
  { id:"students",      label:"Students",      icon:"👥" },
  { id:"analytics",     label:"Analytics",     icon:"📈" },
  { id:"submissions",   label:"Submissions",   icon:"📋" },
  { id:"announcements", label:"Announcements", icon:"📣" },
  { id:"settings",      label:"Settings",      icon:"⚙️" },
];

const SECTION_LABELS: Record<Section,string> = {
  dashboard:"Dashboard", practicals:"Practicals", questions:"Questions",
  students:"Students", analytics:"Analytics", submissions:"Submissions",
  announcements:"Announcements", settings:"Settings",
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component — owns theme state, provides ThemeCtx
// ─────────────────────────────────────────────────────────────────────────────

interface Props { onBack: () => void; }

const TeacherPanel: React.FC<Props> = ({ onBack }) => {
  const [isDark,      setIsDark]      = useState(true);
  const [section,     setSection]     = useState<Section>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const C = isDark ? DARK : LIGHT;
  const toggle = () => setIsDark(v => !v);

  const renderSection = () => {
    switch (section) {
      case "dashboard":     return <Dashboard />;
      case "practicals":    return <Practicals />;
      case "questions":     return <Questions />;
      case "students":      return <Students />;
      case "analytics":     return <Analytics />;
      case "submissions":   return <Submissions />;
      case "announcements": return <Announcements />;
      case "settings":      return <Settings />;
    }
  };

  const sidebarW = sidebarOpen ? 240 : 64;

  return (
    <ThemeCtx.Provider value={{ C, isDark, toggle }}>
      <div style={{ display:"flex", height:"100vh", background:C.bg,
        fontFamily:"system-ui,-apple-system,sans-serif", overflow:"hidden",
        transition:"background .25s ease" }}>

        {/* ── Sidebar ── */}
        <aside style={{ width:sidebarW, minWidth:sidebarW, background:C.sidebar,
          borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column",
          transition:"width .2s ease,min-width .2s ease,background .25s ease",
          overflow:"hidden", flexShrink:0,
          boxShadow:`2px 0 8px ${C.shadow}` }}>

          {/* Logo */}
          <div style={{ padding: sidebarOpen ? "18px 20px" : "18px 12px",
            borderBottom:`1px solid ${C.border}`, display:"flex",
            alignItems:"center", justifyContent:"space-between", gap:10, minHeight:64 }}>
            {sidebarOpen ? (
              <>
                <div style={{ display:"flex", alignItems:"center", gap:10, overflow:"hidden" }}>
                  <div style={{ width:34, height:34, borderRadius:10, flexShrink:0,
                    background:"linear-gradient(135deg,#2563eb,#7c3aed)",
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🧪</div>
                  <div style={{ overflow:"hidden" }}>
                    <div style={{ color:C.txtPri, fontWeight:800, fontSize:13, whiteSpace:"nowrap" }}>VirtualLab</div>
                    <div style={{ color:C.txtMut, fontSize:10, whiteSpace:"nowrap" }}>Teacher Panel</div>
                  </div>
                </div>
                <button onClick={() => setSidebarOpen(false)}
                  style={{ background:"transparent", border:"none", color:C.txtMut,
                    cursor:"pointer", fontSize:16, padding:4, flexShrink:0, lineHeight:1 }}>☰</button>
              </>
            ) : (
              <button onClick={() => setSidebarOpen(true)}
                style={{ margin:"0 auto", background:"transparent", border:"none", cursor:"pointer",
                  width:34, height:34, borderRadius:10,
                  background2:"linear-gradient(135deg,#2563eb,#7c3aed)",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 } as React.CSSProperties}>
                <div style={{ width:34, height:34, borderRadius:10,
                  background:"linear-gradient(135deg,#2563eb,#7c3aed)",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🧪</div>
              </button>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex:1, padding:"12px 8px", overflowY:"auto" }}>
            {NAV.map(item => {
              const active = section===item.id;
              return (
                <button key={item.id} onClick={() => setSection(item.id)} style={{
                  width:"100%", display:"flex", alignItems:"center",
                  gap: sidebarOpen ? 10 : 0,
                  justifyContent: sidebarOpen ? "flex-start" : "center",
                  padding: sidebarOpen ? "10px 12px" : "10px 0",
                  borderRadius:9, border:"none", cursor:"pointer", marginBottom:3,
                  background: active ? `${C.accent}20` : "transparent",
                  color: active ? C.accent : C.txtSec,
                  fontWeight: active ? 700 : 500, fontSize:13,
                  transition:"background .15s,color .15s",
                  textAlign:"left", whiteSpace:"nowrap", overflow:"hidden",
                }}>
                  <span style={{ fontSize:17, flexShrink:0 }}>{item.icon}</span>
                  {sidebarOpen && <span>{item.label}</span>}
                  {active && sidebarOpen && (
                    <span style={{ marginLeft:"auto", width:6, height:6, borderRadius:"50%",
                      background:C.accent, flexShrink:0 }} />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Back to student view */}
          <div style={{ padding:"12px 8px", borderTop:`1px solid ${C.border}` }}>
            <button onClick={onBack} style={{
              width:"100%", display:"flex", alignItems:"center",
              gap: sidebarOpen ? 10 : 0,
              justifyContent: sidebarOpen ? "flex-start" : "center",
              padding: sidebarOpen ? "10px 12px" : "10px 0",
              borderRadius:9, border:"none", cursor:"pointer",
              background:"transparent", color:C.txtMut, fontSize:13,
            }}>
              <span style={{ fontSize:16 }}>←</span>
              {sidebarOpen && <span>Student View</span>}
            </button>
          </div>
        </aside>

        {/* ── Main area ── */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0,
          transition:"background .25s ease" }}>

          {/* Top bar */}
          <header style={{ height:60, borderBottom:`1px solid ${C.border}`,
            background:C.headerBg, display:"flex", alignItems:"center",
            justifyContent:"space-between", padding:"0 24px", flexShrink:0,
            boxShadow:`0 1px 4px ${C.shadow}`, transition:"background .25s ease,border-color .25s ease" }}>

            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              {!sidebarOpen && (
                <button onClick={() => setSidebarOpen(true)}
                  style={{ background:"transparent", border:"none", color:C.txtSec,
                    cursor:"pointer", fontSize:18, padding:4, lineHeight:1 }}>☰</button>
              )}
              <span style={{ color:C.txtMut, fontSize:12 }}>Teacher Panel</span>
              <span style={{ color:C.txtMut }}>›</span>
              <span style={{ color:C.txtPri, fontWeight:700, fontSize:14 }}>
                {SECTION_LABELS[section]}
              </span>
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              {/* Live badge */}
              <div style={{ background:`${C.green}15`, border:`1px solid ${C.green}40`,
                borderRadius:20, padding:"3px 12px", color:C.green, fontSize:11, fontWeight:700 }}>
                ● Live
              </div>

              {/* ── Theme toggle button ── */}
              <button
                onClick={toggle}
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                style={{
                  width:38, height:38, borderRadius:10, cursor:"pointer",
                  background: isDark ? "#1e293b" : "#f1f5f9",
                  border: `1px solid ${C.border2}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  color: isDark ? "#e2e8f0" : "#0f172a",
                  transition:"background .2s,border-color .2s,color .2s",
                  flexShrink:0,
                }}>
                {isDark ? <SunIcon size={17} /> : <MoonIcon size={17} />}
              </button>

              {/* Avatar */}
              <div style={{ width:34, height:34, borderRadius:"50%",
                background:"linear-gradient(135deg,#2563eb,#7c3aed)",
                display:"flex", alignItems:"center", justifyContent:"center",
                color:"white", fontWeight:800, fontSize:14, cursor:"pointer",
                flexShrink:0 }}>T</div>
            </div>
          </header>

          {/* Scrollable content */}
          <main style={{ flex:1, overflowY:"auto", padding:"28px 28px 40px",
            background:C.bg, transition:"background .25s ease" }}>
            {renderSection()}
          </main>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
};

export default TeacherPanel;
