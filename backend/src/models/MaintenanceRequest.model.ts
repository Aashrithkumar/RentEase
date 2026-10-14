import { Schema } from 'mongoose';
import { ref, money, model } from './schema.helpers.js';
export const MaintenanceRequest = model('MaintenanceRequest', new Schema({
    property: ref('Property'), lease: ref('Lease'), owner: ref('User'), tenant: ref('User'),
    title: { type: String, required: true, maxlength: 180 }, description: { type: String, required: true, maxlength: 4000 },
    category: { type: String, enum: ['Electrical', 'Plumbing', 'Appliances', 'Cleaning', 'Structural', 'Other'], required: true },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
    status: { type: String, enum: ['Pending', 'Assigned', 'In Progress', 'Completed', 'Cancelled'], default: 'Pending' }, resolutionNotes: { type: String, default: '', maxlength: 4000 },
}, { timestamps: true }));
