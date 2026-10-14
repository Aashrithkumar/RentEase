import { z } from 'zod';
import { RentObligation, Payment } from '../models/index.js';
import { ApiError, asyncRoute, ok } from '../utils/http.js';
import { scope } from '../middleware/auth.middleware.js';
import { objectId, paise, date } from '../utils/validation.js';
import { notify } from '../services/notification.service.js';
import { transaction } from '../config/database.js';
import { listRecords } from '../services/record.service.js';
export const getPayment = asyncRoute(async (req, res) => ok(res, await listRecords(req, Payment)));
export const getPaymentById = asyncRoute(async (req, res) => { const r = await Payment.findOne({ _id: req.params.id, ...scope(req) }).populate('property tenant', 'title city name').lean(); if (!r)
    throw new ApiError(404, 'Payment not found.'); ok(res, r); });
export const postPayment = asyncRoute(async (req, res) => {
    const input = z.object({ obligation: objectId, amountPaise: paise.positive(), paymentDate: date.refine(d => Date.parse(d) <= Date.now(), 'Payment date cannot be in the future.'), method: z.enum(['UPI', 'Bank Transfer', 'Cash', 'Cheque']), reference: z.string().max(160).default('') }).strict().parse(req.body);
    const payment = await transaction(async (session) => {
        const obligation = await RentObligation.findOneAndUpdate({ _id: input.obligation, owner: req.user!.id, cancelled: { $ne: true }, $expr: { $lte: [{ $add: ['$amountPaidPaise', input.amountPaise] }, '$amountDuePaise'] } }, { $inc: { amountPaidPaise: input.amountPaise } }, { new: true, session });
        if (!obligation)
            throw new ApiError(409, 'This obligation is unavailable or the amount exceeds the remaining balance.');
        const [p] = await Payment.create([{ ...input, owner: req.user!.id, tenant: obligation.tenant, property: obligation.property, lease: obligation.lease, recordedBy: req.user!.id }], { session });
        await notify(p.tenant, 'Payment recorded by owner', `Your owner recorded receipt of ₹${(input.amountPaise / 100).toLocaleString('en-IN')} for ${obligation.month}. This is a manual record.`, '/dashboard/payments', undefined, session);
        return p;
    });
    ok(res, payment, 201);
});
