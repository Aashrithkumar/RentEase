import { Schema } from 'mongoose';
import { ref, money, model } from './schema.helpers.js';
export const Payment = model('Payment', new Schema({
    obligation: ref('RentObligation'), lease: ref('Lease'), owner: ref('User'), tenant: ref('User'), property: ref('Property'),
    amountPaise: money, paymentDate: { type: Date, required: true }, method: { type: String, enum: ['UPI', 'Bank Transfer', 'Cash', 'Cheque'], required: true },
    reference: { type: String, maxlength: 160, default: '' }, recordedBy: ref('User'),
}, { timestamps: true }));
