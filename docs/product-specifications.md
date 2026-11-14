# Bổ sung specification sản phẩm — 17/10/2026

Đã cập nhật trực tiếp database `development` đang cấu hình của dự án. Đây là thay đổi dữ liệu danh mục; không thay đổi giao diện hoặc schema.

## Kết quả

- Rà soát 52 sản phẩm chưa xóa; bỏ qua iPhone 12 Pro theo xác nhận của người dùng vì là dữ liệu test.
- Trong 51 sản phẩm còn lại, 50 sản phẩm được cập nhật, thêm 250 trường và sửa 1 giá trị sai. Intel Core i5-13600KF đã đủ thông số chính nên giữ nguyên.
- Đã điền specification cho 27 sản phẩm trước đó có mảng rỗng, gồm 26 linh kiện và 1 bó hoa. Sau cập nhật, không còn specification rỗng trong 51 sản phẩm được rà soát ngoài dữ liệu test.
- Thông số phần cứng được đối chiếu từ 68 URL thuộc hãng sản xuất, cửa hàng chính thức hoặc tài liệu hỗ trợ chính hãng. Thông số bó hoa chỉ sắp xếp lại nội dung mô tả hiện có của seller.

| Nhóm | Sản phẩm rà soát | Trường thêm |
| --- | ---: | ---: |
| CPU | 5 | 20 |
| Mainboard | 5 | 40 |
| RAM | 5 | 23 |
| GPU | 10 | 40 |
| PSU | 5 | 25 |
| Storage | 5 | 31 |
| Case | 5 | 31 |
| Cooling | 10 | 36 |
| Decor | 1 | 4 |
| Tổng | 51 | 250 |

Intel Core i7-14700K trước đây có `Threads = "3.4 GHz"`. Đã sửa thành `28` và bổ sung `Performance-core Base Frequency = "3.4 GHz"`, đúng với [thông số Intel](https://www.intel.com/content/www/us/en/products/sku/236783/intel-core-i7-processor-14700k-33m-cache-up-to-5-60-ghz/specifications.html).

Các trường phục vụ Build PC dùng nhãn dễ đọc `Socket`, `Memory Type`, `Wattage`, `Recommended PSU Watts`. Bộ kiểm tra hiện có nhận các nhãn này qua alias; không tạo trùng trường có cùng ý nghĩa. Mảng `{ name, value }` được giữ để trang chi tiết, seller và Build PC đọc được trực tiếp.

## Phạm vi xác minh và chi tiết còn thiếu

- Năm bộ RAM chưa có mã part number: đã điền dòng sản phẩm, DDR, dung lượng tổng, tốc độ định mức và RGB khi tên xác định. Chưa suy đoán số thanh, timing, điện áp, XMP/EXPO hoặc màu. Tốc độ định mức không phải cam kết tốc độ mặc định trên mọi nền tảng.
- NZXT H9 Flow, NZXT C1000 Gold, Seasonic Focus GX-850, Corsair RM850x SHIFT và MSI MAG A750GL PCIE5 có nhiều đời: chỉ bổ sung thông số chung đã xác minh; không suy đoán chuẩn ATX, dây GPU hoặc kích thước phụ thuộc phiên bản.
- Gigabyte B650 AORUS ELITE AX thiếu PCB revision: chỉ dùng thông số chung của rev. 1.0/1.1 và 1.2.
- Seagate IronWolf 4TB thiếu mã ổ: chưa điền RPM hoặc cache vì các model có thông số khác nhau.
- Corsair 5000D có giới hạn chiều dài GPU/PSU khác nhau giữa tài liệu cũ và trang hiện tại: bỏ qua hai giới hạn này. ASUS B650E-F không thêm trường chipset khi cách ghi trên trang hãng và tên nền tảng chưa thống nhất.
- Lian Li Galahad II LCD giữ nguyên thông số pump của dữ liệu cũ vì chưa xác định revision. NZXT Kraken Elite khớp đời 2023 theo màn hình, tốc độ pump và airflow đã lưu. Các socket tản nhiệt vẫn cần đối chiếu bộ ngàm thực tế được giao.
- Noctua NH-D15 ghi rõ điều kiện chiều cao 168 mm với hai quạt và RAM cao tối đa 32 mm theo [FAQ hiện tại của Noctua](https://www.noctua.at/en/support/faqs/how-can-i-ensure-both-case-and-ram-compatibility-with-my-nh-d15); RAM cao hơn có thể cần nâng quạt và tăng chiều cao lắp đặt.
- Bó hoa chưa có số cành, kích thước hoặc thông tin bình đi kèm; không tự tạo các thông tin này.

## Cách cập nhật và kiểm chứng

Đã chụp dữ liệu gốc và lưu kế hoạch trước khi ghi. Mỗi lần cập nhật chỉ thay đổi `custom_specification` và timestamp do Prisma quản lý. Script kiểm tra lại tên, slug, hãng, nhóm sản phẩm, trạng thái, thông số gốc và `updatedAt`; lệnh ghi có điều kiện theo timestamp để tránh đè thay đổi đồng thời. Không có xung đột hoặc lần ghi thất bại.

Đã đọc lại toàn bộ danh mục và đối chiếu chính xác với kế hoạch. Dữ liệu sau ghi được đưa qua bộ kiểm tra Build PC thực tế:

| Cặp kiểm tra | Số cặp | Đạt phép kiểm tra | Xung đột | Thiếu thông số |
| --- | ---: | ---: | ---: | ---: |
| CPU / mainboard socket | 25 | 9 | 16 | 0 |
| RAM / mainboard DDR | 25 | 17 | 8 | 0 |
| GPU / PSU công suất | 50 | 46 | 4 | 0 |

Đã chạy 30 tests hiện có của `pc-compatibility` và `pc-compatibility-summary`, đều đạt. Các cặp xung đột vẫn bị phát hiện, gồm CPU khác socket, RAM khác DDR và nguồn 750 W thấp hơn khuyến nghị của một số GPU. Kết quả đạt từng phép kiểm tra không xác nhận toàn bộ cấu hình: BIOS, QVL RAM, đường PCIe/M.2, đầu nối, bộ ngàm và không gian lắp đặt vẫn phải đối chiếu riêng. Chưa kiểm tra hiển thị qua trình duyệt trong đợt bổ sung dữ liệu này.

## Hồ sơ cục bộ

Các tệp trong `tmp/product-specifications/` bị Git ignore, chứa dữ liệu danh mục và hồ sơ cập nhật; không chứa chuỗi kết nối hoặc thông tin tài khoản:

- `catalog-before.json`: dữ liệu gốc của lần rà soát.
- `plan-*.json`: thông số đề xuất, URL nguồn và lưu ý từng sản phẩm.
- `backup.json`: giá trị gốc, giá trị mới và thông tin kiểm soát lần ghi.
- `result.json`: kết quả ghi và đọc lại từng sản phẩm.
- `catalog-after.json`, `compatibility-after-apply.json`: dữ liệu và kết quả kiểm tra sau ghi.

Giữ bản sao lưu này khi cần đối chiếu hoặc khôi phục; việc commit mã nguồn không sao lưu dữ liệu database.
