import { Notification } from '../models/index.js';
import { ApiError, asyncRoute, ok } from '../utils/http.js';
import { pageSchema } from '../utils/validation.js';
export const getNotification = asyncRoute(async (req, res) => {
    const q = pageSchema.parse(req.query);
    const filter = { user: req.user!.id };
    ok(res, { items: await Notification.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(), total: await Notification.countDocuments(filter), unread: await Notification.countDocuments({ ...filter, read: false }), page: q.page });
});
export const patchNotificationReadAll = asyncRoute(async (req, res) => { await Notification.updateMany({ user: req.user!.id, read: false }, { read: true }); ok(res, { message: 'All notifications marked as read.' }); });
export const patchNotificationReadById = asyncRoute(async (req, res) => { const r = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user!.id }, { read: true }, { new: true }); if (!r)
    throw new ApiError(404, 'Notification not found.'); ok(res, r); });
