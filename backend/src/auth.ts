import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { config } from './config.js';

export type AuthUser = { id: string; role: Role; email: string; name: string };

declare module 'express-serve-static-core' {
  interface Request {
    authUser?: AuthUser;
  }
}

export function signJwt(user: AuthUser): string {
  return jwt.sign(user, config.jwtSecret, { expiresIn: '12h' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    req.authUser = jwt.verify(header.slice(7), config.jwtSecret) as AuthUser;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.authUser || !roles.includes(req.authUser.role)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }
    next();
  };
}
