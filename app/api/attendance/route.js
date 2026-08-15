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

export async function POST(request) {
  if (!await authorizeStaff(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = process.env.GOOGLE_APPS_SCRIPT_WEB_APP_URL;
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
  if (!url || !secret) {
    return NextResponse.json({ error: 'Google Sheet bridge is not configured' }, { status: 503 });
  }
  const body = await request.json();
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'appendAttendance', secret, data: body.entries }),
    cache: 'no-store'
  });
  const result = await response.json();
  if (!response.ok || result.error) {
    return NextResponse.json({ error: result.error || 'Sheet update failed' }, { status: 502 });
  }
  return NextResponse.json(result.data);
}
