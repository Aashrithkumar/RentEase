import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('hex');
export const accessToken = (user: {
    _id: unknown;
    tokenVersion?: number;
}) => jwt.sign({ sub: String(user._id), ver: user.tokenVersion || 0 }, config.jwtSecret, { expiresIn: '15m', issuer: 'rentease', audience: 'rentease-web' });
