import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { setCookie, deleteCookie } from 'hono/cookie';
import { ZLogin, ZRegister } from '../../validation/auth';
import { loginUser, registerUser } from '../services/auth';
import { signJWT } from '../utils/jwt';
import { handleError } from '../utils/errors';
import { requireAuth, Env } from '../middlewares/auth';

export const authRouter = new Hono<Env>()
  .post('/register', zValidator('json', ZRegister), async (c) => {
    try {
      const body = c.req.valid('json');
      const user = await registerUser(body);
      const token = await signJWT(user);
      
      setCookie(c, 'ttpl_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });

      return c.json({ success: true, data: user }, 201);
    } catch (e) {
      return handleError(c, e, 'Registration failed');
    }
  })
  .post('/login', zValidator('json', ZLogin), async (c) => {
    try {
      const body = c.req.valid('json');
      const user = await loginUser(body);
      const token = await signJWT(user);
      
      setCookie(c, 'ttpl_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });

      return c.json({ success: true, data: user }, 200);
    } catch (e) {
      return handleError(c, e, 'Login failed');
    }
  })
  .post('/logout', (c) => {
    deleteCookie(c, 'ttpl_session');
    return c.json({ success: true, message: 'Logged out successfully' });
  })
  .get('/me', requireAuth, (c) => {
    const user = c.get('user')!;
    return c.json({ success: true, data: user });
  });
