import { z } from 'zod';
import { Lease, MaintenanceRequest } from '../models/index.js';
import { ApiError, asyncRoute, ok } from '../utils/http.js';
import { scope } from '../middleware/auth.middleware.js';
import { objectId } from '../utils/validation.js';
import { notify, alertEmail } from '../services/notification.service.js';
import { transaction } from '../config/database.js';
import { listRecords } from '../services/record.service.js';
export const getMaintenance = asyncRoute(async (req, res) => {
    const priority = z.enum(['Low', 'Medium', 'High', 'Urgent']).optional().parse(req.query.priority);
    ok(res, await listRecords(req, MaintenanceRequest, priority ? { priority } : {}));
});
export const getMaintenanceById = asyncRoute(async (req, res) => { const r = await MaintenanceRequest.findOne({ _id: req.params.id, ...scope(req) }).populate('property tenant', 'title city name').lean(); if (!r)
    throw new ApiError(404, 'Request not found.'); ok(res, r); });
export const postMaintenance = asyncRoute(async (req, res) => {
    const input = z.object({ lease: objectId, title: z.string().trim().min(5).max(180), description: z.string().trim().min(10).max(4000), category: z.enum(['Electrical', 'Plumbing', 'Appliances', 'Cleaning', 'Structural', 'Other']), priority: z.enum(['Low', 'Medium', 'High', 'Urgent']) }).strict().parse(req.body);
    const result = await transaction(async (session) => {
        const lease = await Lease.findOne({ _id: input.lease, tenant: req.user!.id, status: 'Active', endDate: { $gte: new Date() } }).session(session);
        if (!lease)
            throw new ApiError(403, 'You need an active lease for this property.');
        const [r] = await MaintenanceRequest.create([{ ...input, property: lease.property, owner: lease.owner, tenant: req.user!.id }], { session });
        await notify(lease.owner, 'New maintenance request', input.title, '/dashboard/maintenance', undefined, session);
        return r;
    });
    ok(res, result, 201);
});
export const patchMaintenanceById = asyncRoute(async (req, res) => {
    const input = z.object({ status: z.enum(['Assigned', 'In Progress', 'Completed', 'Cancelled']), resolutionNotes: z.string().max(4000).default('') }).strict().parse(req.body);
    if (req.user!.role === 'admin' || (req.user!.role === 'tenant' && input.status !== 'Cancelled'))
        throw new ApiError(403, 'Only the owner can manage requests.');
    const result = await transaction(async (session) => {
        const r = await MaintenanceRequest.findOne({ _id: req.params.id, ...scope(req) }).session(session);
        if (!r)
            throw new ApiError(404, 'Request not found.');
        if (['Completed', 'Cancelled'].includes(r.status))
            throw new ApiError(409, 'This request is already closed.');
        if (req.user!.role === 'tenant' && r.status !== 'Pending')
            throw new ApiError(409, 'Only a pending request can be cancelled.');
        r.status = input.status;
        if (req.user!.role === 'owner')
            r.resolutionNotes = input.resolutionNotes;
        await r.save({ session });
        await notify(req.user!.role === 'owner' ? r.tenant : r.owner, 'Maintenance updated', `${r.title}: ${r.status}`, '/dashboard/maintenance', undefined, session);
        return r;
    });
    await alertEmail(req.user!.role === 'owner' ? result.tenant : result.owner, 'Maintenance updated', `${result.title}: ${result.status}`);
    ok(res, result);
});
