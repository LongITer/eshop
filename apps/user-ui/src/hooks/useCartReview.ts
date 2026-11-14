'use client';
import { useQuery } from '@tanstack/react-query';
import axios from '@/utils/axioInstance';
import { useStore, CartItem } from '@/store';
import { cartLineKey } from '@packages/utils/cart';

type ReviewedLine = {key:string;id:string;available:boolean;reason?:string;maxQuantity:number;sale_price?:number;title?:string;slug?:string;shopId?:string;shopName?:string;variantId?:string|null;selectedOptions?:{color?:string;size?:string}};
export default function useCartReview(cart:CartItem[]) {
  const review=useQuery<{rows:ReviewedLine[];shippingByShop:Record<string,number>}>({
    queryKey:['cart-review',cart], enabled:cart.length>0,
    queryFn:async({signal})=>(await axios.post('/order/api/inspect-cart',{cart},{signal})).data,
    staleTime:15000,refetchOnWindowFocus:true,retry:1,
  });
  const rowFor=(item:CartItem)=>review.data?.rows.find(row=>row.key===cartLineKey(item));
  const priceChanged=(item:CartItem)=>{const row=rowFor(item);return row?.sale_price!==undefined&&row.sale_price!==Number(item.sale_price??item.price);};
  const changed=cart.some(priceChanged);
  const blocked=!review.data||review.isError||review.isFetching||review.data.rows.some(row=>!row.available);
  const shipping=Object.values(review.data?.shippingByShop||{}).reduce((sum,value)=>sum+Math.round(value*100),0)/100;
  function acceptPrices(){useStore.setState(state=>({cart:state.cart.map(item=>{const row=rowFor(item);return row?.sale_price!==undefined?{...item,sale_price:row.sale_price,price:row.sale_price,title:row.title||item.title,slug:row.slug||item.slug,variantId:row.variantId,selectedOptions:row.selectedOptions}:item;})}));}
  async function validate(){
    const result=await review.refetch();
    if(result.error||!result.data)throw new Error('Không kiểm tra được giá và tồn kho. Vui lòng thử lại.');
    if(result.data.rows.some(row=>!row.available||row.sale_price!==Number(cart.find(item=>cartLineKey(item)===row.key)?.sale_price??cart.find(item=>cartLineKey(item)===row.key)?.price)))throw new Error('Giá hoặc tồn kho đã thay đổi. Vui lòng kiểm tra lại giỏ hàng.');
  }
  return {review,rowFor,priceChanged,changed,blocked,shipping,acceptPrices,validate};
}
