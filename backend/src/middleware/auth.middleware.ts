import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/index.js';
import { ApiError, asyncRoute } from '../utils/http.js';
export interface Identity {
    id: string;
    role: 'owner' | 'tenant' | 'admin';
    name: string;
    email: string;
}
declare global {
    namespace Express {
        interface Request {
            user?: Identity;
        }
    }
}
export const auth = asyncRoute(async (req, _res, next) => {
    const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
    if (!bearer)
        throw new ApiError(401, 'Please sign in to continue.');
    let payload: jwt.JwtPayload;
    try {
        payload = jwt.verify(bearer, config.jwtSecret, { issuer: 'rentease', audience: 'rentease-web', algorithms: ['HS256'] }) as jwt.JwtPayload;
    }
    catch {
        throw new ApiError(401, 'Your session has expired. Please sign in again.');
    }
    const user = await User.findById(payload.sub).lean();
    if (!user || user.status !== 'active')
        throw new ApiError(401, 'This account is unavailable.');
    if ((payload.ver || 0) !== (user.tokenVersion || 0))
        throw new ApiError(401, 'Session revoked. Please sign in again.');
    req.user = { id: String(user._id), role: user.role as Identity['role'], name: user.name, email: user.email };
    next();
});
export const roles = (...allowed: Identity['role'][]): RequestHandler => (req, _res, next) => { if (!req.user || !allowed.includes(req.user.role))
    return next(new ApiError(403, 'You do not have permission to do this.')); next(); };
export const scope = (req: Request) => req.user!.role === 'admin' ? {} : { [req.user!.role === 'owner' ? 'owner' : 'tenant']: req.user!.id };
