'use client';
import { useStorefrontText } from '@packages/components/storefront-language';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store';
import useUser from '@/hooks/useUser';
import axios from '@/utils/axioInstance';
import { cartLineKey } from '@packages/utils/cart';
type Payload={cart:any[];wishlist:any[]};
const empty:Payload={cart:[],wishlist:[]};
const snapshot=():Payload=>({cart:useStore.getState().cart,wishlist:useStore.getState().wishlist});
function cache(owner:string|null,payload:Payload,pending=false){try{localStorage.setItem(`shopping-v2:${owner||'guest'}`,JSON.stringify({payload,pending}));}catch{}}
function cached(owner:string|null){try{const value=JSON.parse(localStorage.getItem(`shopping-v2:${owner||'guest'}`)||'null');return Array.isArray(value?.payload?.cart)&&Array.isArray(value?.payload?.wishlist)?value:null;}catch{return null;}}
export function mergeShopping(a:Payload,b:Payload):Payload{
  const cart=[...a.cart];for(const item of b.cart){const i=cart.findIndex(p=>cartLineKey(p)===cartLineKey(item));if(i<0)cart.push(item);else cart[i]={...cart[i],quantity:Math.min(10000,(cart[i].quantity||1)+(item.quantity||1))};}
  const wishlist=[...a.wishlist,...b.wishlist.filter(p=>!a.wishlist.some(i=>i.id===p.id))];
  if(cart.length>100 || wishlist.length>200) throw new Error('Giỏ hàng tối đa 100 mục và danh sách yêu thích tối đa 200 mục. Hãy bớt mục trước khi gộp.');
  return {cart,wishlist};
}
export default function ShoppingSync({children}:{children:React.ReactNode}){
  const { t } = useStorefrontText();
  const {user,isLoading,isError}=useUser();const scope=user?.id||null;
  const [ready,setReady]=useState<string|null|undefined>(undefined),[problem,setProblem]=useState(''),[guest,setGuest]=useState<Payload|null>(null),[pending,setPending]=useState(false);
  const retry=useRef<()=>Promise<void>>(async()=>{}),discard=useRef<()=>Promise<void>>(async()=>{});
  useEffect(()=>{
    if(isLoading)return;
    let active=true,ignore=false,saving=false,stopped=false,revision=0,timer:ReturnType<typeof setTimeout>|undefined,latest:Payload|undefined;
    let unsubscribe=()=>{};setProblem('');setReady(undefined);setPending(false);
    const old=useStore.getState();if(old.ownerId!==scope){if(!old.ownerId)cache(null,snapshot());useStore.setState({ownerId:scope,...empty});}
    const apply=(payload:Payload)=>{ignore=true;useStore.setState({...payload,ownerId:scope});ignore=false;};
    const subscribe=()=>{unsubscribe=useStore.subscribe((state,previous)=>{if(!active||ignore||state.ownerId!==scope||(state.cart===previous.cart&&state.wishlist===previous.wishlist))return;latest=snapshot();cache(scope,latest,true);setPending(true);clearTimeout(timer);timer=setTimeout(flush,500);});};
    const load=async()=>{
      if(!scope){apply(cached(null)?.payload||snapshot());setGuest(null);setReady(null);unsubscribe=useStore.subscribe(()=>{if(active&&!ignore)cache(null,snapshot());});return;}
      try{
        const {data}=await axios.get('/api/shopping-state',{params:{ownerId:scope}});if(!active)return;
        revision=data.revision;
        const local=cached(scope);apply(data.payload);if(!local?.pending)cache(scope,data.payload);setReady(scope);
        const guestState=cached(null)?.payload;setGuest(guestState&&(guestState.cart.length||guestState.wishlist.length)?guestState:null);
        if(local?.pending){latest=local.payload;apply(local.payload);stopped=true;setProblem('Có giỏ hàng chưa đồng bộ trên thiết bị này. Chọn dữ liệu muốn giữ.');}
        subscribe();
      }catch{if(active){apply(cached(scope)?.payload||empty);stopped=true;setReady(scope);subscribe();setProblem('Không tải được giỏ hàng tài khoản. Đang dùng bản lưu trên thiết bị; kết nối lại để đồng bộ.');}}
    };
    const flush=async()=>{
      if(!active||!scope||saving||stopped||!latest)return;saving=true;const payload=latest;latest=undefined;
      try{const {data}=await axios.put('/api/shopping-state',{ownerId:scope,revision,payload});if(!active)return;revision=data.revision;cache(scope,latest||payload,!!latest);setPending(!!latest);}
      catch(e:any){if(active){latest=latest||payload;stopped=true;setProblem(e.response?.status===409?'Giỏ hàng đã thay đổi trên thiết bị khác. Chọn dữ liệu muốn giữ.':'Chưa đồng bộ được. Dữ liệu vẫn lưu trên thiết bị này.');}}
      finally{saving=false;if(active&&latest&&!stopped)void flush();}
    };
    retry.current=async()=>{if(!scope)return;try{const {data}=await axios.get('/api/shopping-state',{params:{ownerId:scope}});if(!active)return;revision=data.revision;latest=snapshot();stopped=false;setProblem('');await flush();}catch{setProblem('Chưa kết nối được. Vui lòng thử lại.');}};
    discard.current=async()=>{if(!scope)return;try{const {data}=await axios.get('/api/shopping-state',{params:{ownerId:scope}});if(!active)return;revision=data.revision;latest=undefined;stopped=false;apply(data.payload);cache(scope,data.payload);setPending(false);setProblem('');}catch{setProblem('Chưa kết nối được. Vui lòng thử lại.');}};
    void load();
    const focus=async()=>{if(!scope||saving||latest||stopped)return;const before=snapshot();try{const {data}=await axios.get('/api/shopping-state',{params:{ownerId:scope}});if(!active||saving||latest||stopped||snapshot().cart!==before.cart||snapshot().wishlist!==before.wishlist||data.revision===revision)return;revision=data.revision;apply(data.payload);cache(scope,data.payload);}catch{/* Keep local state; the next write still checks its revision. */}};window.addEventListener('focus',focus);
    return()=>{active=false;clearTimeout(timer);unsubscribe();window.removeEventListener('focus',focus);if(latest&&scope)cache(scope,latest,true);};
  },[scope,isLoading,isError]);
  return <>{isLoading&&<p className="px-4 py-2 text-sm text-slate-500" role="status">{t("Đang tải tài khoản…")}</p>}{!isLoading&&ready!==scope&&<p className="px-4 py-2 text-sm text-slate-500" role="status">{t("Đang tải giỏ hàng…")}</p>}{isError&&<p role="alert" className="bg-amber-50 p-3">{t("Chưa xác minh được tài khoản. Bạn có thể tiếp tục xem sản phẩm; vui lòng tải lại trước khi thanh toán.")}</p>}{problem&&<aside role="alert" className="space-x-4 bg-amber-50 p-4"><span>{t(problem)}</span><button className="underline" onClick={()=>retry.current()}>{t("Dùng dữ liệu trên thiết bị này")}</button><button className="underline" onClick={()=>discard.current()}>{t("Tải dữ liệu từ tài khoản")}</button></aside>}{guest&&scope&&<aside className="space-x-4 bg-blue-50 p-4"><span>{t("Có giỏ hàng / yêu thích trước khi đăng nhập.")}</span><button className="underline" onClick={()=>{try{useStore.setState(mergeShopping(snapshot(),guest));cache(null,empty);setGuest(null);}catch(e:any){setProblem(e.message);}}}>{t("Gộp vào tài khoản")}</button><button className="underline" onClick={()=>{cache(null,empty);setGuest(null);}}>{t("Bỏ qua")}</button></aside>}{pending&&!problem&&<p role="status" className="px-4 text-sm text-slate-500">{t("Đang đồng bộ giỏ hàng…")}</p>}{children}</>;
}
