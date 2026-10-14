import { Schema } from 'mongoose';
import { ref, money, model } from './schema.helpers.js';
const obligationSchema = new Schema({
    lease: ref('Lease'), owner: ref('User'), tenant: ref('User'), property: ref('Property'),
    month: { type: String, required: true }, dueDate: { type: Date, required: true }, amountDuePaise: money,
    amountPaidPaise: { ...money, default: 0 }, cancelled: { type: Boolean, default: false },
}, { timestamps: true });
obligationSchema.index({ lease: 1, month: 1 }, { unique: true });
export const RentObligation = model('RentObligation', obligationSchema);
