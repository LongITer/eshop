import { RequestHandler } from 'express';
import { ForbiddenError } from '@packages/error-handler';
import { AdminPermission, canAdmin } from '@packages/utils/admin-access';
export const adminPermission = (permission: AdminPermission): RequestHandler => (req, _res, next) => {
  if (req.role !== 'admin' || !canAdmin(req.user, permission)) return next(new ForbiddenError('You do not have permission for this action'));
  next();
};
