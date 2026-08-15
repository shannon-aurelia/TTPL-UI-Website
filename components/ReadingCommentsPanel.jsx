'use client';

import { useEffect, useMemo, useState } from 'react';
import { MessageSquarePlus, Pencil, Save, Trash2, X } from 'lucide-react';

function fmt(value) {
  return new Date(value).toLocaleString('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function ReadingCommentsPanel({ supabase, userId, track, moduleNumber, src, currentPage }) {
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingBody, setEditingBody] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!supabase || !userId) return;
    const { data, error } = await supabase
      .from('reading_comments')
      .select('id,page_number,body,created_at,updated_at')
      .eq('student_id', userId)
      .eq('track', track)
      .eq('module_number', Number(moduleNumber))
      .eq('document_path', src)
      .order('created_at', { ascending: false });
    if (error) setMessage(error.message);
    else {
      setComments(data || []);
      setMessage('');
    }
  };

  useEffect(() => { load(); }, [supabase, userId, track, moduleNumber, src]);

  const pageComments = useMemo(() => comments.filter((comment) => Number(comment.page_number) === Number(currentPage)), [comments, currentPage]);

  const addComment = async () => {
    const body = draft.trim();
    if (!body || !supabase || !userId) return;
    setSaving(true);
    const { error } = await supabase.from('reading_comments').insert({
      student_id: userId,
      track,
      module_number: Number(moduleNumber),
      document_path: src,
      page_number: Number(currentPage),
      body
    });
    setSaving(false);
    if (error) setMessage(error.message);
    else {
      setDraft('');
      await load();
    }
  };

  const saveEdit = async (id) => {
    const body = editingBody.trim();
    if (!body) return;
    setSaving(true);
    const { error } = await supabase.from('reading_comments').update({ body, updated_at: new Date().toISOString() }).eq('id', id);
    setSaving(false);
    if (error) setMessage(error.message);
    else {
      setEditingId(null);
      setEditingBody('');
      await load();
    }
  };

  const remove = async (id) => {
    const { error } = await supabase.from('reading_comments').delete().eq('id', id);
    if (error) setMessage(error.message);
    else await load();
  };

  return <aside className="reader-comments liquid">
    <div className="comments-heading">
      <div><div className="eyebrow">Page notes</div><h2>Page {currentPage}</h2></div>
      <span>{pageComments.length}</span>
    </div>

    <p className="comments-help">Leave a note, question, or reminder tied to this page. TTPL assistants and admins can review these comments with their timestamps.</p>

    <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={5000} placeholder={`Write a note about page ${currentPage}...`} />
    <button className="btn comment-add" onClick={addComment} disabled={saving || !draft.trim()}><MessageSquarePlus size={16}/> Add note</button>
    {message && <small className="comment-message">{message}</small>}

    <div className="comments-list">
      {pageComments.map((comment) => <article className="comment-card" key={comment.id}>
        {editingId === comment.id ? <>
          <textarea value={editingBody} onChange={(event) => setEditingBody(event.target.value)} maxLength={5000}/>
          <div className="comment-actions"><button onClick={() => saveEdit(comment.id)} disabled={saving}><Save size={14}/> Save</button><button onClick={() => { setEditingId(null); setEditingBody(''); }}><X size={14}/> Cancel</button></div>
        </> : <>
          <p>{comment.body}</p>
          <div className="comment-meta"><span>Created {fmt(comment.created_at)}</span>{comment.updated_at !== comment.created_at && <span>Edited {fmt(comment.updated_at)}</span>}</div>
          <div className="comment-actions"><button onClick={() => { setEditingId(comment.id); setEditingBody(comment.body); }}><Pencil size={14}/> Edit</button><button onClick={() => remove(comment.id)}><Trash2 size={14}/> Delete</button></div>
        </>}
      </article>)}
      {pageComments.length === 0 && <p className="comments-empty">No notes on this page yet.</p>}
    </div>
  </aside>;
}
