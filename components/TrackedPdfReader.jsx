'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Clock3, Eye, Loader2, MousePointer2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from './AuthProvider';

const PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const ACTIVE_WINDOW_MS = 60000;
const FLUSH_EVERY_MS = 5000;
const PAGE_QUALIFY_SECONDS = 5;
const MIN_VISIBLE_RATIO = 0.5;

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
  const lastMeaningfulActivity = useRef(Date.now());
  const latest = useRef({});
  const flushRef = useRef(null);
  const sessionInitKey = useRef('');
  const renderTasks = useRef(new Map());

  const completion = useMemo(() => pageCount ? clamp((pagesSeen.length / pageCount) * 100, 0, 100) : 0, [pageCount, pagesSeen]);

  useEffect(() => {
    latest.current = {
      pageCount,
      activeSeconds,
      idleSeconds,
      focusLosses,
      pagesSeen,
      pageSeconds,
      maxScrollDepth,
      completion,
      lastMeaningfulActivity: lastMeaningfulActivity.current
    };
  }, [pageCount, activeSeconds, idleSeconds, focusLosses, pagesSeen, pageSeconds, maxScrollDepth, completion]);

  useEffect(() => {
    if (loading || !user || !supabase || profile?.role !== 'student') return;
    const key = `${user.id}:${track}:${moduleNumber}:${src}`;
    if (sessionInitKey.current === key) return;
    sessionInitKey.current = key;
    let cancelled = false;
    (async () => {
      const recentCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: existing } = await supabase.from('reading_sessions')
        .select('id').eq('student_id', user.id).eq('track', track)
        .eq('module_number', Number(moduleNumber)).eq('document_path', src)
        .gte('updated_at', recentCutoff).order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (!cancelled && existing?.id) {
        setSessionId(existing.id);
        return;
      }
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
      setError('Reading telemetry is recorded only for student accounts.');
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
    if (status !== 'ready' || !pageCount || !pdf) return;
    const renderPage = async (pageNumber, container) => {
      if (!container || container.dataset.rendered === 'true' || renderTasks.current.has(pageNumber)) return;
      const task = (async () => {
        const page = await pdf.getPage(pageNumber);
        if (!container.isConnected) return;
        const base = page.getViewport({ scale: 1 });
        const availableWidth = Math.min(920, Math.max(280, container.clientWidth - 24));
        const viewport = page.getViewport({ scale: availableWidth / base.width });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.className = 'tracked-pdf-canvas';
        container.replaceChildren(canvas);
        await page.render({ canvasContext: context, viewport }).promise;
        container.dataset.rendered = 'true';
      })().finally(() => renderTasks.current.delete(pageNumber));
      renderTasks.current.set(pageNumber, task);
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const page = Number(entry.target.dataset.page);
        if (entry.isIntersecting) {
          visiblePages.current.set(page, entry.intersectionRatio);
          renderPage(page, entry.target);
        }
        else visiblePages.current.delete(page);
      });
      const top = [...visiblePages.current.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top) setCurrentPage(top[0]);
    }, { rootMargin: '800px 0px', threshold: [0, 0.2, 0.5, 0.8] });
    pageRefs.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [status, pageCount, pdf]);

  useEffect(() => {
    const meaningfulActivity = () => { lastMeaningfulActivity.current = Date.now(); };
    const scroll = () => {
      meaningfulActivity();
      const root = document.documentElement;
      const scrollable = Math.max(1, root.scrollHeight - window.innerHeight);
      const depth = clamp((window.scrollY / scrollable) * 100, 0, 100);
      setMaxScrollDepth((prev) => Math.max(prev, depth));
    };
    const keydown = (event) => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) meaningfulActivity();
    };
    const visibility = () => {
      if (document.hidden) {
        setFocusLosses((value) => value + 1);
        flushRef.current?.(false);
      } else {
        meaningfulActivity();
      }
    };
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('wheel', meaningfulActivity, { passive: true });
    window.addEventListener('touchstart', meaningfulActivity, { passive: true });
    window.addEventListener('touchmove', meaningfulActivity, { passive: true });
    window.addEventListener('keydown', keydown);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('scroll', scroll);
      window.removeEventListener('wheel', meaningfulActivity);
      window.removeEventListener('touchstart', meaningfulActivity);
      window.removeEventListener('touchmove', meaningfulActivity);
      window.removeEventListener('keydown', keydown);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    const timer = window.setInterval(() => {
      const top = [...visiblePages.current.entries()].sort((a, b) => b[1] - a[1])[0];
      const visibleEnough = Boolean(top && top[1] >= MIN_VISIBLE_RATIO);
      const recentlyInteracted = Date.now() - lastMeaningfulActivity.current < ACTIVE_WINDOW_MS;
      const qualifies = !document.hidden && visibleEnough && recentlyInteracted;

      if (qualifies) {
        setActiveSeconds((value) => value + 1);
        if (top) {
          const page = top[0];
          setPageSeconds((prev) => {
            const nextSeconds = Number(prev[page] || 0) + 1;
            if (nextSeconds >= PAGE_QUALIFY_SECONDS) {
              setPagesSeen((seen) => seen.includes(page) ? seen : [...seen, page].sort((a, b) => a - b));
            }
            return { ...prev, [page]: nextSeconds };
          });
        }
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
        last_seen_at: new Date(data.lastMeaningfulActivity || Date.now()).toISOString(),
        ended_at: ended ? new Date().toISOString() : null,
        active_seconds: data.activeSeconds || 0,
        idle_seconds: data.idleSeconds || 0,
        max_scroll_depth: Number((data.maxScrollDepth || 0).toFixed(2)),
        pages_seen: data.pagesSeen || [],
        page_seconds: data.pageSeconds || {},
        focus_losses: data.focusLosses || 0,
        completion_percent: Number((data.completion || 0).toFixed(2)),
        updated_at: new Date().toISOString()
      }).eq('id', sessionId);
    };
    flushRef.current = flush;
    const timer = window.setInterval(() => flush(false), FLUSH_EVERY_MS);
    const pageHide = () => { flush(true); };
    window.addEventListener('pagehide', pageHide);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', pageHide);
      flushRef.current = null;
      flush(true);
    };
  }, [sessionId, supabase]);

  if (loading) return <section className="section reader-state"><Loader2 className="spin"/><h1>Loading student session...</h1></section>;
  if (!user) return <section className="section reader-state"><BookOpen/><h1>Sign in to open tracked modules.</h1><p>This viewer records reading interaction for your TTPL student account.</p><Link className="btn" href="/login">Student login</Link></section>;
  if (status === 'error' || status === 'blocked') return <section className="section reader-state"><h1>Viewer unavailable.</h1><p>{error}</p><Link className="btn ghost" href="/practicum">Back to practicum</Link></section>;

  return <section className="section tracked-reader-page">
    <div className="reader-layout">
      <aside className="reader-toolbar liquid">
        <Link className="reader-back" href={`/practicum/${track}`}><ArrowLeft size={17}/> Back</Link>
        <div className="reader-title"><div className="eyebrow">Tracked reader</div><h1>{title || `${track.toUpperCase()} Module ${moduleNumber}`}</h1></div>
        <div className="reader-metrics">
          <div><Eye size={16}/><span>Qualified pages</span><b>{pagesSeen.length}/{pageCount || '–'}</b></div>
          <div><Clock3 size={16}/><span>Active reading</span><b>{formatTime(activeSeconds)}</b></div>
          <div><BookOpen size={16}/><span>Coverage</span><b>{Math.round(completion)}%</b></div>
          <div><MousePointer2 size={16}/><span>Current page</span><b>{currentPage}</b></div>
        </div>
        <div className="reader-progress"><span style={{ width: `${completion}%` }}/></div>
        <small>Scroll depth {Math.round(maxScrollDepth)}%<br/>Focus changes {focusLosses}</small>
        <p className="reader-note">Time counts only while a page is substantially visible and you have interacted with the document recently. A page needs several seconds of qualified dwell before it counts as seen.</p>
      </aside>

      <main className="reader-document">
        {status === 'loading' && <div className="reader-loading"><Loader2 className="spin"/><p>Opening PDF...</p></div>}
        <div className="tracked-pdf-stack">
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => <article className="tracked-pdf-page" data-page={page} key={page} ref={(element) => { if (element) pageRefs.current.set(page, element); else pageRefs.current.delete(page); }}><div className="pdf-page-placeholder">Page {page}</div></article>)}
        </div>
      </main>
    </div>
  </section>;
}
