import request from 'supertest';
import db, { resetDb } from './mocks/prisma';
import { appFor, userId, otherId, productId, shopId } from './helpers';
import { filteredCatalog } from '../../apps/product-service/src/controllers/catalog-query';
import { inspectCart, customerOrders, reorder } from '../../apps/order-service/src/routes/customer-tools.controller';
import { shoppingPayload, getShoppingState, saveShoppingState } from '../../apps/auth-service/src/controllers/shopping-state.controller';
import { uploadEvidence, escalateReturn } from '../../apps/order-service/src/routes/return-evidence.controller';
import { imageKit } from '@packages/libs/imagekit';
beforeEach(resetDb);

test('catalog preserves explicit filters, supports prices above 1199 and stable sorting', async()=>{
  db.products.findMany.mockResolvedValue([{id:productId,sale_price:2400}]);db.products.count.mockResolvedValue(13);db.products.aggregate.mockResolvedValue({_min:{sale_price:10},_max:{sale_price:2400}});
  const res=await request(appFor('get','/',filteredCatalog)).get('/?categories=CPU&categories=GPU&minPrice=1500&sort=priceDesc&page=2&limit=12&q=RTX&inStock=true');
  expect(res.status).toBe(200);expect(res.body.pagination).toEqual({total:13,page:2,totalPages:2});expect(res.body.priceBounds.max).toBe(2400);
  expect(db.products.findMany.mock.calls[0][0]).toMatchObject({skip:12,take:12,where:{category:{in:['CPU','GPU']},sale_price:{gte:1500},stock:{gt:0}},orderBy:[{sale_price:'desc'},{id:'asc'}]});
});
test.each(['minPrice=20&maxPrice=10','maxPrice=NaN','sort=sql','priceRange=1,2,3'])('catalog rejects invalid query %s',async q=>{expect((await request(appFor('get','/',filteredCatalog)).get('/?'+q)).status).toBe(400);expect(db.products.findMany).not.toHaveBeenCalled();});
test('cart inspection accounts for aggregate product stock across choices and uses current prices',async()=>{
  db.products.findMany.mockResolvedValue([{id:productId,title:'GPU',slug:'gpu',shopId,sale_price:90,stock:5,colors:['red','blue'],sizes:[],variants:[],images:[],shop:{name:'Shop',sellers:{}}}]);
  const res=await request(appFor('post','/',inspectCart)).post('/').send({cart:[{id:productId,quantity:3,price:1,selectedOptions:{color:'red'}},{id:productId,quantity:3,selectedOptions:{color:'blue'}}]});
  expect(res.status).toBe(200);expect(res.body.rows.every((r:any)=>r.sale_price===90 && !r.available && r.maxQuantity===2)).toBe(true);
});
test('cart reports removed products and suspended sellers unavailable',async()=>{
  db.products.findMany.mockResolvedValue([{id:productId,shop:{sellers:{suspendedAt:new Date(),suspendedUntil:null}}}]);
  const res=await request(appFor('post','/',inspectCart)).post('/').send({cart:[{id:productId,quantity:1},{id:otherId,quantity:1}]});
  expect(res.status).toBe(200);expect(res.body.rows.every((r:any)=>!r.available)).toBe(true);
});
test('malformed cart is a validation error',async()=>{expect((await request(appFor('post','/',inspectCart)).post('/').send({cart:[null]})).status).toBe(400);});
test('order search is paginated and always scoped to the authenticated buyer',async()=>{
  db.orders.findMany.mockResolvedValue([]);db.orders.count.mockResolvedValue(0);
  const res=await request(appFor('get','/',customerOrders)).get('/?status=Delivered&from=2026-01-01&to=2026-01-02&limit=5&page=2');
  expect(res.status).toBe(200);expect(db.orders.findMany.mock.calls[0][0]).toMatchObject({skip:5,take:5,where:{userId,status:'Delivered',createdAt:{gte:new Date('2025-12-31T17:00:00Z'),lte:new Date('2026-01-02T16:59:59.999Z')}}});
});
test('reorder cannot read another buyers order',async()=>{db.orders.findFirst.mockResolvedValue(null);expect((await request(appFor('get','/:orderId',reorder)).get('/'+otherId)).status).toBe(404);expect(db.orders.findFirst.mock.calls[0][0].where).toEqual({id:otherId,userId});});
test('shopping data strips untrusted fields and rejects malformed/duplicate items',()=>{
  expect(shoppingPayload({cart:[{id:productId,title:'GPU',price:10,secret:'x',images:[{url:'javascript:alert(1)'}]}],wishlist:[]})).toMatchObject({cart:[{id:productId,images:[]}]});
  expect(shoppingPayload({cart:[{id:productId}],wishlist:[]}).cart[0]).not.toHaveProperty('secret');
  for(const cart of [[null],[{id:productId,quantity:-1}],[{id:productId},{id:productId}]])expect(()=>shoppingPayload({cart,wishlist:[]})).toThrow();
});
test('shopping read/write blocks stale identity after an account switch',async()=>{
  expect((await request(appFor('get','/',getShoppingState)).get('/?ownerId='+otherId)).status).toBe(403);
  expect((await request(appFor('put','/',saveShoppingState)).put('/').send({ownerId:otherId,revision:0,payload:{cart:[],wishlist:[]}})).status).toBe(403);expect(db.shoppingState.updateMany).not.toHaveBeenCalled();
});
test('shopping uses compare-and-swap and returns conflict without overwriting',async()=>{
  db.shoppingState.updateMany.mockResolvedValue({count:0});const body={ownerId:userId,revision:2,payload:{cart:[],wishlist:[]}};
  expect((await request(appFor('put','/',saveShoppingState)).put('/').send(body)).status).toBe(409);
  expect(db.shoppingState.updateMany.mock.calls[0][0].where).toEqual({id:userId,revision:2});
  db.shoppingState.updateMany.mockResolvedValue({count:1});expect((await request(appFor('put','/',saveShoppingState)).put('/').send(body)).body.revision).toBe(3);
});
test('evidence ownership and actual image signature are checked before upload',async()=>{
  db.orders.findFirst.mockResolvedValue(null);const app=appFor('post','/:orderId',uploadEvidence);
  expect((await request(app).post('/'+otherId).send({file:'x'})).status).toBe(404);
  db.orders.findFirst.mockResolvedValue({id:otherId});expect((await request(app).post('/'+otherId).send({file:'data:image/png;base64,'+Buffer.from('not an image at all').toString('base64')})).status).toBe(400);
  expect(imageKit.upload).not.toHaveBeenCalled();
});
test('rejected return can be escalated once by its owner',async()=>{
  db.orders.findFirst.mockResolvedValue({id:otherId});db.returnRequest.findUnique.mockResolvedValue({id:productId,status:'Rejected'});db.returnRequest.update.mockResolvedValue({status:'Escalated'});
  const app=appFor('post','/:orderId',escalateReturn);expect((await request(app).post('/'+otherId).send({reason:'Please review the evidence'})).status).toBe(200);
  expect(db.returnRequest.update.mock.calls[0][0].data).toMatchObject({status:'Escalated',escalationReason:'Please review the evidence'});
  db.returnRequest.findUnique.mockResolvedValue({id:productId,status:'Rejected',escalatedAt:new Date()});expect((await request(app).post('/'+otherId).send({reason:'Again'})).status).toBe(400);
});
