import { z } from 'zod';
import { cloudinary } from '../config/cloudinary.js';
import { Property, Lease } from '../models/index.js';
import { ApiError, asyncRoute, ok } from '../utils/http.js';
import { pageSchema, escapeRegex } from '../utils/validation.js';
import { transaction } from '../config/database.js';
import { propertyInput } from '../utils/property.validation.js';
import { uploadBuffer } from '../services/storage.service.js';
export const listProperties = asyncRoute(async (req, res) => {
    const q = pageSchema.extend({ q: z.string().max(150).optional(), city: z.string().max(80).optional(), type: propertyInput.shape.type.optional(), minRent: z.coerce.number().min(0).max(1e10).optional(), maxRent: z.coerce.number().min(0).max(1e10).optional(), bedrooms: z.coerce.number().int().min(0).max(20).optional(), bathrooms: z.coerce.number().int().min(1).max(20).optional(), amenities: z.string().max(400).optional(), sort: z.enum(['newest', 'rent-asc', 'rent-desc']).default('newest') }).parse(req.query);
    const filter: Record<string, unknown> = { status: 'Available', moderationStatus: { $ne: 'hidden' } };
    if (req.query.ids !== undefined) {
        const ids = z.string().max(2500).parse(req.query.ids).split(',').filter(Boolean);
        if (ids.length > 100 || ids.some(id => !/^[a-f\d]{24}$/i.test(id)))
            throw new ApiError(400, 'Invalid shortlist.');
        filter._id = { $in: ids };
    }
    if (q.city)
        filter.city = new RegExp(`^${escapeRegex(q.city)}$`, 'i');
    if (q.q)
        filter.$or = ['city', 'locality', 'title', 'address'].map(field => ({ [field]: new RegExp(escapeRegex(q.q!), 'i') }));
    if (q.type)
        filter.type = q.type;
    if (q.bedrooms !== undefined)
        filter.bedrooms = q.bedrooms;
    if (q.bathrooms)
        filter.bathrooms = { $gte: q.bathrooms };
    if (q.amenities)
        filter.amenities = { $all: q.amenities.split(',').filter(Boolean) };
    if (q.minRent !== undefined || q.maxRent !== undefined)
        filter.rentPaise = { ...(q.minRent !== undefined ? { $gte: Math.round(q.minRent * 100) } : {}), ...(q.maxRent !== undefined ? { $lte: Math.round(q.maxRent * 100) } : {}) };
    const sort: Record<string, 1 | -1> = q.sort === 'rent-asc' ? { rentPaise: 1, _id: 1 } : q.sort === 'rent-desc' ? { rentPaise: -1, _id: 1 } : { createdAt: -1, _id: -1 };
    const [items, total] = await Promise.all([Property.find(filter).select('-owner -__v -moderatedBy -moderationReason -moderatedAt').sort(sort).skip((q.page - 1) * q.limit).limit(q.limit).lean(), Property.countDocuments(filter)]);
    ok(res, { items, total, page: q.page, pages: Math.ceil(total / q.limit) });
});
export const listOwnedProperties = asyncRoute(async (req, res) => {
    const p = pageSchema.parse(req.query);
    const filter = { owner: req.user!.id };
    ok(res, { items: await Property.find(filter).sort({ createdAt: -1 }).skip((p.page - 1) * p.limit).limit(p.limit).lean(), total: await Property.countDocuments(filter), page: p.page });
});
export const getOwnedProperty = asyncRoute(async (req, res) => { const property = await Property.findOne({ _id: req.params.id, owner: req.user!.id }).lean(); if (!property)
    throw new ApiError(404, 'Property not found.'); ok(res, property); });
export const getProperty = asyncRoute(async (req, res) => { const property = await Property.findOne({ _id: req.params.id, moderationStatus: { $ne: 'hidden' }, status: { $in: ['Available', 'Occupied'] } }).select('-owner -__v -moderatedBy -moderationReason -moderatedAt').lean(); if (!property)
    throw new ApiError(404, 'Property not found.'); ok(res, property); });
export const createProperty = asyncRoute(async (req, res) => ok(res, await Property.create({ ...propertyInput.parse(req.body), owner: req.user!.id }), 201));
export const updateProperty = asyncRoute(async (req, res) => {
    const input = propertyInput.partial().parse(req.body);
    const property = await transaction(async (session) => {
        const record = await Property.findOne({ _id: req.params.id, owner: req.user!.id }).session(session);
        if (!record)
            throw new ApiError(404, 'Property not found.');
        if (input.status && await Lease.exists({ property: record._id, status: 'Active' }).session(session))
            throw new ApiError(409, 'Availability is controlled by this property’s active lease.');
        Object.assign(record, input);
        await record.save({ session });
        return record;
    });
    ok(res, property);
});
export const archiveProperty = asyncRoute(async (req, res) => {
    await transaction(async (session) => {
        if (await Lease.exists({ property: req.params.id, status: 'Active' }).session(session))
            throw new ApiError(409, 'Terminate the active lease before archiving this property.');
        const record = await Property.findOneAndUpdate({ _id: req.params.id, owner: req.user!.id }, { status: 'Archived' }, { session });
        if (!record)
            throw new ApiError(404, 'Property not found.');
    });
    ok(res, { message: 'Property archived.' });
});
export const uploadPropertyImages = asyncRoute(async (req, res) => {
    const record = await Property.findOne({ _id: req.params.id, owner: req.user!.id });
    if (!record)
        throw new ApiError(404, 'Property not found.');
    const files = req.files as Express.Multer.File[];
    if (!files?.length)
        throw new ApiError(400, 'Choose JPEG, PNG or WebP images under 5 MB.');
    if (record.images.length + files.length > 12)
        throw new ApiError(400, 'A property can have up to 12 images.');
    const created: {
        url: string;
        publicId: string;
    }[] = [];
    try {
        for (const file of files) {
            const b = file.buffer;
            const jpeg = b[0] === 255 && b[1] === 216;
            const png = b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
            const webp = b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
            if (!jpeg && !png && !webp)
                throw new ApiError(400, 'An uploaded file is not a supported image.');
            const result = await uploadBuffer(b, { folder: `rentease/${req.user!.id}/${record._id}`, resource_type: 'image', allowed_formats: ['jpg', 'png', 'webp'] });
            created.push({ url: result.secure_url, publicId: result.public_id });
        }
        record.images.push(...created);
        await record.save();
        ok(res, record);
    }
    catch (e) {
        await Promise.allSettled(created.map(x => cloudinary.uploader.destroy(x.publicId)));
        throw e;
    }
});
