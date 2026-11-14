# GIỚI THIỆU ĐỀ TÀI VÀ HIỆN TRẠNG DỰ ÁN ESHOP

**Ngày cập nhật:** 26/10/2026.  
**Tên dự án:** Eshop.  
**Tên đề tài:** Xây dựng hệ thống thương mại điện tử đa nhà bán hàng tích hợp công cụ xây dựng cấu hình máy tính và chatbot tư vấn.

Tài liệu tổng hợp những thành phần và chức năng đã có trong mã nguồn hiện tại. Các dịch vụ bên ngoài cần cấu hình hoặc chưa được kiểm chứng đầy đủ được ghi riêng ở phần hiện trạng tích hợp; không xem việc có mã nguồn là bằng chứng đã vận hành trên môi trường production.

## 1. Giới thiệu chung

Eshop là hệ thống thương mại điện tử theo mô hình nhiều nhà bán hàng, tập trung vào hoạt động mua bán sản phẩm công nghệ và linh kiện máy tính. Hệ thống cung cấp ba giao diện riêng cho khách hàng, người bán và quản trị viên, cùng các dịch vụ backend xử lý tài khoản, sản phẩm, thanh toán, đơn hàng, trao đổi tin nhắn và vận hành nền tảng.

Bên cạnh quy trình mua sắm, dự án có PC Builder để người dùng lựa chọn linh kiện, so sánh thông số, theo dõi tổng giá và kiểm tra một số điều kiện tương thích. Chatbot tư vấn sử dụng dữ liệu sản phẩm trong hệ thống làm ngữ cảnh để hỗ trợ trao đổi về nhu cầu và ngân sách.

Đề tài kết hợp các nghiệp vụ thương mại điện tử với những vấn đề kỹ thuật như giao dịch cơ sở dữ liệu, kiểm soát tồn kho, xử lý webhook thanh toán, đồng bộ dữ liệu giữa thiết bị, giao tiếp thời gian thực và phân quyền quản trị.

## 2. Mục tiêu của đề tài

- Xây dựng quy trình từ tìm kiếm sản phẩm, lựa chọn biến thể, thêm vào giỏ, thanh toán đến theo dõi đơn hàng và yêu cầu trả hàng.
- Cung cấp không gian quản lý riêng để người bán vận hành sản phẩm, kho hàng, đơn hàng, khuyến mãi và báo cáo.
- Cung cấp công cụ quản trị tài khoản, kiểm duyệt sản phẩm, xử lý trả hàng, hoàn tiền và theo dõi hoạt động nền tảng.
- Hỗ trợ lựa chọn cấu hình PC bằng dữ liệu sản phẩm thực tế, so sánh linh kiện và các kiểm tra tương thích có phạm vi xác định.
- Tích hợp trao đổi trực tiếp giữa người mua và cửa hàng, thông báo và chatbot tư vấn.
- Tổ chức mã nguồn dùng chung, có kiểm thử tự động và quy trình chuẩn bị triển khai.

## 3. Đối tượng sử dụng

| Đối tượng | Phạm vi sử dụng |
|---|---|
| Khách chưa đăng nhập | Xem sản phẩm, cửa hàng, ưu đãi; tìm kiếm; sử dụng giỏ hàng, yêu thích và cấu hình PC trên thiết bị; trao đổi với chatbot theo phiên. |
| Khách hàng có tài khoản | Đồng bộ dữ liệu mua sắm, quản lý hồ sơ và địa chỉ, thanh toán, theo dõi đơn, đánh giá, trả hàng và chat với cửa hàng. |
| Người bán | Quản lý cửa hàng, sản phẩm/SKU, tồn kho, đơn hàng, yêu cầu trả hàng, mã giảm giá, báo cáo và tin nhắn. |
| Quản trị viên | Quản lý hoạt động nền tảng theo quyền được cấp, gồm tài khoản, sản phẩm, đơn hàng, thanh toán, thông báo và cấu hình. |

Quản trị viên được chia thành bốn nhóm quyền:

| Vai trò | Quyền chính đã có |
|---|---|
| `owner` | Toàn bộ quyền, bao gồm đội ngũ quản trị, nhật ký và cấu hình hệ thống. |
| `operations` | Tổng quan, xử lý đơn hàng, sản phẩm, mẫu PC, trả hàng và thông báo. |
| `support` | Xử lý đơn hàng, hỗ trợ tài khoản khách hàng/người bán, trả hàng và thông báo. |
| `finance` | Xem đơn hàng, quản lý thanh toán và hoàn tiền; không có quyền thay đổi trạng thái giao hàng. |

## 4. Các chức năng đã có cho khách hàng

### 4.1. Tài khoản và hồ sơ

- Đăng ký tài khoản, xác minh OTP qua email, đăng nhập bằng email/mật khẩu và đăng xuất.
- Quên mật khẩu, đặt lại mật khẩu và đổi mật khẩu.
- Cập nhật tên hiển thị và ảnh đại diện.
- Thêm, sửa, xóa địa chỉ nhận hàng và lựa chọn địa chỉ mặc định.
- Xem, theo dõi và bỏ theo dõi cửa hàng; xem danh sách cửa hàng đang theo dõi.
- Có mã tích hợp đăng nhập Google OAuth; điều kiện kích hoạt được ghi ở mục 14.

### 4.2. Khám phá và xem sản phẩm

- Trang chủ hiển thị sản phẩm, cửa hàng nổi bật, ưu đãi và các nhóm sản phẩm gợi ý.
- Tìm kiếm theo tên sản phẩm/thương hiệu; lọc danh mục, giá, màu sắc, kích thước và tình trạng còn hàng.
- Sắp xếp và phân trang kết quả; bộ lọc được giữ trong URL để mở lại hoặc chia sẻ.
- Trang chi tiết có ảnh, mô tả, giá, thông số, bảo hành, biến thể và thông tin cửa hàng.
- Lựa chọn SKU, màu sắc và kích thước theo dữ liệu người bán cung cấp.
- Xem đánh giá, sản phẩm liên quan và thông tin trang cửa hàng.
- Có metadata cho sản phẩm/cửa hàng, sitemap và robots phục vụ việc lập chỉ mục.

### 4.3. Giỏ hàng và yêu thích

- Thêm, xóa sản phẩm và cập nhật số lượng theo từng tổ hợp sản phẩm/biến thể.
- Lưu dữ liệu trên thiết bị đối với khách; đồng bộ giỏ hàng và yêu thích theo tài khoản khi đăng nhập.
- Cho phép lựa chọn gộp giỏ khách vào tài khoản.
- Sử dụng revision để phát hiện xung đột giữa các thiết bị, cho người dùng lựa chọn bản dữ liệu cần giữ.
- Kiểm tra lại giá và tồn kho từ máy chủ; hiển thị thay đổi trước khi thanh toán.
- Giữ dữ liệu cache để có thể phục hồi thay đổi chưa đồng bộ khi kết nối gặp lỗi.

Giới hạn đồng bộ hiện tại là **100 dòng giỏ hàng** và **200 mục yêu thích** cho mỗi tài khoản. Giá lưu trong giỏ không thay thế giá được máy chủ xác nhận khi tạo phiên thanh toán.

### 4.4. Thanh toán

- Nhập hoặc chọn địa chỉ nhận hàng và xem tóm tắt đơn trước khi thanh toán.
- Kiểm tra giá, SKU, số lượng, tồn kho, mã giảm giá và phí vận chuyển tại backend.
- Thanh toán trực tuyến qua Stripe với tiền tệ **USD**.
- Tách đơn theo cửa hàng khi thanh toán sản phẩm của nhiều người bán.
- Lưu phiên thanh toán bền vững trong MongoDB và tạo biên nhận sau khi xử lý thành công.
- Xác minh webhook; đối chiếu tài khoản, giao dịch, số tiền và tiền tệ trước khi ghi đơn.
- Xử lý webhook gửi lặp để tránh tạo lại đơn hoặc trừ kho nhiều lần.
- Có cơ chế xác nhận lại giao dịch khi webhook chậm, trạng thái chờ xác nhận và nút thử lại.
- Chỉ cập nhật giỏ sau khi xác nhận kết quả thanh toán; mở URL thành công không tự được coi là đã thanh toán.

Phí vận chuyển hiện dùng cấu hình cố định **theo từng cửa hàng** qua `SHIPPING_FEE_USD`, mặc định bằng 0. Đây chưa phải phí được tính tự động từ đơn vị vận chuyển.

### 4.5. Đơn hàng, đánh giá và hậu mãi

- Xem lịch sử đơn hàng, tìm mã đơn, lọc trạng thái/ngày và phân trang.
- Xem chi tiết đơn, các mốc xử lý, mã vận đơn và thời gian giao dự kiến do người bán cập nhật.
- Mua lại sản phẩm từ đơn cũ; kiểm tra lại giá và tồn kho tại giỏ.
- Khách hàng có thể hủy đơn đang ở trạng thái `Pending` theo điều kiện của hệ thống.
- Đánh giá sao và nội dung sau khi đơn đã giao; thêm hoặc cập nhật một đánh giá của tài khoản cho từng sản phẩm.
- Yêu cầu trả toàn bộ đơn đã giao và đã thanh toán, kèm lý do và tối đa năm bằng chứng.
- Tải ảnh bằng chứng PNG/JPEG/WebP với giới hạn 5 MB/ảnh.
- Theo dõi xử lý trả hàng và tiến độ hoàn tiền; có thể khiếu nại một lần tới admin khi yêu cầu bị từ chối.

### 4.6. Tin nhắn với cửa hàng

- Trao đổi thời gian thực qua WebSocket, xem lịch sử và tải thêm tin nhắn cũ.
- Hiển thị trạng thái online, đang nhập và số tin chưa đọc.
- Gửi ảnh và tệp đính kèm; hiển thị avatar người đang trò chuyện.
- Icon Message trên header mở danh sách hội thoại; chọn một hội thoại mở box ở góc dưới bên phải.
- Đóng rồi bật lại Message sẽ về danh sách ban đầu; bản nháp vẫn được giữ theo từng hội thoại trong cùng trang.
- Nút xem chi tiết mở trang Inbox đầy đủ theo hội thoại đang chọn.
- Có tích hợp Web Push cho tin nhắn, phụ thuộc cấu hình và quyền thông báo của trình duyệt.

### 4.7. Thông báo và ngôn ngữ

- Icon chuông mở hộp thông báo ngay trên trang, có sáu mục gần nhất và nút xem tất cả.
- Trang thông báo có bộ lọc tất cả/chưa đọc, nhóm thời gian, phân trang, làm mới và đánh dấu từng mục/tất cả đã đọc.
- Số chưa đọc được đồng bộ giữa icon, popup và danh sách.
- Message và thông báo phối hợp để không mở chồng hai hộp.
- Giao diện khách hàng có bộ chọn Việt/Anh, lưu lựa chọn và định dạng ngày theo ngôn ngữ.
- Chuyển ngôn ngữ không chuyển đổi USD sang tiền tệ khác. Tên sản phẩm và nội dung do người dùng/cửa hàng nhập giữ nguyên.
- Các trang chính có bố cục responsive, trạng thái tải, lỗi, thử lại và dữ liệu trống.

## 5. PC Builder và chatbot tư vấn

### 5.1. Công cụ xây dựng cấu hình PC

PC Builder là một chức năng riêng của dự án, sử dụng catalog sản phẩm và báo giá từ backend:

- Lựa chọn tối đa tám nhóm linh kiện: CPU, bo mạch chủ, RAM, GPU, lưu trữ, nguồn, vỏ máy và tản nhiệt.
- Tìm kiếm, sắp xếp, xem ảnh, giá, thông số, bảo hành và tồn kho của linh kiện.
- Chọn SKU/biến thể, thay thế hoặc xóa linh kiện khỏi cấu hình.
- So sánh tối đa ba sản phẩm cùng loại bằng dữ liệu thông số thực tế.
- Hiển thị giá từng món, tổng giá và tiến độ lựa chọn các nhóm linh kiện.
- Kiểm tra socket CPU–bo mạch chủ, loại RAM–bo mạch chủ và công suất PSU so với khuyến nghị của GPU.
- Phân biệt kết quả kiểm tra đã đạt, thiếu thông tin và xung đột; xung đột đã xác định hoặc hết hàng chặn thêm cấu hình vào giỏ.
- Lưu/mở cấu hình trên thiết bị hoặc tài khoản, chia sẻ qua liên kết và thêm cấu hình vào giỏ.
- Kiểm tra lại giá, tồn kho và tương thích khi mở cấu hình hoặc thêm vào giỏ.
- Xử lý xung đột dữ liệu giữa các thiết bị bằng revision; mỗi tài khoản hiện lưu một cấu hình.

Bộ kiểm tra chưa bao quát BIOS, kích thước linh kiện, đầu nối, tản nhiệt và mức tiêu thụ điện toàn hệ thống. Một cấu hình được thêm vào giỏ không đồng nghĩa đã đủ linh kiện để khởi động hoặc được bảo đảm tương thích mọi trường hợp.

### 5.2. Chatbot tư vấn PC

- Có widget tư vấn trên giao diện khách hàng, hỗ trợ tiếng Việt và tiếng Anh.
- Tạo phiên trò chuyện cho khách hoặc người dùng; lưu hội thoại và tin nhắn trong MongoDB.
- Tích hợp Google Gemini để trả lời theo ngữ cảnh trao đổi và dữ liệu sản phẩm đang bán/còn hàng trong hệ thống.
- Luồng hiện tại đưa tối đa 20 tin nhắn lịch sử và 100 sản phẩm vào ngữ cảnh xử lý.
- Có xử lý timeout, lỗi/quota của nhà cung cấp và chuyển model theo cấu hình.
- Khi không thể lấy phản hồi AI, hiển thị thông báo tạm không khả dụng để người dùng thử lại.

Chatbot cần API key và dịch vụ Gemini hoạt động. Luồng chat hiện tại không có tìm kiếm web và không tự chuyển sang một bộ tư vấn thông minh chạy offline khi AI lỗi.

## 6. Các chức năng đã có cho người bán

| Nhóm chức năng | Nội dung đã triển khai |
|---|---|
| Tài khoản và cửa hàng | Đăng ký/xác minh OTP, đăng nhập người bán, tạo cửa hàng; có luồng liên kết Stripe Connect; quản lý tên, mô tả, ảnh đại diện, banner, địa chỉ, giờ hoạt động, website và liên kết mạng xã hội. |
| Tổng quan | Thống kê doanh thu, đơn hàng, sản phẩm; biểu đồ doanh thu, đơn gần đây, sản phẩm bán chạy và cảnh báo tồn kho. |
| Sản phẩm | Tạo/sửa sản phẩm, ảnh, nội dung, danh mục, giá, tùy chọn và thông số; tìm kiếm, lọc, phân trang, xóa mềm và khôi phục theo điều kiện. |
| SKU và kho hàng | Quản lý SKU, giá và tồn kho theo biến thể; điều chỉnh kho, xem lịch sử và danh sách sắp hết hàng. |
| Thông số linh kiện | Gợi ý tên trường theo nhóm linh kiện để người bán điền dữ liệu phục vụ PC Builder; không tự suy đoán thông số từ tên sản phẩm. |
| Khuyến mãi | Tạo/xóa mã giảm giá và gán mã cho sản phẩm thuộc cửa hàng; xóa mã đồng thời dọn tham chiếu trên các sản phẩm liên quan. |
| Đơn hàng | Tìm kiếm/lọc/phân trang, xem chi tiết; xác nhận, xử lý, giao hàng, cập nhật mã vận đơn, ngày dự kiến và lý do hủy. |
| Trả hàng | Xem yêu cầu/bằng chứng, chấp thuận hoặc từ chối và xác nhận nhận hàng trả trong chi tiết đơn. |
| Thanh toán | Xem thống kê và lịch sử thanh toán đơn hàng bằng USD, trạng thái liên quan đến hoàn tiền. |
| Báo cáo | Báo cáo theo khoảng thời gian, doanh thu, sản phẩm bán chạy, hiệu quả mã giảm giá; xuất CSV và in/lưu PDF qua trình duyệt. |
| Liên lạc | Inbox thời gian thực, thông báo, lọc chưa đọc và đánh dấu đã đọc. |

Giao diện người bán có menu và bố cục quản lý thống nhất, xử lý trạng thái tải/lỗi, giữ nội dung biểu mẫu khi lưu thất bại hoặc dữ liệu nền làm mới. Trang thanh toán người bán thể hiện dữ liệu đơn hàng; không phải hệ thống số dư ngân hàng hay rút tiền tự động. Luồng liên kết Stripe Connect cần cấu hình và kiểm chứng với tài khoản nhà cung cấp của môi trường sử dụng.

## 7. Các chức năng đã có cho quản trị viên

### 7.1. Giám sát và điều hành

- Dashboard tổng quan doanh thu, đăng ký, sản phẩm nổi bật và tình trạng vận hành.
- Theo dõi đơn chờ lâu, hoàn tiền đang chờ và yêu cầu trả hàng đang mở.
- Xem/tìm/lọc các danh sách khách hàng, người bán, cửa hàng, sản phẩm và đơn hàng theo quyền.
- Khóa/mở tài khoản khách hàng và người bán, có lý do và thời hạn.
- Kiểm duyệt, ẩn và khôi phục sản phẩm; sản phẩm bị admin ẩn không được người bán tự đăng lại.
- Xử lý yêu cầu trả hàng, xem bằng chứng, lịch sử và khiếu nại.
- Xem thanh toán và xử lý hoàn tiền theo đơn, có kiểm tra trạng thái và lý do.

### 7.2. Quản trị nền tảng

- Quản lý đội ngũ admin và quyền `owner`, `operations`, `support`, `finance`.
- Ghi nhật ký người thao tác, đối tượng, lý do và dữ liệu trước/sau; có cơ chế bảo vệ owner cuối cùng khi thay đổi quyền đồng thời.
- Quản lý mẫu cấu hình PC: nội dung, mục đích, khoảng ngân sách, linh kiện/sản phẩm liên kết, bản nháp và xuất bản.
- Quản lý danh mục/cấu hình trang, logo và banner.
- Gửi thông báo tới người nhận hoặc nhóm đối tượng; gửi toàn bộ cần xác nhận.
- Gửi thông báo qua công việc nền có tiến độ, xử lý theo lô, chống gửi lặp và tiếp tục sau lỗi.
- Xem/lọc hành vi, nhật ký, biểu đồ hoạt động; xuất CSV/JSON ở các chức năng hỗ trợ.
- Cấu hình nhóm hành vi cần ghi log.

Quyền được kiểm tra tại API và phản ánh trên menu giao diện. Các thao tác như thay đổi quyền, xử lý đơn và hoàn tiền yêu cầu quyền phù hợp; không chỉ dựa vào việc ẩn nút ở frontend.

## 8. Gợi ý sản phẩm, thống kê và sự kiện

- Có dịch vụ gợi ý sản phẩm theo người dùng, độ tương tự sản phẩm và xu hướng.
- Thu thập các sự kiện mua sắm như xem sản phẩm, thay đổi giỏ hàng và yêu thích để phục vụ phân tích/gợi ý.
- Sử dụng Kafka để chuyển các sự kiện và consumer để xử lý dữ liệu nền.
- Lưu dữ liệu phân tích người dùng/sản phẩm và nhật ký hành vi trong MongoDB.
- Có cấu hình bật/tắt ghi nhận theo nhóm hành vi và giao diện xem/xuất nhật ký.

Phần gợi ý sản phẩm dựa trên dữ liệu và logic chấm điểm trong dự án; không được mô tả là một mô hình học máy đã được huấn luyện, đo độ chính xác hoặc đánh giá hiệu quả kinh doanh độc lập.

## 9. Kiến trúc và tổ chức mã nguồn

Dự án được tổ chức dưới dạng **Nx monorepo với TypeScript**, gồm **ba giao diện và mười dịch vụ backend**. Các giao diện gọi HTTP API qua gateway; chat thời gian thực sử dụng kết nối WebSocket riêng theo cấu hình. MongoDB lưu dữ liệu nghiệp vụ, Redis phục vụ dữ liệu tạm và Kafka phục vụ trao đổi/xử lý sự kiện.

| Thành phần | Vai trò |
|---|---|
| `apps/user-ui` | Giao diện mua sắm, tài khoản khách hàng, PC Builder và chatbot. |
| `apps/seller-ui` | Không gian quản lý của người bán. |
| `apps/admin-ui` | Không gian quản trị nền tảng. |
| `apps/api-gateway` | Điểm vào HTTP API, định tuyến yêu cầu và giới hạn tần suất. |
| `apps/auth-service` | Tài khoản, phiên đăng nhập, hồ sơ, địa chỉ và các chức năng tài khoản. |
| `apps/product-service` | Sản phẩm, cửa hàng, SKU, kho, khuyến mãi, đánh giá và API PC Builder. |
| `apps/order-service` | Checkout, Stripe/webhook, đơn hàng, trả hàng và hoàn tiền. |
| `apps/admin-service` | Nghiệp vụ quản trị, báo cáo, nhật ký và công việc gửi thông báo. |
| `apps/recommendation-service` | API gợi ý, tương tự và xu hướng sản phẩm. |
| `apps/chatting-service` | Hội thoại người mua–người bán, WebSocket, tệp đính kèm và thông báo chat. |
| `apps/chatbot-service` | Phiên hội thoại và tích hợp AI tư vấn. |
| `apps/logger-service` | Tiếp nhận/truyền log thời gian thực. |
| `apps/kafka-service` | Consumer xử lý sự kiện và dữ liệu phân tích. |
| `packages` | Thành phần giao diện, thư viện, middleware, tiện ích và quy tắc nghiệp vụ dùng chung. |
| `prisma` | Schema cơ sở dữ liệu và cấu hình Prisma. |
| `tests`, `scripts`, `docs` | Kiểm thử, công cụ kiểm tra/vận hành và tài liệu dự án. |

## 10. Công nghệ và công cụ sử dụng

| Lớp | Công nghệ đã sử dụng |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS, Lucide React. |
| Dữ liệu phía giao diện | TanStack Query, Zustand, Axios và các hook/thành phần dùng chung. |
| Backend | Node.js, Express, TypeScript. |
| Cơ sở dữ liệu | MongoDB, Prisma Client; sử dụng transaction trên replica set. |
| Dữ liệu tạm | Redis qua ioredis. |
| Sự kiện | Apache Kafka, KafkaJS. |
| Thời gian thực | WebSocket qua thư viện `ws`; Web Push khi được cấu hình. |
| Xác thực | JWT, bcrypt, cookie HttpOnly, OTP email; mã tích hợp Google OAuth. |
| Dịch vụ ngoài | Stripe, ImageKit, Nodemailer/SMTP và Google Gemini. |
| Kiểm thử | Jest, Supertest, MongoDB Memory Server và API fixture cho kiểm thử giao diện. |
| Quản lý/triển khai | Nx, npm, Docker, Docker Compose và GitHub Actions. |

## 11. Cơ sở dữ liệu hiện có

Schema hiện tại có **37 model/collection, 4 enum và 19 quan hệ khai báo bằng `@relation`**. Các nhóm dữ liệu chính gồm:

| Nhóm | Collection |
|---|---|
| Tài khoản và cửa hàng | `users`, `sellers`, `shops`, `address`, `images`, `shopReviews`, `oauthIdentity`, `shoppingState`. |
| Sản phẩm và tồn kho | `products`, `productVariant`, `productReviews`, `inventoryHistory`, `discountCodes`, `productAnalytics`, `site_config`. |
| Đơn hàng và thanh toán | `orders`, `orderItems`, `paymentSession`, `paymentReceipt`, `orderEvent`, `returnRequest`. |
| Tin nhắn và thông báo | `conversationGroup`, `Participant`, `message`, `chatAttachment`, `pushSubscription`, `notifications`. |
| PC Builder và chatbot | `pcBuildTemplate`, `savedPcBuild`, `chatbotConversation`, `chatbotMessage`. |
| Quản trị và phân tích | `adminAudit`, `adminGuard`, `notificationJob`, `behaviorLog`, `log_config`, `userAnalytics`. |

Giỏ hàng/yêu thích được lưu trong `shoppingState.payload`; cấu hình PC nằm trong `savedPcBuild.parts`; danh mục nằm trong `site_config`. Đây là dữ liệu nhúng/mảng, không phải các collection riêng. Địa chỉ nhận hàng và thông tin sản phẩm trong đơn có dữ liệu chụp lại để giữ lịch sử mua hàng.

Ngoài quan hệ Prisma, một số liên kết chỉ lưu ID và được xử lý ở tầng ứng dụng. Sơ đồ đã phân biệt hai loại liên kết này; MongoDB không có khóa ngoại vật lý như hệ quản trị quan hệ.

Tài liệu và sơ đồ: [Mô tả database](docs/database-schema.md), [sơ đồ đầy đủ SVG](docs/diagrams/database-full.svg), [ảnh tổng quan PNG](docs/diagrams/database-overview.png).

## 12. Các quy trình nghiệp vụ đã được xây dựng

### 12.1. Mua hàng và giao hàng

1. Khách tìm sản phẩm, chọn SKU và thêm vào giỏ.
2. Backend kiểm tra lại giá, kho, mã giảm giá, địa chỉ và phí theo cửa hàng.
3. Hệ thống tạo phiên thanh toán và xử lý thanh toán Stripe.
4. Khi được xác nhận hợp lệ, giao dịch database ghi đơn, chi tiết đơn, trừ tồn kho và lưu biên nhận.
5. Người bán xử lý đơn theo chuỗi `Pending → Confirmed → Processing → Shipped → Delivered`.
6. Khách theo dõi đơn, mua lại hoặc đánh giá sau khi giao.

### 12.2. Trả hàng và hoàn tiền

1. Khách gửi yêu cầu trả toàn đơn đủ điều kiện, kèm lý do và bằng chứng.
2. Người bán xem xét, chấp thuận hoặc từ chối.
3. Khi nhận lại hàng, người bán xác nhận; đơn chuyển về `Returned` theo luồng trả hàng.
4. Admin có quyền tài chính thực hiện hoàn tiền và theo dõi kết quả từ Stripe.
5. Nếu bị từ chối, khách có thể gửi khiếu nại để admin xem xét.

Hàng trả không tự động nhập lại kho: cần kiểm tra tình trạng và điều chỉnh kho chủ động. Hoàn tiền có kiểm tra thông tin giao dịch và cơ chế xử lý lặp/thử lại; không coi hoàn một phần là đã hoàn toàn bộ đơn.

### 12.3. Lựa chọn cấu hình PC

1. Người dùng chọn nhóm linh kiện, tìm kiếm và so sánh các sản phẩm phù hợp.
2. Hệ thống lấy báo giá và kiểm tra các điều kiện tương thích được hỗ trợ.
3. Người dùng chỉnh sửa, lưu hoặc chia sẻ cấu hình.
4. Khi thêm vào giỏ, hệ thống kiểm tra lại giá/kho/xung đột và tạo các dòng sản phẩm tương ứng.

## 13. Cơ chế kiểm soát dữ liệu đã có

- Băm mật khẩu bằng bcrypt; sử dụng access token, refresh token và cookie HttpOnly.
- Phân biệt phiên người mua và người bán, xử lý làm mới phiên ở API client.
- Kiểm tra vai trò, quyền sở hữu tài nguyên và trạng thái đình chỉ tài khoản tại các luồng liên quan.
- Tách dữ liệu cache theo tài khoản cho các chức năng đồng bộ, thanh toán, chat và thông báo.
- Kiểm tra dữ liệu đầu vào, loại/kích thước tệp và định dạng ảnh ở các API upload liên quan.
- Dùng transaction cho những thay đổi liên quan giữa đơn hàng, tồn kho và biên nhận.
- Dùng revision cho dữ liệu mua sắm/cấu hình và idempotency cho các luồng thanh toán, hoàn tiền, gửi thông báo.
- Lưu lịch sử thay đổi kho, trạng thái đơn và thao tác quản trị.
- Có giới hạn tần suất yêu cầu tại gateway.

Những cơ chế này mô tả phần đã triển khai, không thay thế một đợt kiểm toán bảo mật toàn hệ thống hoặc kiểm tra cấu hình môi trường thực tế.

## 14. Hiện trạng tích hợp và giới hạn cần nêu khi báo cáo

| Hạng mục | Hiện trạng |
|---|---|
| Stripe | Đã tích hợp thanh toán, webhook và hoàn tiền; tài liệu ghi nhận một đợt kiểm chứng API test mode ngày 09/10/2026. Cần kiểm chứng lại phiên bản chuẩn bị triển khai, luồng nhập thẻ/3DS và cấu hình webhook của môi trường đích. Không coi test mode là thanh toán tiền thật. |
| ImageKit | Có mã tải ảnh/tệp và kiểm tra đầu vào; cần cấu hình dịch vụ và kiểm chứng upload với tài khoản/môi trường triển khai. |
| Email | Đăng ký OTP và email liên quan đến đơn cần SMTP hoạt động. Email sau giao dịch chưa có outbox thử lại bền vững. |
| Google OAuth | Có nút giao diện, route và xử lý OAuth trong mã nguồn; cần client ID/secret, redirect URI, Redis và kiểm chứng callback. Chưa được coi là đã nghiệm thu với nhà cung cấp. |
| Gemini | Có tích hợp chatbot; chất lượng/khả dụng phụ thuộc model, API key, quota và dữ liệu catalog. Khi AI lỗi, hệ thống báo tạm không khả dụng. |
| Web Push | Có mã tích hợp; cần VAPID, môi trường trình duyệt phù hợp và sự cho phép của người dùng. |
| GHTK | Mới có tài liệu và script kiểm tra phí ở chế độ chỉ đọc; chưa hoàn thiện tích hợp phí vào checkout, tạo vận đơn, tracking hay callback thực tế. |
| Tương thích PC | Chỉ kiểm tra những điều kiện đã nêu; thông số thiếu hoặc mâu thuẫn vẫn cần người dùng/người bán xác minh. |
| Tồn kho khi thanh toán | Có kiểm tra và rollback giao dịch khi xung đột, nhưng chưa có giữ chỗ tồn kho trước thanh toán hoặc bù trừ tự động toàn bộ khi thanh toán xong mà thiếu hàng. |
| Phạm vi hậu mãi | Hiện tập trung trả/hoàn toàn bộ đơn; chưa có quy trình trả một phần hoặc quản lý bảo hành chuyên biệt. |
| Triển khai | Đã có Docker/CI và runbook; chưa có bằng chứng nghiệm thu production hoàn chỉnh chỉ từ việc có các cấu hình này. |

Catalog và checkout dùng USD trong khi API phí GHTK trả VND. Muốn nối phí vận chuyển thực tế cần dữ liệu địa chỉ có cấu trúc, cân nặng đóng gói, điểm lấy hàng cho từng shop và chính sách quy đổi rõ ràng; hiện không tự giả định tỷ giá.

## 15. Kiểm thử và công cụ triển khai đã có

- Bộ kiểm thử implementation cho xác thực/phân quyền, sản phẩm/SKU, đơn hàng, thanh toán, hoàn tiền, đồng bộ dữ liệu, PC Builder, chat, thông báo và báo cáo.
- Kiểm thử tích hợp sử dụng MongoDB replica set tạm để kiểm tra transaction, unique index và thao tác đồng thời.
- API fixture dành cho kiểm tra giao diện với dữ liệu cách ly và các dịch vụ ngoài được thay bằng test double khi cần.
- Script kiểm tra TypeScript, build backend, kiểm tra cấu hình offline và smoke test GET local có giới hạn.
- Script kiểm chứng Stripe test mode và script chuẩn bị kiểm tra phí GHTK.
- Dockerfile cho các ứng dụng/dịch vụ và Docker Compose cho môi trường phát triển.
- GitHub Actions có các bước kiểm tra/build và công bố image theo mã commit; chưa đồng nghĩa có CD production tự động.
- Runbook cho staging, sao lưu, khôi phục, quan sát sau triển khai và rollback.

Các lệnh kiểm tra được cung cấp trong dự án:

```sh
npm run typecheck
npm run test:implementation
npm run test:integration
npm run build:services
npm run check:deployment
npm run test:smoke:local
```

Việc chạy cần đúng cấu hình và môi trường tương ứng; xem README/runbook trước khi thực hiện. Tài liệu này không chạy lại các lệnh trên và không tổng hợp số kiểm thử từ những biên bản khác thời điểm thành kết quả nghiệm thu hiện tại. Smoke test local cũng không xác nhận sức tải production.

## 16. Tài liệu hiện có trong dự án

| Tài liệu | Nội dung |
|---|---|
| [README](README.md) | Tổng quan ứng dụng, cách cài đặt, khởi chạy và kiểm tra. |
| [Chức năng khách hàng](docs/user-improvements.md) | Các thay đổi của storefront, giỏ hàng, PC Builder, ngôn ngữ, chat và thông báo. |
| [Chức năng người bán](docs/seller-improvements.md) | Không gian quản lý, biểu mẫu, sản phẩm, SKU, báo cáo và các giới hạn kiểm chứng. |
| [Chức năng quản trị](docs/admin-improvements.md) | Phân quyền, kiểm duyệt, trả hàng, thông báo nền và nhật ký. |
| [Nghiệp vụ thương mại](docs/commerce-improvements.md) | Thanh toán, kho, trạng thái đơn, trả hàng, tương thích PC và bằng chứng kiểm tra theo từng đợt. |
| [Cơ sở dữ liệu](docs/database-schema.md) | 37 collection, quan hệ, ràng buộc và các sơ đồ PNG/SVG/Mermaid. |
| [Thông số sản phẩm](docs/product-specifications.md) | Quy trình và ghi nhận bổ sung thông số linh kiện. |
| [Chuẩn bị vận chuyển GHTK](docs/ghtk-setup.md) | Cấu hình, script kiểm tra phí và những điều kiện còn thiếu trước tích hợp checkout. |
| [Quy trình triển khai](docs/deployment-runbook.md) | Kiểm tra môi trường, staging, sao lưu/khôi phục và rollback. |
| [Theo dõi nghiệm thu ban đầu](docs/implementation-progress.md) | Mốc kiểm tra và phạm vi nghiệm thu lịch sử; cần đọc cùng các tài liệu cập nhật mới hơn. |
