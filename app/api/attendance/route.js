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
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'appendAttendance', secret, data: entries }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000)
    });
  } catch {
    return NextResponse.json({ error: 'Google Sheet bridge could not be reached' }, { status: 502 });
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return NextResponse.json({ error: 'Google Sheet bridge returned an invalid response' }, { status: 502 });
  }
  const result = await response.json();
  if (!response.ok || result.error) {
    return NextResponse.json({ error: result.error || 'Sheet update failed' }, { status: 502 });
  }
  return NextResponse.json(result.data);
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
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteAttendance', secret, data: body.sourceKeys || [] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000)
    });
  } catch {
    return NextResponse.json({ error: 'Google Sheet bridge could not be reached' }, { status: 502 });
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return NextResponse.json({ error: 'Google Sheet bridge returned an invalid response' }, { status: 502 });
  }
  const result = await response.json();
  if (!response.ok || result.error) return NextResponse.json({ error: result.error || 'Sheet delete failed' }, { status: 502 });
  return NextResponse.json(result.data);
}
