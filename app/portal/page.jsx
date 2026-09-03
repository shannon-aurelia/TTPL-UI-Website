"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle,
  Clock,
  LogOut,
  ShieldAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";
import ProfileEditor from "../../components/ProfileEditor";

function displayDate(value) {
  if (!value) return "To be scheduled";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export default function Portal() {
  const { user, profile, loading, configured, supabase } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [plans, setPlans] = useState([]);
  const router = useRouter();

  const loadData = useCallback(async () => {
    if (!user || !supabase) return;
    const [sessionResult, planResult] = await Promise.all([
      supabase
        .from("practicum_sessions")
        .select("*")
        .eq("student_id", user.id)
        .order("scheduled_at"),
      supabase
        .from("student_module_plans")
        .select("*")
        .eq("student_id", user.id)
        .order("planned_lab_date"),
    ]);
    setSessions(sessionResult.data || []);
    setPlans(planResult.data || []);
  }, [user, supabase]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (profile?.role === "assistant" || profile?.role === "admin")
      router.replace("/assistant-dashboard");
  }, [loading, user, profile, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!user || !supabase) return undefined;
    const channel = supabase
      .channel(`ttpl-student-live-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "practicum_sessions",
          filter: `student_id=eq.${user.id}`,
        },
        loadData,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_module_plans",
          filter: `student_id=eq.${user.id}`,
        },
        loadData,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, loadData]);

  const upcoming = useMemo(
    () =>
      plans
        .filter(
          (item) =>
            item.planned_lab_date &&
            new Date(`${item.planned_lab_date}T23:59:00+07:00`) >= new Date(),
        )
        .slice(0, 4),
    [plans],
  );
  const attended = useMemo(
    () =>
      sessions.filter((item) =>
        ["present", "late"].includes(item.attendance_status),
      ),
    [sessions],
  );
  const scored = useMemo(
    () => sessions.filter((item) => item.qna_score != null),
    [sessions],
  );

  if (loading)
    return (
      <section className="section">
        <h1 className="title">Loading dashboard...</h1>
      </section>
    );
  if (!configured)
    return (
      <section className="section">
        <div className="card">
          <h1 className="title">Database connection pending.</h1>
          <p className="subtitle">
            Configure Supabase using DATA_SETUP_GUIDE.md, then restart the
            development server.
          </p>
        </div>
      </section>
    );
  if (!user) return null;

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <section className="section dashboard-page">
      <div className="dashboard-heading">
        <div>
          <div className="eyebrow">Student dashboard</div>
          <h1 className="title">Welcome, {profile?.full_name || "student"}.</h1>
          <p className="subtitle">
            Your schedule follows the latest attendance spreadsheet sync.
            Different students can receive different modules, dates, makeup
            sessions, and deadlines in the same week.
          </p>
        </div>
        <button className="btn ghost" onClick={logout}>
          <LogOut size={17} /> Sign out
        </button>
      </div>
      <div className="dashboard-stats">
        <div className="card metric-card">
          <CalendarDays />
          <span>Planned labs</span>
          <b>{plans.length}</b>
        </div>
        <div className="card metric-card">
          <CheckCircle />
          <span>Attendance recorded</span>
          <b>{attended.length}</b>
        </div>
        <div className="card metric-card">
          <Clock />
          <span>QnA scores</span>
          <b>{scored.length}</b>
        </div>
      </div>
      <ProfileEditor />
      <div className="grid two dashboard-grid">
        <div className="card">
          <div className="eyebrow">Reference schedule</div>
          <h2>Upcoming practicum</h2>
          <div className="schedule-list">
            {upcoming.length === 0 && (
              <p className="muted">No planned date has been added yet.</p>
            )}
            {upcoming.map((plan) => (
              <div className="schedule-item" key={plan.id}>
                <div>
                  <b>
                    {plan.track.toUpperCase()} · {plan.report_label}
                  </b>
                  <p>
                    {new Date(
                      `${plan.planned_lab_date}T12:00:00`,
                    ).toLocaleDateString("en-GB", { dateStyle: "full" })}
                  </p>
                </div>
                <span
                  className={`attendance-badge ${plan.status === "deferred" ? "late" : "scheduled"}`}
                >
                  {plan.status}
                </span>
              </div>
            ))}
          </div>
          <p className="muted">
            This is a reminder only. If you miss it, contact an assistant to
            arrange a makeup session. Upload access starts only after your
            actual attendance is recorded.
          </p>
        </div>
        <div className="card">
          <div className="eyebrow">Attendance & QnA</div>
          <h2>Current semester</h2>
          <div className="progress-list">
            {sessions.map((session) => (
              <div className="progress-item" key={session.id}>
                {session.attendance_status === "absent" ||
                session.attendance_status === "excused" ? (
                  <ShieldAlert size={18} />
                ) : session.qna_score != null ? (
                  <CheckCircle size={18} />
                ) : (
                  <Clock size={18} />
                )}
                <span>
                  {session.track.toUpperCase()} ·{" "}
                  {session.report_label || session.report_group} · Week{" "}
                  {session.week_number}
                </span>
                <b>
                  {session.attendance_status === "absent" ||
                  session.attendance_status === "excused"
                    ? "Awaiting makeup"
                    : session.qna_score != null
                      ? `QnA ${session.qna_score}`
                      : "QnA pending"}
                </b>
              </div>
            ))}
          </div>
          <p className="muted">
            Attendance and QnA records are maintained by TTPL assistants and
            synchronized with the practicum sheet.
          </p>
        </div>
      </div>
      <div className="card dashboard-help">
        <div className="eyebrow">Report submission</div>
        <h2>Submit reports through EMAS3.</h2>
        <p className="muted">
          The TTPL website no longer accepts report files. Use this dashboard
          for your profile, schedule, attendance, QnA results, and tracked
          learning materials.
        </p>
      </div>
    </section>
  );
}
