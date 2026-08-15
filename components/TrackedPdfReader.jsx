'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Clock3, Eye, Gauge, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from './AuthProvider';

const PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const IDLE_AFTER_MS = 45000;
const FLUSH_EVERY_MS = 10000;

function loadPdfJs() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Browser required'));
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${PDFJS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.pdfjsLib), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = PDFJS_SRC;
    script.async = true;
    script.onload = () => resolve(window.pdfjsLib);
    script.onerror = () => reject(new Error('Could not load the PDF viewer.'));
    document.head.appendChild(script);
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scoreSession({ totalPages, pagesSeen, pageSeconds, activeSeconds, idleSeconds, focusLosses }) {
  if (!totalPages) return { completion: 0, score: 0 };
  const coverage = clamp((pagesSeen.length / totalPages) * 100, 0, 100);
  const timeScore = clamp((activeSeconds / (totalPages * 45)) * 100, 0, 100);
  const studiedPages = Object.values(pageSeconds).filter((seconds) => Number(seconds) >= 10).length;
  const dwellScore = clamp((studiedPages / totalPages) * 100, 0, 100);
  const totalObserved = activeSeconds + idleSeconds;
  const idleShare = totalObserved ? idleSeconds / totalObserved : 0;
  const focusScore = clamp(100 - focusLosses * 5 - idleShare * 50, 0, 100);
  const score = coverage * 0.4 + timeScore * 0.3 + dwellScore * 0.2 + focusScore * 0.1;
  return { completion: coverage, score: clamp(score, 0, 100) };
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function TrackedPdfReader({ track, moduleNumber, src, title }) {
  const { user, profile, loading, supabase } = useAuth();
  const [pdf, setPdf] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [idleSeconds, setIdleSeconds] = useState(0);
  const [focusLosses, setFocusLosses] = useState(0);
  const [pagesSeen, setPagesSeen] = useState([]);
  const [pageSeconds, setPageSeconds] = useState({});
  const [maxScrollDepth, setMaxScrollDepth] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [sessionId, setSessionId] = useState(null);
  const pageRefs = useRef(new Map());
  const visiblePages = useRef(new Map());
  const lastActivity = useRef(Date.now());
  const latest = useRef({});

  const metrics = useMemo(() => scoreSession({ totalPages: pageCount, pagesSeen, pageSeconds, activeSeconds, idleSeconds, focusLosses }), [pageCount, pagesSeen, pageSeconds, activeSeconds, idleSeconds, focusLosses]);

  useEffect(() => {
    latest.current = { pageCount, activeSeconds, idleSeconds, focusLosses, pagesSeen, pageSeconds, maxScrollDepth, metrics };
  }, [pageCount, activeSeconds, idleSeconds, focusLosses, pagesSeen, pageSeconds, maxScrollDepth, metrics]);

  useEffect(() => {
    if (loading || !user || !supabase || profile?.role !== 'student') return;
    let cancelled = false;
    (async () => {
      const { data, error: insertError } = await supabase.from('reading_sessions').insert({
        student_id: user.id,
        track,
        module_number: Number(moduleNumber),
        document_path: src,
        document_title: title || null
      }).select('id').single();
      if (!cancelled && !insertError) setSessionId(data.id);
    })();
    return () => { cancelled = true; };
  }, [loading, user, supabase, profile?.role, track, moduleNumber, src, title]);

  useEffect(() => {
    if (loading || !user) return;
    if (profile?.role !== 'student') {
      setStatus('blocked');
      setError('Reading analytics are recorded only for student accounts.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const pdfjsLib = await loadPdfJs();
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        const loaded = await pdfjsLib.getDocument(src).promise;
        if (cancelled) return;
        setPdf(loaded);
        setPageCount(loaded.numPages);
        setStatus('ready');
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setError(err?.message || 'Could not open this PDF.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [loading, user, profile?.role, src]);

  useEffect(() => {
    if (!pdf || status !== 'ready') return;
    let disposed = false;
    (async () => {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        if (disposed) break;
        const container = pageRefs.current.get(pageNumber);
        if (!container || container.dataset.rendered === 'true') continue;
        const page = await pdf.getPage(pageNumber);
        if (disposed) break;
        const base = page.getViewport({ scale: 1 });
        const availableWidth = Math.min(920, Math.max(280, container.clientWidth - 24));
        const scale = availableWidth / base.width;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.className = 'tracked-pdf-canvas';
        container.replaceChildren(canvas);
        await page.render({ canvasContext: context, viewport }).promise;
        container.dataset.rendered = 'true';
      }
    })();
    return () => { disposed = true; };
  }, [pdf, status]);

  useEffect(() => {
    if (status !== 'ready' || !pageCount) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const page = Number(entry.target.dataset.page);
        if (entry.isIntersecting) {
          visiblePages.current.set(page, entry.intersectionRatio);
          setPagesSeen((prev) => prev.includes(page) ? prev : [...prev, page].sort((a, b) => a - b));
        } else {
          visiblePages.current.delete(page);
        }
      });
      const top = [...visiblePages.current.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top) setCurrentPage(top[0]);
    }, { threshold: [0.2, 0.5, 0.8] });
    pageRefs.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [status, pageCount]);

  useEffect(() => {
    const activity = () => { lastActivity.current = Date.now(); };
    const scroll = () => {
      activity();
      const root = document.documentElement;
      const scrollable = Math.max(1, root.scrollHeight - window.innerHeight);
      const depth = clamp((window.scrollY / scrollable) * 100, 0, 100);
      setMaxScrollDepth((prev) => Math.max(prev, depth));
    };
    const visibility = () => {
      if (document.hidden) setFocusLosses((value) => value + 1);
      else activity();
    };
    ['mousemove', 'mousedown', 'keydown', 'touchstart'].forEach((eventName) => window.addEventListener(eventName, activity, { passive: true }));
    window.addEventListener('scroll', scroll, { passive: true });
    document.addEventListener('visibilitychange', visibility);
    return () => {
      ['mousemove', 'mousedown', 'keydown', 'touchstart'].forEach((eventName) => window.removeEventListener(eventName, activity));
      window.removeEventListener('scroll', scroll);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    const timer = window.setInterval(() => {
      const active = !document.hidden && Date.now() - lastActivity.current < IDLE_AFTER_MS;
      if (active) {
        setActiveSeconds((value) => value + 1);
        const top = [...visiblePages.current.entries()].sort((a, b) => b[1] - a[1])[0];
        if (top) setPageSeconds((prev) => ({ ...prev, [top[0]]: Number(prev[top[0]] || 0) + 1 }));
      } else {
        setIdleSeconds((value) => value + 1);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (!sessionId || !supabase) return;
    const flush = async (ended = false) => {
      const data = latest.current;
      await supabase.from('reading_sessions').update({
        total_pages: data.pageCount || 0,
        last_seen_at: new Date().toISOString(),
        ended_at: ended ? new Date().toISOString() : null,
        active_seconds: data.activeSeconds || 0,
        idle_seconds: data.idleSeconds || 0,
        max_scroll_depth: Number((data.maxScrollDepth || 0).toFixed(2)),
        pages_seen: data.pagesSeen || [],
        page_seconds: data.pageSeconds || {},
        focus_losses: data.focusLosses || 0,
        completion_percent: Number((data.metrics?.completion || 0).toFixed(2)),
        engagement_score: Number((data.metrics?.score || 0).toFixed(2)),
        updated_at: new Date().toISOString()
      }).eq('id', sessionId);
    };
    const timer = window.setInterval(() => flush(false), FLUSH_EVERY_MS);
    const beforeUnload = () => { flush(true); };
    window.addEventListener('pagehide', beforeUnload);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', beforeUnload);
      flush(true);
    };
  }, [sessionId, supabase]);

  if (loading) return <section className="section reader-state"><Loader2 className="spin"/><h1>Loading student session...</h1></section>;
  if (!user) return <section className="section reader-state"><BookOpen/><h1>Sign in to open tracked modules.</h1><p>This viewer records reading engagement for your TTPL student account.</p><Link className="btn" href="/login">Student login</Link></section>;
  if (status === 'error' || status === 'blocked') return <section className="section reader-state"><h1>Viewer unavailable.</h1><p>{error}</p><Link className="btn ghost" href="/practicum">Back to practicum</Link></section>;

  return <section className="section tracked-reader-page">
    <div className="reader-toolbar liquid">
      <div className="reader-heading"><Link className="reader-back" href={`/practicum/${track}`}><ArrowLeft size={18}/> Back</Link><div><div className="eyebrow">Tracked module reader</div><h1>{title || `${track.toUpperCase()} Module ${moduleNumber}`}</h1><p>Interaction data estimates reading engagement. It does not measure comprehension.</p></div></div>
      <div className="reader-metrics">
        <div><Eye size={16}/><span>Pages</span><b>{pagesSeen.length}/{pageCount || '–'}</b></div>
        <div><Clock3 size={16}/><span>Active</span><b>{formatTime(activeSeconds)}</b></div>
        <div><Gauge size={16}/><span>Engagement</span><b>{Math.round(metrics.score)}</b></div>
      </div>
      <div className="reader-progress"><span style={{ width: `${metrics.completion}%` }}/></div>
      <small>Current page {currentPage} · {Math.round(metrics.completion)}% page coverage · {Math.round(maxScrollDepth)}% scroll depth</small>
    </div>

    {status === 'loading' && <div className="reader-loading"><Loader2 className="spin"/><p>Opening PDF...</p></div>}
    <div className="tracked-pdf-stack">
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => <article className="tracked-pdf-page" data-page={page} key={page} ref={(element) => { if (element) pageRefs.current.set(page, element); else pageRefs.current.delete(page); }}><div className="pdf-page-placeholder">Page {page}</div></article>)}
    </div>
  </section>;
}
