'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, CalendarCheck, CalendarDays, Download, ExternalLink, GripVertical, LogOut, RefreshCw, Search, Trash2, UserRoundX, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import ProfileEditor from '../../components/ProfileEditor';

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1NqCyRfXKIotsbx019oP1RBer3aj3EPSTQRLes__i_nc/edit';

function jakartaParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value || '';
  return { date: `${value('year')}-${value('month')}-${value('day')}`, time: `${value('hour')}:${value('minute')}` };
}

function localInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  const jakarta = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return jakarta.toISOString().slice(0, 16);
}

function displayDate(value) {
  return value ? new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta' }) : 'Not set';
}

function moduleLabel(item) {
  if (item?.report_group?.endsWith('2-3')) return '2&3';
  if (item?.report_group?.endsWith('4-5')) return '4&5';
  return String(item?.module_number || '');
}

function moduleOptions(track) {
  if (track === 'rl' || track === 'idp') return [
    ['1', '1 · Pre-test'],
    ['2&3', '2&3 · Combined'],
    ['4&5', '4&5 · Combined'],
    ['6', '6'],
    ['7', '7'],
    ['8', '8']
  ];
  return Array.from({ length: 8 }, (_, index) => [String(index + 1), String(index + 1)]);
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

export default function AdminPage() {
  const now = useMemo(() => jakartaParts(), []);
  const { user, profile, loading, configured, supabase } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [settings, setSettings] = useState(null);
  const [tab, setTab] = useState('attendance');
  const [query, setQuery] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [scheduleQuery, setScheduleQuery] = useState('');
  const [scheduleWeek, setScheduleWeek] = useState(() => mondayOf(now.date));
  const [scheduleModule, setScheduleModule] = useState('2&3');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState({});
  const [attendance, setAttendance] = useState({
    track: 'rl',
    module: '2&3',
    week_number: '1',
    attended_date: now.date,
    attended_time: now.time,
    is_makeup: false,
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState('');
  const [profileDrafts, setProfileDrafts] = useState({});
  const router = useRouter();
  const isStaff = profile?.role === 'assistant' || profile?.role === 'admin';

  const load = useCallback(async () => {
    if (!supabase || !isStaff) return;
    const [profileResult, sessionResult, submissionResult, planResult, settingResult] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('practicum_sessions').select('*, profiles!practicum_sessions_student_id_fkey(full_name,npm,email)').order('attended_at', { ascending: false }),
      supabase.from('submissions').select('*, profiles!submissions_student_id_fkey(full_name,npm,email), submission_reviews(*)').order('submitted_at', { ascending: false }),
      supabase.from('student_module_plans').select('*, profiles!student_module_plans_student_id_fkey(full_name,npm,email)').order('planned_week_start'),
      supabase.from('lab_settings').select('*').eq('id', true).maybeSingle()
    ]);
    const error = profileResult.error || sessionResult.error || submissionResult.error || planResult.error || settingResult.error;
    if (error) setMessage(error.message);
    setProfiles(profileResult.data || []);
    setSessions(sessionResult.data || []);
    setSubmissions(submissionResult.data || []);
    setPlans(planResult.data || []);
    setSettings(settingResult.data || null);
  }, [supabase, isStaff]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && profile?.role === 'student') router.replace('/portal');
  }, [loading, user, profile, router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!supabase || !isStaff) return undefined;
    const channel = supabase
      .channel('ttpl-admin-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'practicum_sessions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_module_plans' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, isStaff, load]);

  const students = useMemo(() => profiles.filter((item) => item.role === 'student'), [profiles]);
  const studentChoices = useMemo(() => {
    const normalized = studentQuery.trim().toLowerCase();
    if (normalized.length < 2) return [];
    return students
      .filter((item) => `${item.full_name} ${item.npm || ''} ${item.email}`.toLowerCase().includes(normalized))
      .slice(0, 5);
  }, [students, studentQuery]);
  const missingPlans = useMemo(() => plans.filter((item) => item.status !== 'completed'), [plans]);
  const filteredProfiles = useMemo(() => profiles.filter((item) => `${item.full_name} ${item.npm || ''} ${item.email}`.toLowerCase().includes(query.toLowerCase())), [profiles, query]);
  const filteredSessions = useMemo(() => sessions.filter((item) => `${item.profiles?.full_name || ''} ${item.profiles?.npm || ''} ${item.track} ${item.report_label}`.toLowerCase().includes(query.toLowerCase())), [sessions, query]);
  const filteredPlans = useMemo(() => missingPlans.filter((item) => `${item.profiles?.full_name || ''} ${item.profiles?.npm || ''} ${item.track} ${item.report_label}`.toLowerCase().includes(query.toLowerCase())), [missingPlans, query]);
  const filteredSubmissions = useMemo(() => submissions.filter((item) => `${item.profiles?.full_name || ''} ${item.profiles?.npm || ''} ${item.track} ${item.report_group}`.toLowerCase().includes(query.toLowerCase())), [submissions, query]);
  const selectedCount = Object.keys(selected).length;
  const scheduleChoices = useMemo(() => {
    const normalized = scheduleQuery.trim().toLowerCase();
    if (normalized.length < 2) return [];
    return students.filter((item) => `${item.full_name} ${item.npm || ''} ${item.email}`.toLowerCase().includes(normalized)).slice(0, 5);
  }, [students, scheduleQuery]);
  const scheduleDays = useMemo(() => Array.from({ length: 5 }, (_, index) => addDays(scheduleWeek, index)), [scheduleWeek]);
  const scheduledThisWeek = useMemo(() => plans.filter((plan) => plan.track === 'rl' && plan.report_group === `rl-${scheduleModule.replace('&', '-')}` && scheduleDays.includes(plan.planned_lab_date)), [plans, scheduleDays, scheduleModule]);

  const toggleStudent = (student) => {
    setSelected((current) => {
      const next = { ...current };
      if (next[student.id]) delete next[student.id];
      else next[student.id] = { student, score: '' };
      return next;
    });
  };

  const saveToday = async (event) => {
    event.preventDefault();
    if (!selectedCount) {
      setMessage('Select at least one student who attended today.');
      return;
    }
    setSaving(true);
    setMessage('Saving attendance and QnA to the website and Google Sheet...');
    const moduleNumber = Number(attendance.module.split('&')[0]);
    const attendedAt = new Date(`${attendance.attended_date}T${attendance.attended_time}:00+07:00`).toISOString();
    const entries = Object.values(selected).map(({ student, score }) => ({
      source_row_key: `web-${student.id}-${attendance.track}-${attendance.module}-${attendance.attended_date}-${attendance.attended_time}`,
      student_id: student.id,
      track: attendance.track,
      module_number: moduleNumber,
      week_number: Number(attendance.week_number),
      attended_at: attendedAt,
      qna_score: score,
      is_makeup: attendance.is_makeup,
      notes: attendance.notes
    }));
    setSessions((current) => [...entries.map((entry) => ({
      ...entry,
      id: `saving-${entry.source_row_key}`,
      profiles: selected[entry.student_id].student,
      scheduled_at: entry.attended_at,
      attendance_status: 'on_time',
      submission_open: attendance.module !== '1' && entry.qna_score !== '',
      report_group: `${attendance.track}-${attendance.module.replace('&', '-')}`,
      report_label: `${attendance.track.toUpperCase()} Module ${attendance.module} Report`
    })), ...current]);
    const { data: sessionData } = await supabase.auth.getSession();
    const sheetEntries = entries.map((entry) => {
        const student = selected[entry.student_id].student;
        return {
          sourceKey: entry.source_row_key,
          npm: student.npm || '',
          fullName: student.full_name,
          track: attendance.track,
          moduleLabel: attendance.module,
          weekNumber: Number(attendance.week_number),
          attendedDate: attendance.attended_date,
          attendedTime: attendance.attended_time,
          qnaScore: entry.qna_score,
          attendanceStatus: 'on_time',
          isMakeup: attendance.is_makeup,
          notes: attendance.notes,
          assistantCode: ''
        };
      });
    const sheetRequest = fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token || ''}`
        },
        body: JSON.stringify({ entries: sheetEntries })
      });
    const databaseRequest = supabase.rpc('staff_record_attendance_batch', { entries });
    const [sheetResponse, databaseResult] = await Promise.all([sheetRequest, databaseRequest]);
    let sheetResult = {};
    try { sheetResult = await sheetResponse.json(); } catch { sheetResult = { error: 'Invalid response from Google Sheets' }; }
    const databaseError = databaseResult.error;

    if (!sheetResponse.ok || databaseError) {
      if (!sheetResponse.ok && !databaseError) {
        await supabase.from('practicum_sessions').delete().in('source_row_key', entries.map((entry) => entry.source_row_key));
      }
      if (sheetResponse.ok && databaseError) {
        await fetch('/api/attendance', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token || ''}` },
          body: JSON.stringify({ sourceKeys: entries.map((entry) => entry.source_row_key) })
        });
      }
      setMessage(`Nothing was kept because both systems did not confirm the save. ${sheetResult.error || databaseError?.message || 'Please try again.'}`);
      await load();
    } else {
      setMessage(`${databaseResult.data || selectedCount} students saved to the website and Google Sheet.`);
      setSelected({});
      setStudentQuery('');
      setQuery('');
      await load();
    }
    setSaving(false);
  };

  const syncSheet = async () => {
    setSyncing(true);
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/sync-attendance', { method: 'POST', headers: { Authorization: `Bearer ${data.session?.access_token || ''}` } });
    const result = await response.json();
    setMessage(response.ok ? `${result.studentsSynced} students, ${result.attendanceSynced} attendance rows, and ${result.plansSynced} plans synchronized.` : result.error);
    if (response.ok) load();
    setSyncing(false);
  };

  const updateRole = async (profileId, role) => {
    const { error } = await supabase.rpc('admin_set_profile_role', { target_id: profileId, new_role: role });
    setMessage(error ? error.message : 'Account role updated.');
    if (!error) load();
  };

  const deleteAttendance = async (session) => {
    if (!confirm(`Delete this QnA record for ${session.profiles?.full_name || 'this student'}?`)) return;
    setDeleting(session.id);
    const { data: sessionData } = await supabase.auth.getSession();
    const sheetResponse = await fetch('/api/attendance', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token || ''}` },
      body: JSON.stringify({ sourceKeys: [session.source_row_key] })
    });
    const sheetResult = await sheetResponse.json();
    if (!sheetResponse.ok) {
      setMessage(`Nothing was deleted. Google Sheet connection failed: ${sheetResult.error || 'unknown error'}`);
      setDeleting('');
      return;
    }
    const { error } = await supabase.from('practicum_sessions').delete().eq('id', session.id);
    if (error) setMessage(`The Sheet row was deleted. Website retry needed: ${error.message}`);
    await load();
    if (!error) setMessage('QnA record deleted from the website and Google Sheet.');
    setDeleting('');
  };

  const deleteStudent = async (student) => {
    if (!confirm(`Permanently delete ${student.full_name || student.email} and all of their practicum data?`)) return;
    setDeleting(student.id);
    const { data: auth } = await supabase.auth.getSession();
    const response = await fetch('/api/admin-data', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.session?.access_token || ''}` }, body: JSON.stringify({ action: 'deleteStudent', id: student.id }) });
    const result = await response.json();
    setMessage(response.ok ? 'Student account, linked practicum data, and Sheet row deleted.' : result.error);
    if (response.ok) await load();
    setDeleting('');
  };

  const saveStudent = async (student) => {
    const draft = profileDrafts[student.id] || student;
    const { data: auth } = await supabase.auth.getSession();
    const response = await fetch('/api/admin-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.session?.access_token || ''}` },
      body: JSON.stringify({ action: 'updateStudent', id: student.id, full_name: draft.full_name, npm: draft.npm, group_name: draft.group_name, study_program: draft.study_program, is_active: draft.is_active })
    });
    const result = await response.json();
    setMessage(response.ok ? 'Student profile updated on the website and Sheet.' : result.error);
    if (response.ok) { setProfileDrafts((current) => { const next = { ...current }; delete next[student.id]; return next; }); await load(); }
  };

  const patchAttendance = async (session, changes, sheetChanges, successMessage) => {
    setSessions((current) => current.map((item) => item.id === session.id ? { ...item, ...changes } : item));
    const { data: auth } = await supabase.auth.getSession();
    const response = await fetch('/api/attendance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.session?.access_token || ''}` },
      body: JSON.stringify({ entry: { sourceKey: session.source_row_key, ...sheetChanges } })
    });
    const result = await response.json();
    if (!response.ok) { setMessage(`Nothing changed. Google Sheet connection failed: ${result.error || 'unknown error'}`); await load(); return; }
    const { error } = await supabase.from('practicum_sessions').update({ ...changes, sheet_updated_at: new Date().toISOString() }).eq('id', session.id);
    setMessage(error ? `The Sheet changed, but the website needs a sync: ${error.message}` : successMessage);
    await load();
  };

  const updateDeadline = async (session, value) => {
    const iso = new Date(value).toISOString();
    await patchAttendance(session, {
      deadline_at: iso,
      deadline_override_reason: 'Manual force majeure adjustment',
      deadline_updated_by: user.id
    }, { deadlineOverride: value.replace('T', ' ') }, 'Deadline updated on the website and Sheet.');
  };

  const updateQna = async (session, value) => {
    const score = value === '' ? null : Number(value);
    if (score != null && (!Number.isFinite(score) || score < 0 || score > 100)) { setMessage('QnA score must be between 0 and 100.'); return; }
    const eligible = score !== null && ['on_time', 'late'].includes(session.attendance_status);
    await patchAttendance(session, { qna_score: score, submission_open: eligible }, { qnaScore: score, submissionOverride: eligible ? 'open' : 'closed' }, `QnA score updated on the website and Sheet. Submission is now ${eligible ? 'open' : 'closed'}.`);
  };

  const toggleSubmissionAccess = async (session) => {
    const next = !session.submission_open;
    if (next && session.qna_score == null) { setMessage('Enter a QnA score first. A score of 0 is valid, but a blank score cannot open submission.'); return; }
    await patchAttendance(session, { submission_open: next }, { submissionOverride: next ? 'open' : 'closed' }, `Submission access ${next ? 'opened' : 'closed'} on the website and Sheet.`);
  };

  const saveSchedule = async (student, plannedDate) => {
    const studentId = student.id || student.student_id;
    const moduleNumber = Number(scheduleModule.split('&')[0]);
    const reportGroup = `rl-${scheduleModule.replace('&', '-')}`;
    const existing = plans.find((plan) => plan.student_id === studentId && plan.report_group === reportGroup && plan.planned_week_start === scheduleWeek);
    const payload = {
      source_row_key: existing?.source_row_key || `calendar-${studentId}-${reportGroup}-${scheduleWeek}`,
      student_id: studentId, track: 'rl', week_number: Number(attendance.week_number), module_number: moduleNumber,
      report_group: reportGroup, report_label: scheduleModule.includes('&') ? `Modules ${scheduleModule} Combined Report` : `Module ${scheduleModule} Report`,
      planned_week_start: scheduleWeek, planned_lab_date: plannedDate, status: existing?.status || 'expected', updated_at: new Date().toISOString()
    };
    setPlans((current) => existing ? current.map((plan) => plan.id === existing.id ? { ...plan, ...payload } : plan) : [...current, { ...payload, id: `saving-${payload.source_row_key}`, profiles: student }]);
    const { data: auth } = await supabase.auth.getSession();
    const response = await fetch('/api/admin-data', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.session?.access_token || ''}` }, body: JSON.stringify({ action: 'upsertPlan', plan: { ...payload, moduleLabel: scheduleModule } }) });
    const result = await response.json();
    setMessage(response.ok ? `${student.full_name} scheduled for ${plannedDate} on the website and Sheet. Submission access is unchanged.` : result.error);
    if (response.ok) { setScheduleQuery(''); await load(); }
    else await load();
  };

  const removeSchedule = async (plan) => {
    setPlans((current) => current.filter((item) => item.id !== plan.id));
    const { data: auth } = await supabase.auth.getSession();
    const response = await fetch('/api/admin-data', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.session?.access_token || ''}` }, body: JSON.stringify({ action: 'deletePlan', source_row_key: plan.source_row_key }) });
    const result = await response.json();
    setMessage(response.ok ? 'Planned date removed from the website and Sheet. Attendance and submission access were not changed.' : result.error);
    await load();
  };

  const updatePlanStatus = async (planId, status) => {
    const plan = plans.find((item) => item.id === planId);
    if (!plan) return;
    const { data: auth } = await supabase.auth.getSession();
    const payload = { source_row_key: plan.source_row_key, student_id: plan.student_id, track: plan.track, week_number: plan.week_number, module_number: plan.module_number, moduleLabel: moduleLabel(plan), report_group: plan.report_group, report_label: plan.report_label, planned_week_start: plan.planned_week_start, planned_lab_date: plan.planned_lab_date, status, notes: plan.notes };
    const response = await fetch('/api/admin-data', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.session?.access_token || ''}` }, body: JSON.stringify({ action: 'upsertPlan', plan: payload }) });
    const result = await response.json();
    setMessage(response.ok ? 'Plan status updated on the website and Sheet.' : result.error);
    if (response.ok) load();
  };

  const updateSubmission = async (id, changes) => {
    const { error } = await supabase.from('submission_reviews').upsert({ submission_id: id, ...changes, graded_by: user.id, graded_at: new Date().toISOString() });
    setMessage(error ? error.message : 'Submission review updated.');
    if (!error) load();
  };

  const openFile = async (submission) => {
    if (submission.drive_file_url) {
      window.open(submission.drive_file_url, '_blank', 'noopener,noreferrer');
      return;
    }
    const { data, error } = await supabase.storage.from('practicum-reports').createSignedUrl(submission.file_path, 120);
    if (error) setMessage(error.message);
    else window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const toggleExternalRegistration = async () => {
    const { error } = await supabase.from('lab_settings').update({ allow_external_student_registration: !settings.allow_external_student_registration, updated_at: new Date().toISOString(), updated_by: user.id }).eq('id', true);
    setMessage(error ? error.message : 'Registration mode updated.');
    if (!error) load();
  };

  if (loading) return <section className="section"><h1 className="title">Loading administration...</h1></section>;
  if (!configured) return <section className="section"><div className="card"><h1 className="title">Account service unavailable.</h1></div></section>;
  if (!user || !isStaff) return null;

  return <section className="section dashboard-page">
    <div className="dashboard-heading">
      <div><div className="eyebrow">Practicum administration</div><h1 className="title">Today’s lab desk.</h1><p className="subtitle">Choose today’s session, mark everyone who came, enter their QnA scores, then save the group once.</p></div>
      <div className="btn-row">
        <a className="btn ghost" href={SHEET_URL} target="_blank" rel="noreferrer"><ExternalLink size={17}/> Open source Sheet</a>
        <Link className="btn ghost" href="/reading-analytics"><BookOpenCheck size={17}/> Reading analytics</Link>
        <button className="btn" onClick={syncSheet} disabled={syncing}><RefreshCw size={17}/> {syncing ? 'Syncing...' : 'Sync Sheet'}</button>
        <button className="btn ghost" onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }}><LogOut size={17}/> Sign out</button>
      </div>
    </div>

    {message && <div className="status-message">{message}</div>}

    <div className="dashboard-stats">
      <Link className="card metric-card" href="/admin/students"><Users/><span>Students</span><b>{students.length}</b><small>Open student directory</small></Link>
      <a className="card metric-card" href="#attendance-records" onClick={() => setTab('attendance')}><CalendarCheck/><span>Attendance records</span><b>{sessions.length}</b><small>Review QnA and attendance</small></a>
      <Link className="card metric-card" href="/admin/schedule"><UserRoundX/><span>Still expected</span><b>{missingPlans.length}</b><small>Open planning calendar</small></Link>
      <a className="card metric-card" href="#submission-records" onClick={() => setTab('submissions')}><Download/><span>Submissions</span><b>{submissions.length}</b><small>Open submission reviews</small></a>
    </div>
    <ProfileEditor/>

    <div className="admin-tabs" role="tablist">
      <Link href="/admin/students">Students</Link>
      <Link href="/admin/schedule">Schedule calendar</Link>
      <button className={tab === 'attendance' ? 'active' : ''} onClick={() => setTab('attendance')}>Today’s attendance</button>
      <button className={tab === 'calendar' ? 'active' : ''} onClick={() => setTab('calendar')}>Planning calendar</button>
      <button className={tab === 'missing' ? 'active' : ''} onClick={() => setTab('missing')}>Missing students</button>
      <button className={tab === 'submissions' ? 'active' : ''} onClick={() => setTab('submissions')}>Submissions</button>
      {profile.role === 'admin' && <button className={tab === 'accounts' ? 'active' : ''} onClick={() => setTab('accounts')}>Accounts</button>}
    </div>

    {tab !== 'calendar' && <div className="card dashboard-tools"><label><Search size={17}/><input placeholder="Search name, NPM, email, or report" value={query} onChange={(event) => setQuery(event.target.value)}/></label></div>}

    {tab === 'attendance' && <>
      <form className="card batch-attendance" id="attendance-records" onSubmit={saveToday}>
        <div className="batch-heading"><div><div className="eyebrow">Step 1</div><h2>Set today’s session</h2></div><b>{selectedCount} selected</b></div>
        <div className="batch-session-grid">
          <label>Track<select value={attendance.track} onChange={(event) => setAttendance({ ...attendance, track: event.target.value, module: ['rl', 'idp'].includes(event.target.value) ? '2&3' : '1' })}><option value="rl">RL</option><option value="idp">IDP</option><option value="t3">T3</option></select></label>
          <label>Module<select value={attendance.module} onChange={(event) => setAttendance({ ...attendance, module: event.target.value })}>{moduleOptions(attendance.track).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Week<input type="number" min="1" value={attendance.week_number} onChange={(event) => setAttendance({ ...attendance, week_number: event.target.value })}/></label>
          <label>Date<input type="date" value={attendance.attended_date} onChange={(event) => setAttendance({ ...attendance, attended_date: event.target.value })}/></label>
          <label>Time<input type="time" value={attendance.attended_time} onChange={(event) => setAttendance({ ...attendance, attended_time: event.target.value })}/></label>
          <label className={`makeup-option ${attendance.is_makeup ? 'selected' : ''}`}><input type="checkbox" checked={attendance.is_makeup} onChange={(event) => setAttendance({ ...attendance, is_makeup: event.target.checked })}/><span><b>Makeup session</b><small>Use this when the student attends on a replacement day.</small></span></label>
        </div>

        <div className="batch-heading"><div><div className="eyebrow">Step 2</div><h2>Mark everyone who came</h2></div></div>
        <div className="student-picker-search"><Search size={17}/><input placeholder="Type at least 2 characters to find up to 5 students" value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)}/></div>
        <div className="batch-student-list">
          {studentQuery.trim().length < 2 && <p className="muted">Search first. The full student list stays hidden so this remains fast with 100+ students.</p>}
          {studentChoices.map((student) => {
            const entry = selected[student.id];
            return <div className={`batch-student-row ${entry ? 'selected' : ''}`} key={student.id}>
              <label className="student-check"><input type="checkbox" checked={Boolean(entry)} onChange={() => toggleStudent(student)}/><span><b>{student.full_name}</b><small>{student.npm || student.email}</small></span></label>
              <label className="score-field">QnA score<input type="number" min="0" max="100" step="0.01" disabled={!entry} value={entry?.score || ''} onChange={(event) => setSelected((current) => ({ ...current, [student.id]: { ...current[student.id], score: event.target.value } }))}/></label>
            </div>;
          })}
        </div>
        <label className="batch-notes">Notes for this session<input value={attendance.notes} onChange={(event) => setAttendance({ ...attendance, notes: event.target.value })}/></label>
        <button className="btn batch-save" type="submit" disabled={saving || !selectedCount}>{saving ? 'Confirming website + Sheet...' : `Save ${selectedCount || ''} students`}</button>
      </form>

      <div className="card table-card"><div className="table-scroll"><table className="dashboard-table"><thead><tr><th>Student</th><th>Attendance</th><th>Module</th><th>QnA</th><th>Deadline</th><th>Submission</th><th>Delete</th></tr></thead><tbody>{filteredSessions.map((session) => <tr key={session.id}><td><b>{session.profiles?.full_name}</b><small>{session.profiles?.npm}</small></td><td>{displayDate(session.attended_at || session.scheduled_at)}<small>{session.is_makeup ? 'Makeup session' : `Week ${session.week_number}`}</small></td><td><b>{session.track.toUpperCase()} M{moduleLabel(session)}</b><small>{session.report_label}</small></td><td><input className="score-edit" type="number" min="0" max="100" step="0.01" defaultValue={session.qna_score ?? ''} placeholder="Not entered" onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} onBlur={(event) => updateQna(session, event.target.value)}/><small>Press Enter or click away to save</small></td><td><input type="datetime-local" defaultValue={localInputValue(session.deadline_at)} onBlur={(event) => event.target.value && updateDeadline(session, event.target.value)}/><small>{session.deadline_override_reason || 'Automatic: next day 23:59 WIB'}</small></td><td><button type="button" className={`access-toggle ${session.submission_open ? 'open' : ''}`} onClick={() => toggleSubmissionAccess(session)}>{session.submission_open ? 'Open' : 'Closed'}</button><small>Click to change access</small></td><td><button className="danger-action" type="button" disabled={deleting === session.id} onClick={() => deleteAttendance(session)}><Trash2 size={16}/>{deleting === session.id ? 'Deleting...' : 'Delete'}</button></td></tr>)}</tbody></table></div></div>
    </>}

    {tab === 'calendar' && <>
      <div className="card calendar-controls">
        <div><div className="eyebrow">Reference schedule only</div><h2>Planned lab calendar</h2><p className="muted">Moving a name changes the plan students see. It never opens a submission. Recorded attendance controls submission access and the next-day deadline.</p></div>
        <label>Week starting<input type="date" value={scheduleWeek} onChange={(event) => setScheduleWeek(mondayOf(event.target.value))}/></label>
        <label>RL module<select value={scheduleModule} onChange={(event) => setScheduleModule(event.target.value)}>{moduleOptions('rl').filter(([value]) => value !== '1').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <div className="card schedule-add"><label><Search size={17}/><input placeholder="Find a student, then choose a day" value={scheduleQuery} onChange={(event) => setScheduleQuery(event.target.value)}/></label><div className="schedule-search-results">{scheduleChoices.map((student) => <div key={student.id}><b>{student.full_name}</b><span>{student.npm || student.email}</span>{scheduleDays.map((day) => <button key={day} type="button" onClick={() => saveSchedule(student, day)}>{new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })}</button>)}</div>)}</div></div>
      <div className="planning-calendar">{scheduleDays.map((day) => <section className="card calendar-day" key={day} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const plan = plans.find((item) => item.id === event.dataTransfer.getData('text/plain')); if (plan) saveSchedule({ ...plan.profiles, student_id: plan.student_id }, day); }}><header><b>{new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })}</b><span>{day}</span></header>{scheduledThisWeek.filter((plan) => plan.planned_lab_date === day).map((plan) => <div className="student-calendar-card" draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', plan.id)} key={plan.id}><GripVertical size={15}/><span>{plan.profiles?.full_name}</span><button type="button" aria-label={`Remove ${plan.profiles?.full_name}`} onClick={() => removeSchedule(plan)}>×</button></div>)}</section>)}</div>
    </>}

    {tab === 'missing' && <div className="card table-card"><div className="table-scroll"><table className="dashboard-table"><thead><tr><th>Student</th><th>Planned week</th><th>Expected module</th><th>Status</th><th>Action</th></tr></thead><tbody>{filteredPlans.map((plan) => <tr key={plan.id}><td><b>{plan.profiles?.full_name}</b><small>{plan.profiles?.npm}</small></td><td>{plan.planned_week_start}<small>Week {plan.week_number}</small></td><td><b>{plan.track.toUpperCase()} M{moduleLabel(plan)}</b><small>{plan.report_label}</small></td><td><span className="attendance-badge late">{plan.status}</span></td><td><button className="table-link" onClick={() => updatePlanStatus(plan.id, plan.status === 'deferred' ? 'expected' : 'deferred')}>{plan.status === 'deferred' ? 'Return to expected' : 'Mark force majeure'}</button></td></tr>)}</tbody></table></div></div>}

    {tab === 'submissions' && <div className="card table-card"><div className="table-scroll"><table className="dashboard-table"><thead><tr><th>Student</th><th>Report</th><th>Submitted</th><th>File</th><th>Review</th><th>Grade</th></tr></thead><tbody>{filteredSubmissions.map((submission) => { const review = Array.isArray(submission.submission_reviews) ? submission.submission_reviews[0] : submission.submission_reviews; return <tr key={submission.id}><td><b>{submission.profiles?.full_name}</b><small>{submission.profiles?.npm}</small></td><td><b>{submission.track.toUpperCase()}</b><small>{submission.report_group}, week {submission.week_number}</small></td><td>{displayDate(submission.submitted_at)}<small>{submission.minutes_late > 0 ? `${submission.minutes_late} minutes late` : 'On time'}</small></td><td><button className="table-link" onClick={() => openFile(submission)}><Download size={15}/> Open PDF</button><small>Drive: {submission.drive_sync_status}</small></td><td><div className="review-controls"><select value={review?.plagiarism_status || 'pending'} onChange={(event) => updateSubmission(submission.id, { plagiarism_status: event.target.value })}><option value="pending">Pending</option><option value="processing">Processing</option><option value="clear">Clear</option><option value="review">Needs review</option></select><textarea placeholder="Feedback" defaultValue={review?.feedback || ''} onBlur={(event) => updateSubmission(submission.id, { feedback: event.target.value || null })}/></div></td><td><div className="review-controls"><input type="number" min="0" max="100" placeholder="Grade" defaultValue={review?.grade ?? ''} onBlur={(event) => updateSubmission(submission.id, { grade: event.target.value === '' ? null : Number(event.target.value) })}/><label className="release-toggle"><input type="checkbox" checked={Boolean(review?.grade_released)} onChange={(event) => updateSubmission(submission.id, { grade_released: event.target.checked })}/> Release grade</label></div></td></tr>; })}</tbody></table></div></div>}

    {tab === 'accounts' && profile.role === 'admin' && <>
      <div className="card registration-control"><div><h2>Student registration mode</h2><p className="muted">Keep external emails enabled while testing. Turn it off before the practicum opens to students.</p></div><button className="btn" onClick={toggleExternalRegistration}>{settings?.allow_external_student_registration ? 'Testing: Gmail allowed' : 'Production: UI email only'}</button></div>
      <div className="card table-card"><div className="table-scroll"><table className="dashboard-table admin-account-table"><thead><tr><th>Name</th><th>NPM</th><th>Group</th><th>Program</th><th>Email</th><th>Active</th><th>Access</th><th>Save or delete</th></tr></thead><tbody>{filteredProfiles.map((item) => { const draft = profileDrafts[item.id] || item; const change = (key, value) => setProfileDrafts((current) => ({ ...current, [item.id]: { ...draft, [key]: value } })); return <tr key={item.id}><td>{item.role === 'student' ? <input value={draft.full_name || ''} onChange={(event) => change('full_name', event.target.value)}/> : <b>{item.full_name}</b>}</td><td>{item.role === 'student' ? <input value={draft.npm || ''} onChange={(event) => change('npm', event.target.value)}/> : item.npm || 'Not set'}</td><td>{item.role === 'student' ? <input value={draft.group_name || ''} onChange={(event) => change('group_name', event.target.value)}/> : 'Staff'}</td><td>{item.role === 'student' ? <select value={draft.study_program || 'Electrical Engineering'} onChange={(event) => change('study_program', event.target.value)}><option>Electrical Engineering</option><option>Computer Engineering</option></select> : 'Staff'}</td><td>{item.email}</td><td>{item.role === 'student' ? <label className="account-active"><input type="checkbox" checked={draft.is_active !== false} onChange={(event) => change('is_active', event.target.checked)}/>{draft.is_active !== false ? 'Active' : 'Blocked'}</label> : 'Active'}</td><td><select value={item.role} disabled={item.id === user.id} onChange={(event) => updateRole(item.id, event.target.value)}><option value="student">Student</option><option value="assistant">Assistant</option><option value="admin">Administrator</option></select>{item.id === user.id && <small>Your account</small>}</td><td>{item.role === 'student' ? <div className="account-actions"><button className="table-link" type="button" onClick={() => saveStudent(item)}>Save edits</button><button className="danger-action" type="button" disabled={deleting === item.id} onClick={() => deleteStudent(item)}><Trash2 size={16}/>{deleting === item.id ? 'Deleting...' : 'Delete'}</button></div> : <small>Staff protected</small>}</td></tr>; })}</tbody></table></div></div>
    </>}
  </section>;
}
