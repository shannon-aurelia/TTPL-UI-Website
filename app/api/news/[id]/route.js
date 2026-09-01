import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function DELETE(request, { params }) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data } = await supabase.auth.getUser(authorization.slice(7));
  if (!data.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  if (!['assistant', 'admin'].includes(profile?.role)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const { error } = await supabase.from('news_posts').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
