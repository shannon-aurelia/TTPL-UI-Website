'use client';

import { useEffect, useMemo, useState } from 'react';
import { MessageSquareText, RefreshCw, Search } from 'lucide-react';
import { useAuth } from './AuthProvider';

function fmt(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export default function StaffReadingComments() {
  const { user, profile, supabase } = useAuth();
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [track, setTrack] = useState('all');
  const [message, setMessage] = useState('');
  const isStaff = ['assistant', 'admin'].includes(profile?.role);

  const load = async () => {
    if (!supabase || !isStaff) return;
    const { data, error } = await supabase
      .from('reading_comments')
      .select('id,student_id,track,module_number,document_path,page_number,body,created_at,updated_at,profiles!reading_comments_student_id_fkey(full_name,npm,email)')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) setMessage(error.message);
    else {
      setRows(data || []);
      setMessage('');
    }
  };

  useEffect(() => { if (user && isStaff) load(); }, [user, isStaff]);

  const filtered = useMemo(() => rows.filter((row) => {
    const haystack = `${row.profiles?.full_name || ''} ${row.profiles?.npm || ''} ${row.profiles?.email || ''} ${row.track} ${row.module_number} ${row.page_number} ${row.body}`.toLowerCase();
    return (track === 'all' || row.track === track) && haystack.includes(query.toLowerCase());
  }), [rows, query, track]);

  if (!isStaff) return null;

  return <section className="reading-comments-admin">
    <div className="dashboard-heading reading-heading">
      <div>
        <div className="eyebrow">Student comments</div>
        <h2>Page-linked notes and questions.</h2>
        <p className="muted">Every comment includes the student, module, PDF page, original creation time, and latest edit time.</p>
      </div>
      <button className="btn ghost" onClick={load}><RefreshCw size={17}/> Refresh comments</button>
    </div>

    {message && <div className="status-message">{message}</div>}

    <div className="card dashboard-tools">
      <label><Search size={17}/><input placeholder="Search student, module, page, or comment" value={query} onChange={(event) => setQuery(event.target.value)}/></label>
      <select value={track} onChange={(event) => setTrack(event.target.value)}><option value="all">All tracks</option><option value="rl">RL</option><option value="idp">IDP</option><option value="t3">T3</option></select>
    </div>

    <div className="comments-admin-list">
      {filtered.map((row) => <article className="card staff-comment-card" key={row.id}>
        <div className="staff-comment-top">
          <div><b>{row.profiles?.full_name || 'Student'}</b><small>{row.profiles?.npm || row.profiles?.email}</small></div>
          <span><MessageSquareText size={15}/> {row.track.toUpperCase()} · M{row.module_number} · Page {row.page_number}</span>
        </div>
        <p>{row.body}</p>
        <div className="staff-comment-times"><span>Created: {fmt(row.created_at)}</span><span>Last edited: {fmt(row.updated_at)}</span></div>
      </article>)}
      {filtered.length === 0 && <div className="card reading-empty"><p className="muted">No student comments match this filter yet.</p></div>}
    </div>
  </section>;
}
