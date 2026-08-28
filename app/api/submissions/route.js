import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function userClient(authorization) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function sendToDrive(file, submission, profile) {
  const url = process.env.GOOGLE_APPS_SCRIPT_WEB_APP_URL;
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
  if (!url || !secret) return { pending: true };
  const buffer = Buffer.from(await file.arrayBuffer());
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'uploadReport',
      secret,
      data: {
        submissionId: submission.id,
        npm: profile.npm,
        fullName: profile.full_name,
        email: profile.email,
        track: submission.track,
        reportGroup: submission.report_group,
        weekNumber: submission.week_number,
        labDate: submission.lab_date,
        deadlineAt: submission.deadline_at,
        submittedAt: submission.submitted_at,
        minutesLate: submission.minutes_late,
        latePenalty: submission.late_penalty,
        originalFileName: submission.original_file_name,
        driveFileName: submission.stored_file_name,
        mimeType: 'application/pdf',
        base64: buffer.toString('base64')
      }
    }),
    cache: 'no-store'
  });
  if (!response.ok) throw new Error('Google Drive could not receive the report');
  const body = await response.json();
  if (body.error) throw new Error(body.error);
  return body.data;
}

export async function POST(request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const token = authorization.slice(7);
  const supabase = userClient(authorization);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { sessionId, filePath, originalFileName, storedFileName } = body;
  if (!sessionId || !filePath || !originalFileName || !storedFileName) return NextResponse.json({ error: 'Missing submission details' }, { status: 400 });

  const [profileResult, sessionResult, existingResult] = await Promise.all([
    supabase.from('profiles').select('full_name,npm,email').eq('id', authData.user.id).single(),
    supabase.from('practicum_sessions').select('*').eq('id', sessionId).eq('student_id', authData.user.id).single(),
    supabase.from('submissions').select('id').eq('session_id', sessionId).maybeSingle()
  ]);
  if (profileResult.error || sessionResult.error) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

  const session = sessionResult.data;
  const attended = ['on_time', 'late'].includes(session.attendance_status);
  if (!attended || !session.submission_open || session.qna_score == null) {
    return NextResponse.json({ error: 'Submission opens only after attendance and a QnA score are recorded.' }, { status: 403 });
  }
  if (!session.deadline_at) return NextResponse.json({ error: 'This submission does not have an active deadline.' }, { status: 403 });
  const payload = {
    ...(existingResult.data?.id ? { id: existingResult.data.id } : {}),
    session_id: session.id,
    student_id: authData.user.id,
    track: session.track,
    report_group: session.report_group,
    week_number: session.week_number,
    original_file_name: originalFileName,
    stored_file_name: storedFileName,
    file_path: filePath,
    status: new Date() > new Date(session.deadline_at) ? 'late' : 'submitted',
    drive_sync_status: 'pending'
  };
  const submissionResult = existingResult.data?.id
    ? await supabase.from('submissions').update(payload).eq('id', existingResult.data.id).select().single()
    : await supabase.from('submissions').insert(payload).select().single();
  if (submissionResult.error) return NextResponse.json({ error: submissionResult.error.message }, { status: 400 });

  const enriched = {
    ...submissionResult.data,
    lab_date: session.attended_at || session.scheduled_at,
    deadline_at: session.deadline_at
  };
  try {
    const { data: fileData, error: fileError } = await supabase.storage.from('practicum-reports').download(filePath);
    if (fileError) throw fileError;
    const drive = await sendToDrive(fileData, enriched, profileResult.data);
    if (drive.pending) return NextResponse.json({ submission: submissionResult.data, driveSync: 'pending' });
    const { data: updated, error: updateError } = await supabase.from('submissions').update({
      drive_file_id: drive.fileId,
      drive_file_url: drive.fileUrl,
      drive_sync_status: 'synced'
    }).eq('id', submissionResult.data.id).select().single();
    if (updateError) throw updateError;
    return NextResponse.json({ submission: updated, driveSync: 'synced' });
  } catch (error) {
    await supabase.from('submissions').update({ drive_sync_status: 'failed' }).eq('id', submissionResult.data.id);
    return NextResponse.json({ submission: submissionResult.data, driveSync: 'failed', warning: error.message });
  }
}
