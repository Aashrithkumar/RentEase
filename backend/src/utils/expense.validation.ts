import { z } from 'zod';
import { objectId, paise, date } from '../utils/validation.js';
export const expenseInput = z.object({ property: objectId, category: z.enum(['Maintenance', 'Plumbing', 'Electricity', 'Cleaning', 'Repairs', 'Taxes', 'Other']), description: z.string().trim().min(5).max(2000), amountPaise: paise.positive(), expenseDate: date });
