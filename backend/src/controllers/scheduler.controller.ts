import { timingSafeEqual } from 'node:crypto';
import { Lease, Property, RentObligation, User } from '../models/index.js';
import { ApiError, asyncRoute, ok } from '../utils/http.js';
import { hash } from '../utils/tokens.js';
import { notify } from '../services/notification.service.js';
import { transaction } from '../config/database.js';
import { sendEmail } from '../services/email.service.js';
export const postSchedulerReminders = asyncRoute(async (req, res) => {
    const secret = process.env.SCHEDULER_SECRET;
    const supplied = req.headers.authorization?.replace(/^Bearer /, '') || '';
    if (!secret || !timingSafeEqual(Buffer.from(hash(secret)), Buffer.from(hash(supplied))))
        throw new ApiError(401, 'Scheduler authorization required.');
    let expired = 0, reminders = 0;
    const now = new Date();
    // Bounded batches permit retries by Cloud Scheduler without unbounded collection reads.
    const leases = await Lease.find({ status: 'Active', endDate: { $lt: now } }).limit(200);
    for (const lease of leases)
        await transaction(async (session) => {
            const changed = await Lease.updateOne({ _id: lease._id, status: 'Active' }, { status: 'Expired' }, { session });
            if (!changed.modifiedCount)
                return;
            await Property.updateOne({ _id: lease.property, status: 'Occupied' }, { status: 'Available' }, { session });
            await notify(lease.tenant, 'Lease expired', 'Your lease has ended.', '/dashboard/leases', `expired:${lease._id}`, session);
            expired++;
        });
    const due = await RentObligation.find({ cancelled: { $ne: true }, dueDate: { $gte: now, $lte: new Date(Date.now() + 3 * 86400000) }, $expr: { $lt: ['$amountPaidPaise', '$amountDuePaise'] } }).limit(200).lean();
    const expiring = await Lease.find({ status: 'Active', endDate: { $gte: now, $lte: new Date(Date.now() + 30 * 86400000) } }).limit(200).lean();
    for (const item of [...due.map(x => ({ user: x.tenant, key: `rent:${x._id}`, title: 'Rent due soon', message: `Your rent for ${x.month} is due soon.`, link: '/dashboard/payments' })), ...expiring.flatMap(x => [x.tenant, x.owner].map(user => ({ user, key: `lease:${x._id}`, title: 'Lease expiring soon', message: 'Your lease ends within 30 days.', link: '/dashboard/leases' })))]) {
        const result = await notify(item.user, item.title, item.message, item.link, item.key);
        if (result && 'upsertedCount' in result && result.upsertedCount) {
            const user = await User.findById(item.user);
            if (user)
                await sendEmail(user.email, item.title, item.message);
            reminders++;
        }
    }
    ok(res, { expired, reminders, moreExpired: await Lease.exists({ status: 'Active', endDate: { $lt: now } }) !== null });
});
