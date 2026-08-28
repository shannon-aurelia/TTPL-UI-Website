'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, Lock, Upload } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { storedFileName } from '../lib/practicum';

function formatDate(value) {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value));
}

export default function ReportSubmissionPanel({ track, compact = false }) {
  const { user, profile, loading, configured, supabase } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [uploading, setUploading] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user || !supabase) return;
    Promise.all([
      supabase.from('practicum_sessions').select('*').eq('student_id', user.id).eq('track', track).order('scheduled_at'),
      supabase.from('submissions').select('*').eq('student_id', user.id).eq('track', track)
    ]).then(([sessionResult, submissionResult]) => {
      setSessions(sessionResult.data || []);
      setSubmissions(submissionResult.data || []);
    });
  }, [user, supabase, track]);

  const visibleSessions = useMemo(() => {
    const grouped = new Map();
    sessions.forEach((session) => {
      const key = `${session.report_group}-${session.week_number}`;
      if (!grouped.has(key) || session.is_makeup) grouped.set(key, session);
    });
    return [...grouped.values()];
  }, [sessions]);

  const upload = async (event, session) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !supabase || !profile) return;
    if (file.type !== 'application/pdf') {
      setMessage('Only PDF files are accepted.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setMessage('The PDF must be smaller than 20 MB.');
      return;
    }
    setUploading(session.id);
    setMessage('');
    const fileName = storedFileName({ name: profile.full_name, npm: profile.npm, reportGroup: session.report_group, weekNumber: session.week_number });
    const path = `${user.id}/${session.track}/${session.report_group}/week-${session.week_number}/${fileName}`;
    const { error: storageError } = await supabase.storage.from('practicum-reports').upload(path, file, { upsert: true, contentType: 'application/pdf' });
    if (storageError) {
      setMessage(storageError.message);
      setUploading('');
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session?.access_token || ''}`
      },
      body: JSON.stringify({
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
      setMessage(result.driveSync === 'synced' ? `${fileName} has been received and archived.` : `${fileName} has been received. Drive archiving is pending.`);
    }
    setUploading('');
  };

  if (loading) return <div className="submission-panel card"><p>Loading submission access...</p></div>;
  if (!configured) return <div className="submission-panel card"><h2>Submission connection pending</h2><p className="muted">Add the Supabase environment variables to activate real accounts and PDF storage.</p></div>;
  if (!user) return <div className="submission-panel card"><Lock size={22}/><h2>Sign in to submit</h2><p className="muted">Your assigned module, attendance status, deadline, and report upload will appear after login.</p><Link className="btn" href="/login">Open login</Link></div>;

  return <div className={`submission-panel card ${compact ? 'compact' : ''}`}>
    <div className="eyebrow">Your assigned work</div>
    <h2>{track.toUpperCase()} report submissions</h2>
    <p className="muted">Only assignments imported from the attendance sheet are shown. An absence or excused session remains visible but cannot be submitted until a makeup session is scheduled.</p>
    {message && <div className="status-message">{message}</div>}
    <div className="submission-list">
      {visibleSessions.length === 0 && <div className="submission-row"><div><b>No assignment imported yet</b><p>Ask an assistant to sync the current attendance sheet.</p></div></div>}
      {visibleSessions.map((session) => {
        const submitted = submissions.find((item) => item.session_id === session.id);
        const blocked = !session.submission_open || session.qna_score == null || ['absent', 'excused'].includes(session.attendance_status);
        return <div className="submission-row" key={session.id}>
          <div className="submission-main">
            <span className="num">Week {session.week_number}</span>
            <h3>{session.report_label || session.report_group}</h3>
            <p>Module {session.module_number} · {session.attendance_status.replace('_', ' ')}{session.is_makeup ? ' · Makeup session' : ''}</p>
            <p><Clock size={15}/> Deadline: {formatDate(session.deadline_at)}</p>
          </div>
          <div className="submission-action">
            {submitted && <span className="submission-state"><CheckCircle size={17}/> Submitted{Number(submitted.late_penalty) > 0 ? ` · −${submitted.late_penalty} late points` : ''}</span>}
            {blocked ? <span className="submission-state blocked"><Lock size={17}/> {session.qna_score == null ? 'Waiting for QnA score' : 'Submission unavailable'}</span> : <label className="btn upload-label"><Upload size={17}/>{uploading === session.id ? 'Uploading...' : submitted ? 'Replace PDF' : 'Upload PDF'}<input type="file" accept="application/pdf" disabled={uploading === session.id} onChange={(event) => upload(event, session)}/></label>}
          </div>
        </div>;
      })}
    </div>
  </div>;
}
