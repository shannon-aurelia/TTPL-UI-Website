'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, Lock, Upload } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { MAX_REPORT_BYTES, storedFileName, submissionExpired } from '../lib/practicum';

function formatDate(value) {
  if (!value) return 'Not scheduled';
  return `${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value))} WIB`;
}

export default function ReportSubmissionPanel({ track, compact = false }) {
  const { user, profile, loading, configured, supabase } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [uploading, setUploading] = useState('');
  const [message, setMessage] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = useCallback(() => {
    if (!user || !supabase) return;
    return Promise.all([
      supabase.from('practicum_sessions').select('*').eq('student_id', user.id).eq('track', track).order('scheduled_at'),
      supabase.from('submissions').select('*').eq('student_id', user.id).eq('track', track),
      supabase.from('student_module_plans').select('*').eq('student_id', user.id).eq('track', track).order('planned_lab_date')
    ]).then(([sessionResult, submissionResult, planResult]) => {
      setSessions(sessionResult.data || []);
      setSubmissions(submissionResult.data || []);
      setPlans(planResult.data || []);
    });
  }, [user, supabase, track]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user || !supabase) return undefined;
    const channel = supabase.channel(`student-submissions-${track}-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'practicum_sessions', filter: `student_id=eq.${user.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_module_plans', filter: `student_id=eq.${user.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions', filter: `student_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, supabase, track, load]);

  const visibleSessions = useMemo(() => {
    const grouped = new Map();
    sessions.forEach((session) => {
      const key = `${session.report_group}-${session.week_number}`;
      if (!grouped.has(key) || session.is_makeup) grouped.set(key, session);
    });
    return [...grouped.values()];
  }, [sessions]);

  const assignments = useMemo(() => {
    const rows = new Map();
    plans.forEach((plan) => rows.set(`${plan.report_group}-${plan.week_number}`, { ...plan, planned: true }));
    visibleSessions.forEach((session) => rows.set(`${session.report_group}-${session.week_number}`, session));
    return [...rows.values()].sort((a, b) => Number(a.week_number) - Number(b.week_number));
  }, [plans, visibleSessions]);

  const upload = async (event, session) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !supabase || !profile) return;
    if (submissionExpired(session.deadline_at)) {
      setMessage('This deadline has closed. Deadlines use Western Indonesia Time (WIB) and include a five-minute upload grace period.');
      return;
    }
    if (file.type !== 'application/pdf') {
      setMessage('Only PDF files are accepted.');
      return;
    }
    if (file.size > MAX_REPORT_BYTES) {
      setMessage('The PDF must be 30 MB or smaller.');
      return;
    }
    setUploading(session.id);
    setMessage('Reserving your official submission time...');
    const fileName = storedFileName({ name: profile.full_name, npm: profile.npm, reportGroup: session.report_group, weekNumber: session.week_number });
    const path = `${user.id}/${session.track}/${session.report_group}/week-${session.week_number}/${fileName}`;
    let { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.access_token) sessionData = (await supabase.auth.refreshSession()).data;
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token || ''}` };
    const startResponse = await fetch('/api/submissions', {
      method: 'POST', headers,
      body: JSON.stringify({ phase: 'start', sessionId: session.id, filePath: path, originalFileName: file.name, storedFileName: fileName })
    });
    const startResult = await startResponse.json();
    if (!startResponse.ok) {
      setMessage(startResult.error || 'The upload could not be started.');
      setUploading('');
      return;
    }
    setMessage(`Submission time reserved at ${formatDate(startResult.uploadStartedAt)}. Uploading PDF...`);
    const { error: storageError } = await supabase.storage.from('practicum-reports').upload(path, file, { upsert: true, contentType: 'application/pdf' });
    if (storageError) {
      await fetch('/api/submissions', {
        method: 'POST', headers,
        body: JSON.stringify({ phase: 'failed', sessionId: session.id, filePath: path, originalFileName: file.name, storedFileName: fileName })
      });
      setMessage(`Upload failed: ${storageError.message}. Your attempt time was recorded, but the report was not submitted. Please retry.`);
      setUploading('');
      return;
    }
    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phase: 'complete',
        sessionId: session.id,
        filePath: path,
        originalFileName: file.name,
        storedFileName: fileName
      })
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || 'The report could not be recorded.');
    } else {
      const existing = submissions.find((item) => item.session_id === session.id);
      setSubmissions((current) => existing ? current.map((item) => item.id === existing.id ? result.submission : item) : [...current, result.submission]);
      setMessage(`${fileName} has been received. Its on-time status uses the reserved start time; Drive archiving is continuing in the background.`);
    }
    setUploading('');
  };

  if (loading) return <div className="submission-panel card"><p>Loading submission access...</p></div>;
  if (!configured) return <div className="submission-panel card"><h2>Submission connection pending</h2><p className="muted">Add the Supabase environment variables to activate real accounts and PDF storage.</p></div>;
  if (!user) return <div className="submission-panel card"><Lock size={22}/><h2>Sign in to submit</h2><p className="muted">Your assigned module, attendance status, deadline, and report upload will appear after login.</p><Link className="btn" href="/login">Open login</Link></div>;

  return <div className={`submission-panel card ${compact ? 'compact' : ''}`}>
    <div className="eyebrow">Your assigned work</div>
    <h2>{track.toUpperCase()} report submissions</h2>
    <p className="muted">Every planned assignment stays visible. Upload unlocks only after an assistant records both your attendance and your QnA score. A score of 0 counts as entered; a blank score does not.</p>
    {message && <div className="status-message">{message}</div>}
    <div className="submission-list">
      {assignments.length === 0 && <div className="submission-row"><div><b>No assignment scheduled yet</b><p>Your weekly module schedule will appear here after an assistant adds it.</p></div></div>}
      {assignments.map((session) => {
        const submitted = submissions.find((item) => item.session_id === session.id);
        const plannedOnly = Boolean(session.planned);
        const deadlineClosed = !plannedOnly && submissionExpired(session.deadline_at, nowMs);
        const blocked = plannedOnly || deadlineClosed || !session.submission_open || session.qna_score == null || ['absent', 'excused'].includes(session.attendance_status);
        const moduleLabel = session.report_group?.split('-').slice(1).join('&') || session.module_number;
        const expectedDeadline = session.planned_lab_date ? new Date(`${session.planned_lab_date}T23:59:00+07:00`).getTime() + 86400000 : null;
        return <div className="submission-row" key={`${session.report_group}-${session.week_number}`}>
          <div className="submission-main">
            <span className="num">Week {session.week_number}</span>
            <h3>{session.report_label || session.report_group}</h3>
            <p>Module {moduleLabel} · {plannedOnly ? `planned ${session.planned_lab_date || 'date pending'} at ${String(session.planned_start_time || '15:00').slice(0,5)}` : session.attendance_status.replace('_', ' ')}{session.is_makeup ? ' · Makeup session' : ''}</p>
            <p><Clock size={15}/> {plannedOnly ? 'Expected deadline' : 'Deadline'}: {formatDate(session.deadline_at || expectedDeadline)}{!plannedOnly && ' · upload closes 5 minutes later'}</p>
          </div>
          <div className="submission-action">
            {submitted?.status === 'submitted' && <span className="submission-state"><CheckCircle size={17}/> Submitted{Number(submitted.late_penalty) > 0 ? ` · −${submitted.late_penalty} late points` : ''}</span>}
            {submitted?.status === 'uploading' && <span className="submission-state"><Clock size={17}/> Upload in progress</span>}
            {submitted?.status === 'failed' && <span className="submission-state blocked">Previous upload failed · retry</span>}
            {blocked ? <span className="submission-state blocked"><Lock size={17}/> {plannedOnly ? 'Waiting for attendance and QnA' : deadlineClosed ? 'Deadline closed' : session.qna_score == null ? 'Waiting for QnA score' : 'Submission unavailable'}</span> : <label className="btn upload-label"><Upload size={17}/>{uploading === session.id ? 'Uploading...' : submitted ? 'Replace PDF' : 'Upload PDF'}<input type="file" accept="application/pdf" disabled={uploading === session.id || deadlineClosed} onChange={(event) => upload(event, session)}/></label>}
          </div>
        </div>;
      })}
    </div>
  </div>;
}
