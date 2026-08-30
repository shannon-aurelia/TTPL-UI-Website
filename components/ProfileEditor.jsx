'use client';

import { useEffect, useState } from 'react';
import { Trash2, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

export default function ProfileEditor() {
  const { profile, supabase, refreshProfile } = useAuth();
  const [form, setForm] = useState({ full_name: '', npm: '', gmail_email: '', study_program: 'Electrical Engineering' });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setForm({ full_name: profile?.full_name || '', npm: profile?.npm || '', gmail_email: profile?.gmail_email || '', study_program: profile?.study_program || 'Electrical Engineering' });
  }, [profile]);

  if (!profile) return null;

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('Saving...');
    let { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) {
      const refreshed = await supabase.auth.refreshSession();
      data = refreshed.data;
    }
    if (!data.session?.access_token) {
      setMessage('Your session expired. Sign in again, then retry.');
      setSaving(false);
      return;
    }
    const response = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(form) });
    const result = await response.json();
    setMessage(response.ok ? (result.sheetSync === 'synced' ? 'Profile updated on the website and Sheet.' : 'Profile updated on the website. Sheet sync will retry on the next synchronization.') : result.error);
    if (response.ok) await refreshProfile();
    setSaving(false);
  };

  const deleteAccount = async () => {
    if (!confirm('Permanently delete your account and all linked practicum data? This cannot be undone.')) return;
    setDeleting(true);
    let { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) data = (await supabase.auth.refreshSession()).data;
    const response = await fetch('/api/profile', { method: 'DELETE', headers: { Authorization: `Bearer ${data.session?.access_token || ''}` } });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || 'Account deletion failed.'); setDeleting(false); return; }
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return <form className="card profile-editor" onSubmit={save}>
    <div><UserRound/><div><div className="eyebrow">Your account</div><h2>Edit profile</h2><p className="muted">Your email stays tied to your login. Name changes appear everywhere immediately.</p></div></div>
    <label>Full name<input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} required/></label>
    {profile.role === 'student' && <><label>NPM<input value={form.npm} onChange={(event) => setForm({ ...form, npm: event.target.value })}/></label><label>Personal Gmail<input type="email" value={form.gmail_email} onChange={(event) => setForm({ ...form, gmail_email: event.target.value })}/></label><label>Study program<select value={form.study_program} onChange={(event) => setForm({ ...form, study_program: event.target.value })}><option>Electrical Engineering</option><option>Computer Engineering</option></select></label></>}
    <div className="btn-row"><button className="btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button>{profile.role === 'student' && <button className="danger-action" type="button" disabled={deleting} onClick={deleteAccount}><Trash2 size={16}/>{deleting ? 'Deleting...' : 'Delete my account'}</button>}</div>
    {message && <small>{message}</small>}
  </form>;
}
