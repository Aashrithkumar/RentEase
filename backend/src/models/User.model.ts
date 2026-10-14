import { Schema } from 'mongoose';
import { ref, money, model } from './schema.helpers.js';
const userSchema = new Schema({
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    password: { type: String, required: true, select: false }, phone: { type: String, default: '' },
    role: { type: String, enum: ['owner', 'tenant', 'admin'], required: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' }, demo: { type: Boolean, default: false }, tokenVersion: { type: Number, default: 0 },
}, { timestamps: true });
export const User = model('User', userSchema);
