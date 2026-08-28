'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, ExternalLink, GripVertical, RefreshCw, Search, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthProvider';

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1NqCyRfXKIotsbx019oP1RBer3aj3EPSTQRLes__i_nc/edit#gid=519887260';

function jakartaDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function mondayOf(value) {
  const date = new Date(`${value}T12:00:00+07:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function addDays(value, amount) {
  const date = new Date(`${value}T12:00:00+07:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function modulesFor(track) {
  if (track === 'rl') return ['1', '2&3', '4&5', '6', '7', '8'];
  return ['1', '2', '3', '4', '5', '6', '7', '8'];
}

function reportGroup(track, moduleLabel) {
  return `${track}-${moduleLabel.replace('&', '-')}`;
}

export default function SchedulePage() {
  const { user, profile, loading, configured, supabase } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState([]);
  const [plans, setPlans] = useState([]);
  const [weekStart, setWeekStart] = useState(() => mondayOf(jakartaDate()));
  const [weekNumber, setWeekNumber] = useState('1');
  const [track, setTrack] = useState('rl');
  const [moduleLabel, setModuleLabel] = useState('2&3');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [syncing, setSyncing] = useState(false);
  const isStaff = profile?.role === 'admin' || profile?.role === 'assistant';

  const load = useCallback(async () => {
    if (!supabase || !isStaff) return;
    const [studentResult, planResult] = await Promise.all([
      supabase.from('profiles').select('id,full_name,npm,email,study_program,is_active').eq('role', 'student').order('full_name'),
      supabase.from('student_module_plans').select('*, profiles!student_module_plans_student_id_fkey(full_name,npm,email,study_program)').order('planned_lab_date')
    ]);
    const error = studentResult.error || planResult.error;
    if (error) setMessage(error.message);
    setStudents((studentResult.data || []).filter((student) => student.is_active !== false));
    setPlans(planResult.data || []);
  }, [supabase, isStaff]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && !isStaff) router.replace('/portal');
  }, [loading, user, isStaff, router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!supabase || !isStaff) return undefined;
    const channel = supabase.channel('schedule-page-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_module_plans' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, isStaff, load]);

  const days = useMemo(() => Array.from({ length: 5 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const group = reportGroup(track, moduleLabel);
  const visiblePlans = useMemo(() => plans.filter((plan) => plan.track === track && plan.report_group === group && days.includes(plan.planned_lab_date)), [plans, track, group, days]);
  const choices = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return students.filter((student) => `${student.full_name} ${student.npm || ''} ${student.email}`.toLowerCase().includes(needle)).slice(0, 8);
  }, [students, query]);

  const savePlan = async (student, plannedDate) => {
    const studentId = student.student_id || student.id;
    const existing = plans.find((plan) => plan.student_id === studentId && plan.report_group === group && plan.planned_week_start === weekStart);
    const moduleNumber = Number(moduleLabel.split('&')[0]);
    const payload = {
      source_row_key: existing?.source_row_key || `calendar-${studentId}-${group}-${weekStart}`,
      student_id: studentId,
      track,
      week_number: Number(weekNumber),
      module_number: moduleNumber,
      moduleLabel,
      report_group: group,
      report_label: moduleLabel.includes('&') ? `${track.toUpperCase()} Modules ${moduleLabel} Combined Report` : `${track.toUpperCase()} Module ${moduleLabel} Report`,
      planned_week_start: weekStart,
      planned_lab_date: plannedDate,
      status: existing?.status || 'expected',
      notes: existing?.notes || ''
    };
    const profileData = student.profiles || student;
    setPlans((current) => existing ? current.map((plan) => plan.id === existing.id ? { ...plan, ...payload, profiles: profileData } : plan) : [...current, { ...payload, id: `saving-${payload.source_row_key}`, profiles: profileData }]);
    setMessage(`Saving ${profileData.full_name} to the website and Sheet...`);
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/admin-data', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }, body: JSON.stringify({ action: 'upsertPlan', plan: payload }) });
    const result = await response.json();
    setMessage(response.ok ? `${profileData.full_name} is planned for ${plannedDate}. This does not open report submission.` : result.error);
    setQuery('');
    await load();
  };

  const removePlan = async (plan) => {
    setPlans((current) => current.filter((item) => item.id !== plan.id));
    setMessage('Removing the planned date from the website and Sheet...');
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/admin-data', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }, body: JSON.stringify({ action: 'deletePlan', source_row_key: plan.source_row_key }) });
    const result = await response.json();
    setMessage(response.ok ? 'Planned date removed. Attendance and submission access were not changed.' : result.error);
    await load();
  };

  const syncSheet = async () => {
    setSyncing(true);
    setMessage('Reading student and schedule changes from the Sheet...');
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/sync-attendance', { method: 'POST', headers: { Authorization: `Bearer ${data.session?.access_token || ''}` } });
    const result = await response.json();
    setMessage(response.ok ? `${result.studentsSynced} students and ${result.plansSynced} plans synchronized from Sheets.` : result.error);
    if (response.ok) await load();
    setSyncing(false);
  };

  if (loading) return <section className="section"><h1 className="title">Loading schedule...</h1></section>;
  if (!configured) return <section className="section"><h1 className="title">Account service unavailable.</h1></section>;
  if (!user || !isStaff) return null;

  return <section className="section schedule-workspace-page">
    <div className="workspace-page-heading">
      <div><Link className="back-link" href="/admin"><ArrowLeft size={16}/> Admin desk</Link><div className="eyebrow">Planning calendar</div><h1 className="title">Who is expected each day?</h1><p className="subtitle">Add names or drag them between days. This schedule is informational. Only actual attendance opens a report and starts its deadline.</p></div>
      <div className="btn-row"><Link className="btn ghost" href="/admin/students"><Users size={17}/> Students</Link><a className="btn ghost" href={SHEET_URL} target="_blank" rel="noreferrer"><ExternalLink size={17}/> Module Plans Sheet</a><button className="btn" onClick={syncSheet} disabled={syncing}><RefreshCw size={17}/>{syncing ? 'Syncing...' : 'Sync Sheet'}</button></div>
    </div>
    {message && <div className="status-message">{message}</div>}
    <div className="card schedule-workspace-controls">
      <label>Week starting<input type="date" value={weekStart} onChange={(event) => setWeekStart(mondayOf(event.target.value))}/></label>
      <label>Practicum<select value={track} onChange={(event) => { const next = event.target.value; setTrack(next); setModuleLabel(modulesFor(next)[0]); }}><option value="rl">RL</option><option value="idp">IDP</option><option value="t3">T3</option></select></label>
      <label>Module<select value={moduleLabel} onChange={(event) => setModuleLabel(event.target.value)}>{modulesFor(track).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Practicum week<input type="number" min="1" value={weekNumber} onChange={(event) => setWeekNumber(event.target.value)}/></label>
    </div>
    <div className="card schedule-student-picker">
      <div><Search/><label><b>Add a student</b><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type at least 2 characters"/></label></div>
      {query.trim().length < 2 && <p className="muted">Search keeps the list fast even with 140+ students.</p>}
      <div className="schedule-choice-list">{choices.map((student) => <article key={student.id}><span><b>{student.full_name}</b><small>{student.npm || student.email}</small></span><div>{days.map((day) => <button key={day} type="button" onClick={() => savePlan(student, day)}><b>{new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })}</b><small>{day.slice(5)}</small></button>)}</div></article>)}</div>
    </div>
    <div className="schedule-context"><CalendarDays/><p><b>{track.toUpperCase()} Module {moduleLabel}</b><span>{visiblePlans.length} students planned for this week</span></p></div>
    <div className="planning-calendar schedule-page-calendar">{days.map((day) => <section className="card calendar-day" key={day} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const plan = plans.find((item) => item.id === event.dataTransfer.getData('text/plain')); if (plan) savePlan(plan, day); }}><header><div><b>{new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })}</b><small>{new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</small></div><span>{visiblePlans.filter((plan) => plan.planned_lab_date === day).length}</span></header>{visiblePlans.filter((plan) => plan.planned_lab_date === day).map((plan) => <div className="student-calendar-card" draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', plan.id)} key={plan.id}><GripVertical size={15}/><span><b>{plan.profiles?.full_name}</b><small>{plan.profiles?.npm || ''}</small></span><button type="button" aria-label={`Remove ${plan.profiles?.full_name}`} onClick={() => removePlan(plan)}>×</button></div>)}</section>)}</div>
  </section>;
}
