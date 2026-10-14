import { ApiError } from '../utils/http.js';
import type { RequestHandler } from 'express';
import { allowedOrigins } from '../config/cors.js';
export const validateOrigin: RequestHandler = (req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && !allowedOrigins.includes(req.headers.origin))
        return next(new ApiError(403, 'Origin not allowed.'));
    if (req.path.startsWith('/api/v1/auth') && req.method === 'POST' && !req.is('application/json'))
        return next(new ApiError(415, 'Use application/json.'));
    next();
};
