import mongoose from 'mongoose';
import { Property, Lease, Payment, RentObligation, Expense, MaintenanceRequest, RentalApplication } from '../models/index.js';
import { asyncRoute, ok } from '../utils/http.js';
import { scope } from '../middleware/auth.middleware.js';
function aggregateScope(req: Parameters<typeof scope>[0]) { return Object.fromEntries(Object.entries(scope(req)).map(([k, v]) => [k, new mongoose.Types.ObjectId(String(v))])); }
async function overview(req: Parameters<typeof scope>[0]) {
    const filter = scope(req), af = aggregateScope(req), now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 330 * 60000);
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 330 * 60000);
    const [properties, leases, payments, expenses, outstanding, pendingApplications, maintenance, recentPayments, recentApplications, upcomingLeases] = await Promise.all([
        req.user!.role === 'tenant' ? Promise.resolve([]) : Property.aggregate([{ $match: { ...(req.user!.role === 'owner' ? { owner: new mongoose.Types.ObjectId(req.user!.id) } : {}), status: { $ne: 'Archived' } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
        Lease.find({ ...filter, status: 'Active' }).populate('property', 'title city images').limit(10).lean(),
        Payment.aggregate([{ $match: { ...af, paymentDate: { $gte: monthStart, $lt: monthEnd } } }, { $group: { _id: null, total: { $sum: '$amountPaise' } } }]),
        Expense.aggregate([{ $match: { ...af, archived: false, expenseDate: { $gte: monthStart, $lt: monthEnd } } }, { $group: { _id: null, total: { $sum: '$amountPaise' } } }]),
        RentObligation.aggregate([{ $match: { ...af, cancelled: { $ne: true }, dueDate: { $lt: monthEnd } } }, { $group: { _id: null, total: { $sum: { $subtract: ['$amountDuePaise', '$amountPaidPaise'] } } } }]),
        RentalApplication.countDocuments({ ...filter, status: 'Pending' }), MaintenanceRequest.countDocuments({ ...filter, status: { $nin: ['Completed', 'Cancelled'] } }),
        Payment.find(filter).populate('property tenant', 'title name').sort({ paymentDate: -1 }).limit(5).lean(),
        RentalApplication.find(filter).populate('property tenant', 'title name').sort({ createdAt: -1 }).limit(5).lean(),
        Lease.find({ ...filter, status: 'Active', endDate: { $gte: now, $lte: new Date(Date.now() + 30 * 86400000) } }).populate('property tenant', 'title name').limit(5).lean(),
    ]);
    const totalProperties = properties.reduce((sum, x) => sum + x.count, 0);
    return { totalProperties, occupied: properties.find(x => x._id === 'Occupied')?.count || 0, vacant: properties.find(x => x._id === 'Available')?.count || 0, rentCollectedPaise: payments[0]?.total || 0, expensesPaise: expenses[0]?.total || 0, outstandingPaise: outstanding[0]?.total || 0, pendingApplications, pendingMaintenance: maintenance, activeLeases: leases, recentPayments, recentApplications, upcomingLeases, occupancy: properties.map(x => ({ name: x._id, value: x.count })) };
}
export const getAnalyticsOverview = asyncRoute(async (req, res) => ok(res, await overview(req)));
export const getAnalyticsRevenue = asyncRoute(async (req, res) => {
    const filter = aggregateScope(req);
    const start = new Date();
    start.setUTCMonth(start.getUTCMonth() - 11, 1);
    start.setUTCHours(0, 0, 0, 0);
    const [income, expenses] = await Promise.all([
        Payment.aggregate([{ $match: { ...filter, paymentDate: { $gte: start } } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$paymentDate', timezone: 'Asia/Kolkata' } }, total: { $sum: '$amountPaise' } } }]),
        Expense.aggregate([{ $match: { ...filter, archived: false, expenseDate: { $gte: start } } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$expenseDate', timezone: 'Asia/Kolkata' } }, total: { $sum: '$amountPaise' } } }]),
    ]);
    const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)); const key = d.toISOString().slice(0, 7); return { month: key, incomePaise: income.find(x => x._id === key)?.total || 0, expensesPaise: expenses.find(x => x._id === key)?.total || 0 }; });
    ok(res, months);
});
export const getAnalyticsExpenses = asyncRoute(async (req, res) => ok(res, await Expense.aggregate([{ $match: { ...aggregateScope(req), archived: false } }, { $group: { _id: '$category', amountPaise: { $sum: '$amountPaise' } } }])));
export const getAnalyticsOccupancy = asyncRoute(async (req, res) => ok(res, (await overview(req)).occupancy));
export const getAnalyticsPaymentStatus = asyncRoute(async (req, res) => ok(res, await RentObligation.aggregate([
    { $match: { ...aggregateScope(req), cancelled: { $ne: true }, dueDate: { $lte: new Date() } } }, { $project: { status: { $cond: [{ $gte: ['$amountPaidPaise', '$amountDuePaise'] }, 'Paid', { $cond: [{ $lt: ['$dueDate', new Date()] }, 'Overdue', { $cond: [{ $gt: ['$amountPaidPaise', 0] }, 'Partially Paid', 'Pending'] }] }] } } }, { $group: { _id: '$status', value: { $sum: 1 } } }
])));
