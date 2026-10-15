import prisma from '@packages/libs/prisma';
import { handle, objectId, textField } from '@packages/utils/api';
import { transaction } from '@packages/utils/transaction';
import { imageKit } from '@packages/libs/imagekit';
import { ValidationError, NotFoundError } from '@packages/error-handler';

export const uploadEvidence = handle(async (req,res) => {
  const orderId=objectId(req.params.orderId);
  if(!await prisma.orders.findFirst({where:{id:orderId,userId:req.user!.id,status:'Delivered',paymentStatus:'Paid'}})) throw new NotFoundError();
  const file=req.body.file;
  if(typeof file!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(file))throw new ValidationError('Choose a PNG, JPEG or WebP image');
  const bytes=Buffer.from(file.split(',')[1],'base64');
  if(bytes.length>5*1024*1024||bytes.length<12)throw new ValidationError('Image must be under 5 MB');
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const webp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!png&&!jpg&&!webp)throw new ValidationError('Invalid image contents');
  const uploaded=await imageKit.upload({file,fileName:`evidence-${Date.now()}`,folder:`/returns/${orderId}`});
  res.status(201).json({url:uploaded.url});
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
    return request;
  });
  res.json({request:result});
});
