import mongoose from 'mongoose';
import { scope } from '../middleware/auth.middleware.js';
import { pageSchema } from '../utils/validation.js';
export async function listRecords(req: Parameters<typeof scope>[0], model: mongoose.Model<any>, extra: Record<string, unknown> = {}, populate = 'property tenant') {
    const q = pageSchema.parse(req.query);
    const filter = { ...scope(req), ...extra };
    const [items, total] = await Promise.all([model.find(filter).populate(populate, 'title city images name email phone').sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(), model.countDocuments(filter)]);
    return { items, total, page: q.page, pages: Math.ceil(total / q.limit) };
}
