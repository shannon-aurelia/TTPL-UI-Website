import { createClient } from '@supabase/supabase-js';
import { after, NextResponse } from 'next/server';

async function sheetStudent(profile) {
  const url = process.env.GOOGLE_APPS_SCRIPT_WEB_APP_URL;
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
  if (profile.role !== 'student' || !url || !secret) return;
  const data = {
    Group: profile.group_name || '',
    'Full Name': profile.full_name,
    NPM: profile.npm || '',
    'Study Program': profile.study_program || 'Electrical Engineering',
    Class: '',
    Email: profile.email,
    'Gmail Email': profile.gmail_email || '',
    'Account ID': profile.id,
    Active: true
  };
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'upsertStudent', secret, data }), cache: 'no-store', signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error || 'Google Sheet update failed');
}

export async function PATCH(request) {
  const authorization = request.headers.get('authorization');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || !authorization?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data } = await authClient.auth.getUser(authorization.slice(7));
  if (!data.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: current, error: profileError } = await authClient.from('profiles').select('*').eq('id', data.user.id).single();
  if (profileError || !current) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  const body = await request.json();
  const update = {
    full_name: String(body.full_name || '').trim(),
    npm: current.role === 'student' ? String(body.npm || '').trim() || null : current.npm,
    gmail_email: current.role === 'student' ? String(body.gmail_email || '').trim().toLowerCase() || null : current.gmail_email,
    study_program: current.role === 'student' ? body.study_program || current.study_program : current.study_program,
    updated_at: new Date().toISOString()
  };
  if (!update.full_name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (current.role === 'student' && update.gmail_email && !update.gmail_email.endsWith('@gmail.com')) return NextResponse.json({ error: 'Enter a valid Gmail address.' }, { status: 400 });
  const next = { ...current, ...update };
  const { error } = await authClient.from('profiles').update(update).eq('id', data.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  after(async () => {
    try { await sheetStudent(next); } catch (error) {
      console.error('[profile] Sheet sync pending', { userId: data.user.id, error: String(error) });
    }
  });
  return NextResponse.json({ profile: next, sheetSync: 'pending' });
}

export async function DELETE(request) {
  const authorization = request.headers.get('authorization');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey || !authorization?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data } = await authClient.auth.getUser(authorization.slice(7));
  if (!data.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (body.confirmation !== 'DELETE MY ACCOUNT') {
    return NextResponse.json({ error: 'Type DELETE MY ACCOUNT exactly to confirm.' }, { status: 400 });
  }
  const lastSignIn = Date.parse(data.user.last_sign_in_at || '');
  if (!Number.isFinite(lastSignIn) || Date.now() - lastSignIn > 15 * 60 * 1000) {
    return NextResponse.json({ error: 'For security, sign out and sign in again before deleting your account.' }, { status: 403 });
  }
  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: ownProfile } = await adminClient.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  if (ownProfile?.role !== 'student') {
    return NextResponse.json({ error: 'Staff accounts must be removed by another administrator.' }, { status: 403 });
  }
  const { error } = await adminClient.auth.admin.deleteUser(data.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ deleted: true });
}
