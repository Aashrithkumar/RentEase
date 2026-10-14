import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import multer from 'multer';
import { ApiError } from '../utils/http.js';
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError)
        return res.status(400).json({ success: false, message: err.issues[0]?.message || 'Invalid input.', errors: err.flatten() });
    if (err instanceof ApiError)
        return res.status(err.status).json({ success: false, message: err.message });
    if (err?.code === 11000)
        return res.status(409).json({ success: false, message: 'This record already exists. Check for a duplicate email, active application or lease.' });
    if (err instanceof multer.MulterError)
        return res.status(400).json({ success: false, message: err.message });
    if (err instanceof mongoose.Error.ValidationError)
        return res.status(400).json({ success: false, message: 'Record validation failed.' });
    if (err instanceof SyntaxError && 'body' in err)
        return res.status(400).json({ success: false, message: 'Invalid JSON.' });
    console.error('Request failed:', err?.name || 'Unknown error');
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
};
export const notFound: RequestHandler = (_req, _res, next) => next(new ApiError(404, 'Endpoint not found.'));
