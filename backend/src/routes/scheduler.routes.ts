import { Router } from 'express';
import { postSchedulerReminders } from '../controllers/scheduler.controller.js';
const router = Router();
router.post('/reminders', postSchedulerReminders);
export default router;
