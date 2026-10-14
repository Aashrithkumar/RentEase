import { Schema } from 'mongoose';
import { ref, money, model } from './schema.helpers.js';
const auditSchema = new Schema({
    actor: ref('User'), action: { type: String, enum: ['user.suspended', 'user.reactivated', 'property.hidden', 'property.published', 'property.archived'], required: true },
    target: { type: Schema.Types.ObjectId, required: true }, targetType: { type: String, enum: ['User', 'Property'], required: true }, targetName: { type: String, required: true },
    reason: { type: String, maxlength: 500, default: '' }, before: { type: String, required: true }, after: { type: String, required: true },
}, { timestamps: true });
auditSchema.index({ createdAt: -1 });
export const AuditLog = model('AuditLog', auditSchema);
