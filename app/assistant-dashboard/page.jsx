'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, LogOut, RefreshCw, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';

export default function AssistantDashboard() {
  const { user, profile, loading, configured, supabase } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState('');
  const [track, setTrack] = useState('all');
  const [message, setMessage] = useState('');
  const router = useRouter();

  const load = async () => {
    if (!supabase) return;
    const [sessionResult, submissionResult, studentResult] = await Promise.all([
      supabase.from('practicum_sessions').select('*, profiles!practicum_sessions_student_id_fkey(full_name,npm,email)').order('week_number', { ascending: false }),
      supabase.from('submissions').select('*, profiles!submissions_student_id_fkey(full_name,npm,email), submission_reviews(*)').order('submitted_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('role', 'student').order('full_name')
    ]);
    setSessions(sessionResult.data || []);
    setSubmissions((submissionResult.data || []).map((submission) => ({
      ...submission,
      submission_reviews: Array.isArray(submission.submission_reviews) ? submission.submission_reviews[0] : submission.submission_reviews
    })));
    setStudents(studentResult.data || []);
  };

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && profile?.role === 'student') router.replace('/portal');
    if (!loading && user && profile?.role === 'admin') router.replace('/admin');
  }, [loading, user, profile, router]);

  useEffect(() => { if (user && ['assistant', 'admin'].includes(profile?.role)) load(); }, [user, profile]);

  const rows = useMemo(() => sessions.filter((session) => {
    const haystack = `${session.profiles?.full_name || ''} ${session.profiles?.npm || ''} ${session.report_group}`.toLowerCase();
    return (track === 'all' || session.track === track) && haystack.includes(filter.toLowerCase());
  }), [sessions, track, filter]);

  const updateSubmission = async (id, changes) => {
    const { error } = await supabase.from('submission_reviews').upsert({ submission_id: id, ...changes, graded_by: user.id, graded_at: new Date().toISOString() });
    setMessage(error ? error.message : 'Submission updated.');
    if (!error) load();
  };

  const openFile = async (path) => {
    const { data, error } = await supabase.storage.from('practicum-reports').createSignedUrl(path, 120);
    if (error) setMessage(error.message);
    else window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) return <section className="section"><h1 className="title">Loading assistant dashboard...</h1></section>;
  if (!configured) return <section className="section"><div className="card"><h1 className="title">Supabase setup required.</h1><p className="subtitle">Follow DATA_SETUP_GUIDE.md.</p></div></section>;
  if (!user || profile?.role !== 'assistant') return null;

  return <section className="section dashboard-page">
    <div className="dashboard-heading"><div><div className="eyebrow">Assistant dashboard</div><h1 className="title">Practicum control room.</h1><p className="subtitle">Track students by module and week, review attendance-based deadlines, open PDFs, record plagiarism status, and prepare grades without releasing them early.</p></div><div className="btn-row"><button className="btn ghost" onClick={load}><RefreshCw size={17}/> Refresh</button><button className="btn ghost" onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }}><LogOut size={17}/> Sign out</button></div></div>
    {message && <div className="status-message">{message}</div>}
    <div className="dashboard-stats"><div className="card metric-card"><span>Students</span><b>{students.length}</b></div><div className="card metric-card"><span>Scheduled rows</span><b>{sessions.length}</b></div><div className="card metric-card"><span>Submissions</span><b>{submissions.length}</b></div><div className="card metric-card"><span>Late files</span><b>{submissions.filter((item) => Number(item.minutes_late) > 0).length}</b></div></div>
    <div className="card dashboard-tools"><label><Search size={17}/><input placeholder="Search name, NPM, or report group" value={filter} onChange={(event) => setFilter(event.target.value)}/></label><select value={track} onChange={(event) => setTrack(event.target.value)}><option value="all">All tracks</option><option value="rl">RL</option><option value="idp">IDP</option><option value="t3">T3</option></select></div>
    <div className="card table-card"><div className="table-scroll"><table className="dashboard-table"><thead><tr><th>Student</th><th>Week</th><th>Track / module</th><th>Attendance</th><th>Deadline</th><th>Submission</th><th>Review</th></tr></thead><tbody>{rows.map((session) => { const submission = submissions.find((item) => item.session_id === session.id); const review = submission?.submission_reviews; return <tr key={session.id}><td><b>{session.profiles?.full_name}</b><small>{session.profiles?.npm}</small></td><td>{session.week_number}</td><td><b>{session.track.toUpperCase()} · M{session.module_number}</b><small>{session.report_label || session.report_group}</small></td><td><span className={`attendance-badge ${session.attendance_status}`}>{session.attendance_status}</span>{session.is_makeup && <small>Makeup</small>}</td><td>{session.deadline_at ? new Date(session.deadline_at).toLocaleString('en-GB') : 'Closed'}</td><td>{submission ? <><button className="table-link" onClick={() => openFile(submission.file_path)}><Download size={15}/> Open PDF</button><small>{submission.minutes_late} min late · -{submission.late_penalty}</small></> : 'Not submitted'}</td><td>{submission ? <div className="review-controls"><select value={review?.plagiarism_status || 'pending'} onChange={(event) => updateSubmission(submission.id, { plagiarism_status: event.target.value })}><option value="pending">Plagiarism pending</option><option value="processing">Processing</option><option value="clear">Clear</option><option value="review">Needs review</option></select><input type="number" min="0" max="100" placeholder="Grade" defaultValue={review?.grade ?? ''} onBlur={(event) => updateSubmission(submission.id, { grade: event.target.value === '' ? null : Number(event.target.value) })}/><label className="release-toggle"><input type="checkbox" checked={Boolean(review?.grade_released)} onChange={(event) => updateSubmission(submission.id, { grade_released: event.target.checked })}/> Release</label></div> : 'Not submitted'}</td></tr>; })}</tbody></table></div></div>
  </section>;
}
