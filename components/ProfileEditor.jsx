'use client';

import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { useAuth } from './AuthProvider';

export default function ProfileEditor() {
  const { profile, supabase, refreshProfile } = useAuth();
  const [form, setForm] = useState({ full_name: '', npm: '', study_program: 'Electrical Engineering' });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ full_name: profile?.full_name || '', npm: profile?.npm || '', study_program: profile?.study_program || 'Electrical Engineering' });
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
    setMessage(response.ok ? 'Profile updated.' : result.error);
    if (response.ok) await refreshProfile();
    setSaving(false);
  };

  return <form className="card profile-editor" onSubmit={save}>
    <div><UserRound/><div><div className="eyebrow">Your account</div><h2>Edit profile</h2><p className="muted">Your email stays tied to your login. Name changes appear everywhere immediately.</p></div></div>
    <label>Full name<input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} required/></label>
    {profile.role === 'student' && <><label>NPM<input value={form.npm} onChange={(event) => setForm({ ...form, npm: event.target.value })}/></label><label>Study program<select value={form.study_program} onChange={(event) => setForm({ ...form, study_program: event.target.value })}><option>Electrical Engineering</option><option>Computer Engineering</option></select></label></>}
    <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button>
    {message && <small>{message}</small>}
  </form>;
}
