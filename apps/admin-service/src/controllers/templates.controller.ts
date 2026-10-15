import prisma from '@packages/libs/prisma';
import { handle, objectId, pageArgs, textField } from '@packages/utils/api';
import { transaction } from '@packages/utils/transaction';
import { audit } from '@packages/utils/admin-audit';
import { NotFoundError, ValidationError } from '@packages/error-handler';
export const templates = handle(async (req, res) => {
  const [rows, total] = await Promise.all([prisma.pcBuildTemplate.findMany({ ...pageArgs(req.query), orderBy: { createdAt: 'desc' } }), prisma.pcBuildTemplate.count()]);
  res.json({ rows, total });
});
export const saveTemplate = handle(async (req, res) => {
  const name = textField(req.body.name, 'name', 150), purpose = textField(req.body.purpose, 'purpose', 40);
  const budgetMin = Number(req.body.budgetMin), budgetMax = Number(req.body.budgetMax);
  if (!['gaming', 'office', 'design', 'streaming', 'learning'].includes(purpose) || !Number.isFinite(budgetMin) || !Number.isFinite(budgetMax) || budgetMin < 0 || budgetMax < budgetMin) throw new ValidationError('Invalid purpose or budget range');
  const components = req.body.components;
  if (!components || typeof components !== 'object' || Array.isArray(components) || !Object.keys(components).length || JSON.stringify(components).length > 20000 || Object.values(components).some(v => typeof v !== 'string' || v.length > 300)) throw new ValidationError('Provide component names');
  const productIds = req.body.productIds ?? [];
  if (!Array.isArray(productIds) || productIds.length > 20) throw new ValidationError('Up to 20 products allowed');
  productIds.forEach(objectId);
  if (typeof req.body.isActive !== 'boolean') throw new ValidationError('Choose a publication state');
  const data = { name, purpose, budgetMin, budgetMax, components, productIds: [...new Set<string>(productIds)], description: req.body.description ? textField(req.body.description, 'description', 2000) : null, isActive: req.body.isActive };
  const template = await transaction(async tx => {
    if (data.productIds.length && await tx.products.count({ where: { id: { in: data.productIds }, isDeleted: false, status: 'Active' } }) !== data.productIds.length) throw new ValidationError('Linked products must be active');
    const before = req.params.id ? await tx.pcBuildTemplate.findUnique({ where: { id: objectId(req.params.id) } }) : null;
    if (req.params.id && !before) throw new NotFoundError();
    const result = before ? await tx.pcBuildTemplate.update({ where: { id: before.id }, data }) : await tx.pcBuildTemplate.create({ data });
    await audit(tx, req.user!.id, 'template.save', result.id, before ? 'Updated PC template' : 'Created PC template', before, result);
    return result;
  });
  res.json({ template });
});
