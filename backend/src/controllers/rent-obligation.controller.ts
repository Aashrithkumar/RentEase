import { z } from 'zod';
import { RentObligation } from '../models/index.js';
import { asyncRoute, ok } from '../utils/http.js';
import { obligationStatus } from '../services/rent.service.js';
import { listRecords } from '../services/record.service.js';
export const getRentObligations = asyncRoute(async (req, res) => {
    const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional().parse(req.query.month);
    const result = await listRecords(req, RentObligation, { cancelled: { $ne: true }, ...(month ? { month } : {}) });
    result.items = result.items.map((x: any) => ({ ...x, status: obligationStatus(x) }));
    ok(res, result);
});
