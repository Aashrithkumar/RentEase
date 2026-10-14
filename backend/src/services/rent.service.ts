import mongoose from 'mongoose';
import { RentObligation } from '../models/index.js';
export async function generateObligations(lease: any, session: mongoose.ClientSession) {
    const start = new Date(lease.startDate), end = new Date(lease.endDate);
    let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const endMonth = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1);
    while (cursor.getTime() <= endMonth) {
        const month = cursor.toISOString().slice(0, 7);
        const dueDate = new Date(Math.max(cursor.getTime(), start.getTime()) - 330 * 60000);
        await RentObligation.updateOne({ lease: lease._id, month }, { $setOnInsert: { lease: lease._id, owner: lease.owner, tenant: lease.tenant, property: lease.property, month, dueDate, amountDuePaise: lease.rentPaise, amountPaidPaise: 0 } }, { upsert: true, session });
        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    }
}
export function obligationStatus(item: {
    amountPaidPaise: number;
    amountDuePaise: number;
    dueDate: Date;
}) {
    return item.amountPaidPaise >= item.amountDuePaise ? 'Paid' : item.dueDate < new Date() ? 'Overdue' : item.amountPaidPaise > 0 ? 'Partially Paid' : 'Pending';
}
