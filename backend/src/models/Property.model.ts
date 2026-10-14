import { Schema } from 'mongoose';
import { ref, money, model } from './schema.helpers.js';
const propertySchema = new Schema({
    owner: ref('User'), title: { type: String, required: true, maxlength: 180 }, description: { type: String, required: true, maxlength: 6000 },
    type: { type: String, enum: ['Apartment', 'Independent House', 'Villa', 'Studio', 'PG / Shared Accommodation'], required: true },
    address: { type: String, required: true }, locality: { type: String, default: '' }, city: { type: String, required: true },
    state: { type: String, required: true }, pincode: { type: String, required: true },
    bedrooms: { type: Number, required: true, min: 0 }, bathrooms: { type: Number, required: true, min: 1 }, area: { type: Number, required: true, min: 1 },
    rentPaise: money, depositPaise: money, amenities: [String],
    images: [{ url: String, publicId: String }],
    status: { type: String, enum: ['Available', 'Occupied', 'Unavailable', 'Archived'], default: 'Available' }, demo: { type: Boolean, default: false },
    moderationStatus: { type: String, enum: ['visible', 'hidden'], default: 'visible' }, moderationReason: { type: String, default: '', maxlength: 500 }, moderatedAt: Date, moderatedBy: ref('User', false),
}, { timestamps: true });
propertySchema.index({ city: 1, status: 1, rentPaise: 1 });
propertySchema.index({ createdAt: -1 });
export const Property = model('Property', propertySchema);
