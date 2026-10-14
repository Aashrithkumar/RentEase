import { z } from 'zod';
import mongoose from 'mongoose';
import { User, Property, Lease, RentalApplication, MaintenanceRequest, Payment, RefreshToken, AuditLog } from '../models/index.js';
import { auth } from '../middleware/auth.middleware.js';
import { asyncRoute, ok, ApiError } from '../utils/http.js';
import { pageSchema, escapeRegex } from '../utils/validation.js';
import { publicUser } from '../utils/user.js';
import { transaction } from '../config/database.js';
import { notify } from '../services/notification.service.js';
const searchSchema = pageSchema.extend({ q: z.string().trim().max(150).default('') });
const reasonSchema = z.string().trim().max(500).default('');
const userFields = 'name email phone role status demo createdAt updatedAt';
async function moderate(req: Parameters<typeof auth>[0], action: 'hide' | 'publish' | 'archive', reason: string) {
    return transaction(async (session) => {
        const p = await Property.findById(req.params.id).session(session);
        if (!p)
            throw new ApiError(404, 'Property not found.');
        if (p.status === 'Archived')
            throw new ApiError(409, 'Archived properties must be managed by their owner.');
        if (action === 'archive' && await Lease.exists({ property: p._id, status: 'Active' }).session(session))
            throw new ApiError(409, 'An active lease prevents archiving. You can hide the public listing instead.');
        const before = action === 'archive' ? p.status : p.moderationStatus || 'visible';
        const after = action === 'archive' ? 'Archived' : action === 'hide' ? 'hidden' : 'visible';
        if (before === after)
            return p;
        if (action === 'archive')
            p.status = 'Archived';
        else
            p.moderationStatus = action === 'hide' ? 'hidden' : 'visible';
        p.moderationReason = reason;
        p.moderatedBy = new mongoose.Types.ObjectId(req.user!.id);
        p.moderatedAt = new Date();
        await p.save({ session });
        await AuditLog.create([{ actor: req.user!.id, action: action === 'archive' ? 'property.archived' : action === 'hide' ? 'property.hidden' : 'property.published', target: p._id, targetType: 'Property', targetName: p.title, reason, before, after }], { session });
        await notify(p.owner, 'Listing moderation update', `${p.title} was ${action === 'hide' ? 'hidden from public search' : action === 'publish' ? 'restored to public search' : 'archived'} by an administrator.${reason ? ` Reason: ${reason}` : ''}`, '/dashboard/properties', undefined, session);
        return p;
    });
}
export const getAdminOverview = asyncRoute(async (_req, res) => {
    const [users, properties, activeLeases, pendingApplications, openMaintenance, recentUsers, recentProperties, recentActions, growth] = await Promise.all([
        User.aggregate([{ $group: { _id: '$role', total: { $sum: 1 }, suspended: { $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] } } } }]),
        Property.aggregate([{ $group: { _id: '$status', total: { $sum: 1 }, hidden: { $sum: { $cond: [{ $eq: ['$moderationStatus', 'hidden'] }, 1, 0] } } } }]),
        Lease.countDocuments({ status: 'Active' }), RentalApplication.countDocuments({ status: 'Pending' }), MaintenanceRequest.countDocuments({ status: { $nin: ['Completed', 'Cancelled'] } }),
        User.find().select(userFields).sort({ createdAt: -1 }).limit(5).lean(),
        Property.find().populate('owner', 'name email').sort({ createdAt: -1 }).limit(5).lean(),
        AuditLog.find().populate('actor', 'name').sort({ createdAt: -1, _id: -1 }).limit(5).lean(),
        User.aggregate([{ $match: { createdAt: { $gte: new Date(Date.now() - 185 * 86400000) } } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'Asia/Kolkata' } }, owners: { $sum: { $cond: [{ $eq: ['$role', 'owner'] }, 1, 0] } }, tenants: { $sum: { $cond: [{ $eq: ['$role', 'tenant'] }, 1, 0] } } } }]),
    ]);
    const now = new Date();
    const monthlyUsers = Array.from({ length: 6 }, (_, i) => { const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1)).toISOString().slice(0, 7); const row = growth.find(x => x._id === month); return { month, owners: row?.owners || 0, tenants: row?.tenants || 0 }; });
    ok(res, { totalUsers: users.reduce((n, x) => n + x.total, 0), totalOwners: users.find(x => x._id === 'owner')?.total || 0, totalTenants: users.find(x => x._id === 'tenant')?.total || 0, suspendedUsers: users.reduce((n, x) => n + x.suspended, 0), totalProperties: properties.reduce((n, x) => n + x.total, 0), hiddenProperties: properties.reduce((n, x) => n + x.hidden, 0), availableProperties: properties.find(x => x._id === 'Available')?.total || 0, activeLeases, pendingApplications, openMaintenance, propertyDistribution: properties.map(x => ({ name: x._id, value: x.total })), monthlyUsers, recentUsers, recentProperties, recentActions });
});
export const getAdminUsers = asyncRoute(async (req, res) => {
    const q = searchSchema.extend({ role: z.enum(['owner', 'tenant', 'admin']).optional(), status: z.enum(['active', 'suspended']).optional() }).parse(req.query);
    const filter: Record<string, unknown> = { ...(q.role ? { role: q.role } : {}), ...(q.status ? { status: q.status } : {}) };
    if (q.q)
        filter.$or = ['name', 'email', 'phone'].map(k => ({ [k]: new RegExp(escapeRegex(q.q), 'i') }));
    const [items, total] = await Promise.all([User.find(filter).select(userFields).sort({ createdAt: -1, _id: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(), User.countDocuments(filter)]);
    ok(res, { items, total, page: q.page, pages: Math.ceil(total / q.limit) });
});
export const getAdminUsersById = asyncRoute(async (req, res) => {
    const user = await User.findById(req.params.id).select(userFields).lean();
    if (!user)
        throw new ApiError(404, 'User not found.');
    const relationship = user.role === 'owner' ? { owner: user._id } : { tenant: user._id };
    const [properties, applications, activeLeases, recentLeases] = await Promise.all([Property.countDocuments({ owner: user._id }), RentalApplication.countDocuments(relationship), Lease.countDocuments({ ...relationship, status: 'Active' }), Lease.find(relationship).populate('property', 'title city').sort({ createdAt: -1 }).limit(5).select('property status startDate endDate').lean()]);
    ok(res, { user, summary: { properties, applications, activeLeases }, recentLeases });
});
export const patchAdminUsersStatusById = asyncRoute(async (req, res) => {
    const input = z.object({ status: z.enum(['active', 'suspended']), reason: reasonSchema }).strict().parse(req.body);
    const user = await transaction(async (session) => {
        const target = await User.findById(req.params.id).session(session);
        if (!target)
            throw new ApiError(404, 'User not found.');
        if (target.role === 'admin' || String(target._id) === req.user!.id)
            throw new ApiError(403, 'Administrator accounts are protected from suspension.');
        if (target.status === input.status)
            return target;
        const before = target.status;
        target.status = input.status;
        if (input.status === 'suspended') {
            target.tokenVersion += 1;
            await RefreshToken.updateMany({ user: target._id }, { revoked: true }, { session });
        }
        await target.save({ session });
        await AuditLog.create([{ actor: req.user!.id, action: input.status === 'suspended' ? 'user.suspended' : 'user.reactivated', target: target._id, targetType: 'User', targetName: target.name, reason: input.reason, before, after: input.status }], { session });
        return target;
    });
    ok(res, publicUser(user));
});
export const getAdminProperties = asyncRoute(async (req, res) => {
    const q = searchSchema.extend({ status: z.enum(['Available', 'Occupied', 'Unavailable', 'Archived']).optional(), moderation: z.enum(['visible', 'hidden']).optional(), city: z.string().trim().max(80).optional() }).parse(req.query);
    const filter: Record<string, unknown> = { ...(q.status ? { status: q.status } : {}), ...(q.city ? { city: new RegExp(`^${escapeRegex(q.city)}$`, 'i') } : {}), ...(q.moderation === 'hidden' ? { moderationStatus: 'hidden' } : q.moderation === 'visible' ? { moderationStatus: { $ne: 'hidden' } } : {}) };
    if (q.q)
        filter.$or = ['title', 'city', 'locality', 'address'].map(k => ({ [k]: new RegExp(escapeRegex(q.q), 'i') }));
    const [items, total] = await Promise.all([Property.find(filter).populate('owner', 'name email').sort({ createdAt: -1, _id: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(), Property.countDocuments(filter)]);
    ok(res, { items, total, page: q.page, pages: Math.ceil(total / q.limit) });
});
export const getAdminPropertiesById = asyncRoute(async (req, res) => { const property = await Property.findById(req.params.id).populate('owner', 'name email phone').lean(); if (!property)
    throw new ApiError(404, 'Property not found.'); ok(res, property); });
export const patchAdminPropertiesModerationById = asyncRoute(async (req, res) => {
    const input = z.object({ action: z.enum(['hide', 'publish', 'archive']), reason: reasonSchema }).strict().parse(req.body);
    ok(res, await moderate(req, input.action, input.reason));
});
export const patchAdminPropertiesStatusById = asyncRoute(async (req, res) => { const input = z.object({ status: z.enum(['Available', 'Unavailable']) }).parse(req.body); ok(res, await moderate(req, input.status === 'Available' ? 'publish' : 'hide', 'Changed through listing moderation.')); });
export const getAdminActivity = asyncRoute(async (req, res) => {
    const q = pageSchema.extend({ type: z.enum(['applications', 'leases', 'maintenance', 'payments']).default('applications'), status: z.string().max(30).optional() }).parse(req.query);
    const model = { applications: RentalApplication, leases: Lease, maintenance: MaintenanceRequest, payments: Payment }[q.type];
    const filter = q.status && q.type !== 'payments' ? { status: q.status } : {};
    const [items, total] = await Promise.all([(model as typeof RentalApplication).find(filter).populate('property', 'title city').populate('owner tenant', 'name email').select('-document -resolutionNotes -message -description -reference').sort({ createdAt: -1, _id: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(), (model as typeof RentalApplication).countDocuments(filter)]);
    ok(res, { items, total, page: q.page, pages: Math.ceil(total / q.limit) });
});
export const getAdminAudit = asyncRoute(async (req, res) => { const q = pageSchema.parse(req.query); const [items, total] = await Promise.all([AuditLog.find().populate('actor', 'name email').sort({ createdAt: -1, _id: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(), AuditLog.countDocuments()]); ok(res, { items, total, page: q.page, pages: Math.ceil(total / q.limit) }); });
export const getAdminAnalytics = asyncRoute(async (_req, res) => {
    const [users, properties, leases] = await Promise.all([User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]), Property.countDocuments(), Lease.countDocuments({ status: 'Active' })]);
    ok(res, { totalUsers: users.reduce((s, x) => s + x.count, 0), totalOwners: users.find(x => x._id === 'owner')?.count || 0, totalTenants: users.find(x => x._id === 'tenant')?.count || 0, totalProperties: properties, activeLeases: leases });
});
