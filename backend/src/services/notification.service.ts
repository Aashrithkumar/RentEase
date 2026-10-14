import mongoose from 'mongoose';
import { User, Notification } from '../models/index.js';
import { sendEmail } from '../services/email.service.js';
export async function notify(user: unknown, title: string, message: string, link = '/dashboard/notifications', key?: string, session?: mongoose.ClientSession) {
    if (key)
        return Notification.updateOne({ user, key }, { $setOnInsert: { user, title, message, link, key } }, { upsert: true, session });
    return Notification.create([{ user, title, message, link }], { session });
}
export async function alertEmail(userId: unknown, title: string, message: string) { const user = await User.findById(userId).lean(); if (user)
    await sendEmail(user.email, title, message); }
