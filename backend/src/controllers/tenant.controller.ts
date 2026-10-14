import { Lease } from '../models/index.js';
import { asyncRoute, ok } from '../utils/http.js';
import { listRecords } from '../services/record.service.js';
export const getTenant = asyncRoute(async (req, res) => ok(res, await listRecords(req, Lease, {}, 'property tenant')));
