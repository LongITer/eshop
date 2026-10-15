# Cải thiện chức năng khách hàng

## Quy tắc thiết kế đã thống nhất

Theo yêu cầu của chủ dự án ngày 13/10/2026: giữ thiết kế hoàn chỉnh hiện có, không thay bằng giao diện prototype sơ sài. Khi bổ sung chức năng, tích hợp vào bố cục, khoảng cách, màu sắc, ảnh và kiểu nút của trang. Riêng giỏ hàng đã khôi phục bảng sản phẩm, bộ tăng/giảm số lượng, tóm tắt bên phải và nút thanh toán bo tròn. Danh sách đơn và yêu thích tiếp tục sử dụng bảng hiện có.

## Đã triển khai

1. Điều hướng: sửa liên kết footer và shortcut hồ sơ; thêm trang hướng dẫn `/help`; ô tìm kiếm đầu trang gửi từ khóa; menu danh mục có dữ liệu thật.
2. Danh mục: URL giữ bộ lọc và sắp xếp, không áp trần giá 1199 USD; tìm tên/thương hiệu, lọc còn hàng, phân trang ổn định, hủy truy vấn cũ và hiển thị lỗi/thử lại.
3. Giỏ hàng: kiểm tra giá/tồn kho phía server; tính tổng số lượng trên các lựa chọn cùng sản phẩm; khóa tăng quá tồn kho; khách xác nhận giá thay đổi; kiểm tra lại trước tạo phiên thanh toán. Hiển thị phí giao hàng và USD. Backend thanh toán vẫn là nơi xác nhận cuối cùng.
4. Địa chỉ/checkout: dùng lại biểu mẫu địa chỉ trong giỏ; chọn lại mặc định khi địa chỉ bị xóa; checkout hiển thị địa chỉ, lựa chọn sản phẩm và tổng thanh toán. Đăng nhập bằng email quay lại giỏ qua `next` cùng origin.
5. Đơn hàng: API phân trang theo người mua, tìm mã đơn, trạng thái, ngày theo UTC+7; thống kê bằng groupBy thay vì tải toàn bộ đơn; mua lại dùng sản phẩm/biến thể của đơn rồi kiểm tra giá và tồn kho tại giỏ.
6. Trả hàng: tải ảnh PNG/JPEG/WebP tối đa 5 MB/ảnh, kiểm tra quyền sở hữu và chữ ký file; tối đa 5 liên kết trong yêu cầu. Đơn bị từ chối được khiếu nại một lần tới admin, trạng thái `Escalated`, có lịch sử và hàng đợi admin. Hiển thị tiến độ hoàn tiền.
7. Giỏ/yêu thích: lưu theo tài khoản trên server, giữ cache riêng cho khách/từng tài khoản. Người dùng chọn có gộp giỏ khách hay không. Ghi dữ liệu bằng revision, xung đột trả 409 và cho chọn bản muốn giữ; không tự ghi đè thay đổi từ thiết bị khác. Dữ liệu offline chưa lưu có thể phục hồi từ cache. Giá lưu không được tin cậy cho thanh toán.
8. PC Builder: bổ sung so sánh tối đa 3 linh kiện cùng loại, giá USD, thông số và bảo hành từ dữ liệu shop; giữ lưu/chia sẻ cấu hình đã có, tách bản lưu trên thiết bị theo tài khoản. Chatbot ghi rõ giá cửa hàng bằng USD; không tự quy đổi VND theo tỷ giá suy đoán. Giao diện user hỗ trợ Việt/Anh theo mục bên dưới.

Đã bỏ bộ tăng/giảm số lượng trong yêu thích vì bước này chỉ lưu sản phẩm; khách chọn số lượng và biến thể khi mua.

## Kích hoạt

- Prisma thêm `shoppingState` (id tài khoản, payload, revision, updatedAt) và `returnRequest.escalatedAt/escalationReason`.
- Khi triển khai, đồng bộ schema MongoDB và generate Prisma client theo quy trình của môi trường đó, rồi khởi động lại auth/order/product/admin service và user UI. Chưa chạy `db push` vào cơ sở dữ liệu thật trong tác vụ này.
- Tải ảnh sử dụng cấu hình ImageKit hiện có. Phí vận chuyển sử dụng `SHIPPING_FEE_USD`; thanh toán dùng Stripe USD như hiện tại.
- Giới hạn đồng bộ: 100 dòng giỏ, 200 sản phẩm yêu thích; bản lưu PC là trên thiết bị, còn giỏ/yêu thích đồng bộ qua tài khoản.
- Tài khoản chưa xác minh hoặc giỏ đang nạp có trạng thái tải để tránh hiển thị giỏ của tài khoản trước. Khi dịch vụ đồng bộ lỗi, bản cache vẫn dùng được và có thông báo.

## Kiểm chứng

- 184 kiểm thử implementation qua, gồm 15 ca mới: bộ lọc, giá lớn, tồn kho tổng, người bán bị đình chỉ, quyền đơn hàng, dữ liệu giỏ, revision và khiếu nại.
- 23 kiểm thử integration qua trên MongoDB replica set dùng riêng: hai ghi giỏ đồng thời chỉ một thành công; tách tài khoản; giá/tồn kho thực; hai khiếu nại đồng thời chỉ tạo một sự kiện.
- TypeScript toàn workspace và build 10 backend service qua; build production user UI qua với Google Fonts hiện có.
- Trình duyệt local dùng database kiểm thử: giữ URL lọc, danh mục có dữ liệu, so sánh linh kiện, tăng số lượng đến tồn kho, đăng nhập quay lại giỏ, gộp giỏ khách có lựa chọn, giữ dữ liệu sau tải lại, thêm địa chỉ tại giỏ. Kiểm tra giỏ ở màn hình 390 px, không tràn ngang toàn trang.
- Stripe/ImageKit thật không được gọi để tạo thanh toán hay tải bằng chứng trong kiểm thử. API ảnh được kiểm tra bằng test double; các giao dịch kiểm thử dùng môi trường cách ly.

Ảnh kiểm chứng giỏ hàng được lưu tại `tmp/cart-restored.jpg` (artifact local, không đưa dữ liệu thật vào fixture).

## Ngôn ngữ Việt / Anh

- Bộ chọn VI / EN trên đầu trang, dùng được trên desktop và mobile. Mặc định tiếng Việt; lưu bằng khóa `eshop-language`, đồng bộ giữa các tab. Khi trình duyệt chặn storage, vẫn đổi được trong phiên hiện tại.
- Dịch nhãn giao diện, biểu mẫu, thông báo nội bộ, trạng thái đơn và ngày tháng cho trang chủ, sản phẩm, giỏ/yêu thích, tài khoản, đơn hàng, checkout, PC Builder, tin nhắn và trợ giúp. Stripe Elements và chatbot dùng cùng ngôn ngữ đã chọn.
- Giữ bố cục giỏ hàng hiện có. Đổi ngôn ngữ không đổi URL, mã trạng thái API, giỏ hàng, bộ lọc hay tiền tệ USD. Tên sản phẩm, nội dung do người dùng/cửa hàng nhập và thông báo máy chủ chưa có bản dịch giữ nguyên.
- Bản dịch tập trung tại `packages/utils/storefront-messages.ts`. Component dùng `useStorefrontText`; nội dung tĩnh trong server component dùng `StorefrontText`. Shared chat ngoài provider user giữ tiếng Anh như trước.
- Kiểm thử: 6 ca mới cho bản dịch, thông báo tồn kho, SSR mặc định Việt và component dùng chung; 184 ca implementation cũ vẫn qua. Trình duyệt xác nhận lưu lựa chọn sau reload, giữ số lượng/tổng tiền khi chuyển Việt/Anh, giữ lọc Delivered khi chuyển sang Đã giao, và hiển thị chi tiết trả hàng.

## Khôi phục giao diện sản phẩm và chỉnh checkout

- Trang sản phẩm dùng lại nền xám, sidebar trắng, thanh kéo giá và thẻ sản phẩm cũ; giữ tìm kiếm, sắp xếp, lọc theo URL, phân trang và Việt/Anh. Mobile thu gọn bộ lọc.
- Khoảng giá lấy giới hạn từ dữ liệu; gộp tên màu và mã hex khi lọc. Giữ kết quả đang hiển thị trong lúc tải bộ lọc mới. Thẻ dùng đúng trường rating và các thao tác hỗ trợ bàn phím.
- Checkout dùng bố cục địa chỉ/phương thức thanh toán bên trái, tóm tắt đơn bên phải; mobile xếp dọc. Giữ Stripe Elements và tổng tiền máy chủ; lỗi tải biểu mẫu không còn báo đang tải trên nút.
- Kiểm chứng thay đổi này: TypeScript user UI qua; 21 ca kiểm thử customer-improvements và storefront-language qua. Trình duyệt xác nhận lọc màu, đổi ngôn ngữ giữ URL, xóa lọc; catalog và checkout không tràn ngang ở 390 px.
- Checkout được kiểm tra bố cục với fixture cách ly. Stripe từ chối PaymentIntent giả như dự kiến; chưa kiểm chứng nhập thẻ hay giao dịch thật. Ảnh local: `tmp/products-restored.jpg`, `tmp/checkout-restored.jpg`.
