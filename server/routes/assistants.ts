import { Hono } from 'hono';
import { fetchAssistants, addAssistant } from '../services/assistant';
import { requireRole, Env } from '../middlewares/auth';
import { handleError } from '../utils/errors';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const ZAssistantCreate = z.object({
  name: z.string().min(2),
  roleType: z.enum(['assistant', 'alumni']),
  portraitUrl: z.string().optional(),
  email: z.string().optional(),
  instagram: z.string().optional(),
  batch: z.string().min(1)
});

export const assistantsRouter = new Hono<Env>()
  .get('/', async (c) => {
    try {
      const data = await fetchAssistants();
      return c.json({ success: true, data });
    } catch (e) {
      return handleError(c, e, 'Failed to fetch assistants');
    }
  })
  .post('/', requireRole('assistant'), zValidator('json', ZAssistantCreate), async (c) => {
    try {
      const body = c.req.valid('json');
      const data = await addAssistant(body);
      return c.json({ success: true, data }, 201);
    } catch (e) {
      return handleError(c, e, 'Failed to add assistant');
    }
  });
