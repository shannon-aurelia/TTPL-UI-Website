import { createSubmission, getSubmissionsForUser, getAllSubmissions, updateSubmissionGrade } from '../queries/submission';
import { randomUUID } from 'crypto';
import type { ZSubmissionUpload } from '../../validation/submission';
import type { z } from 'zod';

export async function uploadSubmission(userId: string, input: z.infer<typeof ZSubmissionUpload>) {
  return await createSubmission({
    id: randomUUID(),
    userId,
    trackId: input.trackId,
    type: input.type,
    moduleIndex: input.moduleIndex,
    fileUrl: input.fileUrl,
    fileName: input.fileName,
    submittedAt: Date.now()
  });
}

export async function fetchSubmissions(userId: string, userRole: string) {
  if (userRole === 'assistant' || userRole === 'admin') {
    return await getAllSubmissions();
  }
  return await getSubmissionsForUser(userId);
}

export async function gradeSubmission(id: string, score: number, notes?: string) {
  return await updateSubmissionGrade(id, score, notes);
}
