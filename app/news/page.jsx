'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, X, Send } from 'lucide-react';

export default function News() {
  const [articles, setArticles] = useState([]);
  const [user, setUser] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tag, setTag] = useState('Announcement');
  const [error, setError] = useState('');

  useEffect(() => {
    // 1. Fetch news
    fetchNews();
    // 2. Fetch session (if logged in, we enable posting options)
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUser(data.data);
        }
      })
      .catch(() => {});
  }, []);

  const fetchNews = async () => {
    try {
      const res = await fetch('/api/news');
      const data = await res.json();
      if (data.success) {
        setArticles(data.data);
      }
    } catch (e) {
      console.error('Failed to load news', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNews = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, tag }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to create news');
      } else {
        setTitle('');
        setContent('');
        setTag('Announcement');
        setShowAddForm(false);
        fetchNews();
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    }
  };

  const handleDeleteNews = async (id) => {
    if (!confirm('Are you sure you want to delete this news article?')) return;
    try {
      const res = await fetch(`/api/news/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchNews();
      }
    } catch (err) {
      console.error('Failed to delete news', err);
    }
  };

  const isAssistant = user?.role === 'assistant' || user?.role === 'admin';

  return (
    <section className="section page-hero" id="top">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 className="title" style={{ margin: 0 }}>News & updates.</h1>
          <p className="subtitle" style={{ margin: '8px 0 0 0' }}>
            Announcements, practicum updates, assistant recruitment, project news, and learning-resource releases.
          </p>
        </div>
        {isAssistant && (
          <button 
            className="btn" 
            onClick={() => setShowAddForm(!showAddForm)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12 }}
          >
            {showAddForm ? <X size={16} /> : <Plus size={16} />}
            {showAddForm ? 'Cancel' : 'Post Announcement'}
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="card" style={{ marginBottom: 30, maxWidth: 700, border: '1px solid rgba(255,255,255,0.05)' }}>
          <h2>Post News Announcement</h2>
          {error && (
            <div style={{ padding: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: 12, marginBottom: 16 }}>
              {error}
            </div>
          )}
          <form onSubmit={handleCreateNews}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', fontSize: 14 }}>Title</label>
              <input 
                type="text" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                required 
                placeholder="e.g. New Practicum Registration Schedule"
                style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'inherit' }}
              />
            </div>

            <div className="grid two" style={{ gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', fontSize: 14 }}>Tag Category</label>
                <select 
                  value={tag} 
                  onChange={(e) => setTag(e.target.value)}
                  style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'inherit' }}
                >
                  <option value="Announcement">Announcement</option>
                  <option value="Practicum">Practicum</option>
                  <option value="Resource">Resource</option>
                  <option value="Project">Project</option>
                  <option value="Archive">Archive</option>
                  <option value="Portal">Portal</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', fontSize: 14 }}>Content</label>
              <textarea 
                rows="4" 
                value={content} 
                onChange={(e) => setContent(e.target.value)} 
                required 
                placeholder="Write news content details here..."
                style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'inherit', resize: 'vertical' }}
              />
            </div>

            <button className="btn" type="submit" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Send size={16} /> Publish Post
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <h3 className="muted">Loading articles...</h3>
      ) : articles.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p className="muted" style={{ margin: 0 }}>No announcements published yet.</p>
        </div>
      ) : (
        <div className="grid" style={{ marginTop: 34 }}>
          {articles.map((article) => (
            <div className="card" key={article.id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                  <span className="eyebrow">{article.tag}</span>
                  {isAssistant && (
                    <button 
                      onClick={() => handleDeleteNews(article.id)} 
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', opacity: 0.7 }}
                      title="Delete article"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <h2>{article.title}</h2>
                <p style={{ whiteSpace: 'pre-wrap' }}>{article.content}</p>
              </div>
              <div style={{ marginTop: 20, fontSize: 12 }} className="muted">
                Posted: {new Date(article.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
