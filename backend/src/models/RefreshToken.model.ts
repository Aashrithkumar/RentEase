import { Schema } from 'mongoose';
import { ref, money, model } from './schema.helpers.js';
const refreshSchema = new Schema({ user: ref('User'), hash: { type: String, unique: true, required: true }, family: { type: String, required: true }, expiresAt: { type: Date, required: true }, revoked: { type: Boolean, default: false } }, { timestamps: true });
refreshSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RefreshToken = model('RefreshToken', refreshSchema);
