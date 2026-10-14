import mongoose from 'mongoose';
import type { RequestHandler } from 'express';
export const health: RequestHandler = (_req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ success: mongoose.connection.readyState === 1, service: 'RentEase API', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
