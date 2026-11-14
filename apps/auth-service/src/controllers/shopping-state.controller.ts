import prisma from '@packages/libs/prisma';
import { handle, objectId } from '@packages/utils/api';
import { ValidationError, ForbiddenError } from '@packages/error-handler';
import { cartLineKey } from '@packages/utils/cart';

export function shoppingPayload(body:any) {
  if(!body || !Array.isArray(body.cart) || !Array.isArray(body.wishlist) || body.cart.length>100 || body.wishlist.length>200 || JSON.stringify(body).length>500000) throw new ValidationError('Shopping state is too large');
  const line=(p:any)=>{
    if(!p || typeof p !== 'object') throw new ValidationError('Invalid item');
    objectId(p.id); if(p.variantId)objectId(p.variantId);
    const quantity=Number(p.quantity??1); if(!Number.isSafeInteger(quantity)||quantity<1||quantity>10000)throw new ValidationError('Invalid quantity');
    const text=(v:any,max=300)=>typeof v==='string'?v.slice(0,max):'';
    const price=Number(p.sale_price??p.price??0);if(!Number.isFinite(price)||price<0)throw new ValidationError('Invalid price');
    const images=(Array.isArray(p.images)?p.images:[]).slice(0,4).map((i:any)=>typeof i==='string'?i:i?.url).filter((url:any)=>typeof url==='string'&&url.startsWith('https://')&&url.length<2000).map((url:string)=>({url}));
    return {id:p.id,title:text(p.title),slug:text(p.slug),price,sale_price:price,regular_price:Number.isFinite(p.regular_price)?p.regular_price:price,quantity,variantId:p.variantId||null,selectedOptions:{color:text(p.selectedOptions?.color,200),size:text(p.selectedOptions?.size,200)},images,image:typeof p.image==='string'&&p.image.startsWith('https://')?p.image.slice(0,2000):null,shopId:typeof p.shopId==='string'?p.shopId:null,stock:Number.isSafeInteger(p.stock)?Math.max(0,p.stock):0,category:text(p.category),rating:Number.isFinite(p.rating)?p.rating:0};
  };
  const cart=body.cart.map(line),wishlist=body.wishlist.map(line);
  const keys=cart.map(cartLineKey);
  if(new Set(keys).size!==keys.length||new Set(wishlist.map((p:any)=>p.id)).size!==wishlist.length)throw new ValidationError('Duplicate items');
  return {cart,wishlist};
}
export const getShoppingState=handle(async(req,res)=>{
  if(req.query.ownerId!==req.user!.id)throw new ForbiddenError();
  res.setHeader('Cache-Control','no-store');
  const state=await prisma.shoppingState.upsert({where:{id:req.user!.id},create:{id:req.user!.id,payload:{cart:[],wishlist:[]}},update:{}});
  res.json(state);
});
export const saveShoppingState=handle(async(req,res)=>{
  if(req.body.ownerId!==req.user!.id)throw new ForbiddenError();
  const revision=req.body.revision;if(!Number.isSafeInteger(revision)||revision<0)throw new ValidationError('Invalid revision');
  const payload=shoppingPayload(req.body.payload);
  const result=await prisma.shoppingState.updateMany({where:{id:req.user!.id,revision},data:{payload,revision:{increment:1}}});
  if(!result.count){res.status(409).json({message:'Shopping state changed on another device'});return;}
  res.json({revision:revision+1});
});
