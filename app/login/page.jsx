'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';

export default function Login() {
  const [registering, setRegistering] = useState(false);
  const [fullName, setFullName] = useState('');
  const [npm, setNpm] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user, profile, configured, supabase } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    router.replace(profile?.role === 'assistant' || profile?.role === 'admin' ? '/assistant-dashboard' : '/portal');
  }, [user, profile, router]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!supabase) {
      setError('Supabase has not been configured. Follow DATA_SETUP_GUIDE.md first.');
      return;
    }
    setSubmitting(true);
    if (registering) {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, npm } }
      });
      if (authError) {
        setError(authError.message);
      } else if (data.user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          email,
          full_name: fullName,
          npm,
          role: 'student'
        });
        if (profileError) setError(profileError.message);
        else setNotice('Account created. Check your email if confirmation is enabled, then sign in.');
      }
    } else {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) setError(authError.message);
    }
    setSubmitting(false);
  };

  return <section className="section auth-section">
    <div className="card auth-card">
      <div className="eyebrow">TTPL account</div>
      <h1 className="title">{registering ? 'Create your account.' : 'Sign in.'}</h1>
      <p className="subtitle">Students receive a personalized weekly schedule, deadline tracking, report uploads, and progress view. Assistant accounts open the review dashboard.</p>
      {!configured && <div className="status-message warning">The interface is ready, but Supabase variables are not set yet.</div>}
      {error && <div className="status-message error">{error}</div>}
      {notice && <div className="status-message">{notice}</div>}
      <form className="auth-form" onSubmit={submit}>
        {registering && <>
          <label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>
          <label>NPM<input value={npm} onChange={(event) => setNpm(event.target.value)} required inputMode="numeric" /></label>
        </>}
        <label>UI email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></label>
        <button className="btn" type="submit" disabled={submitting}>{submitting ? 'Please wait...' : registering ? 'Create student account' : 'Sign in'}</button>
      </form>
      <button className="btn ghost auth-switch" type="button" onClick={() => { setRegistering(!registering); setError(''); setNotice(''); }}>{registering ? 'Already registered? Sign in' : 'Create a student account'}</button>
    </div>
  </section>;
}
