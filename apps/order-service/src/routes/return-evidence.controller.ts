import prisma from '@packages/libs/prisma';
import { handle, objectId, textField } from '@packages/utils/api';
import { transaction } from '@packages/utils/transaction';
import { imageKit } from '@packages/libs/imagekit';
import { AppError, ValidationError, NotFoundError } from '@packages/error-handler';

export function evidenceImage(file: unknown) {
  if (typeof file !== 'string') throw new ValidationError('Choose a PNG, JPEG or WebP image');
  // Reject an oversized payload before allocating the decoded buffer.
  if (file.length > 4 * Math.ceil(5 * 1024 * 1024 / 3) + 32) throw new ValidationError('Image must be under 5 MB');
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(file);
  if (!match) throw new ValidationError('Choose a PNG, JPEG or WebP image');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 5 * 1024 * 1024 || bytes.length < 12) throw new ValidationError('Image must be under 5 MB');
  if (bytes.toString('base64') !== match[2]) throw new ValidationError('Invalid image contents');
  const format = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png'
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'jpeg'
    : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP' ? 'webp' : null;
  if (!format) throw new ValidationError('Invalid image contents');
  if (format !== match[1]) throw new ValidationError('Image format does not match its contents');
  return { file, format };
}

export const uploadEvidence = handle(async (req,res) => {
  const orderId=objectId(req.params.orderId);
  if(!await prisma.orders.findFirst({where:{id:orderId,userId:req.user!.id,status:'Delivered',paymentStatus:'Paid'}})) throw new NotFoundError();
  if (await prisma.returnRequest.findUnique({ where: { orderId } })) throw new ValidationError('The return request has already been submitted');
  const { file, format } = evidenceImage(req.body.file);
  try {
    const uploaded = await imageKit.upload({ file, fileName: `evidence-${Date.now()}.${format}`, folder: `/returns/${orderId}` });
    const url = new URL(uploaded.url);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid upload response');
    res.status(201).json({url: url.toString()});
  } catch {
    throw new AppError('Image upload is temporarily unavailable. Successfully uploaded images are retained; retry the remaining files.', 503);
  }
});
export const escalateReturn = handle(async(req,res)=>{
  const orderId=objectId(req.params.orderId),reason=textField(req.body.reason,'reason',2000);
  const result=await transaction(async tx=>{
    const order=await tx.orders.findFirst({where:{id:orderId,userId:req.user!.id,status:'Delivered',paymentStatus:'Paid'}});
    const current=await tx.returnRequest.findUnique({where:{orderId}});
    if(!order||!current)throw new NotFoundError();
    if(current.escalatedAt)throw new ValidationError('This return has already been escalated');
    if(current.status!=='Rejected')throw new ValidationError('Only a rejected return can be escalated');
    await tx.orders.update({where:{id:orderId,status:'Delivered'},data:{updatedAt:new Date()}});
    const request=await tx.returnRequest.update({where:{id:current.id,status:'Rejected'},data:{status:'Escalated',escalatedAt:new Date(),escalationReason:reason}});
    await tx.orderEvent.create({data:{orderId,actorId:req.user!.id,from:'Return:Rejected',to:'Return:Escalated',reason}});
    const shop = await tx.shops.findUniqueOrThrow({ where: { id: order.shopId } });
    await tx.notifications.create({ data: { sellerId: shop.sellerId, orderId, type: 'System', title: 'Buyer requests return reconsideration', message: reason, redirectUrl: `/dashboard/orders/${orderId}` } });
    return request;
  });
  res.json({request:result});
});
