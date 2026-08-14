'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Download, LogOut, RefreshCw, Search, ShieldCheck, UserRoundX, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';

function localInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  const jakarta = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return jakarta.toISOString().slice(0, 16);
}

function displayDate(value) {
  return value ? new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta' }) : 'Not set';
}

const emptyAttendance = {
  student_id: '',
  track: 'rl',
  module_number: '2',
  week_number: '1',
  attended_at: '',
  qna_score: '',
  is_makeup: false,
  notes: ''
};

export default function AdminPage() {
  const { user, profile, loading, configured, supabase } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [settings, setSettings] = useState(null);
  const [tab, setTab] = useState('attendance');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [attendance, setAttendance] = useState(emptyAttendance);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();
  const isStaff = profile?.role === 'assistant' || profile?.role === 'admin';

  const load = useCallback(async () => {
    if (!supabase || !isStaff) return;
    const requests = [
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('practicum_sessions').select('*, profiles!practicum_sessions_student_id_fkey(full_name,npm,email)').order('attended_at', { ascending: false }),
      supabase.from('submissions').select('*, profiles!submissions_student_id_fkey(full_name,npm,email), submission_reviews(*)').order('submitted_at', { ascending: false }),
      supabase.from('student_module_plans').select('*, profiles!student_module_plans_student_id_fkey(full_name,npm,email)').order('planned_week_start'),
      supabase.from('lab_settings').select('*').eq('id', true).maybeSingle()
    ];
    const [profileResult, sessionResult, submissionResult, planResult, settingResult] = await Promise.all(requests);
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

  const students = useMemo(() => profiles.filter((item) => item.role === 'student'), [profiles]);
  const missingPlans = useMemo(() => plans.filter((item) => item.status !== 'completed'), [plans]);
  const filteredProfiles = useMemo(() => profiles.filter((item) => `${item.full_name} ${item.npm || ''} ${item.email}`.toLowerCase().includes(query.toLowerCase())), [profiles, query]);
  const filteredSessions = useMemo(() => sessions.filter((item) => `${item.profiles?.full_name || ''} ${item.profiles?.npm || ''} ${item.track} ${item.report_label}`.toLowerCase().includes(query.toLowerCase())), [sessions, query]);
  const filteredPlans = useMemo(() => missingPlans.filter((item) => `${item.profiles?.full_name || ''} ${item.profiles?.npm || ''} ${item.track} ${item.report_label}`.toLowerCase().includes(query.toLowerCase())), [missingPlans, query]);
  const filteredSubmissions = useMemo(() => submissions.filter((item) => `${item.profiles?.full_name || ''} ${item.profiles?.npm || ''} ${item.track} ${item.report_group}`.toLowerCase().includes(query.toLowerCase())), [submissions, query]);

  const recordAttendance = async (event) => {
    event.preventDefault();
    setSaving(true);
    const { error } = await supabase.rpc('staff_record_attendance', {
      target_student_id: attendance.student_id,
      selected_track: attendance.track,
      selected_module: Number(attendance.module_number),
      selected_week: Number(attendance.week_number),
      attended_time: new Date(attendance.attended_at).toISOString(),
      score: attendance.qna_score === '' ? null : Number(attendance.qna_score),
      makeup: attendance.is_makeup,
      attendance_notes: attendance.notes || null
    });
    setMessage(error ? error.message : 'Attendance recorded. The deadline is tomorrow at 23:59 WIB.');
    if (!error) {
      setAttendance(emptyAttendance);
      load();
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
      <div><div className="eyebrow">Practicum administration</div><h1 className="title">Attendance sets the deadline.</h1><p className="subtitle">The initial module plan shows what students expect to take. The QnA attendance log creates the actual submission window.</p></div>
      <div className="btn-row"><button className="btn" onClick={syncSheet} disabled={syncing}><RefreshCw size={17}/> {syncing ? 'Syncing...' : 'Sync Google Sheet'}</button><button className="btn ghost" onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }}><LogOut size={17}/> Sign out</button></div>
    </div>

    {message && <div className="status-message">{message}</div>}

    <div className="dashboard-stats">
      <div className="card metric-card"><Users/><span>Students</span><b>{students.length}</b></div>
      <div className="card metric-card"><CalendarCheck/><span>Attendance records</span><b>{sessions.length}</b></div>
      <div className="card metric-card"><UserRoundX/><span>Still expected</span><b>{missingPlans.length}</b></div>
      <div className="card metric-card"><Download/><span>Submissions</span><b>{submissions.length}</b></div>
    </div>

    <div className="admin-tabs" role="tablist">
      <button className={tab === 'attendance' ? 'active' : ''} onClick={() => setTab('attendance')}>Attendance</button>
      <button className={tab === 'missing' ? 'active' : ''} onClick={() => setTab('missing')}>Missing students</button>
      <button className={tab === 'submissions' ? 'active' : ''} onClick={() => setTab('submissions')}>Submissions</button>
      {profile.role === 'admin' && <button className={tab === 'accounts' ? 'active' : ''} onClick={() => setTab('accounts')}>Accounts</button>}
    </div>

    <div className="card dashboard-tools"><label><Search size={17}/><input placeholder="Search name, NPM, email, or report" value={query} onChange={(event) => setQuery(event.target.value)}/></label></div>

    {tab === 'attendance' && <>
      <form className="card admin-assignment-form" onSubmit={recordAttendance}>
        <div><div className="eyebrow">QnA attendance fallback</div><h2>Record a student manually</h2><p className="muted">Use this when the Google Sheet is unavailable or a force majeure change must be handled immediately.</p></div>
        <label>Student<select required value={attendance.student_id} onChange={(event) => setAttendance({ ...attendance, student_id: event.target.value })}><option value="">Select student</option>{students.map((item) => <option key={item.id} value={item.id}>{item.full_name} ({item.npm || 'no NPM'})</option>)}</select></label>
        <label>Track<select value={attendance.track} onChange={(event) => setAttendance({ ...attendance, track: event.target.value })}><option value="rl">RL</option><option value="idp">IDP</option><option value="t3">T3</option></select></label>
        <label>Module<input type="number" min="1" max="8" required value={attendance.module_number} onChange={(event) => setAttendance({ ...attendance, module_number: event.target.value })}/></label>
        <label>Week<input type="number" min="1" required value={attendance.week_number} onChange={(event) => setAttendance({ ...attendance, week_number: event.target.value })}/></label>
        <label>Attended at<input type="datetime-local" required value={attendance.attended_at} onChange={(event) => setAttendance({ ...attendance, attended_at: event.target.value })}/></label>
        <label>QnA score<input type="number" step="0.01" value={attendance.qna_score} onChange={(event) => setAttendance({ ...attendance, qna_score: event.target.value })}/></label>
        <label>Notes<input value={attendance.notes} onChange={(event) => setAttendance({ ...attendance, notes: event.target.value })}/></label>
        <label className="admin-checkbox"><input type="checkbox" checked={attendance.is_makeup} onChange={(event) => setAttendance({ ...attendance, is_makeup: event.target.checked })}/> Makeup session</label>
        <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Record attendance'}</button>
      </form>
      <div className="card table-card"><div className="table-scroll"><table className="dashboard-table"><thead><tr><th>Student</th><th>Attendance</th><th>Module</th><th>QnA</th><th>Deadline</th><th>Submission</th></tr></thead><tbody>{filteredSessions.map((session) => <tr key={session.id}><td><b>{session.profiles?.full_name}</b><small>{session.profiles?.npm}</small></td><td>{displayDate(session.attended_at || session.scheduled_at)}<small>{session.is_makeup ? 'Makeup session' : `Week ${session.week_number}`}</small></td><td><b>{session.track.toUpperCase()} M{session.module_number}</b><small>{session.report_label}</small></td><td>{session.qna_score ?? 'Not entered'}</td><td><input type="datetime-local" defaultValue={localInputValue(session.deadline_at)} onBlur={(event) => event.target.value && updateDeadline(session.id, event.target.value)}/><small>{session.deadline_override_reason || 'Automatic: next day 23:59 WIB'}</small></td><td><span className={`attendance-badge ${session.submission_open ? 'on_time' : 'absent'}`}>{session.submission_open ? 'Open' : 'Closed'}</span></td></tr>)}</tbody></table></div></div>
    </>}

    {tab === 'missing' && <div className="card table-card"><div className="table-scroll"><table className="dashboard-table"><thead><tr><th>Student</th><th>Planned week</th><th>Expected module</th><th>Status</th><th>Action</th></tr></thead><tbody>{filteredPlans.map((plan) => <tr key={plan.id}><td><b>{plan.profiles?.full_name}</b><small>{plan.profiles?.npm}</small></td><td>{plan.planned_week_start}<small>Week {plan.week_number}</small></td><td><b>{plan.track.toUpperCase()} M{plan.module_number}</b><small>{plan.report_label}</small></td><td><span className="attendance-badge late">{plan.status}</span></td><td><button className="table-link" onClick={() => updatePlanStatus(plan.id, plan.status === 'deferred' ? 'expected' : 'deferred')}>{plan.status === 'deferred' ? 'Return to expected' : 'Mark force majeure'}</button></td></tr>)}</tbody></table></div></div>}

    {tab === 'submissions' && <div className="card table-card"><div className="table-scroll"><table className="dashboard-table"><thead><tr><th>Student</th><th>Report</th><th>Submitted</th><th>File</th><th>Review</th><th>Grade</th></tr></thead><tbody>{filteredSubmissions.map((submission) => { const review = submission.submission_reviews; return <tr key={submission.id}><td><b>{submission.profiles?.full_name}</b><small>{submission.profiles?.npm}</small></td><td><b>{submission.track.toUpperCase()}</b><small>{submission.report_group}, week {submission.week_number}</small></td><td>{displayDate(submission.submitted_at)}<small>{submission.minutes_late > 0 ? `${submission.minutes_late} minutes late` : 'On time'}</small></td><td><button className="table-link" onClick={() => openFile(submission)}><Download size={15}/> Open PDF</button><small>Drive: {submission.drive_sync_status}</small></td><td><div className="review-controls"><select value={review?.plagiarism_status || 'pending'} onChange={(event) => updateSubmission(submission.id, { plagiarism_status: event.target.value })}><option value="pending">Pending</option><option value="processing">Processing</option><option value="clear">Clear</option><option value="review">Needs review</option></select><textarea placeholder="Feedback" defaultValue={review?.feedback || ''} onBlur={(event) => updateSubmission(submission.id, { feedback: event.target.value || null })}/></div></td><td><div className="review-controls"><input type="number" min="0" max="100" placeholder="Grade" defaultValue={review?.grade ?? ''} onBlur={(event) => updateSubmission(submission.id, { grade: event.target.value === '' ? null : Number(event.target.value) })}/><label className="release-toggle"><input type="checkbox" checked={Boolean(review?.grade_released)} onChange={(event) => updateSubmission(submission.id, { grade_released: event.target.checked })}/> Release grade</label></div></td></tr>; })}</tbody></table></div></div>}

    {tab === 'accounts' && profile.role === 'admin' && <>
      <div className="card registration-control"><div><h2>Student registration mode</h2><p className="muted">Keep external emails enabled while testing. Turn it off before the practicum opens to students.</p></div><button className="btn" onClick={toggleExternalRegistration}>{settings?.allow_external_student_registration ? 'Testing: Gmail allowed' : 'Production: UI email only'}</button></div>
      <div className="card table-card"><div className="table-scroll"><table className="dashboard-table admin-account-table"><thead><tr><th>Name</th><th>NPM</th><th>Email</th><th>Access</th></tr></thead><tbody>{filteredProfiles.map((item) => <tr key={item.id}><td><b>{item.full_name}</b></td><td>{item.npm || 'Not set'}</td><td>{item.email}</td><td><select value={item.role} disabled={item.id === user.id} onChange={(event) => updateRole(item.id, event.target.value)}><option value="student">Student</option><option value="assistant">Assistant</option><option value="admin">Administrator</option></select>{item.id === user.id && <small>Your account</small>}</td></tr>)}</tbody></table></div></div>
    </>}
  </section>;
}
