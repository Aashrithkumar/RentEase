import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { config, validateConfig } from '../config/env.js';
import { User } from '../models/index.js';
validateConfig();
const input = z.object({ name: z.string().min(2).max(100), email: z.string().email().transform(s => s.toLowerCase()), password: z.string().min(12).max(128) }).parse({ name: process.env.ADMIN_NAME, email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
await mongoose.connect(config.mongoUri);
try {
    if (await User.exists({ email: input.email }))
        throw new Error('Account already exists. No account roles were changed.');
    await User.create({ ...input, role: 'admin', password: await bcrypt.hash(input.password, 12) });
    console.log('Administrator created. Remove ADMIN_PASSWORD from your environment after this command.');
}
finally {
    await mongoose.disconnect();
}
