import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { User, RefreshToken, PasswordResetToken } from '../models/index.js';
import { config } from '../config/env.js';
import { ApiError, asyncRoute, ok } from '../utils/http.js';
import { accessToken, hash, token } from '../utils/tokens.js';
import { publicUser } from '../utils/user.js';
import { transaction } from '../config/database.js';
import { sendEmail, appLink } from '../services/email.service.js';
const credentials = z.object({ email: z.string().email().max(200).transform(s => s.toLowerCase()), password: z.string().min(8).max(128) });
const cookieOptions = { httpOnly: true, secure: config.production, sameSite: (config.production ? 'none' : 'lax') as 'none' | 'lax', path: '/api/v1/auth' };
async function createSession(userId: unknown, family = randomUUID()) {
    const raw = token();
    await RefreshToken.create({ user: userId, hash: hash(raw), family, expiresAt: new Date(Date.now() + 7 * 86400000) });
    return raw;
}
export const register = asyncRoute(async (req, res) => {
    const input = credentials.extend({ name: z.string().trim().min(2).max(100), phone: z.string().regex(/^(?:\+91)?[6-9]\d{9}$/).or(z.literal('')).default(''), role: z.enum(['owner', 'tenant']) }).strict().parse(req.body);
    const user = await User.create({ ...input, password: await bcrypt.hash(input.password, 12) });
    const raw = await createSession(user._id);
    res.cookie('refreshToken', raw, { ...cookieOptions, maxAge: 7 * 86400000 });
    await sendEmail(user.email, 'Welcome to RentEase', `Hi ${user.name}, your ${user.role} account is ready.`);
    ok(res, { user: publicUser(user), accessToken: accessToken(user) }, 201);
});
export const login = asyncRoute(async (req, res) => {
    const input = credentials.parse(req.body);
    const user = await User.findOne({ email: input.email }).select('+password');
    if (!user || !await bcrypt.compare(input.password, user.password) || user.status !== 'active')
        throw new ApiError(401, 'Email or password is incorrect, or this account is unavailable.');
    const raw = await createSession(user._id);
    res.cookie('refreshToken', raw, { ...cookieOptions, maxAge: 7 * 86400000 });
    ok(res, { user: publicUser(user), accessToken: accessToken(user) });
});
export const refresh = asyncRoute(async (req, res) => {
    const raw = req.cookies.refreshToken;
    if (typeof raw !== 'string')
        throw new ApiError(401, 'Please sign in.');
    const current = await RefreshToken.findOne({ hash: hash(raw) });
    if (!current || current.expiresAt < new Date())
        throw new ApiError(401, 'Please sign in again.');
    if (current.revoked) {
        await RefreshToken.updateMany({ family: current.family }, { revoked: true });
        throw new ApiError(401, 'Session was revoked. Please sign in again.');
    }
    const user = await User.findById(current.user);
    if (!user || user.status !== 'active')
        throw new ApiError(401, 'Account unavailable.');
    const replacement = token();
    await transaction(async (session) => {
        const consumed = await RefreshToken.updateOne({ _id: current._id, revoked: false }, { revoked: true }, { session });
        if (!consumed.modifiedCount)
            throw new ApiError(401, 'Session already refreshed.');
        await RefreshToken.create([{ user: user._id, hash: hash(replacement), family: current.family, expiresAt: new Date(Date.now() + 7 * 86400000) }], { session });
    });
    res.cookie('refreshToken', replacement, { ...cookieOptions, maxAge: 7 * 86400000 });
    ok(res, { user: publicUser(user), accessToken: accessToken(user) });
});
export const logout = asyncRoute(async (req, res) => {
    if (typeof req.cookies.refreshToken === 'string') {
        const existing = await RefreshToken.findOne({ hash: hash(req.cookies.refreshToken) });
        if (existing)
            await RefreshToken.updateMany({ family: existing.family }, { revoked: true });
    }
    res.clearCookie('refreshToken', cookieOptions);
    ok(res, { message: 'Signed out.' });
});
export const getCurrentUser = asyncRoute(async (req, res) => ok(res, publicUser((await User.findById(req.user!.id))!)));
export const updateProfile = asyncRoute(async (req, res) => {
    const input = z.object({ name: z.string().trim().min(2).max(100), phone: z.string().regex(/^(?:\+91)?[6-9]\d{9}$/).or(z.literal('')) }).strict().parse(req.body);
    ok(res, publicUser((await User.findByIdAndUpdate(req.user!.id, input, { new: true, runValidators: true }))!));
});
export const changePassword = asyncRoute(async (req, res) => {
    const input = z.object({ currentPassword: z.string().max(128), password: z.string().min(8).max(128) }).parse(req.body);
    const user = (await User.findById(req.user!.id).select('+password'))!;
    if (!await bcrypt.compare(input.currentPassword, user.password))
        throw new ApiError(400, 'Current password is incorrect.');
    await transaction(async (session) => { user.password = await bcrypt.hash(input.password, 12); user.tokenVersion += 1; await user.save({ session }); await RefreshToken.updateMany({ user: user._id }, { revoked: true }, { session }); });
    res.clearCookie('refreshToken', cookieOptions);
    ok(res, { message: 'Password changed. Please sign in again.' });
});
export const forgotPassword = asyncRoute(async (req, res) => {
    const { email } = z.object({ email: z.string().email().transform(s => s.toLowerCase()) }).parse(req.body);
    const user = await User.findOne({ email, status: 'active' });
    if (user) {
        const raw = token();
        await PasswordResetToken.deleteMany({ user: user._id });
        await PasswordResetToken.create({ user: user._id, hash: hash(raw), expiresAt: new Date(Date.now() + 30 * 60000) });
        await sendEmail(user.email, 'Reset your RentEase password', 'Use this link within 30 minutes. If you did not request a reset, ignore this message.', { label: 'Reset password', url: appLink(`/reset-password?token=${raw}`) });
    }
    ok(res, { message: 'If that account exists, a password reset link has been sent. In development, check the local email outbox.' });
});
export const resetPassword = asyncRoute(async (req, res) => {
    const input = z.object({ token: z.string().length(64), password: z.string().min(8).max(128) }).parse(req.body);
    await transaction(async (session) => {
        const record = await PasswordResetToken.findOneAndDelete({ hash: hash(input.token), expiresAt: { $gt: new Date() } }, { session });
        if (!record)
            throw new ApiError(400, 'This reset link is invalid or expired.');
        await User.updateOne({ _id: record.user }, { $set: { password: await bcrypt.hash(input.password, 12) }, $inc: { tokenVersion: 1 } }, { session });
        await RefreshToken.updateMany({ user: record.user }, { revoked: true }, { session });
    });
    ok(res, { message: 'Password reset. You can sign in now.' });
});
