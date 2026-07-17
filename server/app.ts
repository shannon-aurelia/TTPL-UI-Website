import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { authMiddleware, Env } from './middlewares/auth';
import { authRouter } from './routes/auth';
import { newsRouter } from './routes/news';
import { assistantsRouter } from './routes/assistants';
import { submissionsRouter } from './routes/submissions';

const app = new Hono<Env>().basePath('/api');

app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: (origin) => origin,
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
}));

app.use('*', authMiddleware);

app.get('/health', (c) => c.json({ status: 'ok', time: Date.now() }));

app.route('/auth', authRouter);
app.route('/news', newsRouter);
app.route('/assistants', assistantsRouter);
app.route('/submissions', submissionsRouter);

export default app;
export type AppType = typeof app;
