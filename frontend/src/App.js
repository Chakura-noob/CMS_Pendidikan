import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  LogOut, LayoutDashboard, Users, BookOpen, School, CalendarDays,
  ClipboardList, Video, CheckCircle2, Plus, ArrowUpRight, Download,
  Bell, User as UserIcon
} from "lucide-react";
import "@/App.css";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const h = () => ({ Authorization: `Bearer ${localStorage.getItem("lms_token")}` });

const icons = {
  Dashboard: LayoutDashboard, Academic: CalendarDays, Teachers: Users,
  Students: Users, Classes: School, Subjects: BookOpen,
  "Teaching Assignments": ClipboardList, "My Classes": School,
  Attendance: CheckCircle2, "Grade Reports": ClipboardList, PJJ: Video,
  Assignments: ClipboardList, Profile: UserIcon
};
const adminNav = ["Dashboard", "Academic", "Teachers", "Students", "Classes", "Subjects", "Teaching Assignments", "Profile"];
const teacherNav = ["Dashboard", "My Classes", "Attendance", "Grade Reports", "PJJ", "Profile"];
const studentNav = ["Dashboard", "Subjects", "Assignments", "PJJ", "Attendance", "Profile"];

function Pill({ children, tone = "blue" }) {
  return <span className={`pill ${tone}`} data-testid="status-badge">{children}</span>;
}

function Stat({ label, value, icon: Icon, accent }) {
  return (
    <div className="stat-card" data-testid={`stat-${label.toLowerCase().replaceAll(" ", "-")}`}>
      <div className={`stat-icon ${accent}`}><Icon size={20} /></div>
      <div><span>{label}</span><strong>{value}</strong></div>
    </div>
  );
}

function Login({ onLogin }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const submit = async e => {
    e.preventDefault();
    try {
      const r = await axios.post(`${API}/auth/login`, form);
      localStorage.setItem("lms_token", r.data.token);
      onLogin(r.data.user);
    } catch (x) { setError(x.response?.data?.detail || "Unable to sign in"); }
  };
  return (
    <main className="login-shell">
      <section className="login-visual">
        <div className="brand-mark">N</div>
        <p className="eyebrow">NUSANTARA SMP</p>
        <h1>Learning that moves<br /><em>everyone</em> forward.</h1>
        <p className="visual-copy">A focused space for school communities to learn, teach, and grow together.</p>
        <div className="login-image" />
      </section>
      <section className="login-panel">
        <div className="login-form-wrap">
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Sign in to your portal</h2>
          <p className="muted">Use your school account to continue.</p>
          <form onSubmit={submit} data-testid="login-form">
            <label>Username
              <input data-testid="login-username-input" value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                placeholder="e.g. guru.budi" required />
            </label>
            <label>Password
              <input data-testid="login-password-input" type="password" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="Enter your password" required />
            </label>
            {error && <div className="error" data-testid="login-error">{error}</div>}
            <button className="primary-btn" data-testid="login-submit-button">
              Sign in <ArrowUpRight size={18} />
            </button>
          </form>
          <div className="demo-box">
            <strong>Demo access</strong>
            <span>admin / admin123</span>
            <span>guru.budi / password</span>
            <span>siswa.budi / password</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function Sidebar({ user, page, setPage, onLogout }) {
  const nav = user.role === "admin" ? adminNav : user.role === "teacher" ? teacherNav : studentNav;
  return (
    <aside className="sidebar">
      <div className="side-brand">
        <div className="brand-mark small">N</div>
        <div><b>Nusantara</b><span>SMP Learning Portal</span></div>
      </div>
      <div className="role-chip"><span className={`role-dot ${user.role}`} />{user.role} portal</div>
      <nav>
        {nav.map(item => {
          const Icon = icons[item] || LayoutDashboard;
          return (
            <button className={page === item ? "active" : ""} key={item}
              onClick={() => setPage(item)}
              data-testid={`nav-${item.toLowerCase().replaceAll(" ", "-")}`}>
              <Icon size={18} />{item}
            </button>
          );
        })}
      </nav>
      <div className="side-bottom">
        <div className="user-mini">
          <div className="avatar">{user.name?.[0]}</div>
          <div><b>{user.name}</b><span>@{user.username}</span></div>
        </div>
        <button className="logout" onClick={onLogout} data-testid="logout-button">
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </aside>
  );
}

function Header({ user, page, period }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{user.role.toUpperCase()} WORKSPACE</p>
        <h2>{page}</h2>
      </div>
      <div className="top-actions">
        <div className="period" data-testid="active-period-header">
          <span>ACTIVE PERIOD</span>
          <b>{period?.year || "—"} · {period?.semester || "—"}</b>
        </div>
        <div className="avatar top-avatar">{user.name?.[0]}</div>
      </div>
    </header>
  );
}

/* --------------------- Admin --------------------- */

function AdminList({ selected, refreshKey, bump }) {
  const [items, setItems] = useState([]);
  const [show, setShow] = useState(false);
  const map = { Academic: "periods", Teachers: "users", Students: "users", Classes: "classes", Subjects: "subjects", "Teaching Assignments": "assignments" };
  const collection = map[selected];
  const role = selected === "Teachers" ? "teacher" : selected === "Students" ? "student" : undefined;

  useEffect(() => {
    if (!collection) return;
    axios.get(`${API}/admin/${collection}`, { headers: h(), params: role ? { role } : undefined })
      .then(r => setItems(r.data));
  }, [collection, role, refreshKey]);

  const activate = async id => {
    await axios.post(`${API}/admin/periods/${id}/activate`, {}, { headers: h() });
    bump();
  };

  return (
    <section className="content">
      <div className="section-head">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>{selected}</h1>
          <p className="muted">Keep your school data accurate and ready for learning.</p>
        </div>
        <button className="primary-btn compact" onClick={() => setShow(true)} data-testid="add-record-button">
          <Plus size={17} /> Add {selected === "Academic" ? "period" : selected.toLowerCase().replace("teaching assignments", "assignment")}
        </button>
      </div>
      <div className="table-card">
        <div className="table-toolbar"><span>{items.length} records</span><Pill>{selected === "Academic" ? "Academic periods" : "Master data"}</Pill></div>
        {items.map((x, i) => (
          <div className="data-row" key={x.id || i} data-testid={`record-row-${i}`}>
            <div className="row-main">
              <div className="row-icon">
                {selected === "Classes" ? <School size={18} /> : selected === "Subjects" ? <BookOpen size={18} /> : <Users size={18} />}
              </div>
              <div>
                <b>{x.name || x.title || (selected === "Academic" ? `${x.year} · ${x.semester}` : `${x.teacher} · ${x.class_name}`)}</b>
                <span>{selected === "Academic" ? `Semester ${x.semester}` : (x.detail || x.username || x.subject || `${x.year} · ${x.semester}`)}</span>
              </div>
            </div>
            {selected === "Academic" ? (
              x.active
                ? <Pill tone="green">Active</Pill>
                : <button className="text-btn" onClick={() => activate(x.id)} data-testid={`activate-period-${i}`}>Activate</button>
            ) : x.status ? (
              <Pill tone={x.status === "Active" ? "green" : "gray"}>{x.status}</Pill>
            ) : <Pill tone="green">Active</Pill>}
          </div>
        ))}
        {!items.length && <div className="empty">No records yet.</div>}
      </div>
      {show && (
        <CreateModal collection={collection} selected={selected}
          close={() => setShow(false)}
          refresh={() => { setShow(false); bump(); }} />
      )}
    </section>
  );
}

function CreateModal({ collection, selected, close, refresh }) {
  const [form, setForm] = useState({});
  const [error, setError] = useState("");
  const save = async () => {
    try {
      const payload = { ...form };
      if (selected === "Teachers") payload.role = "teacher";
      if (selected === "Students") payload.role = "student";
      await axios.post(`${API}/admin/${collection}`, payload, { headers: h() });
      refresh();
    } catch (x) { setError(x.response?.data?.detail || "Could not save this record"); }
  };
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <button className="modal-close" onClick={close} data-testid="close-modal-button">×</button>
        <p className="eyebrow">NEW RECORD</p>
        <h3>Add {selected}</h3>
        {selected === "Academic" ? (
          <>
            <input data-testid="period-year-input" placeholder="Academic year e.g. 2027/2028"
              onChange={e => setForm({ ...form, year: e.target.value })} />
            <select data-testid="period-semester-select"
              onChange={e => setForm({ ...form, semester: e.target.value })} defaultValue="Ganjil">
              <option>Ganjil</option><option>Genap</option>
            </select>
            <label className="check-line">
              <input type="checkbox" data-testid="period-active-check"
                onChange={e => setForm({ ...form, active: e.target.checked })} />
              Activate this period now
            </label>
          </>
        ) : selected === "Teaching Assignments" ? (
          <>
            <input placeholder="Teacher name" data-testid="assignment-teacher-input"
              onChange={e => setForm({ ...form, teacher: e.target.value })} />
            <input placeholder="Class name" data-testid="assignment-class-input"
              onChange={e => setForm({ ...form, class_name: e.target.value })} />
            <input placeholder="Subject" data-testid="assignment-subject-input"
              onChange={e => setForm({ ...form, subject: e.target.value })} />
          </>
        ) : selected === "Teachers" || selected === "Students" ? (
          <>
            <input placeholder="Full name" data-testid="user-name-input"
              onChange={e => setForm({ ...form, name: e.target.value })} />
            <input placeholder="Username" data-testid="user-username-input"
              onChange={e => setForm({ ...form, username: e.target.value })} />
            <input type="password" placeholder="Password" data-testid="user-password-input"
              onChange={e => setForm({ ...form, password: e.target.value })} />
            {selected === "Teachers" ? (
              <input placeholder="NIP" data-testid="user-nip-input"
                onChange={e => setForm({ ...form, nip: e.target.value })} />
            ) : (
              <>
                <input placeholder="NIS" data-testid="user-nis-input"
                  onChange={e => setForm({ ...form, nis: e.target.value })} />
                <input placeholder="NISN" data-testid="user-nisn-input"
                  onChange={e => setForm({ ...form, nisn: e.target.value })} />
                <input placeholder="Class name (e.g. VIII-A)" data-testid="user-class-input"
                  onChange={e => setForm({ ...form, class_name: e.target.value })} />
              </>
            )}
          </>
        ) : (
          <input data-testid="record-name-input"
            placeholder={`Enter ${selected.toLowerCase()} name`}
            onChange={e => setForm({ ...form, name: e.target.value, detail: "Added by admin" })} />
        )}
        <button className="primary-btn" onClick={save} data-testid="save-record-button">Save record</button>
        {error && <div className="error" data-testid="record-save-error">{error}</div>}
      </div>
    </div>
  );
}

function AdminView({ data, page, refreshKey, bump }) {
  if (page === "Dashboard") return <Dashboard user={data.user} period={data.period} counts={data.counts} />;
  if (page === "Profile") return <ProfileView user={data.user} period={data.period} />;
  return <AdminList selected={page} refreshKey={refreshKey} bump={bump} />;
}

/* --------------------- Dashboards --------------------- */

function Dashboard({ user, period, counts, data }) {
  const role = user.role;
  return (
    <section className="content">
      <div className="welcome">
        <div>
          <p className="eyebrow">{period?.year} · {period?.semester} · ACTIVE</p>
          <h1 data-testid="welcome-heading">
            {role === "student" ? `Welcome, ${user.name.split(" ")[0]}` : `Good day, ${user.name.split(",")[0]}`}
          </h1>
          <p className="muted">
            {role === "admin" ? "Here's the pulse of your school community today."
              : role === "teacher" ? "Your teaching day, organised in one calm view."
                : `Class ${user.class_name || "—"} · Keep learning at your own pace.`}
          </p>
        </div>
        <div className="welcome-illustration">
          <School size={38} />
          <span>{role === "admin" ? "Academic control centre" : role === "teacher" ? "Ready to teach" : "Your learning space"}</span>
        </div>
      </div>
      {role === "admin" && counts && (
        <div className="stats-grid">
          <Stat label="Teachers" value={counts.teachers} icon={Users} accent="indigo" />
          <Stat label="Students" value={counts.students} icon={Users} accent="cyan" />
          <Stat label="Classes" value={counts.classes} icon={School} accent="amber" />
          <Stat label="Subjects" value={counts.subjects} icon={BookOpen} accent="green" />
        </div>
      )}
      {role === "teacher" && data?.counts && (
        <div className="stats-grid">
          <Stat label="Classes" value={data.counts.classes} icon={School} accent="indigo" />
          <Stat label="Subjects" value={data.counts.subjects} icon={BookOpen} accent="cyan" />
          <Stat label="Assignments" value={data.counts.assignments} icon={ClipboardList} accent="amber" />
          <Stat label="Pending reviews" value={data.counts.pending} icon={CheckCircle2} accent="green" />
        </div>
      )}
      {role === "student" && data && <StudentDash data={data} />}
      {role === "admin" && (
        <div className="split-grid">
          <div className="table-card">
            <div className="card-title"><div><p className="eyebrow">QUICK VIEW</p><h3>Academic period</h3></div><Pill tone="green">Active</Pill></div>
            <div className="period-large"><CalendarDays /><div><strong>{period?.year}</strong><span>Semester {period?.semester}</span></div></div>
          </div>
          <div className="table-card accent-panel">
            <p className="eyebrow">SYSTEM NOTE</p>
            <h3>Ready for the new term?</h3>
            <p className="muted">Set up your classes, subjects, and teaching assignments to prepare the school workspace.</p>
          </div>
        </div>
      )}
      {role === "teacher" && data && <TeacherDash data={data} />}
    </section>
  );
}

function TeacherDash({ data }) {
  const classes = [...new Set((data.assignments || []).map(a => `${a.class_name} · ${a.subject}`))];
  return (
    <div className="split-grid">
      <div className="table-card">
        <div className="card-title"><div><p className="eyebrow">MY CLASSES</p><h3>Teaching assignments</h3></div><Pill>{classes.length} classes</Pill></div>
        {classes.length ? classes.map(x => (
          <div className="data-row" key={x}>
            <div className="row-main"><div className="row-icon indigo-bg"><School size={18} /></div>
              <div><b>{x}</b><span>{data.period?.year} · {data.period?.semester}</span></div></div>
            <ArrowUpRight size={17} />
          </div>
        )) : <div className="empty">No teaching assignments yet.</div>}
      </div>
      <div className="table-card">
        <div className="card-title"><div><p className="eyebrow">WORK TO REVIEW</p><h3>Latest submissions</h3></div></div>
        {(data.submissions || []).slice(0, 4).map(s => (
          <div className="activity" key={s.id}><span className="activity-dot" />
            <div><b>{s.student_name}</b><span>{s.filename}</span></div>
            <Pill tone={s.status === "Graded" ? "green" : "amber"}>{s.status}</Pill>
          </div>
        ))}
        {!data.submissions?.length && <div className="empty">Submissions from students will appear here.</div>}
      </div>
    </div>
  );
}

function StudentDash({ data }) {
  const att = data.attendance?.stats || { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 };
  const pct = data.attendance?.percentage || 0;
  const subjectList = (data.subjects || []).slice(0, 3);
  return (
    <div className="student-grid">
      <div className="table-card attendance-card">
        <div className="card-title"><div><p className="eyebrow">THIS TERM</p><h3>Attendance</h3></div>
          <strong className="attendance-percent" data-testid="attendance-percent">{pct}%</strong></div>
        <div className="attendance-list">
          {[{ l: "Hadir", n: att.Hadir, c: "green" }, { l: "Izin", n: att.Izin, c: "blue" }, { l: "Sakit", n: att.Sakit, c: "amber" }, { l: "Alpa", n: att.Alpa, c: "red" }].map(x => (
            <div key={x.l}><span><i className={`dot ${x.c}`} />{x.l}</span><b>{x.n}</b></div>
          ))}
        </div>
      </div>
      <div className="table-card">
        <div className="card-title"><div><p className="eyebrow">CONTINUE LEARNING</p><h3>My subjects</h3></div></div>
        <div className="subject-list">
          {subjectList.map((s, i) => (
            <div className="subject-item" key={s.id || s.name}>
              <div className={`subject-icon s${i}`}><BookOpen size={18} /></div>
              <b>{s.name}</b><ArrowUpRight size={16} />
            </div>
          ))}
        </div>
      </div>
      <div className="table-card upcoming">
        <div className="card-title"><div><p className="eyebrow">UP NEXT</p><h3>Upcoming work</h3></div><Pill tone="amber">{(data.tasks || []).length} due</Pill></div>
        {(data.tasks || []).slice(0, 2).map(t => (
          <div className="task-line" key={t.id}><ClipboardList size={18} />
            <div><b>{t.title}</b><span>{t.subject} · Due {t.due}</span></div>
            <Pill>{t.status}</Pill></div>
        ))}
        {(data.pjj || []).slice(0, 1).map(j => (
          <div className="task-line" key={j.id}><Video size={18} />
            <div><b>{j.title}</b><span>{j.platform} · {j.date} · {j.time}</span></div>
            <a className="join-link" href={j.url} target="_blank" rel="noreferrer" data-testid={`join-meeting-${j.id}`}>
              Join <ArrowUpRight size={14} />
            </a></div>
        ))}
      </div>
    </div>
  );
}

/* --------------------- Notifications --------------------- */

function NoticeList({ items = [], onRead }) {
  if (!items.length) return <div className="empty">You're all caught up.</div>;
  return (
    <div className="notice-list">
      {items.slice(0, 6).map(n => (
        <div className={`notice ${n.read ? "read" : ""}`} key={n.id} data-testid="notification-item">
          <span className={`notice-dot ${n.kind}`} />
          <div><b>{n.title}</b><span>{n.detail} · {n.created}</span></div>
          {!n.read && (
            <button className="text-btn" data-testid={`mark-read-${n.id}`}
              onClick={() => onRead(n.id)}>Mark read</button>
          )}
        </div>
      ))}
    </div>
  );
}

/* --------------------- Teacher --------------------- */

function TeacherAttendance({ assignments }) {
  const options = [...new Set((assignments || []).map(a => `${a.class_name}::${a.subject}`))];
  const [selection, setSelection] = useState(options[0] || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!selection) return;
    const [class_name] = selection.split("::");
    axios.get(`${API}/teacher/roster`, { headers: h(), params: { class_name } })
      .then(r => {
        setRoster(r.data);
        setStatuses(Object.fromEntries(r.data.map(s => [s.id, "Hadir"])));
      });
  }, [selection]);

  const save = async () => {
    const [class_name, subject] = selection.split("::");
    const records = roster.map(r => ({ student_id: r.id, student_name: r.name, status: statuses[r.id] || "Alpa" }));
    await axios.post(`${API}/teacher/attendance`, { class_name, subject, date, records }, { headers: h() });
    setMessage("Attendance saved successfully");
  };

  return (
    <section className="content">
      <div className="section-head">
        <div><p className="eyebrow">TEACHER WORKSPACE</p><h1>Attendance</h1>
          <p className="muted">Mark class attendance for each session.</p></div>
      </div>
      {message && <div className="success" data-testid="attendance-success-message">{message}</div>}
      <div className="table-card">
        <div className="filter-row">
          <label>Class · Subject
            <select value={selection} onChange={e => setSelection(e.target.value)} data-testid="attendance-class-select">
              {options.map(o => <option key={o} value={o}>{o.replace("::", " · ")}</option>)}
            </select>
          </label>
          <label>Date
            <input type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="attendance-date-input" />
          </label>
        </div>
        {roster.length ? roster.map(s => (
          <div className="data-row" key={s.id}>
            <div className="row-main">
              <div className="row-icon indigo-bg"><UserIcon size={18} /></div>
              <div><b>{s.name}</b><span>NIS {s.nis || "—"}</span></div>
            </div>
            <div className="attendance-radio">
              {["Hadir", "Izin", "Sakit", "Alpa"].map(v => (
                <label key={v} className={statuses[s.id] === v ? `on ${v}` : ""}>
                  <input type="radio" name={`att-${s.id}`} value={v}
                    checked={statuses[s.id] === v}
                    onChange={() => setStatuses({ ...statuses, [s.id]: v })}
                    data-testid={`attendance-${s.id}-${v.toLowerCase()}`} />
                  {v}
                </label>
              ))}
            </div>
          </div>
        )) : <div className="empty">No students in this class yet.</div>}
        {roster.length > 0 && (
          <button className="primary-btn" style={{ marginTop: 20 }} onClick={save} data-testid="attendance-save-button">
            Save attendance
          </button>
        )}
      </div>
    </section>
  );
}

function TeacherPjj({ pjj, assignments, refresh }) {
  const [form, setForm] = useState({ title: "", class_name: "", subject: "", date: "", start_time: "", end_time: "", platform: "Google Meet", url: "", notes: "" });
  const [message, setMessage] = useState("");
  const options = [...new Set((assignments || []).map(a => `${a.class_name}::${a.subject}`))];
  const create = async e => {
    e.preventDefault();
    await axios.post(`${API}/teacher/pjj`, form, { headers: h() });
    setMessage("PJJ session created successfully");
    refresh();
  };
  return (
    <section className="content">
      <div className="section-head">
        <div><p className="eyebrow">TEACHER WORKSPACE</p><h1>PJJ Schedules</h1>
          <p className="muted">Plan online sessions with Google Meet or Zoom links.</p></div>
      </div>
      {message && <div className="success" data-testid="pjj-success-message">{message}</div>}
      <div className="creator-grid">
        <form className="table-card creator" onSubmit={create} data-testid="pjj-create-form">
          <div className="card-title"><div><p className="eyebrow">NEW SESSION</p><h3>Create PJJ</h3></div><Video size={20} /></div>
          <input required placeholder="Session title" data-testid="pjj-title-input"
            onChange={e => setForm({ ...form, title: e.target.value })} />
          <select required data-testid="pjj-class-select"
            onChange={e => { const [c, s] = e.target.value.split("::"); setForm({ ...form, class_name: c, subject: s }); }}>
            <option value="">Select class · subject</option>
            {options.map(o => <option key={o} value={o}>{o.replace("::", " · ")}</option>)}
          </select>
          <input required type="date" data-testid="pjj-date-input"
            onChange={e => setForm({ ...form, date: e.target.value })} />
          <div className="options-row">
            <input required type="time" data-testid="pjj-start-input"
              onChange={e => setForm({ ...form, start_time: e.target.value })} />
            <input required type="time" data-testid="pjj-end-input"
              onChange={e => setForm({ ...form, end_time: e.target.value })} />
          </div>
          <select data-testid="pjj-platform-select" defaultValue="Google Meet"
            onChange={e => setForm({ ...form, platform: e.target.value })}>
            <option>Google Meet</option><option>Zoom</option><option>Other</option>
          </select>
          <input required placeholder="Meeting URL" data-testid="pjj-url-input"
            onChange={e => setForm({ ...form, url: e.target.value })} />
          <textarea placeholder="Notes (optional)"
            onChange={e => setForm({ ...form, notes: e.target.value })} />
          <button className="primary-btn" data-testid="pjj-create-submit">Publish session</button>
        </form>
        <div className="table-card">
          <div className="card-title"><div><p className="eyebrow">SCHEDULE</p><h3>Upcoming sessions</h3></div></div>
          {(pjj || []).map(j => (
            <div className="data-row" key={j.id}>
              <div className="row-main"><div className="row-icon indigo-bg"><Video size={18} /></div>
                <div><b>{j.title}</b><span>{j.class_name || "All"} · {j.subject} · {j.date} · {j.time}</span></div></div>
              <Pill tone={j.status === "Completed" ? "gray" : "green"}>{j.status}</Pill>
            </div>
          ))}
          {!pjj?.length && <div className="empty">No sessions scheduled.</div>}
        </div>
      </div>
    </section>
  );
}

function TeacherGradeReports({ notifications, onRead }) {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const [scoreInputs, setScoreInputs] = useState({});
  const [feedbackInputs, setFeedbackInputs] = useState({});
  const [savedFeedback, setSavedFeedback] = useState({});

  const load = useCallback(() => {
    axios.get(`${API}/teacher/grades`, { headers: h() }).then(r => setRows(r.data));
  }, []);
  useEffect(() => { load(); }, [load]);

  const grade = async id => {
    const score = Number(scoreInputs[id] || 0);
    const feedback = feedbackInputs[id] || "Keep going, you're improving!";
    const r = await axios.patch(`${API}/teacher/submissions/${id}`,
      { score, feedback }, { headers: h() });
    setSavedFeedback({ ...savedFeedback, [id]: `Final ${r.data.final_score} · Assignment ${r.data.score} · Quiz ${r.data.quiz_score} · Feedback saved` });
    setMessage("Grade saved successfully");
    load();
  };

  const exportExcel = async () => {
    const r = await axios.get(`${API}/teacher/grades/export`, { headers: h(), responseType: "blob" });
    const blob = new Blob([r.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "grade-report.xlsx";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className="content">
      <div className="section-head">
        <div><p className="eyebrow">TEACHER WORKSPACE</p><h1>Grade Reports</h1>
          <p className="muted">Review submissions and give feedback that moves learning forward.</p></div>
        <button className="primary-btn compact" onClick={exportExcel} data-testid="export-grades-button">
          <Download size={17} /> Export Excel
        </button>
      </div>
      {message && <div className="success" data-testid="teacher-success-message">{message}</div>}
      <div className="table-card">
        <div className="card-title"><div><p className="eyebrow">SUBMISSIONS</p><h3>Student work</h3></div>
          <Pill tone="amber">{rows.filter(x => !x.score).length} pending</Pill></div>
        {rows.map(s => (
          <div className="data-row grade-row" key={s.id}>
            <div className="row-main"><div className="row-icon indigo-bg"><UserIcon size={18} /></div>
              <div><b>{s.student_name}</b><span>{s.class_name} · {s.filename} · {s.status}</span></div></div>
            <div className="grade-inline">
              <input placeholder="Score" type="number" min="0" max="100"
                value={scoreInputs[s.id] ?? s.score ?? ""}
                onChange={e => setScoreInputs({ ...scoreInputs, [s.id]: e.target.value })}
                data-testid={`grade-input-${s.id}`} />
              <input placeholder="Feedback" style={{ width: 180 }}
                value={feedbackInputs[s.id] ?? s.feedback ?? ""}
                onChange={e => setFeedbackInputs({ ...feedbackInputs, [s.id]: e.target.value })}
                data-testid={`feedback-input-${s.id}`} />
              <button className="text-btn" onClick={() => grade(s.id)}
                data-testid={`grade-submit-${s.id}`}>Save</button>
            </div>
            {savedFeedback[s.id] && (
              <div className="success grade-feedback" data-testid={`grade-feedback-${s.id}`}>{savedFeedback[s.id]}</div>
            )}
          </div>
        ))}
        {!rows.length && <div className="empty">No submissions yet. Student work will appear here.</div>}
      </div>
      <div className="table-card notification-card">
        <div className="card-title"><div><p className="eyebrow">INBOX</p><h3>Notifications</h3></div><Bell size={18} /></div>
        <NoticeList items={notifications} onRead={onRead} />
      </div>
    </section>
  );
}

function TeacherClasses({ data, refresh }) {
  const [material, setMaterial] = useState({ title: "", description: "", status: "Published", file: null });
  const [assignment, setAssignment] = useState({ title: "", description: "", deadline: "" });
  const [questions, setQuestions] = useState([{ question: "", options: ["", "", "", ""], correct: "A" }]);
  const [quizMeta, setQuizMeta] = useState({ title: "Algebra Checkpoint", description: "A quick check for this week's lesson." });
  const [message, setMessage] = useState("");

  const upload = async e => {
    e.preventDefault();
    const f = new FormData();
    Object.entries(material).forEach(([k, v]) => v && f.append(k, v));
    await axios.post(`${API}/teacher/materials`, f, { headers: { ...h(), "Content-Type": "multipart/form-data" } });
    setMessage("Material published successfully");
    refresh();
  };
  const createAssignment = async e => {
    e.preventDefault();
    const f = new FormData();
    Object.entries(assignment).forEach(([k, v]) => f.append(k, v));
    await axios.post(`${API}/teacher/assignments`, f, { headers: h() });
    setMessage("Assignment created successfully");
    refresh();
  };
  const createQuiz = async e => {
    e.preventDefault();
    await axios.post(`${API}/teacher/quizzes`, { ...quizMeta, questions }, { headers: h() });
    setMessage("Quiz published successfully");
    refresh();
  };
  const updateQuestion = (idx, key, value) =>
    setQuestions(questions.map((q, i) => i === idx ? { ...q, [key]: value } : q));
  const addQuestion = () =>
    setQuestions([...questions, { question: "", options: ["", "", "", ""], correct: "A" }]);

  return (
    <section className="content">
      <div className="section-head">
        <div><p className="eyebrow">TEACHER WORKSPACE</p><h1>My Classes</h1>
          <p className="muted">Publish materials, quizzes and assignments for your classes.</p></div>
      </div>
      {message && <div className="success" data-testid="teacher-success-message">{message}</div>}
      <div className="table-card">
        <div className="card-title"><div><p className="eyebrow">TEACHING ASSIGNMENTS</p><h3>Classes I teach</h3></div></div>
        {(data.assignments || []).map(a => (
          <div className="data-row" key={a.id}>
            <div className="row-main"><div className="row-icon indigo-bg"><School size={18} /></div>
              <div><b>{a.class_name} · {a.subject}</b><span>{data.period?.year} · {data.period?.semester}</span></div></div>
            <Pill tone="green">Active</Pill>
          </div>
        ))}
      </div>
      <div className="creator-grid">
        <form className="table-card creator" onSubmit={upload} data-testid="material-upload-form">
          <div className="card-title"><div><p className="eyebrow">LEARNING MATERIAL</p><h3>Publish a material</h3></div><BookOpen size={20} /></div>
          <input required data-testid="material-title-input" placeholder="Material title"
            onChange={e => setMaterial({ ...material, title: e.target.value })} />
          <textarea data-testid="material-description-input" placeholder="Short description"
            onChange={e => setMaterial({ ...material, description: e.target.value })} />
          <select data-testid="material-status-select"
            onChange={e => setMaterial({ ...material, status: e.target.value })}>
            <option>Published</option><option>Draft</option>
          </select>
          <input required data-testid="material-file-input" type="file"
            onChange={e => setMaterial({ ...material, file: e.target.files[0] })} />
          <button className="primary-btn" data-testid="material-upload-submit">Upload material</button>
        </form>
        <form className="table-card creator" onSubmit={createAssignment} data-testid="assignment-create-form">
          <div className="card-title"><div><p className="eyebrow">FILE ASSIGNMENT</p><h3>Create assignment</h3></div><ClipboardList size={20} /></div>
          <input required data-testid="assignment-title-input" placeholder="Assignment title"
            onChange={e => setAssignment({ ...assignment, title: e.target.value })} />
          <textarea placeholder="Instructions"
            onChange={e => setAssignment({ ...assignment, description: e.target.value })} />
          <input required data-testid="assignment-deadline-input" placeholder="Deadline e.g. 25 Sep 2026"
            onChange={e => setAssignment({ ...assignment, deadline: e.target.value })} />
          <button className="primary-btn" data-testid="assignment-create-submit">Create assignment</button>
        </form>
      </div>
      <form className="table-card creator quiz-builder" onSubmit={createQuiz} data-testid="quiz-create-form">
        <div className="card-title"><div><p className="eyebrow">MULTIPLE CHOICE QUIZ</p>
          <h3>
            <input className="inline-input" value={quizMeta.title}
              onChange={e => setQuizMeta({ ...quizMeta, title: e.target.value })}
              data-testid="quiz-title-input" />
          </h3></div><Pill tone="green">Published</Pill></div>
        {questions.map((q, i) => (
          <div className="question-row" key={i}>
            <input required placeholder={`Question ${i + 1}`} data-testid={`quiz-question-${i}`}
              onChange={e => updateQuestion(i, "question", e.target.value)} />
            <div className="options-row">
              {q.options.map((_, j) => (
                <input key={j} required placeholder={`Option ${String.fromCharCode(65 + j)}`}
                  data-testid={`quiz-option-${i}-${j}`}
                  onChange={e => {
                    const opts = [...q.options]; opts[j] = e.target.value;
                    updateQuestion(i, "options", opts);
                  }} />
              ))}
            </div>
            <select data-testid={`quiz-correct-${i}`}
              onChange={e => updateQuestion(i, "correct", e.target.value)}>
              <option>A</option><option>B</option><option>C</option><option>D</option>
            </select>
          </div>
        ))}
        <div className="quiz-actions">
          <button type="button" className="text-btn" onClick={addQuestion} data-testid="quiz-add-question">+ Add question</button>
          <button className="primary-btn" data-testid="quiz-create-submit">Publish quiz</button>
        </div>
      </form>
    </section>
  );
}

function TeacherWorkspace({ page, data, refresh, onRead }) {
  if (page === "My Classes") return <TeacherClasses data={data} refresh={refresh} />;
  if (page === "Attendance") return <TeacherAttendance assignments={data.assignments} />;
  if (page === "Grade Reports") return <TeacherGradeReports notifications={data.notifications} onRead={onRead} />;
  if (page === "PJJ") return <TeacherPjj pjj={data.pjj} assignments={data.assignments} refresh={refresh} />;
  if (page === "Profile") return <ProfileView user={data.user} period={data.period} />;
  return <Dashboard user={data.user} period={data.period} data={data} />;
}

/* --------------------- Student --------------------- */

function StudentSubjects({ data, refresh }) {
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const quiz = data.quizzes?.[0];
  const submitQuiz = async () => {
    const r = await axios.post(`${API}/quizzes/${quiz.id}/submit`,
      { answers: quizAnswers }, { headers: h() });
    setResult(r.data);
  };
  const download = async id => {
    const r = await axios.get(`${API}/materials/${id}/download`, { headers: h() });
    window.open(`${process.env.REACT_APP_BACKEND_URL}${r.data.download_url}`, "_blank");
  };
  return (
    <section className="content">
      <div className="section-head">
        <div><p className="eyebrow">STUDENT WORKSPACE</p><h1>Subjects & materials</h1>
          <p className="muted">Read, practice, and keep your learning momentum.</p></div>
      </div>
      <div className="student-resource-grid">
        <div className="table-card">
          <div className="card-title"><div><p className="eyebrow">MATERIALS</p><h3>Published resources</h3></div></div>
          {(data.materials || []).map(m => (
            <div className="data-row" key={m.id}>
              <div className="row-main">
                <div className="row-icon indigo-bg"><BookOpen size={18} /></div>
                <div><b>{m.title}</b><span>{m.type} · {m.updated}</span></div>
              </div>
              <button className="text-btn" onClick={() => download(m.id)}
                data-testid={`download-material-${m.id}`}>
                Download <ArrowUpRight size={14} />
              </button>
            </div>
          ))}
          {!data.materials?.length && <div className="empty">No materials published yet.</div>}
        </div>
        <div className="table-card quiz-card">
          <div className="card-title"><div><p className="eyebrow">QUIZ</p><h3>{quiz?.title || "No quiz yet"}</h3></div></div>
          {quiz?.questions?.map((q, i) => (
            <label key={i} className="quiz-question">{q.question}
              <select onChange={e => {
                const a = [...quizAnswers]; a[i] = e.target.value; setQuizAnswers(a);
              }} data-testid={`quiz-answer-${i}`}>
                <option value="">Choose answer</option>
                {q.options?.map((o, j) => (
                  <option key={j} value={String.fromCharCode(65 + j)}>{String.fromCharCode(65 + j)} · {o}</option>
                ))}
              </select>
            </label>
          ))}
          {quiz && <button className="primary-btn" onClick={submitQuiz} data-testid="quiz-submit-button">Submit quiz</button>}
          {result?.score !== undefined && (
            <div className="score-result" data-testid="quiz-score-result">
              <strong>{result.score}</strong>
              <span>{result.completion} · {result.correct}/{result.total} correct</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StudentAssignments({ data, refresh }) {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState(data.tasks?.[0]);
  const [mySubs, setMySubs] = useState(data.submissions || []);

  useEffect(() => setSelected(data.tasks?.[0]), [data.tasks]);
  useEffect(() => setMySubs(data.submissions || []), [data.submissions]);

  const submit = async () => {
    if (!file || !selected) return;
    const f = new FormData();
    f.append("file", file);
    const r = await axios.post(`${API}/assignments/${selected.id}/submit`, f, { headers: { ...h(), "Content-Type": "multipart/form-data" } });
    setMessage("Assignment submitted successfully");
    setMySubs([...mySubs.filter(x => x.assignment_id !== selected.id), r.data]);
    refresh();
  };

  const findSub = id => mySubs.find(x => x.assignment_id === id);

  return (
    <section className="content">
      <div className="section-head">
        <div><p className="eyebrow">STUDENT WORKSPACE</p><h1>Assignments</h1>
          <p className="muted">Submit your work before the deadline and see your status here.</p></div>
      </div>
      {message && <div className="success" data-testid="assignment-success-message">{message}</div>}
      <div className="table-card">
        <div className="card-title"><div><p className="eyebrow">OPEN WORK</p><h3>{selected?.title || "No assignments"}</h3></div>
          <Pill tone="amber">{selected?.due || "Open"}</Pill></div>
        <p className="muted">{selected?.description || "Complete the task and upload your file."}</p>
        <div className="upload-line">
          <input type="file" onChange={e => setFile(e.target.files[0])}
            data-testid="student-assignment-file-input" />
          <button className="primary-btn compact" onClick={submit}
            data-testid="student-assignment-submit">Submit file</button>
        </div>
        {selected && findSub(selected.id) && (
          <div className="success" data-testid="assignment-persistent-status">
            Submitted · {findSub(selected.id).filename} · {findSub(selected.id).status}
            {findSub(selected.id).final_score !== undefined && findSub(selected.id).final_score !== null && (
              <> · Final score {findSub(selected.id).final_score}</>
            )}
            {findSub(selected.id).feedback && <> · Feedback: {findSub(selected.id).feedback}</>}
          </div>
        )}
      </div>
      <div className="table-card" style={{ marginTop: 18 }}>
        <div className="card-title"><div><p className="eyebrow">ALL ASSIGNMENTS</p><h3>Your task list</h3></div></div>
        {(data.tasks || []).map(t => {
          const sub = findSub(t.id);
          const isSel = selected?.id === t.id;
          return (
            <div className={`data-row task-selectable ${isSel ? "on" : ""}`} key={t.id}
              onClick={() => setSelected(t)} data-testid={`select-task-${t.id}`}>
              <div className="row-main"><div className="row-icon indigo-bg"><ClipboardList size={18} /></div>
                <div><b>{t.title}</b><span>{t.subject} · Due {t.due}</span></div></div>
              <Pill tone={sub ? (sub.status === "Graded" ? "green" : "amber") : "gray"}>
                {sub ? sub.status : "Not submitted"}
              </Pill>
            </div>
          );
        })}
        {!data.tasks?.length && <div className="empty">No assignments yet.</div>}
      </div>
    </section>
  );
}

function StudentPjj({ pjj }) {
  return (
    <section className="content">
      <div className="section-head">
        <div><p className="eyebrow">STUDENT WORKSPACE</p><h1>PJJ Schedules</h1>
          <p className="muted">Join live online learning sessions from your teachers.</p></div>
      </div>
      <div className="table-card">
        {(pjj || []).map(j => (
          <div className="data-row" key={j.id}>
            <div className="row-main"><div className="row-icon indigo-bg"><Video size={18} /></div>
              <div><b>{j.title}</b><span>{j.subject} · {j.date} · {j.time} · {j.platform}</span></div></div>
            <a className="join-link primary-btn compact" href={j.url} target="_blank" rel="noreferrer"
              data-testid={`join-meeting-${j.id}`}>Join meeting <ArrowUpRight size={14} /></a>
          </div>
        ))}
        {!pjj?.length && <div className="empty">No sessions scheduled yet.</div>}
      </div>
    </section>
  );
}

function StudentAttendance() {
  const [att, setAtt] = useState(null);
  useEffect(() => {
    axios.get(`${API}/student/attendance`, { headers: h() }).then(r => setAtt(r.data));
  }, []);
  if (!att) return <section className="content"><div className="empty">Loading attendance…</div></section>;
  const stats = att.stats;
  return (
    <section className="content">
      <div className="section-head">
        <div><p className="eyebrow">STUDENT WORKSPACE</p><h1>My Attendance</h1>
          <p className="muted">Your presence over the active academic period.</p></div>
      </div>
      <div className="table-card attendance-card">
        <div className="card-title"><div><p className="eyebrow">SUMMARY</p><h3>This term</h3></div>
          <strong className="attendance-percent">{att.percentage}%</strong></div>
        <div className="attendance-list">
          {[{ l: "Hadir", c: "green" }, { l: "Izin", c: "blue" }, { l: "Sakit", c: "amber" }, { l: "Alpa", c: "red" }].map(x =>
            <div key={x.l}><span><i className={`dot ${x.c}`} />{x.l}</span><b>{stats[x.l]}</b></div>
          )}
        </div>
      </div>
      {att.entries?.length > 0 && (
        <div className="table-card" style={{ marginTop: 18 }}>
          <div className="card-title"><div><p className="eyebrow">HISTORY</p><h3>Recorded sessions</h3></div></div>
          {att.entries.map((e, i) => (
            <div className="data-row" key={i}>
              <div className="row-main"><div className="row-icon indigo-bg"><CalendarDays size={18} /></div>
                <div><b>{e.subject}</b><span>{e.date}</span></div></div>
              <Pill tone={e.status === "Hadir" ? "green" : e.status === "Alpa" ? "gray" : "amber"}>{e.status}</Pill>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StudentWorkspace({ page, data, refresh, onRead }) {
  if (page === "Subjects") return <StudentSubjects data={data} refresh={refresh} />;
  if (page === "Assignments") return <StudentAssignments data={data} refresh={refresh} />;
  if (page === "PJJ") return <StudentPjj pjj={data.pjj} />;
  if (page === "Attendance") return <StudentAttendance />;
  if (page === "Profile") return <ProfileView user={data.user} period={data.period} />;
  return (
    <>
      <Dashboard user={data.user} period={data.period} data={data} />
      <section className="content" style={{ paddingTop: 0 }}>
        <div className="table-card notification-card">
          <div className="card-title"><div><p className="eyebrow">INBOX</p><h3>Notifications</h3></div>
            <Pill tone="amber">{(data.notifications || []).filter(n => !n.read).length} unread</Pill></div>
          <NoticeList items={data.notifications} onRead={onRead} />
        </div>
      </section>
    </>
  );
}

/* --------------------- Profile --------------------- */

function ProfileView({ user, period }) {
  return (
    <section className="content">
      <div className="section-head">
        <div><p className="eyebrow">ACCOUNT</p><h1>Profile</h1>
          <p className="muted">Your account information at a glance.</p></div>
      </div>
      <div className="table-card">
        <div className="profile-header">
          <div className="avatar profile-avatar">{user.name?.[0]}</div>
          <div>
            <h3>{user.name}</h3>
            <p className="muted">@{user.username} · {user.role}</p>
          </div>
        </div>
        <div className="profile-grid">
          {user.class_name && <div><span>Class</span><b>{user.class_name}</b></div>}
          {user.nis && <div><span>NIS</span><b>{user.nis}</b></div>}
          {user.nisn && <div><span>NISN</span><b>{user.nisn}</b></div>}
          {user.nip && <div><span>NIP</span><b>{user.nip}</b></div>}
          <div><span>Status</span><b>{user.status || "Active"}</b></div>
          <div><span>Academic Period</span><b>{period?.year} · {period?.semester}</b></div>
        </div>
      </div>
    </section>
  );
}

/* --------------------- App --------------------- */

function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [page, setPage] = useState("Dashboard");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey(x => x + 1);

  useEffect(() => {
    const t = localStorage.getItem("lms_token");
    if (t) axios.get(`${API}/auth/me`, { headers: h() })
      .then(r => setUser(r.data))
      .catch(() => localStorage.removeItem("lms_token"))
      .finally(() => setLoading(false));
    else setLoading(false);
  }, []);

  useEffect(() => {
    if (user) axios.get(`${API}/dashboard`, { headers: h() }).then(r => setData(r.data));
  }, [user, refreshKey]);

  const markRead = async id => {
    await axios.post(`${API}/notifications/${id}/read`, {}, { headers: h() });
    bump();
  };

  if (loading) return <div className="loading">Loading Nusantara portal…</div>;
  if (!user) return <Login onLogin={u => { setPage("Dashboard"); setUser(u); }} />;

  const workspace =
    user.role === "admin" ? <AdminView data={data} page={page} refreshKey={refreshKey} bump={bump} /> :
    user.role === "teacher" ? <TeacherWorkspace page={page} data={data} refresh={bump} onRead={markRead} /> :
    <StudentWorkspace page={page} data={data} refresh={bump} onRead={markRead} />;

  return (
    <div className="app-shell">
      <Sidebar user={user} page={page} setPage={setPage}
        onLogout={() => {
          localStorage.removeItem("lms_token");
          setPage("Dashboard"); setData(null); setUser(null);
        }} />
      <main className="main">
        <Header user={user} page={page} period={data?.period} />
        {data && workspace}
      </main>
    </div>
  );
}

export default App;
