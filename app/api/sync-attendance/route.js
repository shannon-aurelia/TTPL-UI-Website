import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { reportGroupFor } from '../../../lib/practicum';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) { row.push(value); value = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value); value = '';
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
    } else value += character;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  const headers = rows.shift().map((header) => header.trim());
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, (cells[index] || '').trim()])));
}

function parseModuleNumber(value) {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : Number.NaN;
}

function jakartaDate(date, time) {
  if (!date) return null;
  return new Date(`${date}T${time || '08:00'}:00+07:00`);
}

function calculateDeadline(attendanceDate, override) {
  if (override) {
    const normalized = override.trim().replace(' ', 'T');
    const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
    const hasSeconds = /T\d{2}:\d{2}:\d{2}/.test(normalized);
    return new Date(`${normalized}${hasSeconds ? '' : ':00'}${hasZone ? '' : '+07:00'}`).toISOString();
  }
  const jakarta = new Date(attendanceDate.getTime() + 7 * 60 * 60 * 1000);
  jakarta.setUTCDate(jakarta.getUTCDate() + 1);
  const year = jakarta.getUTCFullYear();
  const month = String(jakarta.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jakarta.getUTCDate()).padStart(2, '0');
  return new Date(`${year}-${month}-${day}T23:59:00+07:00`).toISOString();
}

async function authorizeStaff(request, url, anonKey) {
  if (request.headers.get('x-sync-secret') === process.env.ATTENDANCE_SYNC_SECRET) return true;
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return false;
  const token = authorization.slice(7);
  const client = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: authData } = await client.auth.getUser(token);
  if (!authData.user) return false;
  const { data: profile } = await client.from('profiles').select('role').eq('id', authData.user.id).maybeSingle();
  return ['assistant', 'admin'].includes(profile?.role);
}

async function appsScriptRows(action) {
  const url = process.env.GOOGLE_APPS_SCRIPT_WEB_APP_URL;
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
  if (!url || !secret) return null;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, secret }),
    cache: 'no-store'
  });
  if (!response.ok) throw new Error('Could not reach the Google control sheet');
  const body = await response.json();
  if (body.error) throw new Error(body.error);
  return body.rows || [];
}

export async function POST(request) {
  const sheetUrl = process.env.ATTENDANCE_SHEET_CSV_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceKey) return NextResponse.json({ error: 'Missing server configuration' }, { status: 500 });
  if (!await authorizeStaff(request, supabaseUrl, anonKey)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  let records = await appsScriptRows('attendanceRows');
  const planRecords = await appsScriptRows('modulePlanRows') || [];
  if (!records) {
    if (!sheetUrl) return NextResponse.json({ error: 'Google Sheet connection is not configured' }, { status: 500 });
    const response = await fetch(sheetUrl, { cache: 'no-store' });
    if (!response.ok) return NextResponse.json({ error: 'Could not download the attendance CSV' }, { status: 502 });
    records = parseCsv(await response.text());
  }
  const results = [];

  for (const record of planRecords) {
    const profileQuery = record.npm
      ? supabase.from('profiles').select('id').eq('npm', record.npm).maybeSingle()
      : supabase.from('profiles').select('id').eq('email', record.email?.toLowerCase()).maybeSingle();
    const { data: profile } = await profileQuery;
    if (!profile) { results.push({ source_key: record.source_key, status: 'plan_student_not_found', npm: record.npm }); continue; }
    const track = record.track.toLowerCase();
    const moduleNumber = parseModuleNumber(record.module_number);
    const group = reportGroupFor(track, moduleNumber);
    const payload = {
      source_row_key: record.source_key || `plan-${record.npm}-${track}-${record.week_number}-${moduleNumber}`,
      student_id: profile.id,
      track,
      week_number: Number(record.week_number),
      module_number: moduleNumber,
      report_group: group?.id || `${track}-${moduleNumber}`,
      report_label: group?.title || `${track.toUpperCase()} Module ${moduleNumber}`,
      planned_week_start: record.planned_week_start,
      status: record.status || 'expected',
      notes: record.notes || null
    };
    const { error } = await supabase.from('student_module_plans').upsert(payload, { onConflict: 'source_row_key' });
    results.push({ source_key: payload.source_row_key, status: error ? 'plan_error' : 'plan_synced', error: error?.message });
  }

  const attendanceNpms = [...new Set(records.map((record) => record.npm).filter(Boolean))];
  const { data: attendanceProfiles } = attendanceNpms.length
    ? await supabase.from('profiles').select('id,npm').in('npm', attendanceNpms)
    : { data: [] };
  const profileByNpm = new Map((attendanceProfiles || []).map((item) => [item.npm, item.id]));
  const attendancePayloads = [];

  for (const record of records) {
    const studentId = profileByNpm.get(record.npm);
    if (!studentId) { results.push({ source_key: record.source_key, status: 'student_not_found', npm: record.npm }); continue; }
    const track = record.track.toLowerCase();
    const moduleNumber = parseModuleNumber(record.module_number);
    const group = reportGroupFor(track, moduleNumber);
    const attendedAt = jakartaDate(record.attended_date, record.attended_time);
    if (!attendedAt) { results.push({ source_key: record.source_key, status: 'attendance_date_missing', npm: record.npm }); continue; }
    const attendanceStatus = (record.attendance_status || 'on_time').toLowerCase();
    const submissionOpen = group?.submission && ['on_time', 'late'].includes(attendanceStatus) && record.submission_override !== 'closed';
    const deadlineAt = submissionOpen ? calculateDeadline(attendedAt, record.deadline_override) : null;
    const sourceKey = record.source_key || `attendance-${record.npm}-${record.attended_date}-${track}-${moduleNumber}`;
    const payload = {
      source_row_key: sourceKey,
      student_id: studentId,
      week_number: Number(record.week_number),
      track,
      module_number: moduleNumber,
      report_group: group?.id || `${track}-${moduleNumber}`,
      report_label: group?.title || `${track.toUpperCase()} Module ${moduleNumber} Report`,
      scheduled_at: attendedAt.toISOString(),
      attendance_status: attendanceStatus,
      attended_at: attendedAt.toISOString(),
      is_makeup: String(record.is_makeup).toLowerCase() === 'true',
      makeup_for_source_key: record.makeup_for_source_key || null,
      submission_open: Boolean(submissionOpen),
      deadline_at: deadlineAt,
      qna_score: record.qna_score === '' || record.qna_score == null ? null : Number(record.qna_score),
      notes: record.notes || null,
      sheet_updated_at: new Date().toISOString()
    };
    attendancePayloads.push(payload);
  }

  if (attendancePayloads.length) {
    const { data: syncedSessions, error } = await supabase
      .from('practicum_sessions')
      .upsert(attendancePayloads, { onConflict: 'source_row_key' })
      .select('id,source_row_key,student_id,track,report_group,week_number');
    if (error) {
      attendancePayloads.forEach((payload) => results.push({ source_key: payload.source_row_key, status: 'error', error: error.message }));
    } else {
      (syncedSessions || []).forEach((session) => results.push({ source_key: session.source_row_key, status: 'synced' }));
      await Promise.all((syncedSessions || []).map((session) => supabase
        .from('student_module_plans')
        .update({ status: 'completed', completed_session_id: session.id })
        .eq('student_id', session.student_id)
        .eq('track', session.track)
        .eq('report_group', session.report_group)
        .eq('week_number', session.week_number)));
    }
  }
  await supabase.from('sheet_sync_runs').insert({ row_count: records.length + planRecords.length, result: results });
  return NextResponse.json({
    attendanceSynced: results.filter((item) => item.status === 'synced').length,
    plansSynced: results.filter((item) => item.status === 'plan_synced').length,
    results
  });
}
