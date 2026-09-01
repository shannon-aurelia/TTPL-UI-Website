import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { reportGroupFor } from '../../../lib/practicum';

const clean = (value) => String(value || '').trim().toLowerCase();
const moduleNumber = (value) => Number(String(value || '').match(/\d+/)?.[0]);
const enabled = (value) => !['false', '0', 'no', 'inactive'].includes(clean(value));

function attendedDate(date, time) {
  return date ? new Date(`${date}T${time || '08:00'}:00+07:00`) : null;
}

function dueDate(attendedAt, override) {
  if (override) {
    const raw = String(override).trim();
    const local = raw.replace(' ', 'T');
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(local)
      ? `${local}T23:59:00+07:00`
      : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)
        ? `${local}:00+07:00`
        : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(local)
          ? `${local}+07:00`
          : local;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid deadline override: ${raw}`);
    return parsed.toISOString();
  }
  const jakarta = new Date(attendedAt.getTime() + 7 * 60 * 60 * 1000);
  jakarta.setUTCDate(jakarta.getUTCDate() + 1);
  return new Date(`${jakarta.toISOString().slice(0, 10)}T23:59:00+07:00`).toISOString();
}

async function authorized(request, url, anonKey) {
  const syncSecret = request.headers.get('x-sync-secret');
  if (syncSecret && [process.env.WEBSITE_SYNC_SECRET, process.env.ATTENDANCE_SYNC_SECRET, process.env.GOOGLE_APPS_SCRIPT_SECRET].includes(syncSecret)) return true;
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return false;
  const client = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data } = await client.auth.getUser(authorization.slice(7));
  if (!data.user) return false;
  const { data: profile } = await client.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  return ['assistant', 'admin'].includes(profile?.role);
}

async function sheetSnapshot() {
  const url = process.env.GOOGLE_APPS_SCRIPT_WEB_APP_URL;
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
  if (!url || !secret) throw new Error('Google Sheet bridge is not configured');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'syncSnapshot', secret }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20000)
  });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error || 'Google Sheet sync failed');
  return result.data || { students: [], attendance: [], plans: [] };
}

export async function POST(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return NextResponse.json({ error: 'Missing server configuration' }, { status: 500 });
  if (!await authorized(request, url, anonKey)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let snapshot;
  try { snapshot = await sheetSnapshot(); } catch (error) {
    const message = error.message === 'Unauthorized'
      ? 'Google Sheet bridge rejected its service key. Your website login is valid; the Google service configuration needs repair.'
      : error.message;
    console.error('[sync-attendance] Sheet snapshot failed', { error: String(error) });
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const [{ data: profiles }, { data: roster }] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('student_roster').select('*')
  ]);
  const byId = new Map((profiles || []).map((item) => [item.id, item]));
  const byEmail = new Map((profiles || []).map((item) => [clean(item.email), item]));
  const byNpm = new Map((profiles || []).filter((item) => item.npm).map((item) => [clean(item.npm), item]));
  const byName = new Map((profiles || []).filter((item) => item.full_name).map((item) => [clean(item.full_name), item]));
  const resolveProfile = (row) => byId.get(row['Account ID']) || byNpm.get(clean(row.npm || row.NPM)) || byEmail.get(clean(row.email || row.Email)) || byName.get(clean(row.full_name || row['Full Name']));
  const rosterByNpm = new Map((roster || []).map((item) => [clean(item.npm), item]));
  const rosterByName = new Map((roster || []).map((item) => [clean(item.full_name), item]));
  const resolveRoster = (row) => rosterByNpm.get(clean(row.npm || row.NPM)) || rosterByName.get(clean(row.full_name || row['Full Name']));
  const result = { studentsSynced: 0, attendanceSynced: 0, plansSynced: 0, warnings: [] };

  for (const row of snapshot.students || []) {
    const hasIdentity = row['Account ID'] || row.NPM || row.npm || row.Email || row.email || row['Full Name'] || row.full_name;
    if (!hasIdentity) continue;
    const profile = resolveProfile(row);
    if (!profile) {
      const rosterStudent = resolveRoster(row);
      if (!rosterStudent) { result.warnings.push(`Student not found in roster: ${row['Full Name'] || row.Email || row.NPM}`); continue; }
      const rosterUpdate = {
        full_name: row['Full Name'] || rosterStudent.full_name,
        ui_email: row['UI Email'] || row.Email || rosterStudent.ui_email,
        gmail_email: row.Gmail || row['Gmail Email'] || rosterStudent.gmail_email,
        is_active: enabled(row.Active),
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('student_roster').update(rosterUpdate).eq('id', rosterStudent.id);
      if (error) result.warnings.push(error.message); else result.studentsSynced += 1;
      continue;
    }
    const update = {
      full_name: row['Full Name'] || profile.full_name,
      npm: String(row.NPM || '').trim() || profile.npm,
      group_name: row.Group || null,
      study_program: row['Study Program'] || profile.study_program,
      is_active: enabled(row.Active),
      sync_managed: true,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('profiles').update(update).eq('id', profile.id);
    if (error) result.warnings.push(error.message);
    else { Object.assign(profile, update); result.studentsSynced += 1; }
  }

  for (const row of snapshot.plans || []) {
    const profile = resolveProfile(row);
    const rosterStudent = profile ? null : resolveRoster(row);
    if ((!profile && !rosterStudent) || !row.planned_week_start) continue;
    const track = clean(row.track) || 'rl';
    const number = moduleNumber(row.module_number);
    if (!Number.isFinite(number)) continue;
    const group = reportGroupFor(track, number);
    const identityId = profile?.id || rosterStudent.id;
    const sourceKey = row.source_key || `plan-${identityId}-${row.report_group || number}-${row.planned_week_start}`;
    if (clean(row.status) === 'deleted') {
      const { error } = await supabase.from('student_module_plans').delete().eq('source_row_key', sourceKey);
      if (error) result.warnings.push(error.message);
      continue;
    }
    const payload = {
      source_row_key: sourceKey,
      student_id: profile?.id || null,
      roster_id: rosterStudent?.id || null,
      track,
      week_number: Number(row.week_number) || 1,
      module_number: number,
      report_group: row.report_group || group?.id || `${track}-${number}`,
      report_label: group?.title || `${track.toUpperCase()} Module ${row.module_number}`,
      planned_week_start: row.planned_week_start,
      planned_lab_date: row.planned_lab_date || null,
      planned_start_time: row.planned_start_time || '15:00',
      status: row.status || 'expected',
      approved_reason: row.approved_reason || null,
      notes: row.notes || null,
      sync_managed: true,
      updated_at: new Date().toISOString()
    };
    const { data: existingPlan, error: lookupError } = await supabase
      .from('student_module_plans')
      .select('id')
      .eq('source_row_key', sourceKey)
      .maybeSingle();
    if (lookupError) {
      result.warnings.push(lookupError.message);
      continue;
    }
    const operation = existingPlan
      ? supabase.from('student_module_plans').update(payload).eq('id', existingPlan.id)
      : supabase.from('student_module_plans').upsert(payload, { onConflict: 'source_row_key' });
    const { error } = await operation;
    if (error) result.warnings.push(error.message); else result.plansSynced += 1;
  }

  for (const row of snapshot.attendance || []) {
    if (!row.source_key) continue;
    const profile = resolveProfile(row);
    const number = moduleNumber(row.module_number);
    const attendedAt = attendedDate(row.attended_date, row.attended_time);
    if (!profile || !attendedAt || !Number.isFinite(number)) continue;
    const track = clean(row.track) || 'rl';
    const group = reportGroupFor(track, number);
    const status = clean(row.attendance_status) || 'on_time';
    if (status === 'deleted') {
      const { error } = await supabase.from('practicum_sessions').delete().eq('source_row_key', row.source_key);
      if (error) result.warnings.push(error.message);
      continue;
    }
    const qnaScore = row.qna_score === '' || !Number.isFinite(Number(row.qna_score)) ? null : Number(row.qna_score);
    const submissionOpen = Boolean(group?.submission) && ['on_time', 'late'].includes(status) && qnaScore !== null && clean(row.submission_override) !== 'closed';
    const payload = {
      source_row_key: row.source_key,
      student_id: profile.id,
      week_number: Number(row.week_number) || 1,
      track,
      module_number: number,
      report_group: group?.id || `${track}-${number}`,
      report_label: group?.title || `${track.toUpperCase()} Module ${row.module_number} Report`,
      scheduled_at: attendedAt.toISOString(),
      attendance_status: status,
      attended_at: attendedAt.toISOString(),
      is_makeup: clean(row.is_makeup) === 'true',
      submission_open: submissionOpen,
      deadline_at: submissionOpen ? dueDate(attendedAt, row.deadline_override) : null,
      qna_score: qnaScore,
      notes: row.notes || null,
      sync_managed: true,
      sheet_updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('practicum_sessions').upsert(payload, { onConflict: 'source_row_key' });
    if (error) result.warnings.push(error.message); else result.attendanceSynced += 1;
  }

  await supabase.from('sheet_sync_runs').insert({ row_count: result.studentsSynced + result.attendanceSynced + result.plansSynced, result });
  return NextResponse.json(result);
}
