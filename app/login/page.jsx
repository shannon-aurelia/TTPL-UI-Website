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
  const [allowExternalRegistration, setAllowExternalRegistration] = useState(true);
  const { user, profile, configured, supabase } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    router.replace(profile?.role === 'admin' || profile?.role === 'assistant' ? '/admin' : '/portal');
  }, [user, profile, router]);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('lab_settings').select('allow_external_student_registration').eq('id', true).maybeSingle().then(({ data }) => {
      if (data) setAllowExternalRegistration(data.allow_external_student_registration);
    });
  }, [supabase]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!supabase) {
      setError('The account service is not available right now. Please contact a TTPL administrator.');
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const uiEmail = normalizedEmail.endsWith('@ui.ac.id') || normalizedEmail.endsWith('@student.ui.ac.id');
    if (registering && !allowExternalRegistration && !uiEmail) {
      setError('New student accounts must use an official UI email address.');
      return;
    }
    setSubmitting(true);
    if (registering) {
      const { data, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: { full_name: fullName, npm } }
      });
      if (authError) {
        setError(authError.message);
      } else if (data.user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          email: normalizedEmail,
          full_name: fullName,
          npm,
          role: 'student'
        });
        if (profileError) setError(profileError.message);
        else setNotice('Account created. Check your email if confirmation is enabled, then sign in.');
      }
    } else {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (authError) setError(authError.message);
    }
    setSubmitting(false);
  };

  const signInWithGoogle = async () => {
    if (!supabase) return;
    setError('');
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/portal` }
    });
    if (authError) setError(authError.message);
  };

  return <section className="section auth-section">
    <div className="card auth-card">
      <div className="eyebrow">TTPL portal</div>
      <h1 className="title">{registering ? 'Create a student account.' : 'Welcome back.'}</h1>
      <p className="subtitle">Students can view their attendance-based deadlines and submit reports. Staff accounts open the practicum administration portal.</p>
      {!configured && <div className="status-message warning">The account service is currently unavailable.</div>}
      {error && <div className="status-message error">{error}</div>}
      {notice && <div className="status-message">{notice}</div>}
      <form className="auth-form" onSubmit={submit}>
        {registering && <>
          <label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>
          <label>NPM<input value={npm} onChange={(event) => setNpm(event.target.value)} required inputMode="numeric" /></label>
        </>}
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder={allowExternalRegistration ? 'UI email or testing Gmail' : 'name@ui.ac.id'} /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></label>
        <button className="btn" type="submit" disabled={submitting}>{submitting ? 'Please wait...' : registering ? 'Create student account' : 'Sign in'}</button>
      </form>
      <div className="auth-divider"><span>or</span></div>
      <button className="btn ghost auth-google" type="button" onClick={signInWithGoogle}>Continue with Google</button>
      {registering && <p className="auth-note">{allowExternalRegistration ? 'External email registration is temporarily enabled for testing.' : 'Registration is restricted to UI email accounts.'}</p>}
      <button className="btn ghost auth-switch" type="button" onClick={() => { setRegistering(!registering); setError(''); setNotice(''); }}>{registering ? 'Already registered? Sign in' : 'Create a student account'}</button>
    </div>
  </section>;
}
