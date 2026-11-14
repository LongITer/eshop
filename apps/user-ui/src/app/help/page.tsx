'use client';
import { useStorefrontText } from '@packages/components/storefront-language';
import Link from 'next/link';
export default function Help() {
  const { t } = useStorefrontText();
  return <main className="mx-auto max-w-3xl space-y-7 px-5 py-10"><h1 className="text-3xl font-bold">{t("Trợ giúp mua hàng")}</h1>
    <section><h2 className="text-xl font-semibold">{t("Giá và thanh toán")}</h2><p className="mt-2">{t("Giá sản phẩm và thanh toán dùng USD. Kiểm tra sản phẩm, địa chỉ, giảm giá và phí vận chuyển ở bước xác nhận trước khi trả tiền.")}</p></section>
    <section><h2 className="text-xl font-semibold">{t("Theo dõi và hủy đơn")}</h2><p className="mt-2">{t("Mở chi tiết đơn để xem trạng thái, mã vận đơn và lịch sử xử lý. Đơn đang chờ xác nhận có thể được hủy tại đây. Đơn đã thanh toán bị hủy sẽ chờ xử lý hoàn tiền.")}</p><Link className="mt-3 block text-blue-600 underline" href="/profile?active=My+Orders">{t("Xem đơn hàng của tôi")}</Link></section>
    <section><h2 className="text-xl font-semibold">{t("Trả hàng và khiếu nại")}</h2><p className="mt-2">{t("Với đơn đã giao và đã thanh toán, mở chi tiết đơn để gửi lý do cùng bằng chứng. Theo dõi phản hồi, hướng dẫn gửi hàng và tiến độ hoàn tiền ngay trên đơn. Kiểm tra điều kiện bảo hành hoặc đổi trả do cửa hàng cung cấp trước khi mua.")}</p></section>
    <section><h2 className="text-xl font-semibold">{t("Liên hệ cửa hàng")}</h2><p className="mt-2">{t("Dùng nút nhắn tin trên trang sản phẩm hoặc cửa hàng để hỏi về sản phẩm, giao hàng và bảo hành.")}</p><Link className="mt-3 block text-blue-600 underline" href="/inbox">{t("Mở hộp thư")}</Link></section>
  </main>;
}
