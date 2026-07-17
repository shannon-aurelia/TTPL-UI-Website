import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ZSubmissionGrade } from '../../validation/submission';
import { fetchSubmissions, uploadSubmission, gradeSubmission } from '../services/submission';
import { requireAuth, requireRole, Env } from '../middlewares/auth';
import { handleError, AppError } from '../utils/errors';
import { promises as fs } from 'fs';
import path from 'path';

export const submissionsRouter = new Hono<Env>()
  .use(requireAuth)
  .get('/', async (c) => {
    try {
      const user = c.get('user')!;
      const data = await fetchSubmissions(user.id, user.role);
      return c.json({ success: true, data });
    } catch (e) {
      return handleError(c, e, 'Failed to fetch submissions');
    }
  })
  .post('/upload', async (c) => {
    try {
      const user = c.get('user')!;
      const body = await c.req.parseBody();
      
      const file = body['file'];
      const trackId = body['trackId'] as string;
      const type = body['type'] as string;
      const moduleIndex = Number(body['moduleIndex']);

      if (!file || !(file instanceof File)) {
        throw new AppError('File upload is missing or invalid', 400, 'FILE_MISSING');
      }

      if (!trackId || !type || isNaN(moduleIndex)) {
        throw new AppError('Invalid trackId, type, or moduleIndex', 400, 'INVALID_METADATA');
      }

      // Ensure upload directory exists
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      await fs.mkdir(uploadDir, { recursive: true });

      // Save file
      const fileExt = path.extname(file.name);
      const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${fileExt}`;
      const filePath = path.join(uploadDir, uniqueName);
      
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await fs.writeFile(filePath, buffer);

      const fileUrl = `/uploads/${uniqueName}`;

      const data = await uploadSubmission(user.id, {
        trackId: trackId as any,
        type: type as any,
        moduleIndex,
        fileName: file.name,
        fileUrl
      });

      return c.json({ success: true, data }, 201);
    } catch (e) {
      return handleError(c, e, 'Upload failed');
    }
  })
  .patch('/:id/grade', requireRole('assistant'), zValidator('json', ZSubmissionGrade), async (c) => {
    try {
      const id = c.req.param('id');
      const body = c.req.valid('json');
      const data = await gradeSubmission(id!, body.score, body.notes);
      return c.json({ success: true, data });
    } catch (e) {
      return handleError(c, e, 'Grading failed');
    }
  });
