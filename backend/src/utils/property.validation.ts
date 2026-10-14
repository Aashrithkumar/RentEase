import { z } from 'zod';
import { paise } from '../utils/validation.js';
export const propertyInput = z.object({
    title: z.string().trim().min(5).max(180), description: z.string().trim().min(20).max(6000), type: z.enum(['Apartment', 'Independent House', 'Villa', 'Studio', 'PG / Shared Accommodation']),
    address: z.string().trim().min(5).max(250), locality: z.string().trim().max(120).default(''), city: z.string().trim().min(2).max(80), state: z.string().trim().min(2).max(80), pincode: z.string().regex(/^[1-9]\d{5}$/),
    bedrooms: z.number().int().min(0).max(20), bathrooms: z.number().int().min(1).max(20), area: z.number().int().positive().max(1000000), rentPaise: paise.positive(), depositPaise: paise,
    amenities: z.array(z.string().max(60)).max(30).default([]), status: z.enum(['Available', 'Unavailable']).default('Available'),
}).strict();
