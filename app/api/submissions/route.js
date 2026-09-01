import { createClient } from '@supabase/supabase-js';
import { after, NextResponse } from 'next/server';
import { MAX_REPORT_BYTES, submissionExpired } from '../../../lib/practicum';

function userClient(authorization) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function sendToDrive(downloadUrl, file, submission, profile) {
  const url = process.env.GOOGLE_APPS_SCRIPT_WEB_APP_URL;
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
  if (!url || !secret) return { pending: true };
  const useSignedUrl = process.env.GOOGLE_APPS_SCRIPT_SIGNED_URL_UPLOADS === 'true';
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
        ...(useSignedUrl ? { downloadUrl } : { base64: Buffer.from(await file.arrayBuffer()).toString('base64') })
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
  const { phase = 'complete', sessionId, filePath, originalFileName, storedFileName } = body;
  if (!['start', 'complete', 'failed'].includes(phase)) return NextResponse.json({ error: 'Invalid upload phase' }, { status: 400 });
  if (!sessionId || !filePath || !originalFileName || !storedFileName) return NextResponse.json({ error: 'Missing submission details' }, { status: 400 });

  const [profileResult, sessionResult, existingResult] = await Promise.all([
    supabase.from('profiles').select('full_name,npm,email').eq('id', authData.user.id).single(),
    supabase.from('practicum_sessions').select('*').eq('id', sessionId).eq('student_id', authData.user.id).single(),
    supabase.from('submissions').select('id,status,submitted_at,file_path').eq('session_id', sessionId).maybeSingle()
  ]);
  if (profileResult.error || sessionResult.error) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

  const session = sessionResult.data;
  if (!['rl', 'idp'].includes(session.track)) {
    return NextResponse.json({ error: 'Report submission is available only for RL and IDP.' }, { status: 403 });
  }
  const attended = ['on_time', 'late'].includes(session.attendance_status);
  if (!attended || !session.submission_open || session.qna_score == null) {
    return NextResponse.json({ error: 'Submission opens only after attendance and a QnA score are recorded.' }, { status: 403 });
  }
  if (!session.deadline_at) return NextResponse.json({ error: 'This submission does not have an active deadline.' }, { status: 403 });
  if ((phase === 'start' || phase === 'complete') && submissionExpired(session.deadline_at)) {
    return NextResponse.json({ error: 'This deadline has closed. Deadlines use WIB and uploads close five minutes after 23:59.' }, { status: 403 });
  }
  if (phase === 'complete') {
    if (!existingResult.data?.id || existingResult.data.status !== 'uploading' || existingResult.data.file_path !== filePath) {
      return NextResponse.json({ error: 'No matching upload is in progress. Please choose the PDF again.' }, { status: 409 });
    }
    const pathParts = filePath.split('/');
    const objectName = pathParts.pop();
    const folder = pathParts.join('/');
    const { data: objects, error: listError } = await supabase.storage.from('practicum-reports').list(folder, {
      limit: 10,
      search: objectName
    });
    const uploadedObject = objects?.find((object) => object.name === objectName);
    const uploadedSize = Number(uploadedObject?.metadata?.size || 0);
    if (listError || !uploadedObject || uploadedSize <= 0) {
      return NextResponse.json({ error: 'The PDF upload did not finish. Please retry; no submission was counted.' }, { status: 400 });
    }
    if (uploadedSize > MAX_REPORT_BYTES) {
      return NextResponse.json({ error: 'The PDF must be 30 MB or smaller.' }, { status: 413 });
    }
  }
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
    status: phase === 'start' ? 'uploading' : phase === 'failed' ? 'failed' : 'submitted',
    drive_sync_status: 'pending'
  };
  const submissionResult = existingResult.data?.id
    ? await supabase.from('submissions').update(payload).eq('id', existingResult.data.id).select().single()
    : await supabase.from('submissions').insert(payload).select().single();
  if (submissionResult.error) return NextResponse.json({ error: submissionResult.error.message }, { status: 400 });

  // Start only creates a temporary upload attempt. The successful completion call
  // records the official submission time after the PDF exists in storage.
  if (phase === 'start') {
    return NextResponse.json({ submission: submissionResult.data });
  }
  if (phase === 'failed') {
    return NextResponse.json({ submission: submissionResult.data });
  }

  const enriched = {
    ...submissionResult.data,
    lab_date: session.attended_at || session.scheduled_at,
    deadline_at: session.deadline_at
  };
  after(async () => {
    try {
    const admin = serviceClient();
    const useSignedUrl = process.env.GOOGLE_APPS_SCRIPT_SIGNED_URL_UPLOADS === 'true';
    const [{ data: signed, error: signedError }, { data: fileData, error: fileError }] = await Promise.all([
      admin.storage.from('practicum-reports').createSignedUrl(filePath, 900),
      useSignedUrl ? Promise.resolve({ data: null, error: null }) : admin.storage.from('practicum-reports').download(filePath)
    ]);
    if (signedError || !signed?.signedUrl) throw signedError || new Error('Could not create the Drive transfer URL');
    if (!useSignedUrl && (fileError || !fileData)) throw fileError || new Error('Could not retrieve the uploaded PDF');
    const drive = await sendToDrive(signed.signedUrl, fileData, enriched, profileResult.data);
    if (drive.pending) return;
    const { data: updated, error: updateError } = await admin.from('submissions').update({
      drive_file_id: drive.fileId,
      drive_file_url: drive.fileUrl,
      drive_sync_status: 'synced'
    }).eq('id', submissionResult.data.id).select().single();
    if (updateError) throw updateError;
    if (!updated) throw new Error('Drive sync result could not be saved');
  } catch (error) {
    await serviceClient().from('submissions').update({ drive_sync_status: 'failed' }).eq('id', submissionResult.data.id);
    console.error('[submissions] Drive archive failed', { submissionId: submissionResult.data.id, error: String(error) });
  }
  });

  return NextResponse.json({ submission: submissionResult.data, driveSync: 'pending' });
}
