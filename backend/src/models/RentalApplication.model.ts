import { Schema } from 'mongoose';
import { ref, money, model } from './schema.helpers.js';
const applicationSchema = new Schema({
    property: ref('Property'), owner: ref('User'), tenant: ref('User'), message: { type: String, maxlength: 2000, default: '' },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Withdrawn'], default: 'Pending' },
}, { timestamps: true });
applicationSchema.index({ property: 1, tenant: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['Pending', 'Approved'] } } });
export const RentalApplication = model('RentalApplication', applicationSchema);
