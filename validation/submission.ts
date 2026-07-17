import { z } from 'zod';

export const ZSubmissionUpload = z.object({
  trackId: z.enum(['rl', 'idp', 't3']),
  type: z.enum(['pre-test', 'post-test', 'report']),
  moduleIndex: z.coerce.number().min(1).max(10),
  fileName: z.string().min(1, 'File name is required'),
  fileUrl: z.string().min(1, 'File URL or path is required')
});

export const ZSubmissionGrade = z.object({
  score: z.coerce.number().min(0).max(100),
  notes: z.string().optional()
});
