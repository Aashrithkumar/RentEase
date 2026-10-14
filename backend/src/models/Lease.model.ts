import { Schema } from 'mongoose';
import { ref, money, model } from './schema.helpers.js';
const leaseSchema = new Schema({
    property: { ...ref('Property'), index: false }, owner: ref('User'), tenant: ref('User'), application: { ...ref('RentalApplication'), unique: true },
    startDate: { type: Date, required: true }, endDate: { type: Date, required: true }, rentPaise: money, depositPaise: money,
    status: { type: String, enum: ['Pending', 'Active', 'Expired', 'Terminated'], default: 'Pending' },
    document: { publicId: String, name: String },
}, { timestamps: true });
leaseSchema.index({ property: 1 }, { unique: true, partialFilterExpression: { status: 'Active' } });
export const Lease = model('Lease', leaseSchema);
