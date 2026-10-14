import { config } from '../config/env.js';
import { ApiError } from '../utils/http.js';
import type { CorsOptions } from 'cors';
export const allowedOrigins = [config.frontendUrl, ...(!config.production ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : [])];
export const corsOptions: CorsOptions = { origin: (origin, cb) => !origin || allowedOrigins.includes(origin) ? cb(null, true) : cb(new ApiError(403, 'Origin not allowed.')), credentials: true };
