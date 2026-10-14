import { z } from 'zod';
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid record ID');
export const paise = z.number().int().safe().nonnegative().max(1000000000000);
export const date = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).refine(s => Number.isFinite(Date.parse(s)) && (s.length !== 10 || new Date(s).toISOString().slice(0, 10) === s), 'Invalid date');
export const pageSchema = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(50).default(12) });
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
