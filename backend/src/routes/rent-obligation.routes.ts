import { Router } from 'express';
import { getRentObligations } from '../controllers/rent-obligation.controller.js';
const router = Router();
router.get('/', getRentObligations);
export default router;
