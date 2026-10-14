import { z } from 'zod';
import { objectId, paise, date } from '../utils/validation.js';
export const leaseInput = z.object({ application: objectId, startDate: date, endDate: date, rentPaise: paise.positive(), depositPaise: paise, status: z.enum(['Pending', 'Active']).default('Pending') }).strict().refine(x => Date.parse(x.endDate) > Date.parse(x.startDate), { message: 'End date must be after start date.', path: ['endDate'] }).refine(x => Date.parse(x.endDate) - Date.parse(x.startDate) <= 5 * 366 * 86400000, 'Leases can span at most five years.');
