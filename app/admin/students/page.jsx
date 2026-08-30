'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronDown, ChevronUp, Save, Search, Trash2, UserRound, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthProvider';

function formatDate(value) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });
}

function moduleName(item) {
  if (item.report_group?.endsWith('2-3')) return '2&3';
  if (item.report_group?.endsWith('4-5')) return '4&5';
  return item.module_number || '—';
}

export default function StudentsPage() {
  const { user, profile, loading, configured, supabase } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [openStudent, setOpenStudent] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState('');
  const isStaff = profile?.role === 'admin' || profile?.role === 'assistant';

  const load = useCallback(async () => {
    if (!supabase || !isStaff) return;
    const [profileResult, rosterResult, sessionResult, planResult, submissionResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'student').order('full_name'),
      supabase.from('student_roster').select('*').order('full_name'),
      supabase.from('practicum_sessions').select('*').order('attended_at', { ascending: false }),
      supabase.from('student_module_plans').select('*').order('planned_lab_date'),
      supabase.from('submissions').select('*').order('submitted_at', { ascending: false })
    ]);
    const error = profileResult.error || rosterResult.error || sessionResult.error || planResult.error || submissionResult.error;
    if (error) setMessage(error.message);
    const claimedIds = new Set((profileResult.data || []).map((student) => student.id));
    setStudents([...(profileResult.data || []), ...(rosterResult.data || []).filter((student) => !student.claimed_by || !claimedIds.has(student.claimed_by)).map((student) => ({ ...student, id: `roster-${student.id}`, roster_id: student.id, email: student.ui_email || 'Registration pending', gmail_email: student.gmail_email, is_roster: true, study_program: 'Electrical Engineering' }))]);
    setSessions(sessionResult.data || []);
    setPlans(planResult.data || []);
    setSubmissions(submissionResult.data || []);
  }, [supabase, isStaff]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && !isStaff) router.replace('/portal');
  }, [loading, user, isStaff, router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!supabase || !isStaff) return undefined;
    const channel = supabase.channel('student-directory-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_roster' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'practicum_sessions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_module_plans' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, isStaff, load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return students.filter((student) => `${student.full_name} ${student.npm || ''} ${student.email} ${student.group_name || ''}`.toLowerCase().includes(needle));
  }, [students, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20));
  const visible = filtered.slice((page - 1) * 20, page * 20);

  useEffect(() => { setPage(1); }, [query]);

  const updateDraft = (student, key, value) => setDrafts((current) => ({ ...current, [student.id]: { ...(current[student.id] || student), [key]: value } }));

  const saveStudent = async (student) => {
    const draft = drafts[student.id] || student;
    setWorking(student.id);
    setMessage('Saving the profile to the website and Google Sheet...');
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/admin-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
      body: JSON.stringify(student.is_roster
        ? { action: 'updateRoster', id: student.roster_id, full_name: draft.full_name, npm: draft.npm, is_active: draft.is_active }
        : { action: 'updateStudent', id: student.id, full_name: draft.full_name, npm: draft.npm, gmail_email: draft.gmail_email, group_name: draft.group_name, study_program: draft.study_program, is_active: draft.is_active })
    });
    const result = await response.json();
    setMessage(response.ok ? `${draft.full_name} was updated on the website and Sheet.` : result.error);
    if (response.ok) {
      setDrafts((current) => { const next = { ...current }; delete next[student.id]; return next; });
      await load();
    }
    setWorking('');
  };

  const deleteStudent = async (student) => {
    if (!confirm(`Permanently delete ${student.full_name} and all linked practicum records?`)) return;
    setWorking(student.id);
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/admin-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
      body: JSON.stringify({ action: 'deleteStudent', id: student.id })
    });
    const result = await response.json();
    setMessage(response.ok ? 'Student and linked Sheet record deleted.' : result.error);
    if (response.ok) await load();
    setWorking('');
  };

  if (loading) return <section className="section"><h1 className="title">Loading students...</h1></section>;
  if (!configured) return <section className="section"><h1 className="title">Account service unavailable.</h1></section>;
  if (!user || !isStaff) return null;

  return <section className="section student-directory-page">
    <div className="workspace-page-heading">
      <div><Link className="back-link" href="/admin"><ArrowLeft size={16}/> Admin desk</Link><div className="eyebrow">Student directory</div><h1 className="title">Every student, one record.</h1><p className="subtitle">Click a student to review attendance, planned dates, submissions, and edit the profile shared by the website and source Sheet.</p></div>
      <Link className="btn" href="/admin/schedule"><CalendarDays size={17}/> Open schedule</Link>
    </div>
    {message && <div className="status-message">{message}</div>}
    <div className="card directory-toolbar"><label><Search size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, NPM, email, or group"/></label><b>{filtered.length} students</b></div>
    <div className="student-directory-list">
      {visible.map((student) => {
        const draft = drafts[student.id] || student;
        const expanded = openStudent === student.id;
        const attendance = sessions.filter((item) => item.student_id === student.id);
        const studentPlans = plans.filter((item) => student.is_roster ? item.roster_id === student.roster_id : item.student_id === student.id);
        const studentSubmissions = submissions.filter((item) => item.student_id === student.id);
        return <article className={`card student-directory-card ${expanded ? 'expanded' : ''}`} key={student.id}>
          <button className="student-card-summary" type="button" onClick={() => setOpenStudent(expanded ? '' : student.id)} aria-expanded={expanded}>
            <span className="student-avatar"><UserRound/></span><span><b>{student.full_name}</b><small>{student.npm || 'No NPM'} · {student.email}</small></span><span className={student.is_active === false ? 'student-state blocked' : 'student-state'}>{student.is_active === false ? 'Blocked' : student.is_roster ? 'Registration pending' : 'Active'}</span><span className="student-record-count">{attendance.length} attendance</span>{expanded ? <ChevronUp/> : <ChevronDown/>}
          </button>
          {expanded && <div className="student-card-detail">
            <div className="student-edit-grid">
              <label>Full name<input value={draft.full_name || ''} onChange={(event) => updateDraft(student, 'full_name', event.target.value)}/></label>
              <label>NPM<input value={draft.npm || ''} onChange={(event) => updateDraft(student, 'npm', event.target.value)}/></label>
              {!student.is_roster && <label>Gmail<input value={draft.gmail_email || ''} onChange={(event) => updateDraft(student, 'gmail_email', event.target.value)}/></label>}
              <label>Group<input value={draft.group_name || ''} onChange={(event) => updateDraft(student, 'group_name', event.target.value)}/></label>
              <label>Study program<select value={draft.study_program || 'Electrical Engineering'} onChange={(event) => updateDraft(student, 'study_program', event.target.value)}><option>Electrical Engineering</option><option>Computer Engineering</option></select></label>
              <label className="student-active-control"><input type="checkbox" checked={draft.is_active !== false} onChange={(event) => updateDraft(student, 'is_active', event.target.checked)}/><span><b>Account active</b><small>Blocked students cannot sign in or submit.</small></span></label>
              <button className="btn" type="button" disabled={working === student.id} onClick={() => saveStudent(student)}><Save size={16}/>{working === student.id ? 'Saving...' : 'Save profile'}</button>
              {profile.role === 'admin' && !student.is_roster && <button className="danger-action" type="button" disabled={working === student.id} onClick={() => deleteStudent(student)}><Trash2 size={16}/> Delete student</button>}
            </div>
            <div className="student-record-columns">
              <section><h3>Attendance and QnA</h3>{attendance.length ? attendance.map((item) => <div className="student-record-row" key={item.id}><span><b>{item.track.toUpperCase()} · Module {moduleName(item)}</b><small>{formatDate(item.attended_at || item.scheduled_at)}{item.is_makeup ? ' · Makeup' : ''}</small></span><strong>{item.qna_score ?? '—'}</strong></div>) : <p className="muted">No attendance recorded yet.</p>}</section>
              <section><h3>Planned schedule</h3>{studentPlans.length ? studentPlans.map((item) => <div className="student-record-row" key={item.id}><span><b>{item.track.toUpperCase()} · Module {moduleName(item)}</b><small>{item.planned_lab_date || item.planned_week_start}</small></span><strong>{item.status}</strong></div>) : <p className="muted">No planned lab dates yet.</p>}</section>
              <section><h3>Submissions</h3>{studentSubmissions.length ? studentSubmissions.map((item) => <div className="student-record-row" key={item.id}><span><b>{item.track.toUpperCase()} · {item.report_group}</b><small>{formatDate(item.submitted_at)}</small></span><strong>{item.minutes_late > 0 ? 'Late' : 'On time'}</strong></div>) : <p className="muted">No reports submitted yet.</p>}</section>
            </div>
          </div>}
        </article>;
      })}
      {!visible.length && <div className="card directory-empty"><Users/><h2>No students found.</h2><p>Try a different search.</p></div>}
    </div>
    {pageCount > 1 && <nav className="directory-pagination" aria-label="Student pages"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage(page + 1)}>Next</button></nav>}
  </section>;
}
