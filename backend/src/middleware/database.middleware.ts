import mongoose from 'mongoose';
import { ApiError } from '../utils/http.js';
import type { RequestHandler } from 'express';
export const requireDatabase: RequestHandler = (_req, _res, next) => mongoose.connection.readyState === 1 ? next() : next(new ApiError(503, 'Database is unavailable. Please try again shortly.'));
