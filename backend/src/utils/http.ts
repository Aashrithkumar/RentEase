import type { Request, Response, NextFunction, RequestHandler } from 'express';
export class ApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
export const asyncRoute = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler => (req, res, next) => { Promise.resolve(fn(req, res, next)).catch(next); };
export const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });
