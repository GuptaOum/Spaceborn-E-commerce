import type { NextFunction, Request, Response } from 'express';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { config } from './config.js';
import { pool, type Db } from './db/pool.js';
import { forbidden, HttpError, unauthorized } from './errors.js';
import { logger } from './logger.js';

export type Role = 'customer' | 'vendor' | 'admin';

export interface AuthUser {
  uid: string;
  email: string | null;
  name: string | null;
  role: Role;
  storeId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function initFirebase(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  if (config.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return initializeApp({ credential: cert(JSON.parse(config.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  }
  logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set: token verification works, session cookies and role changes will fail');
  return initializeApp({ projectId: config.FIREBASE_PROJECT_ID });
}

export const firebaseAuth: Auth = getAuth(initFirebase());

const ROLES: Role[] = ['customer', 'vendor', 'admin'];
const toRole = (value: unknown): Role => (ROLES.includes(value as Role) ? (value as Role) : 'customer');

const knownUsers = new Map<string, number>();
const USER_SYNC_TTL_MS = 10 * 60 * 1000;

async function syncUser(user: AuthUser) {
  const seenAt = knownUsers.get(user.uid);
  if (seenAt && Date.now() - seenAt < USER_SYNC_TTL_MS) return;
  await pool.query(
    `insert into users (id, email, full_name) values ($1, $2, $3)
     on conflict (id) do update set email = coalesce(excluded.email, users.email),
                                    full_name = coalesce(users.full_name, excluded.full_name)`,
    [user.uid, user.email, user.name],
  );
  knownUsers.set(user.uid, Date.now());
}

async function resolveUser(header: string | undefined): Promise<AuthUser | null> {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!value) return null;

  if (scheme === 'Dev' && config.AUTH_DEV_BYPASS && !config.isProd) {
    const [uid, role, storeId] = value.split(':');
    if (!uid) return null;
    return { uid, email: `${uid}@dev.local`, name: uid, role: toRole(role), storeId: storeId || null };
  }
  if (scheme !== 'Bearer') return null;

  try {
    const token = await firebaseAuth.verifyIdToken(value);
    return {
      uid: token.uid,
      email: token.email ?? null,
      name: (token.name as string | undefined) ?? null,
      role: toRole(token.role),
      storeId: typeof token.storeId === 'string' ? token.storeId : null,
    };
  } catch {
    throw new HttpError(401, 'invalid_token', 'Your session has expired. Please sign in again.');
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const user = await resolveUser(req.headers.authorization);
  if (!user) throw unauthorized();
  await syncUser(user);
  req.user = user;
  next();
}

// Token claims live for up to an hour; the database role is checked so a demotion is immediate.
export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const user = currentUser(req);
  if (user.role !== 'admin') throw forbidden();
  const { rows } = await pool.query<{ role: Role }>('select role from users where id = $1', [user.uid]);
  if (rows[0]?.role !== 'admin') throw forbidden();
  next();
}

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

export async function setRoleClaims(uid: string, role: Role, storeId: string | null, db: Db = pool) {
  await db.query('update users set role = $2 where id = $1', [uid, role]);
  if (!config.AUTH_DEV_BYPASS) {
    await firebaseAuth.setCustomUserClaims(uid, storeId ? { role, storeId } : { role });
  }
  knownUsers.delete(uid);
}

export async function revokeSessions(uid: string) {
  if (!config.AUTH_DEV_BYPASS) await firebaseAuth.revokeRefreshTokens(uid);
}
