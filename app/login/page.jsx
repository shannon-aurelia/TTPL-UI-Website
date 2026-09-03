'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';

export default function Login() {
  const [registering, setRegistering] = useState(false);
  const [registrationMode, setRegistrationMode] = useState('student');
  const [rosterId, setRosterId] = useState('');
  const [identityVerified, setIdentityVerified] = useState(false);
  const [fullName, setFullName] = useState('');
  const [npm, setNpm] = useState('');
  const [gmailEmail, setGmailEmail] = useState('');
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
    if (registering && registrationMode === 'student' && (!rosterId || !uiEmail || !gmailEmail.trim().toLowerCase().endsWith('@gmail.com'))) {
      setError('Select your roster name, enter its matching NPM, and provide both your UI email and Gmail.');
      return;
    }
    if (registering && registrationMode === 'student' && !allowExternalRegistration && !uiEmail) {
      setError('New student accounts must use an official UI email address.');
      return;
    }
    setSubmitting(true);
    if (registering) {
      const { data, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: registrationMode === 'student'
          ? { roster_id: rosterId, npm, gmail_email: gmailEmail.trim().toLowerCase() }
          : { full_name: fullName, npm } }
      });
      if (authError) {
        setError(authError.message);
      } else if (data.user) setNotice('Account created and linked to the roster. Check your UI inbox if confirmation is enabled, then sign in.');
    } else {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (authError) setError(authError.message);
    }
    setSubmitting(false);
  };

  const sendPasswordReset = async () => {
    if (!supabase) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Enter your email address first.');
      return;
    }
    setError('');
    setNotice('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    if (resetError) setError(resetError.message);
    else setNotice('Password reset email sent. Open the link in your inbox to choose a new password.');
  };

  const verifyNpm = async () => {
    setError('');
    setIdentityVerified(false);
    setRosterId('');
    if (!/^\d{10}$/.test(npm)) { setError('Enter your complete 10-digit NPM.'); return; }
    if (fullName.trim().length < 3) { setError('Enter your full name exactly as listed on the TTPL roster.'); return; }
    const response = await fetch('/api/roster', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ npm, full_name: fullName }) });
    const result = await response.json();
    if (!response.ok) setError(result.error || 'NPM could not be verified.');
    else { setIdentityVerified(true); setRosterId(result.roster_id); }
  };

  const signInWithGoogle = async () => {
    if (!supabase) return;
    setError('');
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login`, queryParams: { prompt: 'select_account' } }
    });
    if (authError) setError(authError.message);
  };

  return <section className="section auth-section">
    <div className="card auth-card">
      <div className="eyebrow">TTPL portal</div>
      <h1 className="title">{registering ? 'Create a student account.' : 'Welcome back.'}</h1>
      <p className="subtitle">Students can manage their profile and view schedules, attendance, and QnA records. Report files are submitted through EMAS3.</p>
      {!configured && <div className="status-message warning">The account service is currently unavailable.</div>}
      {error && <div className="status-message error">{error}</div>}
      {notice && <div className="status-message">{notice}</div>}
      <form className="auth-form" onSubmit={submit}>
        {registering && registrationMode === 'student' && <>
          <label>Full name on the roster<input value={fullName} onChange={(event) => { setFullName(event.target.value); setRosterId(''); setIdentityVerified(false); }} required placeholder="Enter your complete registered name"/></label>
          <label>Verify your NPM<input value={npm} onChange={(event) => { setNpm(event.target.value.replace(/\D/g, '').slice(0, 10)); setRosterId(''); setIdentityVerified(false); }} required inputMode="numeric" minLength={10} maxLength={10}/></label>
          <button className="btn ghost roster-verify" type="button" onClick={verifyNpm}>Verify identity</button>
          {identityVerified && <div className="roster-confirmation"><b>Identity verified</b><small>Your name and NPM match one unregistered TTPL roster entry.</small></div>}
          <label>Official UI email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="name@ui.ac.id" /></label>
          <label>Personal Gmail<input type="email" value={gmailEmail} onChange={(event) => setGmailEmail(event.target.value)} required placeholder="name@gmail.com" /></label>
        </>}
        {registering && registrationMode === 'staff' && <>
          <label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>
          <label>Email on the TTPL staff list<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
        </>}
        {!registering && <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>}
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></label>
        <button className="btn" type="submit" disabled={submitting}>{submitting ? 'Please wait...' : registering ? 'Create student account' : 'Sign in'}</button>
      </form>
      {!registering && <button className="auth-text-button" type="button" onClick={sendPasswordReset}>Forgot password?</button>}
      <div className="auth-divider"><span>or</span></div>
      <button className="btn ghost auth-google" type="button" onClick={signInWithGoogle}>Continue with Google</button>
      {registering && <p className="auth-note">{allowExternalRegistration ? 'External email registration is temporarily enabled for testing.' : 'Registration is restricted to UI email accounts.'}</p>}
      {registering && <button className="auth-text-button" type="button" onClick={() => { setRegistrationMode((current) => current === 'student' ? 'staff' : 'student'); setError(''); }}>{registrationMode === 'student' ? 'Register an allowlisted TTPL staff account' : 'Return to student registration'}</button>}
      <button className="btn ghost auth-switch" type="button" onClick={() => { setRegistering(!registering); setError(''); setNotice(''); }}>{registering ? 'Already registered? Sign in' : 'Create a student account'}</button>
    </div>
  </section>;
}
