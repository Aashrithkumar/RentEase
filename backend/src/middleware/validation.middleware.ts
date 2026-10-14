import type { RequestHandler, RequestParamHandler } from 'express';
import { z } from 'zod';
import { objectId } from '../utils/validation.js';
export const idParam: RequestHandler = (req, _res, next) => { try {
    if (req.params.id)
        objectId.parse(req.params.id);
    next();
}
catch (e) {
    next(e);
} };
export const propertyIdParam: RequestParamHandler = (_req, _res, next, id) => { try {
    z.string().regex(/^[a-f\d]{24}$/i).parse(id);
    next();
}
catch (e) {
    next(e);
} };
