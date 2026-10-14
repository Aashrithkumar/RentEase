import { rateLimit } from 'express-rate-limit';
export const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' } });
export const apiLimiter = rateLimit({ windowMs: 60000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, message: 'Too many requests. Please try again shortly.' } });
