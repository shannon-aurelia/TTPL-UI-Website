'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, Clock3, RefreshCw, Search } from 'lucide-react';
import { useAuth } from './AuthProvider';

function fmtSeconds(value) {
  const seconds = Number(value || 0);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

function fmtDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta' });
}

export default function ReadingAnalyticsPanel() {
  const { user, profile, supabase } = useAuth();
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [track, setTrack] = useState('all');
  const [message, setMessage] = useState('');
  const isStaff = ['assistant', 'admin'].includes(profile?.role);

  const load = async () => {
    if (!supabase || !isStaff) return;
    const { data, error } = await supabase
      .from('reading_sessions')
      .select('*, profiles!reading_sessions_student_id_fkey(full_name,npm,email)')
      .order('last_seen_at', { ascending: false })
      .limit(1000);
    if (error) setMessage(error.message);
    else {
      setMessage('');
      setRows(data || []);
    }
  };

  useEffect(() => { if (user && isStaff) load(); }, [user, isStaff]);

  const grouped = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const key = `${row.student_id}:${row.track}:${row.module_number}:${row.document_path}`;
      const current = map.get(key) || {
        ...row,
        sessions: 0,
        active_seconds: 0,
        idle_seconds: 0,
        focus_losses: 0,
        pages_seen_set: new Set(),
        page_seconds_total: {},
        max_scroll_depth: 0,
        last_seen_at: row.last_seen_at
      };
      current.sessions += 1;
      current.active_seconds += Number(row.active_seconds || 0);
      current.idle_seconds += Number(row.idle_seconds || 0);
      current.focus_losses += Number(row.focus_losses || 0);
      current.max_scroll_depth = Math.max(current.max_scroll_depth, Number(row.max_scroll_depth || 0));
      (row.pages_seen || []).forEach((page) => current.pages_seen_set.add(page));
      Object.entries(row.page_seconds || {}).forEach(([page, seconds]) => {
        current.page_seconds_total[page] = Number(current.page_seconds_total[page] || 0) + Number(seconds || 0);
      });
      if (new Date(row.last_seen_at) > new Date(current.last_seen_at)) current.last_seen_at = row.last_seen_at;
      current.total_pages = Math.max(Number(current.total_pages || 0), Number(row.total_pages || 0));
      map.set(key, current);
    });

    return [...map.values()].map((item) => {
      const pagesSeen = item.pages_seen_set.size;
      const coverage = item.total_pages ? (pagesSeen / item.total_pages) * 100 : 0;
      const dwellPages = Object.values(item.page_seconds_total).filter((seconds) => Number(seconds) >= 10).length;
      return { ...item, pagesSeen, coverage, dwellPages };
    });
  }, [rows]);

  const filtered = useMemo(() => grouped.filter((row) => {
    const haystack = `${row.profiles?.full_name || ''} ${row.profiles?.npm || ''} ${row.profiles?.email || ''} ${row.track} ${row.module_number}`.toLowerCase();
    return (track === 'all' || row.track === track) && haystack.includes(query.toLowerCase());
  }), [grouped, query, track]);

  const activeReaders = grouped.filter((row) => Date.now() - new Date(row.last_seen_at).getTime() < 15 * 60 * 1000).length;
  const completedReaders = grouped.filter((row) => row.coverage >= 95).length;
  const totalActiveSeconds = grouped.reduce((sum, row) => sum + Number(row.active_seconds || 0), 0);

  if (!isStaff) return null;

  return <section className="reading-analytics-section">
    <div className="dashboard-heading reading-heading">
      <div><div className="eyebrow">Reading analytics</div><h2>Module interaction.</h2><p className="muted">Shows observed reading behavior only. Coverage and time do not prove comprehension and should not be used as an automatic grade.</p></div>
      <button className="btn ghost" onClick={load}><RefreshCw size={17}/> Refresh reading data</button>
    </div>

    {message && <div className="status-message">{message}</div>}

    <div className="dashboard-stats">
      <div className="card metric-card"><BookOpenCheck/><span>Tracked module records</span><b>{grouped.length}</b></div>
      <div className="card metric-card"><Clock3/><span>Total active reading</span><b>{fmtSeconds(totalActiveSeconds)}</b></div>
      <div className="card metric-card"><Clock3/><span>Active in 15 min</span><b>{activeReaders}</b></div>
      <div className="card metric-card"><BookOpenCheck/><span>95%+ coverage</span><b>{completedReaders}</b></div>
    </div>

    <div className="card dashboard-tools"><label><Search size={17}/><input placeholder="Search name, NPM, email, track, or module" value={query} onChange={(event) => setQuery(event.target.value)}/></label><select value={track} onChange={(event) => setTrack(event.target.value)}><option value="all">All tracks</option><option value="rl">RL</option><option value="idp">IDP</option><option value="t3">T3</option></select></div>

    <div className="card table-card"><div className="table-scroll"><table className="dashboard-table reading-table"><thead><tr><th>Student</th><th>Module</th><th>Coverage</th><th>Active time</th><th>Page dwell</th><th>Sessions</th><th>Focus / idle</th><th>Last activity</th></tr></thead><tbody>{filtered.map((row) => <tr key={`${row.student_id}-${row.track}-${row.module_number}-${row.document_path}`}><td><b>{row.profiles?.full_name || 'Student'}</b><small>{row.profiles?.npm || row.profiles?.email}</small></td><td><b>{row.track.toUpperCase()} · M{row.module_number}</b><small>{row.document_title || row.document_path.split('/').pop()}</small></td><td><b>{Math.round(row.coverage)}%</b><small>{row.pagesSeen}/{row.total_pages || '—'} pages · max scroll {Math.round(row.max_scroll_depth)}%</small></td><td>{fmtSeconds(row.active_seconds)}</td><td>{row.dwellPages} pages with 10s+<small>Per-page dwell is retained for audit</small></td><td>{row.sessions}</td><td>{row.focus_losses} focus changes<small>{fmtSeconds(row.idle_seconds)} idle</small></td><td>{fmtDate(row.last_seen_at)}</td></tr>)}</tbody></table>{filtered.length === 0 && <p className="muted reading-empty">No reading sessions match this filter yet.</p>}</div></div>
  </section>;
}
