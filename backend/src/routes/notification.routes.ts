import { Router } from 'express';
import { idParam } from '../middleware/validation.middleware.js';
import { getNotification, patchNotificationReadAll, patchNotificationReadById } from '../controllers/notification.controller.js';
const router = Router();
router.get('/', getNotification);
router.patch('/read-all', patchNotificationReadAll);
router.patch('/:id/read', idParam, patchNotificationReadById);
export default router;
