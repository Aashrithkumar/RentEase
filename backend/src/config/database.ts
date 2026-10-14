import mongoose from 'mongoose';
import { config } from '../config/env.js';
export async function transaction<T>(fn: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession();
    try {
        return (await session.withTransaction(() => fn(session))) as T;
    }
    finally {
        await session.endSession();
    }
}
export function connectDatabase() { mongoose.set('bufferCommands', false); return mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 }); }
export const disconnectDatabase = () => mongoose.disconnect();
