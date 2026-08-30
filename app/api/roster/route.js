import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: 'Roster verification is unavailable.' }, { status: 503 });
  const { npm, full_name: fullName } = await request.json();
  const normalized = String(npm || '').replace(/\D/g, '');
  const normalizedName = String(fullName || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
  if (!/^\d{10}$/.test(normalized)) return NextResponse.json({ error: 'Enter a valid 10-digit NPM.' }, { status: 400 });
  if (normalizedName.length < 3) return NextResponse.json({ error: 'Enter your complete roster name.' }, { status: 400 });
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.from('student_roster').select('id,full_name,class_type,claimed_by,is_active').eq('npm', normalized).maybeSingle();
  const storedName = String(data?.full_name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
  if (error || !data || !data.is_active || data.claimed_by || storedName !== normalizedName) return NextResponse.json({ error: 'The name and NPM do not match an available TTPL roster entry.' }, { status: 404 });
  return NextResponse.json({ verified: true, roster_id: data.id }, { headers: { 'Cache-Control': 'no-store' } });
}
