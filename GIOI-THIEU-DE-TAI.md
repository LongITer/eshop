# Giới thiệu đề tài Eshop

## 1. Tên đề tài

**Xây dựng nền tảng thương mại điện tử đa nhà bán hàng sử dụng kiến trúc microservices**

Tên hệ thống: **Eshop**

## 2. Bối cảnh và lý do chọn đề tài

Thương mại điện tử hiện nay không chỉ yêu cầu chức năng hiển thị sản phẩm và đặt hàng, mà còn cần hỗ trợ nhiều nhà bán hàng, thanh toán trực tuyến, quản lý tồn kho, theo dõi đơn hàng và khai thác dữ liệu hành vi người dùng.

Đề tài Eshop được thực hiện nhằm xây dựng một nền tảng mô phỏng quy trình thương mại điện tử tương đối đầy đủ. Hệ thống tách các nhóm chức năng thành các dịch vụ độc lập, giúp dễ phát triển, kiểm thử, mở rộng và bảo trì hơn so với mô hình ứng dụng đơn khối.

## 3. Mục tiêu của đề tài

- Xây dựng nền tảng cho phép nhiều seller tạo và quản lý shop riêng.
- Cung cấp giao diện mua sắm cho người dùng và giao diện quản trị cho seller.
- Xây dựng quy trình đăng ký, đăng nhập, xác minh OTP và bảo vệ tài khoản.
- Hỗ trợ tìm kiếm, lọc, xem chi tiết sản phẩm, giỏ hàng và danh sách yêu thích.
- Xây dựng quy trình checkout, thanh toán trực tuyến và theo dõi trạng thái đơn hàng.
- Ghi nhận các sự kiện tương tác của người dùng để phục vụ phân tích sản phẩm.
- Áp dụng các công nghệ phổ biến trong phát triển hệ thống phân tán hiện đại.

## 4. Đối tượng sử dụng

### Người mua

Người mua có thể đăng ký tài khoản, duyệt sản phẩm và shop, tìm kiếm theo danh mục, quản lý địa chỉ, thêm sản phẩm vào giỏ hàng hoặc danh sách yêu thích, thanh toán và theo dõi đơn hàng.

### Seller

Seller có thể đăng ký tài khoản, tạo shop, quản lý thông tin shop, đăng bán sản phẩm, quản lý tồn kho, mã giảm giá và cập nhật trạng thái đơn hàng.

## 5. Phạm vi chức năng

### Chức năng dành cho người mua

- Đăng ký, đăng nhập, xác minh email bằng OTP và khôi phục mật khẩu.
- Xem danh sách sản phẩm, shop nổi bật, sản phẩm khuyến mãi.
- Tìm kiếm và lọc sản phẩm hoặc shop.
- Xem thông tin chi tiết, hình ảnh, biến thể, giá và tồn kho của sản phẩm.
- Thêm, cập nhật và xóa sản phẩm trong giỏ hàng.
- Quản lý danh sách yêu thích và địa chỉ giao hàng.
- Tạo đơn hàng và thanh toán trực tuyến qua Stripe.
- Xem lịch sử đơn hàng, trạng thái giao hàng và thông báo.
- Đánh giá shop sau khi mua hàng.

### Chức năng dành cho seller

- Đăng ký và đăng nhập tài khoản seller.
- Tạo và cập nhật thông tin shop.
- Thêm, sửa, ẩn hoặc xóa sản phẩm.
- Quản lý hình ảnh, danh mục, biến thể, giá và tồn kho.
- Tạo và quản lý mã giảm giá.
- Xem đơn hàng của shop và cập nhật trạng thái xử lý.
- Kết nối tài khoản Stripe để nhận thanh toán.
- Nhận thông báo về đơn hàng mới, tồn kho thấp và hoạt động liên quan.

## 6. Kiến trúc hệ thống

Hệ thống được tổ chức theo mô hình monorepo bằng Nx, trong đó các ứng dụng backend được chia thành các service độc lập và frontend được tách theo vai trò người dùng.

```text
Người mua                 Seller
    |                       |
 User UI                Seller UI
    \                       /
             API Gateway
                  |
    +-------------+-------------+-------------+
    |             |             |             |
Auth Service  Product Service  Order Service  Kafka Service
    |             |             |             |
    +-------------+-------------+-------------+
                  |
       MongoDB / Redis / Stripe / ImageKit
```

### Các thành phần chính

- **API Gateway:** điểm tiếp nhận request từ frontend, định tuyến request đến service phù hợp, xử lý CORS, cookie, giới hạn tần suất và logging.
- **Auth Service:** quản lý tài khoản người dùng và seller, xác thực OTP, JWT access/refresh token, địa chỉ và thông tin shop.
- **Product Service:** quản lý danh mục, shop, sản phẩm, hình ảnh, tìm kiếm, lọc và mã giảm giá.
- **Order Service:** xử lý checkout, kiểm tra tồn kho, tạo đơn hàng, thanh toán và vòng đời đơn hàng.
- **Kafka Service:** tiếp nhận các sự kiện như xem sản phẩm, thêm vào giỏ hàng, thêm vào yêu thích và mua hàng để cập nhật dữ liệu phân tích.
- **User UI:** giao diện dành cho người mua.
- **Seller UI:** giao diện dành cho seller.

## 7. Quy trình nghiệp vụ tiêu biểu

### Quy trình mua hàng

1. Người dùng đăng ký tài khoản và xác minh bằng mã OTP gửi qua email.
2. Người dùng đăng nhập và duyệt, tìm kiếm hoặc lọc sản phẩm.
3. Người dùng xem chi tiết sản phẩm, chọn biến thể và thêm sản phẩm vào giỏ hàng.
4. Khi checkout, hệ thống kiểm tra sản phẩm còn hoạt động, tồn kho và địa chỉ giao hàng.
5. Hệ thống tạo phiên thanh toán tạm thời trên Redis và khởi tạo Payment Intent với Stripe.
6. Sau khi thanh toán thành công, đơn hàng được tạo và tồn kho được cập nhật.
7. Người mua theo dõi đơn hàng qua các trạng thái: `Pending`, `Confirmed`, `Processing`, `Shipped`, `Delivered`, `Cancelled`, `Returned` hoặc `Refunded`.
8. Các thao tác quan trọng được gửi qua Kafka để cập nhật dữ liệu analytics.

### Quy trình dành cho seller

1. Seller đăng ký tài khoản và đăng nhập vào Seller UI.
2. Seller tạo shop và cập nhật thông tin như tên, mô tả, địa chỉ, giờ mở cửa và liên kết mạng xã hội.
3. Seller đăng sản phẩm với thông tin giá, hình ảnh, danh mục, biến thể, bảo hành và tồn kho.
4. Seller theo dõi đơn hàng phát sinh từ shop.
5. Seller xác nhận, xử lý, giao hàng hoặc cập nhật các trạng thái phù hợp.

## 8. Công nghệ sử dụng

### Backend và kiến trúc

- TypeScript và Node.js.
- Express.js để xây dựng các service HTTP.
- Nx Monorepo để quản lý nhiều ứng dụng và thư viện dùng chung.
- API Gateway để định tuyến và tập trung các xử lý dùng chung.

### Frontend

- Next.js và React.
- Tailwind CSS.
- TanStack Query, Zustand và Jotai cho truy vấn và quản lý trạng thái.
- React Hook Form cho biểu mẫu.

### Dữ liệu và hạ tầng

- MongoDB làm cơ sở dữ liệu chính.
- Prisma ORM để định nghĩa schema và truy cập dữ liệu.
- Redis để lưu trữ dữ liệu tạm thời, đặc biệt là phiên thanh toán.
- Apache Kafka và KafkaJS để xử lý các sự kiện bất đồng bộ.

### Dịch vụ tích hợp

- Stripe cho thanh toán trực tuyến và kết nối tài khoản seller.
- ImageKit cho lưu trữ và xử lý hình ảnh.
- Nodemailer cho email xác minh OTP và các thông báo liên quan.
- Swagger cho tài liệu và kiểm thử API.
- JWT và bcryptjs cho xác thực, phân quyền và bảo vệ mật khẩu.

## 9. Mô hình dữ liệu chính

Cơ sở dữ liệu gồm các nhóm dữ liệu chính:

- **Tài khoản:** người dùng, seller, địa chỉ và thông báo.
- **Kinh doanh:** shop, sản phẩm, hình ảnh, danh mục và mã giảm giá.
- **Đơn hàng:** đơn hàng, chi tiết đơn hàng, phương thức thanh toán và địa chỉ giao hàng.
- **Đánh giá:** đánh giá và xếp hạng shop.
- **Phân tích:** lịch sử hành vi người dùng và các chỉ số của sản phẩm như lượt xem, lượt thêm giỏ hàng, lượt yêu thích và lượt mua.

## 10. Kết quả đạt được

- Xây dựng được cấu trúc hệ thống gồm nhiều backend service và hai frontend theo vai trò.
- Hoàn thiện các luồng chính của nền tảng thương mại điện tử: tài khoản, shop, sản phẩm, giỏ hàng, checkout, thanh toán và đơn hàng.
- Tích hợp các dịch vụ bên thứ ba cho thanh toán, email và hình ảnh.
- Áp dụng cơ chế giao tiếp bất đồng bộ để thu thập dữ liệu hành vi.
- Có schema dữ liệu tương đối đầy đủ cho các nghiệp vụ mua bán và phân tích.
- Tạo nền tảng để tiếp tục mở rộng các tính năng như đề xuất sản phẩm, báo cáo doanh thu và quản lý vận hành.

## 11. Hạn chế và hướng phát triển

### Hạn chế hiện tại

- Hệ thống đang tập trung vào các chức năng cốt lõi của thương mại điện tử.
- Các chức năng quản trị cấp nền tảng và báo cáo chuyên sâu chưa phải trọng tâm chính.
- Cơ chế triển khai, giám sát và tự động mở rộng có thể tiếp tục hoàn thiện.

### Hướng phát triển

- Xây dựng trang quản trị dành cho administrator.
- Phát triển hệ thống gợi ý sản phẩm dựa trên dữ liệu hành vi từ Kafka.
- Bổ sung báo cáo doanh thu, sản phẩm bán chạy và hiệu quả mã giảm giá.
- Hoàn thiện cơ chế tồn kho phân tán và xử lý các trường hợp thanh toán thất bại.
- Bổ sung kiểm thử tích hợp, kiểm thử tải và theo dõi hệ thống trong môi trường triển khai thực tế.
- Đóng gói và triển khai các service bằng Docker, kết hợp CI/CD.

## 12. Tóm tắt

Eshop là một nền tảng thương mại điện tử đa nhà bán hàng được xây dựng theo hướng microservices. Đề tài tập trung giải quyết quy trình từ quản lý tài khoản, shop và sản phẩm đến giỏ hàng, thanh toán, xử lý đơn hàng và phân tích hành vi người dùng. Thông qua đề tài, các kiến thức về phát triển web, kiến trúc phân tán, cơ sở dữ liệu, xử lý sự kiện và tích hợp dịch vụ bên thứ ba được kết hợp trong một hệ thống thực tế.
