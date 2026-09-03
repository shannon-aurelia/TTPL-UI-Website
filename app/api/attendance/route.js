import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

async function authorizeStaff(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get('authorization');
  if (!url || !key || !authorization?.startsWith('Bearer ')) return false;
  const client = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false }
  });
  const { data } = await client.auth.getUser(authorization.slice(7));
  if (!data.user) return false;
  const { data: profile } = await client.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  return profile?.role === 'assistant' || profile?.role === 'admin';
}

async function writeAttendance(request) {
  if (!await authorizeStaff(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = process.env.GOOGLE_APPS_SCRIPT_WEB_APP_URL;
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
  if (!url || !secret) {
    return NextResponse.json({ error: 'Google Sheet bridge is not configured' }, { status: 503 });
  }
  const body = await request.json();
  const entries = body.entries || (body.entry ? [body.entry] : []);
  if (!entries.length) return NextResponse.json({ error: 'No attendance rows supplied' }, { status: 400 });
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'appendAttendance', secret, data: entries }),
        cache: 'no-store',
        signal: AbortSignal.timeout(25000)
      });
      const result = JSON.parse(await response.text());
      if (!response.ok || result.error) throw new Error(result.error || 'Sheet update failed');
      return NextResponse.json(result.data);
    } catch (error) {
      lastError = error;
      console.error('[attendance] Sheet write attempt failed', { attempt, error: String(error) });
    }
  }
  return NextResponse.json({ error: lastError?.message || 'Google Sheet bridge could not be reached' }, { status: 502 });
}

export async function POST(request) {
  return writeAttendance(request);
}

export async function PATCH(request) {
  return writeAttendance(request);
}

export async function DELETE(request) {
  if (!await authorizeStaff(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = process.env.GOOGLE_APPS_SCRIPT_WEB_APP_URL;
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
  if (!url || !secret) return NextResponse.json({ error: 'Google Sheet bridge is not configured' }, { status: 503 });
  const body = await request.json();
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteAttendance', secret, data: body.sourceKeys || [] }),
        cache: 'no-store',
        signal: AbortSignal.timeout(25000)
      });
      const result = JSON.parse(await response.text());
      if (!response.ok || result.error) throw new Error(result.error || 'Sheet delete failed');
      return NextResponse.json(result.data);
    } catch (error) {
      lastError = error;
      console.error('[attendance] Sheet delete attempt failed', { attempt, error: String(error) });
    }
  }
  return NextResponse.json({ error: lastError?.message || 'Google Sheet bridge could not be reached' }, { status: 502 });
}
