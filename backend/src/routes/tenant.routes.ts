import { Router } from 'express';
import { roles } from '../middleware/auth.middleware.js';
import { getTenant } from '../controllers/tenant.controller.js';
const router = Router();
router.get('/', roles('owner'), getTenant);
export default router;
