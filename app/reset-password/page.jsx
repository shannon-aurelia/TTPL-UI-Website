'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';

export default function ResetPasswordPage() {
  const { supabase, configured } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const updatePassword = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else {
      setMessage('Password updated. You can now sign in.');
      await supabase.auth.signOut();
      window.setTimeout(() => router.replace('/login'), 1200);
    }
    setSaving(false);
  };

  if (!configured) return <section className="section auth-section"><div className="card auth-card"><h1 className="title">Account service unavailable.</h1></div></section>;

  return <section className="section auth-section">
    <div className="card auth-card">
      <div className="eyebrow">Account recovery</div>
      <h1 className="title">Choose a new password.</h1>
      {!ready && <div className="status-message warning">Open this page using the password reset link sent to your email.</div>}
      {error && <div className="status-message error">{error}</div>}
      {message && <div className="status-message">{message}</div>}
      <form className="auth-form" onSubmit={updatePassword}>
        <label>New password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required autoComplete="new-password"/></label>
        <label>Confirm password<input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength={8} required autoComplete="new-password"/></label>
        <button className="btn" type="submit" disabled={!ready || saving}>{saving ? 'Saving...' : 'Update password'}</button>
      </form>
      <Link className="btn ghost auth-switch" href="/login">Back to login</Link>
    </div>
  </section>;
}
