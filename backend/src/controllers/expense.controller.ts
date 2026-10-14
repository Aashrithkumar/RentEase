import { z } from 'zod';
import { cloudinary } from '../config/cloudinary.js';
import { Property, Expense } from '../models/index.js';
import { ApiError, asyncRoute, ok } from '../utils/http.js';
import { objectId, date } from '../utils/validation.js';
import { uploadBuffer } from '../services/storage.service.js';
import { expenseInput } from '../utils/expense.validation.js';
import { listRecords } from '../services/record.service.js';
export const getExpense = asyncRoute(async (req, res) => {
    const q = z.object({ property: objectId.optional(), from: date.optional(), to: date.optional() }).parse(req.query);
    const extra: Record<string, unknown> = { archived: false };
    if (q.property)
        extra.property = q.property;
    if (q.from || q.to)
        extra.expenseDate = { ...(q.from ? { $gte: new Date(q.from) } : {}), ...(q.to ? { $lte: new Date(q.to) } : {}) };
    ok(res, await listRecords(req, Expense, extra, 'property'));
});
export const postExpense = asyncRoute(async (req, res) => { const input = expenseInput.strict().parse(req.body); if (!await Property.exists({ _id: input.property, owner: req.user!.id }))
    throw new ApiError(403, 'Choose a property you own.'); ok(res, await Expense.create({ ...input, owner: req.user!.id }), 201); });
export const patchExpenseById = asyncRoute(async (req, res) => {
    const input = expenseInput.omit({ property: true }).partial().strict().parse(req.body);
    const r = await Expense.findOneAndUpdate({ _id: req.params.id, owner: req.user!.id, archived: false }, input, { new: true, runValidators: true });
    if (!r)
        throw new ApiError(404, 'Expense not found.');
    ok(res, r);
});
export const deleteExpenseById = asyncRoute(async (req, res) => { const r = await Expense.findOneAndUpdate({ _id: req.params.id, owner: req.user!.id }, { archived: true }); if (!r)
    throw new ApiError(404, 'Expense not found.'); ok(res, { message: 'Expense archived.' }); });
export const postExpenseReceiptById = asyncRoute(async (req, res) => {
    const expense = await Expense.findOne({ _id: req.params.id, owner: req.user!.id });
    if (!expense)
        throw new ApiError(404, 'Expense not found.');
    if (!req.file || req.file.buffer.toString('ascii', 0, 5) !== '%PDF-')
        throw new ApiError(400, 'Choose a PDF receipt under 10 MB.');
    const file = await uploadBuffer(req.file.buffer, { folder: `rentease/private/${req.user!.id}`, resource_type: 'raw', type: 'authenticated' });
    expense.receipt = { publicId: file.public_id, name: req.file.originalname.slice(0, 180) };
    await expense.save();
    ok(res, { name: expense.receipt.name });
});
export const getExpenseReceiptById = asyncRoute(async (req, res) => {
    const expense = await Expense.findOne({ _id: req.params.id, owner: req.user!.id });
    if (!expense?.receipt?.publicId)
        throw new ApiError(404, 'No receipt uploaded.');
    ok(res, { url: cloudinary.utils.private_download_url(expense.receipt.publicId, '', { resource_type: 'raw', type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 60, attachment: true }) });
});
