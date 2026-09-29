import { z } from 'zod';
import { FAB_STATUSES } from '../fabrication/status.js';
import { ORDER_STATUSES } from '../orders/status.js';

export const uuid = z.string().uuid();
export const pincode = z.string().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit PIN code');
export const phone = z.string().regex(/^(\+91)?[6-9][0-9]{9}$/, 'Enter a valid Indian mobile number');
export const latitude = z.coerce.number().min(-90).max(90);
export const longitude = z.coerce.number().min(-180).max(180);

export const pagination = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const statusList = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').map((s) => s.trim()) : null))
  .pipe(z.array(z.enum(ORDER_STATUSES)).nullable());

export const reason = z.string().trim().min(3).max(300);

export const deliveryAddress = z.object({
  fullName: z.string().trim().min(2).max(80),
  phone,
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional(),
  landmark: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(80),
  pincode,
  latitude,
  longitude,
});

export const fabStatusList = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').map((s) => s.trim()) : null))
  .pipe(z.array(z.enum(FAB_STATUSES)).nullable());

export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);
