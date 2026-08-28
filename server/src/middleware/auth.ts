import type { Request, Response, NextFunction } from 'express';
import { verifyJwt, loadUser, type UserWithPerms } from '../lib/auth.js';
import { HttpError } from '../lib/zodError.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserWithPerms;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return next(new HttpError(401, 'missing_token'));

  try {
    const payload = verifyJwt(token);
    const user = loadUser(payload.sub);
    if (!user || !user.is_active) throw new Error('inactive user');
    req.user = user;
    next();
  } catch (e) {
    next(new HttpError(401, 'invalid_token', (e as Error).message));
  }
}

export function requirePerm(perm: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new HttpError(401, 'missing_token'));
    if (req.user.permissions.includes('system.admin') || req.user.permissions.includes(perm)) {
      next();
    } else {
      next(new HttpError(403, 'forbidden', { required: perm }));
    }
  };
}