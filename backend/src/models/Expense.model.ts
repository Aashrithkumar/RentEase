import { Schema } from 'mongoose';
import { ref, money, model } from './schema.helpers.js';
export const Expense = model('Expense', new Schema({
    property: ref('Property'), owner: ref('User'), category: { type: String, enum: ['Maintenance', 'Plumbing', 'Electricity', 'Cleaning', 'Repairs', 'Taxes', 'Other'], required: true },
    description: { type: String, required: true, maxlength: 2000 }, amountPaise: money, expenseDate: { type: Date, required: true }, archived: { type: Boolean, default: false },
    receipt: { publicId: String, name: String },
}, { timestamps: true }));
