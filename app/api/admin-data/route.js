import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

async function staff(request) {
  const authorization = request.headers.get('authorization');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !authorization?.startsWith('Bearer ')) return null;
  const client = createClient(url, key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data } = await client.auth.getUser(authorization.slice(7));
  if (!data.user) return null;
  const { data: profile } = await client.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  return ['assistant', 'admin'].includes(profile?.role) ? { user: data.user, profile } : null;
}

async function sheet(action, data) {
  const url = process.env.GOOGLE_APPS_SCRIPT_WEB_APP_URL;
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
  if (!url || !secret) throw new Error('Google Sheet bridge is not configured');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, secret, data }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error || 'Google Sheet update failed');
  return result.data;
}

function studentRow(profile) {
  return {
    Group: profile.group_name || '',
    'Full Name': profile.full_name || '',
    NPM: profile.npm || '',
    'Study Program': profile.study_program || 'Electrical Engineering',
    Class: '',
    Email: profile.email || '',
    'Account ID': profile.id,
    Active: profile.is_active !== false
  };
}

function planRow(plan, profile) {
  return {
    npm: profile?.npm || '',
    email: profile?.email || '',
    full_name: profile?.full_name || '',
    track: plan.track,
    week_number: plan.week_number,
    module_number: plan.moduleLabel,
    report_group: plan.report_group,
    planned_week_start: plan.planned_week_start,
    status: plan.status || 'expected',
    notes: plan.notes || '',
    source_key: plan.source_row_key,
    planned_lab_date: plan.planned_lab_date || '',
    approved_reason: plan.approved_reason || ''
  };
}

export async function POST(request) {
  const actor = await staff(request);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: 'Missing server configuration' }, { status: 500 });
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  try {
    if (body.action === 'updateStudent') {
      const { data: current } = await supabase.from('profiles').select('*').eq('id', body.id).single();
      if (!current || current.role !== 'student') throw new Error('Student account not found');
      const update = {
        full_name: String(body.full_name || '').trim(),
        npm: String(body.npm || '').trim() || null,
        group_name: String(body.group_name || '').trim() || null,
        study_program: body.study_program || 'Electrical Engineering',
        is_active: body.is_active !== false,
        sync_managed: true,
        updated_at: new Date().toISOString()
      };
      const next = { ...current, ...update };
      await sheet('upsertStudent', studentRow(next));
      const { error } = await supabase.from('profiles').update(update).eq('id', body.id);
      if (error) throw error;
      return NextResponse.json({ saved: true, profile: next });
    }
    if (body.action === 'deleteStudent') {
      if (actor.profile.role !== 'admin') return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
      const { data: current } = await supabase.from('profiles').select('*').eq('id', body.id).single();
      if (!current || current.role !== 'student') throw new Error('Student account not found');
      await sheet('deleteStudent', studentRow(current));
      const { error } = await supabase.rpc('admin_delete_student_account', { target_id: body.id });
      if (error) throw error;
      return NextResponse.json({ deleted: true });
    }
    if (body.action === 'upsertPlan') {
      const { data: profile } = await supabase.from('profiles').select('full_name,npm,email').eq('id', body.plan.student_id).single();
      await sheet('upsertPlan', planRow(body.plan, profile));
      const payload = { ...body.plan, moduleLabel: undefined, sync_managed: true, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('student_module_plans').upsert(payload, { onConflict: 'source_row_key' });
      if (error) throw error;
      return NextResponse.json({ saved: true });
    }
    if (body.action === 'deletePlan') {
      await sheet('deletePlan', { source_key: body.source_row_key });
      const { error } = await supabase.from('student_module_plans').delete().eq('source_row_key', body.source_row_key);
      if (error) throw error;
      return NextResponse.json({ deleted: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Data update failed' }, { status: 502 });
  }
}
