# Cải thiện chức năng khách hàng

## Quy tắc thiết kế đã thống nhất

Theo yêu cầu của chủ dự án ngày 13/10/2026: giữ thiết kế hoàn chỉnh hiện có, không thay bằng giao diện prototype sơ sài. Khi bổ sung chức năng, tích hợp vào bố cục, khoảng cách, màu sắc, ảnh và kiểu nút của trang. Riêng giỏ hàng đã khôi phục bảng sản phẩm, bộ tăng/giảm số lượng, tóm tắt bên phải và nút thanh toán bo tròn. Danh sách đơn và yêu thích tiếp tục sử dụng bảng hiện có.

## Sửa nhóm Cooling trong PC Builder — 29/10/2026

- Danh mục con thực tế dùng `Cooling`, nhưng quy tắc nhóm `cooler` trước đây chỉ nhận `cooler` và `tản nhiệt`. Bổ sung `cooling` vào danh sách dùng chung cho truy vấn catalog và xác nhận linh kiện khi báo giá.
- Thêm ba kiểm thử hồi quy cho category `Cooling`, subcategory `COOLING` và tag `cooling`; cả danh sách và báo giá nhận cùng nhóm tản nhiệt. 73 tests liên quan qua; TypeScript product-service qua.
- Đã build và nạp lại riêng product-service. Kiểm tra qua API của user UI: trả đủ 10 sản phẩm Cooling đang còn hàng; báo giá thử một tản nhiệt trả đúng slot `cooler`, USD và cho phép thêm vào giỏ. Chỉ đọc catalog/báo giá, không sửa sản phẩm, tồn kho hoặc ghi đơn hàng trong lần kiểm tra này.

## Thông báo trên header và trang thông báo — 18/10/2026

- Icon chuông bật/tắt một hộp thông báo dùng chung cho header thường và sticky header. Hộp neo dưới icon, có 6 cập nhật gần nhất, làm mới, đánh dấu từng mục/tất cả đã đọc và liên kết xem tất cả. Đóng bằng X, Escape hoặc bấm ra ngoài; Escape/X trả focus về icon. Message và thông báo đóng lẫn nhau để không mở chồng khung.
- Trang `/notifications` và danh sách trong hồ sơ dùng giao diện trắng/xanh đồng bộ: icon theo loại, trạng thái chưa đọc, nhóm Hôm nay/Trước đó, tab Tất cả/Chưa đọc, phân trang 20 mục, trạng thái tải/lỗi/thử lại/trống/đăng nhập. Giữ nội dung thông báo từ server, dịch nhãn và định dạng ngày theo Việt/Anh.
- API hỗ trợ `unread=true`, trả tổng theo bộ lọc cùng tổng toàn bộ và số chưa đọc. Cache, truy vấn và cập nhật đã đọc tách theo tài khoản; thay đổi cập nhật cả badge, popup và danh sách. Chỉ mở liên kết nội bộ hợp lệ từ thông báo. Đổi tài khoản hoặc điều hướng đóng popup.
- Kiểm chứng: 42 tests của header-chat, header-notifications, notification-data, account và storefront-language qua; TypeScript user UI và auth-service qua. Kiểm tra trình duyệt với API/WebSocket riêng trong bộ nhớ: chuyển Message/thông báo, đánh dấu từng mục/tất cả, lọc chưa đọc, phân trang, Escape trả focus, Việt/Anh. Desktop 1280px và mobile 390px không tràn ngang; popup nằm trong viewport và giữ nút xem tất cả. Dữ liệu thử không ghi vào database thật.

Ảnh kiểm chứng cục bộ: `tmp/header-notifications-desktop.jpg`, `tmp/notifications-page-desktop.jpg`, `tmp/header-notifications-mobile.jpg`.

## Chat trên header — 18/10/2026

- Thay liên kết chữ Messages bằng icon 24px, đồng bộ badge đỏ với thông báo, yêu thích và giỏ hàng. Áp dụng cho header thường và header cố định khi cuộn.
- Hai header điều khiển chung một hộp chat: danh sách/tìm hội thoại, gửi và nhận tin bằng WebSocket, tin cũ, trạng thái kết nối, ảnh/tệp đính kèm, lỗi và thử lại. Danh sách neo dưới icon Message; chọn một hội thoại sẽ chuyển khung chat xuống góc dưới bên phải, giữ cố định khi cuộn hoặc bấm nội dung trang. Nút quay lại mở danh sách dưới icon header đang hiển thị. View details mở `/inbox?conversationId=...` của màn chat toàn màn hình hiện có. Trên trang Inbox, icon tiếp tục dẫn vào Inbox để tránh chạy hai bộ điều khiển chat cùng lúc.
- Hộp chat có nút đóng và Escape; bấm bên ngoài chỉ đóng danh sách, không đóng hội thoại đang ở góc màn hình. Mỗi lần bật lại Message đều mở danh sách hội thoại ban đầu; chọn hội thoại mới mở khung góc phải. Giữ bản nháp riêng cho từng hội thoại khi đóng/mở trong cùng trang. Đổi tài khoản hoặc điều hướng sẽ đóng hộp chat; badge và truy vấn tin nhắn tách theo tài khoản. Upload hoàn thành muộn vẫn thuộc hội thoại ban đầu, không chuyển tệp sang hội thoại mới. Callback từ socket đã dừng được bỏ qua.
- Popup được gắn ngoài header, tự giới hạn theo phần màn hình thực sự hiển thị và tránh mép scrollbar. Hỗ trợ Việt/Anh; giữ nguyên bố cục và chức năng màn Inbox.
- Khung hội thoại cách cạnh dưới/phải 24px trên desktop và 12px trên mobile, nằm trên widget trợ lý PC để không che ô nhập. Kích thước và vị trí cập nhật theo visual viewport khi bàn phím xuất hiện. Đã kiểm tra lại desktop 1280px và mobile 390px: giữ vị trí khi cuộn, quay về danh sách dưới sticky header, không tràn ngang. TypeScript user UI và 9 tests header-chat qua, gồm đóng bằng X hoặc icon Message rồi mở lại danh sách, giữ bản nháp và tệp đính kèm khi chọn lại hội thoại.
- Avatar người đang chat hiển thị cạnh tin nhắn nhận được (28px), dùng cùng ảnh với đầu hội thoại; tin nhắn của người mua tiếp tục căn phải. Nếu thiếu/lỗi ảnh thì dùng biểu tượng shop mặc định, chỉ hiển thị trạng thái online ở đầu box. Kiểm tra local bằng ảnh thử: ảnh nạp được, chuyển hội thoại đổi đúng avatar, trường hợp không có ảnh dùng fallback và màn hình 390px không tràn ngang.
- Kiểm chứng: TypeScript user UI qua; 21 tests của header-chat, chat và storefront-language qua. Trình duyệt local với API/WebSocket thử riêng trong bộ nhớ: mở/đóng, gửi và nhận echo, unread, bản nháp, View details đúng hội thoại, một popup trên header cố định; kiểm tra desktop 1440px và mobile 390px không tràn ngang. Không gửi tin nhắn đến tài khoản thật hoặc tải tệp lên dịch vụ thật trong lượt kiểm tra này.

Ảnh kiểm chứng cục bộ: `tmp/header-chat-desktop.jpg`.

## Đã triển khai

1. Điều hướng: sửa liên kết footer và shortcut hồ sơ; thêm trang hướng dẫn `/help`; ô tìm kiếm đầu trang gửi từ khóa; menu danh mục có dữ liệu thật.
2. Danh mục: URL giữ bộ lọc và sắp xếp, không áp trần giá 1199 USD; tìm tên/thương hiệu, lọc còn hàng, phân trang ổn định, hủy truy vấn cũ và hiển thị lỗi/thử lại.
3. Giỏ hàng: kiểm tra giá/tồn kho phía server; tính tổng số lượng trên các lựa chọn cùng sản phẩm; khóa tăng quá tồn kho; khách xác nhận giá thay đổi; kiểm tra lại trước tạo phiên thanh toán. Hiển thị phí giao hàng và USD. Backend thanh toán vẫn là nơi xác nhận cuối cùng.
4. Địa chỉ/checkout: dùng lại biểu mẫu địa chỉ trong giỏ; chọn lại mặc định khi địa chỉ bị xóa; checkout hiển thị địa chỉ, lựa chọn sản phẩm và tổng thanh toán. Đăng nhập bằng email quay lại giỏ qua `next` cùng origin.
5. Đơn hàng: API phân trang theo người mua, tìm mã đơn, trạng thái, ngày theo UTC+7; thống kê bằng groupBy thay vì tải toàn bộ đơn; mua lại dùng sản phẩm/biến thể của đơn rồi kiểm tra giá và tồn kho tại giỏ.
6. Trả hàng: tải ảnh PNG/JPEG/WebP tối đa 5 MB/ảnh, kiểm tra quyền sở hữu và chữ ký file; tối đa 5 liên kết trong yêu cầu. Đơn bị từ chối được khiếu nại một lần tới admin, trạng thái `Escalated`, có lịch sử và hàng đợi admin. Hiển thị tiến độ hoàn tiền.
7. Giỏ/yêu thích: lưu theo tài khoản trên server, giữ cache riêng cho khách/từng tài khoản. Người dùng chọn có gộp giỏ khách hay không. Ghi dữ liệu bằng revision, xung đột trả 409 và cho chọn bản muốn giữ; không tự ghi đè thay đổi từ thiết bị khác. Dữ liệu offline chưa lưu có thể phục hồi từ cache. Giá lưu không được tin cậy cho thanh toán.
8. PC Builder: bổ sung so sánh tối đa 3 linh kiện cùng loại, giá USD, thông số và bảo hành từ dữ liệu shop; lưu cấu hình theo tài khoản trên server, chống ghi đè giữa hai thiết bị bằng revision. Khách chưa đăng nhập tiếp tục lưu trên thiết bị; người dùng có thể mở bản trên thiết bị cũ rồi lưu vào tài khoản. Mở cấu hình và thêm vào giỏ đều kiểm tra lại giá/tồn kho/tương thích. Chatbot ghi rõ giá cửa hàng bằng USD; không tự quy đổi VND theo tỷ giá suy đoán. Giao diện user hỗ trợ Việt/Anh theo mục bên dưới.

Đã bỏ bộ tăng/giảm số lượng trong yêu thích vì bước này chỉ lưu sản phẩm; khách chọn số lượng và biến thể khi mua.

## Kích hoạt

- Prisma thêm `shoppingState` (id tài khoản, payload, revision, updatedAt), `savedPcBuild` (id tài khoản, parts, revision, updatedAt) và `returnRequest.escalatedAt/escalationReason`.
- Khi triển khai, đồng bộ schema MongoDB và generate Prisma client theo quy trình của môi trường đó, rồi khởi động lại auth/order/product/admin service và user UI. Chưa chạy `db push` vào cơ sở dữ liệu thật trong tác vụ này.
- Tải ảnh sử dụng cấu hình ImageKit hiện có. Phí vận chuyển sử dụng `SHIPPING_FEE_USD`; thanh toán dùng Stripe USD như hiện tại.
- Giới hạn đồng bộ: 100 dòng giỏ, 200 sản phẩm yêu thích, một cấu hình PC đang lưu với tối đa 8 loại linh kiện cho mỗi tài khoản. Cấu hình khách chưa đăng nhập lưu trên thiết bị.
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

## Củng cố nghiệp vụ và triển khai — 16/10/2026

- Checkout đọc snapshot bền vững từ MongoDB thay vì phụ thuộc Redis còn giữ cache. Đối chiếu PaymentIntent, tài khoản, tiền tệ và số tiền; một checkout không thể tạo đơn cho hai giao dịch khác nhau. Giao dịch DB khóa phiên checkout khi xử lý webhook.
- Hoàn tiền đối chiếu đầy đủ đơn/cửa hàng, số tiền, tiền tệ và mã refund. Admin thử lại được lần refund failed/canceled bằng khóa idempotency xác định; xác minh chuỗi lần thử, phục hồi phản hồi bị mất và bỏ qua webhook cũ. Không coi hoàn một phần là hoàn toàn bộ đơn.
- Kết quả thanh toán phía client tách cache theo tài khoản, hủy yêu cầu cũ, không làm hỏng trang khi localStorage bị chặn; chỉ loại sản phẩm đã xác nhận khỏi giỏ đúng tài khoản.
- Chuẩn hóa thông báo lỗi thanh toán Việt/Anh bằng mã Stripe, che chi tiết tích hợp và có nút tải lại. Bổ sung bản dịch lỗi giỏ/trả hàng/đánh giá và thông báo tương thích động, giữ nguyên tên sản phẩm/thông số.
- Ảnh trả hàng kiểm tra base64 chuẩn, giới hạn trước giải mã, nội dung phải khớp MIME; chặn tải thêm khi đã gửi yêu cầu. Lỗi dịch vụ trả thông báo có thể thử lại, giữ các ảnh trước đó đã tải thành công.
- Bộ lọc PC loại người bán đình chỉ vô thời hạn hoặc chưa hết hạn; kiểm thử Mongo phát hiện và sửa trường hợp so sánh null với ngày.
- Thêm `npm run check:deployment` để kiểm tra cấu hình offline, không in secret; `npm run test:smoke:local` để kiểm tra GET local có giới hạn; quy trình staging/sao lưu/khôi phục tại `docs/deployment-runbook.md`.
- Trình duyệt với Mongo riêng: lưu/mở PC sau reload; hai tab ghi cùng revision hiển thị xung đột và chọn bản tài khoản; chuyển Việt/Anh; PC Builder không tràn ngang tại 390 px. Checkout với PaymentIntent giả hiển thị thông báo thân thiện và nút tải lại đúng. Ảnh: `tmp/pc-build-account-sync.jpg`, `tmp/checkout-recovery-verified.jpg`.
- Kiểm tra tải local: 24 GET, đồng thời 2, cả 3 endpoint đều HTTP 200, không có lỗi. Đây là smoke test với dữ liệu fixture, không xác nhận sức tải production.
- Kết quả kiểm chứng đợt này: 241 kiểm thử implementation qua; 50 kiểm thử integration trên MongoDB replica riêng qua; TypeScript toàn bộ 13 ứng dụng qua; build 10 backend và build production user UI qua. Các thay đổi cuối của admin/order đã được build lại sau khi hoàn thiện retry refund.
- Preflight trên `.env` local hiện chưa đạt vì thiếu khai báo Redis, Kafka và các origin/site/gateway/WebSocket. Các mặc định local đang cho phép một số service chạy, nhưng cần cấu hình rõ môi trường trước triển khai. Chưa sửa `.env` hoặc áp schema vào DB thật.
- Stripe test API trước đây đã có biên bản 7 ca ngày 09/10/2026 tại `docs/commerce-improvements.md`. Đợt này kiểm chứng nghiệp vụ với provider double và chữ ký Stripe SDK; chưa chạy lại API provider hoặc nhập thẻ/3DS với mã mới. ImageKit thực, GHTK, staging HTTPS và đo tải đại diện vẫn cần môi trường/credentials tương ứng. Email sau commit hiện chưa có outbox thử lại bền vững; thiếu kho sau thanh toán cần can thiệp vận hành.

## Thiết kế lại PC Builder — 16/10/2026

- Thay trang biểu mẫu đơn giản bằng bố cục cửa hàng: banner minh họa PC dạng vector, danh mục linh kiện có biểu tượng, danh sách sản phẩm và cấu hình đang chọn. Desktop lớn có ba cột; tablet dùng thanh danh mục ngang; mobile có thanh tổng tiền và nút xem cấu hình.
- Thẻ dùng ảnh thật từ catalog, dự phòng bằng biểu tượng loại linh kiện khi chưa có ảnh/lỗi ảnh; hiển thị thông số, bảo hành, tồn kho và giá. Không suy đoán hiệu năng hoặc gắn nhãn tương thích hoàn toàn.
- Chọn SKU/màu/kích thước bằng điều khiển riêng và xác nhận trước khi thay linh kiện. Giữ so sánh tối đa 3 món cùng loại, có bảng ảnh/giá/thông số thực tế và vùng cuộn trên điện thoại.
- Khung cấu hình có tiến độ 8 loại, giá từng món, sửa/xóa, gợi ý loại tiếp theo, lỗi tương thích nổi bật và ghi chú có thể mở rộng. Giá cũ bị ẩn khi đang kiểm tra hoặc lỗi; CTA giỏ chỉ bật sau quote hợp lệ. Giữ lưu/mở tài khoản, xử lý xung đột, bản thiết bị cũ và chia sẻ liên kết.
- Thêm sắp xếp giá phía máy chủ và tổng số trang theo cùng điều kiện lọc. Bộ nhãn PC tập trung tại `packages/utils/pc-builder-messages.ts`.
- Sửa menu sticky bị ép xuống dòng; các thao tác lưu/mở/chia sẻ và mở bản thiết bị cũ dùng được trên mobile. Không đổi bố cục giỏ hàng hoặc danh sách sản phẩm.
- Kiểm chứng: TypeScript user/product qua; 42 kiểm thử implementation liên quan và 3 integration Mongo PC qua; build production user qua. Trình duyệt production: mở bản đã lưu 3 linh kiện, quote 260 USD, thêm đủ 3 dòng vào giỏ; đã kiểm tra cảnh báo AM5/LGA1700 khóa CTA, so sánh, sắp xếp và lưu cấu hình. Kiểm tra viewport 390 px không tràn ngang toàn trang.
- Ảnh giao diện dùng fixture cách ly: `tmp/pc-builder-designed-desktop.jpg`, `tmp/pc-builder-designed-workspace.jpg`. Fixture thiếu ảnh linh kiện không đại diện cho catalog triển khai.
