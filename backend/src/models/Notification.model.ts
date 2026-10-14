import { Schema } from 'mongoose';
import { ref, money, model } from './schema.helpers.js';
const notificationSchema = new Schema({
    user: ref('User'), title: { type: String, required: true }, message: { type: String, required: true }, read: { type: Boolean, default: false },
    key: String, link: { type: String, default: '/dashboard/notifications' },
}, { timestamps: true });
notificationSchema.index({ user: 1, key: 1 }, { unique: true, partialFilterExpression: { key: { $type: 'string' } } });
export const Notification = model('Notification', notificationSchema);
