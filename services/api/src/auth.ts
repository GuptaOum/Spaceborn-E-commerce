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

/** Which cities an admin may act on. `regions` are lower-cased store cities; null means all of them. */
export interface AdminScope {
  email: string;
  regions: string[] | null;
  isOwner: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      admin?: AdminScope;
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
// Break-glass owners. They are also seeded into admin_members, so the team can never lock itself out.
export const DEFAULT_ADMIN_EMAILS = new Set(['oumgupta555@gmail.com']);

export const normalizeEmail = (email: string | null | undefined) => (email ?? '').trim().toLowerCase();

/**
 * Admin access is decided by the admin_members table, never by a token claim, so adding or
 * removing a teammate takes effect on their next request.
 */
export async function loadAdminScope(email: string | null | undefined, db: Db = pool): Promise<AdminScope | null> {
  const lower = normalizeEmail(email);
  if (!lower) return null;
  const { rows } = await db.query<{ regions: string[] | null; is_owner: boolean }>(
    'select regions, is_owner from admin_members where email = $1',
    [lower],
  );
  const breakGlass = DEFAULT_ADMIN_EMAILS.has(lower);
  if (rows[0]) return { email: lower, regions: rows[0].regions, isOwner: rows[0].is_owner || breakGlass };
  if (breakGlass) return { email: lower, regions: null, isOwner: true };
  return null;
}

const knownUsers = new Map<string, number>();
const USER_SYNC_TTL_MS = 10 * 60 * 1000;

async function syncUser(user: AuthUser) {
  const seenAt = knownUsers.get(user.uid);
  if (seenAt && Date.now() - seenAt < USER_SYNC_TTL_MS) return;

  // 'admin' is only ever persisted for team members; a forged or stale admin claim is downgraded.
  const isAdmin = (await loadAdminScope(user.email)) !== null;
  const effectiveRole: Role = isAdmin ? 'admin' : user.role === 'admin' ? 'customer' : user.role;

  await pool.query(
    `insert into users (id, email, full_name, role) values ($1, $2, $3, $4)
     on conflict (id) do update set email = coalesce(excluded.email, users.email),
                                    full_name = coalesce(users.full_name, excluded.full_name),
                                    role = excluded.role`,
    [user.uid, user.email, user.name, effectiveRole],
  );

  user.role = effectiveRole;
  knownUsers.set(user.uid, Date.now());
}

export function forgetUser(uid: string) {
  knownUsers.delete(uid);
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
    const emailLower = normalizeEmail(token.email);

    let role = toRole(token.role);
    if (await loadAdminScope(emailLower)) {
      role = 'admin';
    } else {
      const { rows: dbUsers } = await pool.query<{ role: Role }>(`select role from users where id = $1 limit 1`, [token.uid]);
      const dbRole = dbUsers[0]?.role ? toRole(dbUsers[0].role) : null;
      // A stale users.role = 'admin' (member removed) never grants access.
      if (dbRole && dbRole !== 'admin') role = dbRole;
      else if (role === 'admin') role = 'customer';
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

// Token claims live for up to an hour; membership is read on every request so removal is immediate.
export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const user = currentUser(req);
  const scope = await loadAdminScope(user.email);
  if (!scope) throw forbidden();
  user.role = 'admin';
  req.admin = scope;
  next();
}

/** Team management: only owners. */
export function requireOwner(req: Request, _res: Response, next: NextFunction) {
  if (!adminScope(req).isOwner) throw forbidden('Only an owner can manage the admin team');
  next();
}

/** Company-wide data (master catalog, audit log): admins without a regional restriction. */
export function requireGlobalAdmin(req: Request, _res: Response, next: NextFunction) {
  if (adminScope(req).regions !== null) throw forbidden('This action needs an admin with access to all regions');
  next();
}

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function adminScope(req: Request): AdminScope {
  if (!req.admin) throw forbidden();
  return req.admin;
}

/** SQL parameter for `($n::text[] is null or lower(btrim(city)) = any($n))`. */
export const scopeCities = (scope: AdminScope): string[] | null => scope.regions;

export const inScope = (scope: AdminScope, city: string | null | undefined) =>
  scope.regions === null || (!!city && scope.regions.includes(city.trim().toLowerCase()));

export async function setRoleClaims(uid: string, role: Role, storeId: string | null, db: Db = pool) {
  await db.query('update users set role = $2 where id = $1', [uid, role]);
  if (!config.AUTH_DEV_BYPASS && config.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      await firebaseAuth.setCustomUserClaims(uid, storeId ? { role, storeId } : { role });
    } catch (err) {
      logger.warn({ err, uid, role }, 'Could not set Firebase custom claims, relying on database role');
    }
  }
  forgetUser(uid);
}

export async function revokeSessions(uid: string) {
  if (!config.AUTH_DEV_BYPASS && config.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      await firebaseAuth.revokeRefreshTokens(uid);
    } catch {}
  }
}
