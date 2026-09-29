import { Router } from 'express';
import { z } from 'zod';
import { currentUser, requireAuth } from '../auth.js';
import { pool } from '../db/pool.js';
import { parse } from '../errors.js';
import { phone } from './schemas.js';

export const meRouter = Router();
meRouter.use(requireAuth);

meRouter.get('/', async (req, res) => {
  const user = currentUser(req);
  const { rows } = await pool.query(
    `select u.id, u.email, u.full_name as "fullName", u.phone, u.role,
            s.id as "storeId", s.status as "storeStatus"
       from users u left join stores s on s.owner_id = u.id
      where u.id = $1`,
    [user.uid],
  );
  res.json({ user: { ...rows[0], tokenRole: user.role } });
});

meRouter.patch('/', async (req, res) => {
  const body = parse(z.object({ fullName: z.string().trim().min(2).max(80).optional(), phone: phone.optional() }), req.body);
  const { rows } = await pool.query(
    `update users set full_name = coalesce($2, full_name), phone = coalesce($3, phone)
      where id = $1 returning id, email, full_name as "fullName", phone, role`,
    [currentUser(req).uid, body.fullName ?? null, body.phone ?? null],
  );
  res.json({ user: rows[0] });
});
