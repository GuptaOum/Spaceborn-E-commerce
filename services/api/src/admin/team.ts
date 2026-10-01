import type { Request } from 'express';
import { z } from 'zod';
import { adminScope, currentUser, DEFAULT_ADMIN_EMAILS, forgetUser, normalizeEmail, revokeSessions, type AdminScope } from '../auth.js';
import { pool, withTransaction } from '../db/pool.js';
import { conflict, notFound, unprocessable } from '../errors.js';
import { logger } from '../logger.js';

export interface AdminMember {
  email: string;
  displayName: string | null;
  regions: string[] | null;
  isOwner: boolean;
  addedBy: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  /** Set once the person has signed in at least once. */
  userId: string | null;
  lastSeenAt: string | null;
}

const MEMBER_COLUMNS = `
  m.email, m.display_name as "displayName", m.regions, m.is_owner as "isOwner", m.added_by as "addedBy", m.note,
  m.created_at as "createdAt", m.updated_at as "updatedAt", u.id as "userId", u.updated_at as "lastSeenAt"`;
const MEMBER_FROM = `from admin_members m left join users u on lower(btrim(u.email)) = m.email`;

export const memberEmail = z.string().trim().toLowerCase().email().max(200);

/** Store cities, lower-cased and de-duplicated. An empty list is rejected: use null for "all regions". */
export const regionList = z
  .array(z.string().trim().min(2).max(60))
  .min(1)
  .max(50)
  .transform((cities) => [...new Set(cities.map((c) => c.toLowerCase()))]);

export async function listMembers(): Promise<AdminMember[]> {
  const { rows } = await pool.query<AdminMember>(`select ${MEMBER_COLUMNS} ${MEMBER_FROM} order by m.is_owner desc, m.created_at`);
  return rows;
}

/** Cities that currently have a store, so the panel can offer real choices. */
export async function listRegions(): Promise<{ city: string; stores: number }[]> {
  const { rows } = await pool.query<{ city: string; stores: number }>(
    `select lower(btrim(city)) as city, count(*)::int as stores from stores where status <> 'rejected'
      group by lower(btrim(city)) order by 1`,
  );
  return rows;
}

export async function addMember(
  input: { email: string; displayName?: string; regions: string[] | null; isOwner: boolean; note?: string },
  actor: AdminScope,
) {
  if (input.isOwner && input.regions !== null) throw unprocessable('owner_scope', 'Owners always have access to every region');
  const { rows } = await pool.query<AdminMember>(
    `with inserted as (
       insert into admin_members (email, display_name, regions, is_owner, added_by, note)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (email) do nothing
       returning *
     )
     select ${MEMBER_COLUMNS} from inserted m left join users u on lower(btrim(u.email)) = m.email`,
    [input.email, input.displayName ?? null, input.regions, input.isOwner, actor.email, input.note ?? null],
  );
  if (!rows[0]) throw conflict(`${input.email} is already on the admin team`);
  // If they already have an account, make the role visible immediately.
  await pool.query(`update users set role = 'admin' where lower(btrim(email)) = $1`, [input.email]);
  return rows[0];
}

export async function updateMember(
  email: string,
  patch: { displayName?: string | null; regions?: string[] | null; isOwner?: boolean; note?: string | null },
  actor: AdminScope,
) {
  const lower = normalizeEmail(email);
  const { rows: current } = await pool.query<{ is_owner: boolean; regions: string[] | null }>(
    'select is_owner, regions from admin_members where email = $1',
    [lower],
  );
  if (!current[0]) throw notFound('Admin not found');
  const isOwner = patch.isOwner ?? current[0].is_owner;
  const regions = patch.regions === undefined ? current[0].regions : patch.regions;
  if (isOwner && regions !== null) throw unprocessable('owner_scope', 'Owners always have access to every region');
  if (lower === actor.email && !isOwner) throw conflict('You cannot remove your own owner access');
  if (DEFAULT_ADMIN_EMAILS.has(lower) && (!isOwner || regions !== null)) {
    throw conflict('The founding owner cannot be restricted');
  }
  const { rows } = await pool.query<AdminMember>(
    `with updated as (
       update admin_members set display_name = $2, regions = $3, is_owner = $4, note = $5 where email = $1 returning *
     )
     select ${MEMBER_COLUMNS} from updated m left join users u on lower(btrim(u.email)) = m.email`,
    [lower, patch.displayName === undefined ? null : patch.displayName, regions, isOwner, patch.note === undefined ? null : patch.note],
  );
  if (!rows[0]) throw notFound('Admin not found');
  return rows[0];
}

export async function removeMember(email: string, actor: AdminScope) {
  const lower = normalizeEmail(email);
  if (lower === actor.email) throw conflict('You cannot remove yourself. Ask another owner.');
  if (DEFAULT_ADMIN_EMAILS.has(lower)) throw conflict('The founding owner cannot be removed');
  return withTransaction(async (c) => {
    const { rows } = await c.query('delete from admin_members where email = $1 returning email', [lower]);
    if (!rows[0]) throw notFound('Admin not found');
    const owners = await c.query<{ n: number }>(`select count(*)::int as n from admin_members where is_owner`);
    if ((owners.rows[0]?.n ?? 0) === 0) throw conflict('At least one owner must remain');
    const { rows: users } = await c.query<{ id: string }>(
      `update users set role = 'customer' where lower(btrim(email)) = $1 and role = 'admin' returning id`,
      [lower],
    );
    for (const u of users) {
      forgetUser(u.id);
      await revokeSessions(u.id);
    }
    return { email: lower, removed: true };
  });
}

/** Every admin decision is recorded; a failure to record never fails the decision. */
export async function audit(
  req: Request,
  action: string,
  target: { type: string; id: string | null; city?: string | null },
  detail: Record<string, unknown> = {},
) {
  try {
    const user = currentUser(req);
    await pool.query(
      `insert into admin_audit_log (actor_id, actor_email, action, target_type, target_id, city, detail)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [user.uid, adminScope(req).email, action, target.type, target.id, target.city ?? null, JSON.stringify(detail)],
    );
  } catch (err) {
    logger.warn({ err, action }, 'admin audit write failed');
  }
}

export async function listAudit(limit: number, cities: string[] | null) {
  const { rows } = await pool.query(
    `select id, actor_email as "actorEmail", action, target_type as "targetType", target_id as "targetId", city, detail,
            created_at as "createdAt"
       from admin_audit_log
      where ($2::text[] is null or lower(btrim(city)) = any($2))
      order by created_at desc limit $1`,
    [limit, cities],
  );
  return rows;
}
