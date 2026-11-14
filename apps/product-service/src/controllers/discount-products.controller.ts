import { handle, objectId } from '@packages/utils/api';
import { ValidationError, NotFoundError, ForbiddenError } from '@packages/error-handler';
import { transaction } from '@packages/utils/transaction';

export const updateDiscountProducts = handle(async (req: any, res) => {
  const id = objectId(req.params.id);
  const shopId = req.seller.shop?.id;
  if (!shopId) throw new ForbiddenError();
  const ids = req.body.productIds;
  if (!Array.isArray(ids) || ids.length > 1000) throw new ValidationError('Select up to 1000 products');
  const selected = new Set<string>(ids.map(objectId));
  await transaction(async tx => {
    const code = await tx.discountCodes.findFirst({ where: { id, sellerId: req.seller.id } });
    if (!code) throw new NotFoundError('Discount code not found');
    // Serialize assignments with deletion, including newly linked products that
    // were absent from the deletion transaction's original product snapshot.
    const previousUpdate = code.updatedAt instanceof Date ? code.updatedAt.getTime() : 0;
    await tx.discountCodes.update({ where: { id, sellerId: req.seller.id }, data: { updatedAt: new Date(Math.max(Date.now(), previousUpdate + 1)) } });
    const products = await tx.products.findMany({ where: { shopId, OR: [{ id: { in: [...selected] } }, { discount_codes: { has: id } }] }, select: { id: true, discount_codes: true, isDeleted: true } });
    if (products.filter(p => selected.has(p.id) && !p.isDeleted).length !== selected.size) throw new ValidationError('Select available products belonging to your shop');
    for (const product of products) {
      const codes = product.discount_codes.filter(codeId => codeId !== id);
      if (selected.has(product.id)) codes.push(id);
      await tx.products.update({ where: { id: product.id, shopId }, data: { discount_codes: { set: codes } } });
    }
  });
  res.json({ success: true, productIds: [...selected] });
});
