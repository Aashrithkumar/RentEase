import { Router } from 'express';
import { roles } from '../middleware/auth.middleware.js';
import { idParam } from '../middleware/validation.middleware.js';
import { getPayment, getPaymentById, postPayment } from '../controllers/payment.controller.js';
const router = Router();
router.get('/', getPayment);
router.get('/:id', idParam, getPaymentById);
router.post('/', roles('owner'), postPayment);
export default router;
