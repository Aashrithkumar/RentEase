import { z } from 'zod';
import { cloudinary } from '../config/cloudinary.js';
import { Property, RentalApplication, Lease, RentObligation } from '../models/index.js';
import { ApiError, asyncRoute, ok } from '../utils/http.js';
import { scope } from '../middleware/auth.middleware.js';
import { notify } from '../services/notification.service.js';
import { transaction } from '../config/database.js';
import { uploadBuffer } from '../services/storage.service.js';
import { leaseInput } from '../utils/lease.validation.js';
import { generateObligations } from '../services/rent.service.js';
import { listRecords } from '../services/record.service.js';
export const getLease = asyncRoute(async (req, res) => ok(res, await listRecords(req, Lease)));
export const getLeaseById = asyncRoute(async (req, res) => { const r = await Lease.findOne({ _id: req.params.id, ...scope(req) }).populate('property tenant', 'title city name email phone').lean(); if (!r)
    throw new ApiError(404, 'Lease not found.'); ok(res, r); });
export const postLease = asyncRoute(async (req, res) => {
    const input = leaseInput.parse(req.body);
    const lease = await transaction(async (session) => {
        const application = await RentalApplication.findOne({ _id: input.application, owner: req.user!.id, status: 'Approved' }).session(session);
        if (!application)
            throw new ApiError(409, 'Choose one of your approved applications.');
        const property = await Property.findOne({ _id: application.property, owner: req.user!.id, status: 'Available' }).session(session);
        if (!property)
            throw new ApiError(409, 'Property is unavailable.');
        if (input.status === 'Active' && (Date.parse(input.startDate) > Date.now() || Date.parse(input.endDate) < Date.now()))
            throw new ApiError(400, 'An active lease must include today. Create a pending lease for future dates.');
        const [lease] = await Lease.create([{ ...input, property: property._id, owner: req.user!.id, tenant: application.tenant }], { session });
        if (input.status === 'Active') {
            property.status = 'Occupied';
            await property.save({ session });
            await generateObligations(lease, session);
        }
        await notify(lease.tenant, 'Your lease is ready', `Your lease for ${property.title} is ${lease.status.toLowerCase()}.`, '/dashboard/leases', undefined, session);
        return lease;
    });
    ok(res, lease, 201);
});
export const patchLeaseById = asyncRoute(async (req, res) => {
    const { status } = z.object({ status: z.enum(['Active', 'Terminated']) }).strict().parse(req.body);
    const lease = await transaction(async (session) => {
        const record = await Lease.findOne({ _id: req.params.id, owner: req.user!.id }).session(session);
        if (!record)
            throw new ApiError(404, 'Lease not found.');
        if (status === 'Active' && record.status !== 'Pending')
            throw new ApiError(409, 'Only a pending lease can be activated.');
        if (status === 'Terminated' && !['Pending', 'Active'].includes(record.status))
            throw new ApiError(409, 'Lease has already ended.');
        const property = (await Property.findById(record.property).session(session))!;
        if (status === 'Active') {
            if (record.startDate > new Date() || record.endDate < new Date())
                throw new ApiError(400, 'Active lease dates must include today.');
            if (property.status !== 'Available' || await Lease.exists({ property: property._id, status: 'Active' }).session(session))
                throw new ApiError(409, 'This property already has an active lease or is unavailable.');
            property.status = 'Occupied';
            await generateObligations(record, session);
        }
        else if (record.status === 'Active') {
            property.status = 'Available';
            const nextMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1) - 330 * 60000);
            await RentObligation.updateMany({ lease: record._id, dueDate: { $gte: nextMonth }, amountPaidPaise: 0 }, { cancelled: true }, { session });
        }
        record.status = status;
        await record.save({ session });
        await property.save({ session });
        await notify(record.tenant, `Lease ${status.toLowerCase()}`, `Your lease has been ${status.toLowerCase()}.`, '/dashboard/leases', undefined, session);
        return record;
    });
    ok(res, lease);
});
export const postLeaseDocumentById = asyncRoute(async (req, res) => {
    const lease = await Lease.findOne({ _id: req.params.id, owner: req.user!.id });
    if (!lease)
        throw new ApiError(404, 'Lease not found.');
    if (!req.file || req.file.buffer.toString('ascii', 0, 5) !== '%PDF-')
        throw new ApiError(400, 'Choose a PDF document under 10 MB.');
    const file = await uploadBuffer(req.file.buffer, { folder: `rentease/private/${req.user!.id}`, resource_type: 'raw', type: 'authenticated' });
    const old = lease.document?.publicId;
    lease.document = { publicId: file.public_id, name: req.file.originalname.slice(0, 180) };
    await lease.save();
    if (old)
        await cloudinary.uploader.destroy(old, { resource_type: 'raw', type: 'authenticated' }).catch(() => undefined);
    ok(res, { name: lease.document.name });
});
export const getLeaseDocumentById = asyncRoute(async (req, res) => {
    const lease = await Lease.findOne({ _id: req.params.id, ...scope(req) });
    if (!lease?.document?.publicId)
        throw new ApiError(404, 'No lease document uploaded.');
    if (!process.env.CLOUDINARY_API_SECRET)
        throw new ApiError(503, 'Document storage is not configured.');
    const url = cloudinary.utils.private_download_url(lease.document.publicId, '', { resource_type: 'raw', type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 60, attachment: true });
    ok(res, { url });
});
