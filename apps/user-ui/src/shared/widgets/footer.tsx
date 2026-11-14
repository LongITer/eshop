'use client';
import { useStorefrontText } from '@packages/components/storefront-language';
import Link from 'next/link';

export default function Footer() {
  const { t } = useStorefrontText();
  return <footer className="mt-16 border-t bg-slate-50 text-slate-700"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:grid-cols-3">
    <div><h2 className="text-xl font-bold">Eshop</h2><p className="mt-3 text-sm">{t("Sản phẩm, cửa hàng và cấu hình PC phù hợp với nhu cầu của bạn.")}</p></div>
    <nav aria-label={t("Tài khoản")} className="space-y-3 text-sm"><h2 className="font-semibold">{t("Tài khoản của bạn")}</h2>{[['/profile','Hồ sơ'],['/profile?active=My+Orders','Đơn hàng & theo dõi vận chuyển'],['/wishlist','Sản phẩm yêu thích'],['/profile?active=Shipping+Address','Địa chỉ giao hàng']].map(([href,label]) => <Link key={href} className="block hover:underline" href={href}>{t(label)}</Link>)}</nav>
    <nav aria-label={t("Hỗ trợ")} className="space-y-3 text-sm"><h2 className="font-semibold">{t("Mua sắm & hỗ trợ")}</h2>{[['/products','Tìm sản phẩm'],['/pc-builder','Xây dựng cấu hình PC'],['/help','Hướng dẫn mua hàng & trả hàng'],['/inbox','Tin nhắn với cửa hàng']].map(([href,label]) => <Link key={href} className="block hover:underline" href={href}>{t(label)}</Link>)}</nav>
  </div></footer>;
}
