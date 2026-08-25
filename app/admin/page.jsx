'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, CalendarCheck, Download, ExternalLink, LogOut, RefreshCw, Search, Trash2, UserRoundX, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';

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
  if (track === 'rl') return [
    ['1', '1 · Pre-test'],
    ['2&3', '2&3 · Combined'],
    ['4&5', '4&5 · Combined'],
    ['6', '6'],
    ['7', '7'],
    ['8', '8']
  ];
  return Array.from({ length: 8 }, (_, index) => [String(index + 1), String(index + 1)]);
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
    const syncInBackground = async () => {
      const { data } = await supabase.auth.getSession();
      const response = await fetch('/api/sync-attendance', {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session?.access_token || ''}` }
      });
      if (response.ok) load();
    };
    const timer = window.setInterval(syncInBackground, 30000);
    return () => window.clearInterval(timer);
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
    const { data, error } = await supabase.rpc('staff_record_attendance_batch', { entries });
    if (!error) {
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
      fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token || ''}`
        },
        body: JSON.stringify({ entries: sheetEntries })
      }).then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error || 'Sheet update failed');
        setMessage(`${data || selectedCount} students saved. Google Sheet is updated too.`);
      }).catch((sheetError) => {
        setMessage(`${data || selectedCount} students saved to the portal. Sheet retry needed: ${sheetError.message}`);
      });
    }
    setMessage(error ? error.message : `${data || selectedCount} students saved. The Sheet is updating in the background.`);
    if (!error) {
      setSelected({});
      await load();
    }
    setSaving(false);
  };

  const syncSheet = async () => {
    setSyncing(true);
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/sync-attendance', { method: 'POST', headers: { Authorization: `Bearer ${data.session?.access_token || ''}` } });
    const result = await response.json();
    setMessage(response.ok ? `${result.attendanceSynced} attendance rows and ${result.plansSynced} plans synchronized.` : result.error);
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
    const { error } = await supabase.from('practicum_sessions').delete().eq('id', session.id);
    if (error) {
      setMessage(error.message);
      setDeleting('');
      return;
    }
    await load();
    setMessage('QnA record deleted from the website. Google Sheet cleanup is running in the background.');
    const { data: sessionData } = await supabase.auth.getSession();
    fetch('/api/attendance', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token || ''}` },
      body: JSON.stringify({ sourceKeys: [session.source_row_key] })
    }).then((response) => {
      if (response.ok) setMessage('QnA record deleted from the website and Google Sheet.');
    }).catch(() => {});
    setDeleting('');
  };

  const deleteStudent = async (student) => {
    if (!confirm(`Permanently delete ${student.full_name || student.email} and all of their practicum data?`)) return;
    setDeleting(student.id);
    const { error } = await supabase.rpc('admin_delete_student_account', { target_id: student.id });
    setMessage(error ? error.message : 'Student account and practicum records deleted.');
    if (!error) await load();
    setDeleting('');
  };

  const updateDeadline = async (sessionId, value) => {
    const { error } = await supabase.from('practicum_sessions').update({
      deadline_at: new Date(value).toISOString(),
      deadline_override_reason: 'Manual force majeure adjustment',
      deadline_updated_by: user.id
    }).eq('id', sessionId);
    setMessage(error ? error.message : 'Deadline updated.');
    if (!error) load();
  };

  const updatePlanStatus = async (planId, status) => {
    const { error } = await supabase.from('student_module_plans').update({ status, updated_at: new Date().toISOString() }).eq('id', planId);
    setMessage(error ? error.message : 'Plan status updated.');
    if (!error) load();
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
      <div className="card metric-card"><Users/><span>Students</span><b>{students.length}</b></div>
      <div className="card metric-card"><CalendarCheck/><span>Attendance records</span><b>{sessions.length}</b></div>
      <div className="card metric-card"><UserRoundX/><span>Still expected</span><b>{missingPlans.length}</b></div>
      <div className="card metric-card"><Download/><span>Submissions</span><b>{submissions.length}</b></div>
    </div>

    <div className="admin-tabs" role="tablist">
      <button className={tab === 'attendance' ? 'active' : ''} onClick={() => setTab('attendance')}>Today’s attendance</button>
      <button className={tab === 'missing' ? 'active' : ''} onClick={() => setTab('missing')}>Missing students</button>
      <button className={tab === 'submissions' ? 'active' : ''} onClick={() => setTab('submissions')}>Submissions</button>
      {profile.role === 'admin' && <button className={tab === 'accounts' ? 'active' : ''} onClick={() => setTab('accounts')}>Accounts</button>}
    </div>

    {tab !== 'attendance' && <div className="card dashboard-tools"><label><Search size={17}/><input placeholder="Search name, NPM, email, or report" value={query} onChange={(event) => setQuery(event.target.value)}/></label></div>}

    {tab === 'attendance' && <>
      <form className="card batch-attendance" onSubmit={saveToday}>
        <div className="batch-heading"><div><div className="eyebrow">Step 1</div><h2>Set today’s session</h2></div><b>{selectedCount} selected</b></div>
        <div className="batch-session-grid">
          <label>Track<select value={attendance.track} onChange={(event) => setAttendance({ ...attendance, track: event.target.value, module: event.target.value === 'rl' ? '2&3' : '1' })}><option value="rl">RL</option><option value="idp">IDP</option><option value="t3">T3</option></select></label>
          <label>Module<select value={attendance.module} onChange={(event) => setAttendance({ ...attendance, module: event.target.value })}>{moduleOptions(attendance.track).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Week<input type="number" min="1" value={attendance.week_number} onChange={(event) => setAttendance({ ...attendance, week_number: event.target.value })}/></label>
          <label>Date<input type="date" value={attendance.attended_date} onChange={(event) => setAttendance({ ...attendance, attended_date: event.target.value })}/></label>
          <label>Time<input type="time" value={attendance.attended_time} onChange={(event) => setAttendance({ ...attendance, attended_time: event.target.value })}/></label>
          <label className="admin-checkbox"><input type="checkbox" checked={attendance.is_makeup} onChange={(event) => setAttendance({ ...attendance, is_makeup: event.target.checked })}/> Makeup session</label>
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
        <button className="btn batch-save" type="submit" disabled={saving || !selectedCount}>{saving ? 'Saving attendance...' : `Save ${selectedCount || ''} students`}</button>
      </form>

      <div className="card table-card"><div className="table-scroll"><table className="dashboard-table"><thead><tr><th>Student</th><th>Attendance</th><th>Module</th><th>QnA</th><th>Deadline</th><th>Submission</th><th>Delete</th></tr></thead><tbody>{filteredSessions.map((session) => <tr key={session.id}><td><b>{session.profiles?.full_name}</b><small>{session.profiles?.npm}</small></td><td>{displayDate(session.attended_at || session.scheduled_at)}<small>{session.is_makeup ? 'Makeup session' : `Week ${session.week_number}`}</small></td><td><b>{session.track.toUpperCase()} M{moduleLabel(session)}</b><small>{session.report_label}</small></td><td>{session.qna_score ?? 'Not entered'}</td><td><input type="datetime-local" defaultValue={localInputValue(session.deadline_at)} onBlur={(event) => event.target.value && updateDeadline(session.id, event.target.value)}/><small>{session.deadline_override_reason || 'Automatic: next day 23:59 WIB'}</small></td><td><span className={`attendance-badge ${session.submission_open ? 'on_time' : 'absent'}`}>{session.submission_open ? 'Open' : 'Closed'}</span></td><td><button className="danger-action" type="button" disabled={deleting === session.id} onClick={() => deleteAttendance(session)}><Trash2 size={16}/>{deleting === session.id ? 'Deleting...' : 'Delete'}</button></td></tr>)}</tbody></table></div></div>
    </>}

    {tab === 'missing' && <div className="card table-card"><div className="table-scroll"><table className="dashboard-table"><thead><tr><th>Student</th><th>Planned week</th><th>Expected module</th><th>Status</th><th>Action</th></tr></thead><tbody>{filteredPlans.map((plan) => <tr key={plan.id}><td><b>{plan.profiles?.full_name}</b><small>{plan.profiles?.npm}</small></td><td>{plan.planned_week_start}<small>Week {plan.week_number}</small></td><td><b>{plan.track.toUpperCase()} M{moduleLabel(plan)}</b><small>{plan.report_label}</small></td><td><span className="attendance-badge late">{plan.status}</span></td><td><button className="table-link" onClick={() => updatePlanStatus(plan.id, plan.status === 'deferred' ? 'expected' : 'deferred')}>{plan.status === 'deferred' ? 'Return to expected' : 'Mark force majeure'}</button></td></tr>)}</tbody></table></div></div>}

    {tab === 'submissions' && <div className="card table-card"><div className="table-scroll"><table className="dashboard-table"><thead><tr><th>Student</th><th>Report</th><th>Submitted</th><th>File</th><th>Review</th><th>Grade</th></tr></thead><tbody>{filteredSubmissions.map((submission) => { const review = Array.isArray(submission.submission_reviews) ? submission.submission_reviews[0] : submission.submission_reviews; return <tr key={submission.id}><td><b>{submission.profiles?.full_name}</b><small>{submission.profiles?.npm}</small></td><td><b>{submission.track.toUpperCase()}</b><small>{submission.report_group}, week {submission.week_number}</small></td><td>{displayDate(submission.submitted_at)}<small>{submission.minutes_late > 0 ? `${submission.minutes_late} minutes late` : 'On time'}</small></td><td><button className="table-link" onClick={() => openFile(submission)}><Download size={15}/> Open PDF</button><small>Drive: {submission.drive_sync_status}</small></td><td><div className="review-controls"><select value={review?.plagiarism_status || 'pending'} onChange={(event) => updateSubmission(submission.id, { plagiarism_status: event.target.value })}><option value="pending">Pending</option><option value="processing">Processing</option><option value="clear">Clear</option><option value="review">Needs review</option></select><textarea placeholder="Feedback" defaultValue={review?.feedback || ''} onBlur={(event) => updateSubmission(submission.id, { feedback: event.target.value || null })}/></div></td><td><div className="review-controls"><input type="number" min="0" max="100" placeholder="Grade" defaultValue={review?.grade ?? ''} onBlur={(event) => updateSubmission(submission.id, { grade: event.target.value === '' ? null : Number(event.target.value) })}/><label className="release-toggle"><input type="checkbox" checked={Boolean(review?.grade_released)} onChange={(event) => updateSubmission(submission.id, { grade_released: event.target.checked })}/> Release grade</label></div></td></tr>; })}</tbody></table></div></div>}

    {tab === 'accounts' && profile.role === 'admin' && <>
      <div className="card registration-control"><div><h2>Student registration mode</h2><p className="muted">Keep external emails enabled while testing. Turn it off before the practicum opens to students.</p></div><button className="btn" onClick={toggleExternalRegistration}>{settings?.allow_external_student_registration ? 'Testing: Gmail allowed' : 'Production: UI email only'}</button></div>
      <div className="card table-card"><div className="table-scroll"><table className="dashboard-table admin-account-table"><thead><tr><th>Name</th><th>NPM</th><th>Email</th><th>Access</th><th>Delete</th></tr></thead><tbody>{filteredProfiles.map((item) => <tr key={item.id}><td><b>{item.full_name}</b></td><td>{item.npm || 'Not set'}</td><td>{item.email}</td><td><select value={item.role} disabled={item.id === user.id} onChange={(event) => updateRole(item.id, event.target.value)}><option value="student">Student</option><option value="assistant">Assistant</option><option value="admin">Administrator</option></select>{item.id === user.id && <small>Your account</small>}</td><td>{item.role === 'student' ? <button className="danger-action" type="button" disabled={deleting === item.id} onClick={() => deleteStudent(item)}><Trash2 size={16}/>{deleting === item.id ? 'Deleting...' : 'Delete student'}</button> : <small>Staff protected</small>}</td></tr>)}</tbody></table></div></div>
    </>}
  </section>;
}
