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
const DEFAULT_ADMIN_EMAILS = new Set(['oumgupta555@gmail.com']);

const knownUsers = new Map<string, number>();
const USER_SYNC_TTL_MS = 10 * 60 * 1000;

async function syncUser(user: AuthUser) {
  const seenAt = knownUsers.get(user.uid);
  if (seenAt && Date.now() - seenAt < USER_SYNC_TTL_MS) return;

  const emailLower = (user.email ?? '').toLowerCase();
  const effectiveRole = (emailLower && DEFAULT_ADMIN_EMAILS.has(emailLower)) ? 'admin' : user.role;

  await pool.query(
    `insert into users (id, email, full_name, role) values ($1, $2, $3, $4)
     on conflict (id) do update set email = coalesce(excluded.email, users.email),
                                    full_name = coalesce(users.full_name, excluded.full_name),
                                    role = case when users.role = 'admin' or excluded.role = 'admin' then 'admin' else excluded.role end`,
    [user.uid, user.email, user.name, effectiveRole],
  );

  user.role = effectiveRole;
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
    const emailLower = (token.email ?? '').toLowerCase();

    let role = toRole(token.role);
    if (emailLower && DEFAULT_ADMIN_EMAILS.has(emailLower)) {
      role = 'admin';
    } else {
      const { rows: dbUsers } = await pool.query<{ role: Role }>(
        `select role from users where id = $1 or lower(email) = $2 limit 1`,
        [token.uid, emailLower],
      );
      if (dbUsers[0]?.role) {
        role = toRole(dbUsers[0].role);
      }
    }

    const { rows: storeRows } = await pool.query<{ id: string }>(
      `select id from stores where owner_id = $1 limit 1`,
      [token.uid],
    );
    const storeId = storeRows[0]?.id || (typeof token.storeId === 'string' ? token.storeId : null);

    return {
      uid: token.uid,
      email: token.email ?? null,
      name: (token.name as string | undefined) ?? null,
      role,
      storeId,
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
  const emailLower = (user.email ?? '').toLowerCase();
  if (emailLower && DEFAULT_ADMIN_EMAILS.has(emailLower)) {
    return next();
  }
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
  if (!config.AUTH_DEV_BYPASS && config.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      await firebaseAuth.setCustomUserClaims(uid, storeId ? { role, storeId } : { role });
    } catch (err) {
      logger.warn({ err, uid, role }, 'Could not set Firebase custom claims, relying on database role');
    }
  }
  knownUsers.delete(uid);
}

export async function revokeSessions(uid: string) {
  if (!config.AUTH_DEV_BYPASS && config.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      await firebaseAuth.revokeRefreshTokens(uid);
    } catch {}
  }
}
