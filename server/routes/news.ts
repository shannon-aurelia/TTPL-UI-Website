import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ZNewsCreate } from '../../validation/news';
import { fetchNews, addNews, removeNews } from '../services/news';
import { requireRole, Env } from '../middlewares/auth';
import { handleError } from '../utils/errors';

export const newsRouter = new Hono<Env>()
  .get('/', async (c) => {
    try {
      const data = await fetchNews();
      return c.json({ success: true, data });
    } catch (e) {
      return handleError(c, e, 'Failed to fetch news');
    }
  })
  .post('/', requireRole('assistant'), zValidator('json', ZNewsCreate), async (c) => {
    try {
      const body = c.req.valid('json');
      const data = await addNews(body);
      return c.json({ success: true, data }, 201);
    } catch (e) {
      return handleError(c, e, 'Failed to create news');
    }
  })
  .delete('/:id', requireRole('assistant'), async (c) => {
    try {
      const id = c.req.param('id');
      const data = await removeNews(id!);
      return c.json({ success: true, data });
    } catch (e) {
      return handleError(c, e, 'Failed to delete news');
    }
  });
