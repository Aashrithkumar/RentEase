import { Schema } from 'mongoose';
import { ref, money, model } from './schema.helpers.js';
const resetSchema = new Schema({ user: ref('User'), hash: { type: String, unique: true, required: true }, expiresAt: { type: Date, required: true } }, { timestamps: true });
resetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const PasswordResetToken = model('PasswordResetToken', resetSchema);
