import mongoose from 'mongoose';
import { config } from '../config/env.js';
import dns from 'node:dns';
if (process.argv.includes('--public-dns'))
    dns.setServers(['1.1.1.1', '8.8.8.8']);
try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
    console.log('MongoDB Atlas connection verified.');
    await mongoose.disconnect();
}
catch (e) {
    const error = e as Error & {
        code?: string;
    };
    console.error(`MongoDB connection diagnostic: ${error.name} ${error.code || ''}`);
    console.error(error.message.replace(/mongodb(?:\+srv)?:\/\/[^@\s]+@/g, 'mongodb+srv://[redacted]@'));
    process.exitCode = 1;
}
