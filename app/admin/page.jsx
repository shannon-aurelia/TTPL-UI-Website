'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Download, LogOut, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { reportGroupFor } from '../../lib/practicum';

const emptyAssignment = {
  student_id: '',
  track: 'rl',
  module_number: '2',
  week_number: '1',
  scheduled_at: '',
  deadline_at: '',
  attendance_status: 'on_time',
  submission_open: true
};

function dateTime(value) {
  return value ? new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta' }) : 'Not set';
}

export default function AdminPage() {
  const { user, profile, loading, configured, supabase } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [tab, setTab] = useState('students');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [assignment, setAssignment] = useState(emptyAssignment);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    if (!supabase || profile?.role !== 'admin') return;
    const [profileResult, sessionResult, submissionResult] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('practicum_sessions').select('*, profiles!practicum_sessions_student_id_fkey(full_name,npm,email)').order('scheduled_at', { ascending: false }),
      supabase.from('submissions').select('*, profiles!submissions_student_id_fkey(full_name,npm,email), submission_reviews(*)').order('submitted_at', { ascending: false })
    ]);
    const error = profileResult.error || sessionResult.error || submissionResult.error;
    if (error) setMessage(error.message);
    setProfiles(profileResult.data || []);
    setSessions(sessionResult.data || []);
    setSubmissions(submissionResult.data || []);
  }, [supabase, profile]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && profile?.role === 'student') router.replace('/portal');
    if (!loading && user && profile?.role === 'assistant') router.replace('/assistant-dashboard');
  }, [loading, user, profile, router]);

  useEffect(() => { load(); }, [load]);

  const students = useMemo(() => profiles.filter((item) => item.role === 'student'), [profiles]);
  const filteredProfiles = useMemo(() => profiles.filter((item) => `${item.full_name} ${item.npm || ''} ${item.email}`.toLowerCase().includes(query.toLowerCase())), [profiles, query]);
  const filteredSessions = useMemo(() => sessions.filter((item) => `${item.profiles?.full_name || ''} ${item.profiles?.npm || ''} ${item.track} ${item.report_label}`.toLowerCase().includes(query.toLowerCase())), [sessions, query]);
  const filteredSubmissions = useMemo(() => submissions.filter((item) => `${item.profiles?.full_name || ''} ${item.profiles?.npm || ''} ${item.track} ${item.report_group}`.toLowerCase().includes(query.toLowerCase())), [submissions, query]);

  const updateRole = async (profileId, role) => {
    setMessage('');
    const { error } = await supabase.rpc('admin_set_profile_role', { target_id: profileId, new_role: role });
    setMessage(error ? error.message : 'Account role updated.');
    if (!error) load();
  };

  const addAssignment = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    const group = reportGroupFor(assignment.track, Number(assignment.module_number));
    if (!group) {
      setMessage('This module does not have a valid report group.');
      setSaving(false);
      return;
    }
    const payload = {
      source_row_key: `manual-${crypto.randomUUID()}`,
      student_id: assignment.student_id,
      track: assignment.track,
      module_number: Number(assignment.module_number),
      week_number: Number(assignment.week_number),
      report_group: group.id,
      report_label: group.title,
      scheduled_at: new Date(assignment.scheduled_at).toISOString(),
      deadline_at: assignment.deadline_at ? new Date(assignment.deadline_at).toISOString() : null,
      attendance_status: assignment.attendance_status,
      submission_open: assignment.submission_open,
      notes: 'Added from administrator portal'
    };
    const { error } = await supabase.from('practicum_sessions').insert(payload);
    setMessage(error ? error.message : 'Assignment added.');
    if (!error) {
      setAssignment(emptyAssignment);
      load();
    }
    setSaving(false);
  };

  const updateSession = async (id, changes) => {
    const { error } = await supabase.from('practicum_sessions').update(changes).eq('id', id);
    setMessage(error ? error.message : 'Assignment updated.');
    if (!error) load();
  };

  const updateSubmission = async (id, changes) => {
    const { error } = await supabase.from('submission_reviews').upsert({ submission_id: id, ...changes, graded_by: user.id, graded_at: new Date().toISOString() });
    setMessage(error ? error.message : 'Submission review updated.');
    if (!error) load();
  };

  const openFile = async (path) => {
    const { data, error } = await supabase.storage.from('practicum-reports').createSignedUrl(path, 120);
    if (error) setMessage(error.message);
    else window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) return <section className="section"><h1 className="title">Loading administration...</h1></section>;
  if (!configured) return <section className="section"><div className="card"><h1 className="title">Account service unavailable.</h1></div></section>;
  if (!user || profile?.role !== 'admin') return null;

  return <section className="section dashboard-page">
    <div className="dashboard-heading">
      <div><div className="eyebrow">Administrator portal</div><h1 className="title">Manage the practicum.</h1><p className="subtitle">Manage access, student assignments, submission windows, and report reviews from one page.</p></div>
      <div className="btn-row"><button className="btn ghost" onClick={load}><RefreshCw size={17}/> Refresh</button><button className="btn ghost" onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }}><LogOut size={17}/> Sign out</button></div>
    </div>

    {message && <div className="status-message">{message}</div>}

    <div className="dashboard-stats">
      <div className="card metric-card"><Users/><span>Students</span><b>{students.length}</b></div>
      <div className="card metric-card"><ShieldCheck/><span>Staff accounts</span><b>{profiles.length - students.length}</b></div>
      <div className="card metric-card"><CalendarPlus/><span>Assignments</span><b>{sessions.length}</b></div>
      <div className="card metric-card"><Download/><span>Submissions</span><b>{submissions.length}</b></div>
    </div>

    <div className="admin-tabs" role="tablist">
      <button className={tab === 'students' ? 'active' : ''} onClick={() => setTab('students')}>Accounts</button>
      <button className={tab === 'assignments' ? 'active' : ''} onClick={() => setTab('assignments')}>Assignments</button>
      <button className={tab === 'submissions' ? 'active' : ''} onClick={() => setTab('submissions')}>Submissions</button>
    </div>

    <div className="card dashboard-tools"><label><Search size={17}/><input placeholder="Search name, NPM, email, or report" value={query} onChange={(event) => setQuery(event.target.value)}/></label></div>

    {tab === 'students' && <div className="card table-card"><div className="table-scroll"><table className="dashboard-table admin-account-table"><thead><tr><th>Name</th><th>NPM</th><th>Email</th><th>Access</th></tr></thead><tbody>{filteredProfiles.map((item) => <tr key={item.id}><td><b>{item.full_name}</b></td><td>{item.npm || 'Not set'}</td><td>{item.email}</td><td><select value={item.role} disabled={item.id === user.id} onChange={(event) => updateRole(item.id, event.target.value)}><option value="student">Student</option><option value="assistant">Assistant</option><option value="admin">Administrator</option></select>{item.id === user.id && <small>Your account</small>}</td></tr>)}</tbody></table></div></div>}

    {tab === 'assignments' && <>
      <form className="card admin-assignment-form" onSubmit={addAssignment}>
        <div><div className="eyebrow">New assignment</div><h2>Add a student session</h2></div>
        <label>Student<select required value={assignment.student_id} onChange={(event) => setAssignment({ ...assignment, student_id: event.target.value })}><option value="">Select student</option>{students.map((item) => <option key={item.id} value={item.id}>{item.full_name} ({item.npm || 'no NPM'})</option>)}</select></label>
        <label>Track<select value={assignment.track} onChange={(event) => setAssignment({ ...assignment, track: event.target.value })}><option value="rl">RL</option><option value="idp">IDP</option><option value="t3">T3</option></select></label>
        <label>Module<input type="number" min="1" max="8" required value={assignment.module_number} onChange={(event) => setAssignment({ ...assignment, module_number: event.target.value })}/></label>
        <label>Week<input type="number" min="1" required value={assignment.week_number} onChange={(event) => setAssignment({ ...assignment, week_number: event.target.value })}/></label>
        <label>Scheduled at<input type="datetime-local" required value={assignment.scheduled_at} onChange={(event) => setAssignment({ ...assignment, scheduled_at: event.target.value })}/></label>
        <label>Deadline<input type="datetime-local" value={assignment.deadline_at} onChange={(event) => setAssignment({ ...assignment, deadline_at: event.target.value })}/></label>
        <label>Attendance<select value={assignment.attendance_status} onChange={(event) => setAssignment({ ...assignment, attendance_status: event.target.value })}><option value="scheduled">Scheduled</option><option value="on_time">On time</option><option value="late">Late</option><option value="absent">Absent</option><option value="excused">Excused</option></select></label>
        <label className="admin-checkbox"><input type="checkbox" checked={assignment.submission_open} onChange={(event) => setAssignment({ ...assignment, submission_open: event.target.checked })}/> Submission open</label>
        <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add assignment'}</button>
      </form>
      <div className="card table-card"><div className="table-scroll"><table className="dashboard-table"><thead><tr><th>Student</th><th>Schedule</th><th>Report</th><th>Attendance</th><th>Deadline</th><th>Submission</th></tr></thead><tbody>{filteredSessions.map((session) => <tr key={session.id}><td><b>{session.profiles?.full_name}</b><small>{session.profiles?.npm}</small></td><td>{dateTime(session.scheduled_at)}<small>Week {session.week_number}</small></td><td><b>{session.track.toUpperCase()} M{session.module_number}</b><small>{session.report_label}</small></td><td><select value={session.attendance_status} onChange={(event) => updateSession(session.id, { attendance_status: event.target.value })}><option value="scheduled">Scheduled</option><option value="on_time">On time</option><option value="late">Late</option><option value="absent">Absent</option><option value="excused">Excused</option></select></td><td>{dateTime(session.deadline_at)}</td><td><label className="release-toggle"><input type="checkbox" checked={session.submission_open} onChange={(event) => updateSession(session.id, { submission_open: event.target.checked })}/> {session.submission_open ? 'Open' : 'Closed'}</label></td></tr>)}</tbody></table></div></div>
    </>}

    {tab === 'submissions' && <div className="card table-card"><div className="table-scroll"><table className="dashboard-table"><thead><tr><th>Student</th><th>Report</th><th>Submitted</th><th>File</th><th>Review</th><th>Grade</th></tr></thead><tbody>{filteredSubmissions.map((submission) => { const review = submission.submission_reviews; return <tr key={submission.id}><td><b>{submission.profiles?.full_name}</b><small>{submission.profiles?.npm}</small></td><td><b>{submission.track.toUpperCase()}</b><small>{submission.report_group}, week {submission.week_number}</small></td><td>{dateTime(submission.submitted_at)}<small>{submission.minutes_late > 0 ? `${submission.minutes_late} minutes late` : 'On time'}</small></td><td><button className="table-link" onClick={() => openFile(submission.file_path)}><Download size={15}/> Open PDF</button></td><td><div className="review-controls"><select value={review?.plagiarism_status || 'pending'} onChange={(event) => updateSubmission(submission.id, { plagiarism_status: event.target.value })}><option value="pending">Pending</option><option value="processing">Processing</option><option value="clear">Clear</option><option value="review">Needs review</option></select><textarea placeholder="Feedback" defaultValue={review?.feedback || ''} onBlur={(event) => updateSubmission(submission.id, { feedback: event.target.value || null })}/></div></td><td><div className="review-controls"><input type="number" min="0" max="100" placeholder="Grade" defaultValue={review?.grade ?? ''} onBlur={(event) => updateSubmission(submission.id, { grade: event.target.value === '' ? null : Number(event.target.value) })}/><label className="release-toggle"><input type="checkbox" checked={Boolean(review?.grade_released)} onChange={(event) => updateSubmission(submission.id, { grade_released: event.target.checked })}/> Release grade</label></div></td></tr>; })}</tbody></table></div></div>}
  </section>;
}
