# Nâng cấp admin — 13/10/2026

## Các thay đổi đã triển khai trong mã nguồn

1. **Bảo mật và phân quyền**
   - API danh sách tài khoản/admin và chi tiết đơn chỉ trả các trường cần thiết, không trả password hash.
   - Chia quyền owner, operations, support, finance; kiểm tra ở API và ẩn các mục điều hướng không được phép.
   - Cấp/thu hồi quyền yêu cầu lý do, không tự thay đổi quyền của chính mình. Giao dịch tuần tự hóa thay đổi đội ngũ và kiểm tra lại quyền owner để bảo vệ owner cuối cùng khi có thao tác đồng thời.
   - Admin cũ chưa có `adminRole` được coi là owner để giữ khả năng quản trị. Giá trị vai trò không hợp lệ bị từ chối.
2. **Danh sách và báo cáo**
   - Tìm kiếm, bộ lọc, phân trang tại server; xuất CSV toàn bộ kết quả phù hợp theo từng lô, có xử lý ô có thể bị hiểu là công thức.
   - Sửa phép tính phí sàn theo cent. Đơn mới lưu phí Stripe thực tế khi xác định được; đơn cũ dùng ước tính 10% và có nhãn số đơn ước tính.
   - Tổng hợp doanh thu, đăng ký và biểu đồ hoạt động tại MongoDB; không cắt biểu đồ hoạt động ở 50.000 bản ghi.
   - Bộ lọc ngày và ngày báo cáo dùng `Asia/Ho_Chi_Minh` (UTC+7). Tiền thanh toán vẫn là USD; ngân sách mẫu chatbot vẫn là VND theo dữ liệu tư vấn hiện có.
   - Danh sách chờ hoàn tiền bao gồm mọi ngày, hiển thị đơn cũ trước. Stripe tạm lỗi không làm mất doanh thu nội bộ và danh sách chờ hoàn tiền.
3. **Điều hành và kiểm soát**
   - Khóa/mở tài khoản khách hàng, người bán, có lý do và hạn hết khóa. Chặn đăng nhập, refresh, phiên API đang dùng; phiên chat bị chặn khi gửi tiếp. Chặn tạo checkout mới với người bán bị khóa.
   - Ẩn/khôi phục sản phẩm bằng trạng thái `Suspended`. Người bán không tự đăng lại sản phẩm bị admin ẩn. Khôi phục đưa về `Inactive` để người bán kiểm tra trước khi đăng.
   - Duyệt/từ chối/tiếp nhận trả hàng; có bằng chứng, lịch sử đơn, lý do quyết định và thông báo cho hai bên. Cho phép admin xem xét lại yêu cầu bị từ chối.
   - Chỉ đơn đã nhận trả hàng mới chuyển `Returned` qua luồng trả hàng. Màn hình đổi trạng thái thông thường không bỏ qua bước này. Hoàn tiền được xử lý riêng trong Thanh toán; hàng trả không tự nhập lại tồn kho.
   - Nhật ký admin ghi người thực hiện, đối tượng, lý do, dữ liệu trước/sau; có lọc thời gian, thao tác, mã đối tượng.
4. **Công cụ vận hành**
   - Dashboard có đơn chờ quá 48 giờ, hoàn tiền đang chờ và yêu cầu trả hàng đang mở.
   - Quản lý bản nháp/xuất bản mẫu cấu hình PC, ngân sách, linh kiện và sản phẩm liên kết.
   - Gửi thông báo qua công việc nền bền vững: khóa nhận việc, lô 200 người, lưu tiến độ cùng thông báo trong một giao dịch, khóa chống gửi lặp, xem lịch sử và tiếp tục sau lỗi. Gửi toàn bộ cần tích xác nhận.
   - Tìm cửa hàng/người nhận theo tên/email; không cần nhập mã nội bộ cho thao tác thông thường.
   - Ảnh logo/banner upload lên ImageKit và lưu URL; giới hạn PNG/JPEG/WebP, 5 MB, kiểm tra chữ ký định dạng.
   - Gộp khuyến mãi dưới Sản phẩm, chuyển cấu hình log vào mục nâng cao; bổ sung tiếng Việt cho các luồng vận hành chính và sửa header/bộ lọc trên điện thoại.

## Phạm vi quyền

| Vai trò | Quyền |
| --- | --- |
| owner | Toàn bộ, bao gồm đội ngũ, nhật ký quản trị và cấu hình |
| operations | Tổng quan, xem/xử lý đơn, sản phẩm, mẫu PC, trả hàng, thông báo |
| support | Xem/xử lý đơn, khách hàng/người bán, trả hàng, thông báo |
| finance | Xem đơn, thanh toán, hoàn tiền; không đổi trạng thái giao hàng |

## Kích hoạt trên môi trường cần chạy

Mã nguồn đã được kiểm thử với MongoDB replica set dùng riêng cho test. Chưa áp dụng schema vào database cấu hình trong `.env`, chưa triển khai môi trường thật.

1. Dừng các dịch vụ dùng Prisma trước khi sinh client trên Windows, tránh khóa DLL.
2. Với `DATABASE_URL` trỏ đúng MongoDB replica set đích, chạy:

   ```powershell
   npx prisma generate
   npx prisma db push --skip-generate
   npm run build:services
   npx next build apps/admin-ui
   ```

3. Khởi động lại các dịch vụ và admin UI bằng cách chạy hiện có của môi trường. Worker thông báo tự chạy trong admin-service; không cần một dịch vụ mới.
4. Owner rà soát vai trò admin cũ trong Quản lý đội ngũ. Các ứng dụng gọi API cấp quyền/hoàn tiền/đổi trạng thái cần gửi `reason`; gửi thông báo cần `requestKey` và xác nhận khi gửi toàn bộ.

Không dùng `--accept-data-loss` như một bước mặc định. Nếu Prisma báo thay đổi gây mất dữ liệu, cần kiểm tra riêng thay đổi đó trước khi áp dụng.

## Kiểm chứng

- 169 kiểm thử implementation qua, gồm phân quyền, phiên bị khóa, Google login bị khóa, chat đang mở, checkout, CSV nhiều lô, trả hàng, Stripe lỗi, chống giả mạo nhật ký admin và múi giờ.
- 20 kiểm thử tích hợp MongoDB qua, gồm thay đổi owner đồng thời, phí thực tế/ước tính, chống gửi thông báo lặp và sản phẩm bị kiểm duyệt.
- TypeScript toàn bộ ứng dụng qua; 10 dịch vụ build thành công; admin UI build production thành công.
- Giao diện được kiểm tra trên dữ liệu giả lập: đăng nhập, tổng quan, duyệt trả hàng và nhật ký phát sinh, lưu mẫu PC, menu/danh sách sản phẩm trên desktop và mobile.
- Stripe và ImageKit thật chưa được gọi trong đợt kiểm tra. Không gửi thông báo tới tài khoản thật, không hoàn tiền thật, không thay đổi quyền tài khoản thật.

## Quy ước cần biết

- Doanh thu báo cáo loại đơn hủy/trả hàng/hoàn tiền; phí ước tính không thay thế số liệu đối soát Stripe.
- Khóa người bán chặn phiên và checkout mới; không tự hủy các đơn đã thanh toán. Admin vẫn xử lý các đơn tồn đọng.
- Hàng đợi thông báo lấy người nhận tồn tại tại thời điểm tạo công việc. Lịch sử gửi hiển thị công việc của người đang đăng nhập.
- Khóa tài khoản admin phải thu hồi quyền qua Quản lý đội ngũ trước.
