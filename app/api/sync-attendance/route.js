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

function jakartaDate(date, time) {
  if (!date) return null;
  return new Date(`${date}T${time || '08:00'}:00+07:00`);
}

function calculateDeadline(attendanceDate, override) {
  if (override) return new Date(`${override}+07:00`).toISOString();
  const jakarta = new Date(attendanceDate.getTime() + 7 * 60 * 60 * 1000);
  jakarta.setUTCDate(jakarta.getUTCDate() + 2);
  const year = jakarta.getUTCFullYear();
  const month = String(jakarta.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jakarta.getUTCDate()).padStart(2, '0');
  return new Date(`${year}-${month}-${day}T00:05:00+07:00`).toISOString();
}

export async function POST(request) {
  if (request.headers.get('x-sync-secret') !== process.env.ATTENDANCE_SYNC_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sheetUrl = process.env.ATTENDANCE_SHEET_CSV_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sheetUrl || !supabaseUrl || !serviceKey) return NextResponse.json({ error: 'Missing server configuration' }, { status: 500 });
  const response = await fetch(sheetUrl, { cache: 'no-store' });
  if (!response.ok) return NextResponse.json({ error: 'Could not download the attendance CSV' }, { status: 502 });
  const records = parseCsv(await response.text());
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const results = [];
  for (const record of records) {
    const { data: profile } = await supabase.from('profiles').select('id').eq('npm', record.npm).maybeSingle();
    if (!profile) { results.push({ source_key: record.source_key, status: 'student_not_found', npm: record.npm }); continue; }
    const track = record.track.toLowerCase();
    const moduleNumber = Number(record.module_number);
    const group = reportGroupFor(track, moduleNumber);
    const scheduledAt = jakartaDate(record.scheduled_date, record.scheduled_start);
    const attendanceStatus = (record.attendance_status || 'scheduled').toLowerCase();
    const submissionOpen = group?.submission && (['on_time', 'late'].includes(attendanceStatus) || record.submission_override === 'open') && record.submission_override !== 'closed';
    const deadlineAt = submissionOpen ? calculateDeadline(jakartaDate(record.attended_date || record.scheduled_date, record.attended_time || record.scheduled_start), record.deadline_override) : null;
    const payload = {
      source_row_key: record.source_key,
      student_id: profile.id,
      week_number: Number(record.week_number),
      track,
      module_number: moduleNumber,
      report_group: group?.id || `${track}-${moduleNumber}`,
      report_label: group?.title || `${track.toUpperCase()} Module ${moduleNumber} Report`,
      scheduled_at: scheduledAt?.toISOString(),
      attendance_status: attendanceStatus,
      attended_at: record.attended_date ? jakartaDate(record.attended_date, record.attended_time)?.toISOString() : null,
      is_makeup: String(record.is_makeup).toLowerCase() === 'true',
      makeup_for_source_key: record.makeup_for_source_key || null,
      submission_open: Boolean(submissionOpen),
      deadline_at: deadlineAt,
      notes: record.notes || null,
      sheet_updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('practicum_sessions').upsert(payload, { onConflict: 'source_row_key' });
    results.push({ source_key: record.source_key, status: error ? 'error' : 'synced', error: error?.message });
  }
  await supabase.from('sheet_sync_runs').insert({ row_count: records.length, result: results });
  return NextResponse.json({ synced: results.filter((item) => item.status === 'synced').length, results });
}
