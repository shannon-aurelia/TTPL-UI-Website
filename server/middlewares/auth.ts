import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifyJWT } from '../utils/jwt';
import { AppError } from '../utils/errors';

export interface UserContext {
  id: string;
  email: string;
  role: string;
  name: string;
}

export type Env = {
  Variables: {
    user: UserContext | null;
  };
};

export async function authMiddleware(c: Context<Env>, next: Next) {
  const token = getCookie(c, 'ttpl_session');
  if (!token) {
    c.set('user', null);
    return next();
  }

  const payload = await verifyJWT(token);
  c.set('user', payload);
  return next();
}

export async function requireAuth(c: Context<Env>, next: Next) {
  const user = c.get('user');
  if (!user) {
    throw new AppError('Unauthorized access: please login first', 401, 'UNAUTHORIZED');
  }
  return next();
}

export function requireRole(role: 'student' | 'assistant' | 'admin') {
  return async (c: Context<Env>, next: Next) => {
    const user = c.get('user');
    if (!user) {
      throw new AppError('Unauthorized access: please login first', 401, 'UNAUTHORIZED');
    }
    
    const hasAccess = 
      user.role === 'admin' ||
      (user.role === 'assistant' && role !== 'admin') ||
      (user.role === role);

    if (!hasAccess) {
      throw new AppError('Forbidden: you do not have permission to access this resource', 403, 'FORBIDDEN');
    }
    return next();
  };
}
