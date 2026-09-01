import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function client(authorization) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: authorization ? { headers: { Authorization: authorization } } : {},
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function staffClient(request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const supabase = client(authorization);
  const { data } = await supabase.auth.getUser(authorization.slice(7));
  if (!data.user) return null;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  return ['assistant', 'admin'].includes(profile?.role) ? { supabase, user: data.user } : null;
}

export async function GET() {
  const { data, error } = await client().from('news_posts').select('id,title,content,tag,created_at,author_id').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data: data.map((item) => ({ ...item, createdAt: new Date(item.created_at).getTime() })) });
}

export async function POST(request) {
  const staff = await staffClient(request);
  if (!staff) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const title = String(body.title || '').trim();
  const content = String(body.content || '').trim();
  const tag = String(body.tag || 'Announcement').trim().slice(0, 40);
  if (!title || !content) return NextResponse.json({ success: false, error: 'Title and content are required.' }, { status: 400 });
  const { data, error } = await staff.supabase.from('news_posts').insert({ title: title.slice(0, 180), content: content.slice(0, 5000), tag, author_id: staff.user.id }).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}
