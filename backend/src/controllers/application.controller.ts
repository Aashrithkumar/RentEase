import { z } from 'zod';
import { Property, RentalApplication } from '../models/index.js';
import { ApiError, asyncRoute, ok } from '../utils/http.js';
import { scope } from '../middleware/auth.middleware.js';
import { objectId } from '../utils/validation.js';
import { notify, alertEmail } from '../services/notification.service.js';
import { transaction } from '../config/database.js';
import { listRecords } from '../services/record.service.js';
export const getApplication = asyncRoute(async (req, res) => ok(res, await listRecords(req, RentalApplication)));
export const getApplicationById = asyncRoute(async (req, res) => { const r = await RentalApplication.findOne({ _id: req.params.id, ...scope(req) }).populate('property tenant', 'title city name email phone').lean(); if (!r)
    throw new ApiError(404, 'Application not found.'); ok(res, r); });
export const postApplication = asyncRoute(async (req, res) => {
    const input = z.object({ property: objectId, message: z.string().trim().min(10).max(2000) }).strict().parse(req.body);
    const application = await transaction(async (session) => {
        const property = await Property.findOneAndUpdate({ _id: input.property, status: 'Available', moderationStatus: { $ne: 'hidden' } }, { $set: { updatedAt: new Date() } }, { session, new: true });
        if (!property)
            throw new ApiError(409, 'This property is no longer available.');
        const [r] = await RentalApplication.create([{ ...input, tenant: req.user!.id, owner: property.owner }], { session });
        await notify(property.owner, 'New rental application', `${req.user!.name} applied for ${property.title}.`, '/dashboard/applications', undefined, session);
        return r;
    });
    await alertEmail(application.owner, 'New rental application', `${req.user!.name} has applied for your property. Review it in RentEase.`);
    ok(res, application, 201);
});
export const patchApplicationStatusById = asyncRoute(async (req, res) => {
    const { status } = z.object({ status: z.enum(['Approved', 'Rejected', 'Withdrawn']) }).parse(req.body);
    if (req.user!.role === 'admin' || (req.user!.role === 'tenant' && status !== 'Withdrawn') || (req.user!.role === 'owner' && status === 'Withdrawn'))
        throw new ApiError(403, 'You cannot make this status change.');
    const result = await transaction(async (session) => {
        const r = await RentalApplication.findOneAndUpdate({ _id: req.params.id, ...scope(req), status: 'Pending' }, { status }, { new: true, session });
        if (!r)
            throw new ApiError(409, 'Only your pending applications can be updated.');
        if (status === 'Approved' && !await Property.exists({ _id: r.property, status: 'Available' }).session(session))
            throw new ApiError(409, 'Property is no longer available.');
        const target = status === 'Withdrawn' ? r.owner : r.tenant;
        await notify(target, `Application ${status.toLowerCase()}`, `Your rental application has been ${status.toLowerCase()}.`, '/dashboard/applications', undefined, session);
        return r;
    });
    await alertEmail(status === 'Withdrawn' ? result.owner : result.tenant, `Application ${status.toLowerCase()}`, 'View your application in RentEase for details.');
    ok(res, result);
});
