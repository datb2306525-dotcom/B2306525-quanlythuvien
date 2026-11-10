# Athena — Website quản lý thư viện

Ứng dụng tiếng Việt theo kiến trúc MVC: Node.js / Express, Vue 3, Bootstrap 5, MongoDB / Mongoose. Giao diện xanh navy – trắng – vàng, responsive; cổng độc giả và quản trị riêng.

## Chạy dự án trên Windows

Cần Node.js 22 trở lên, npm và MongoDB replica set (giao dịch duyệt/trả sách cần replica set). Không dùng MongoDB standalone cho nghiệp vụ này.

```powershell
npm.cmd install
npm.cmd run install:all
Copy-Item server/.env.example server/.env
```

Đổi `JWT_SECRET` trong `server/.env` thành chuỗi ngẫu nhiên ít nhất 32 ký tự. Nếu có Docker Desktop:

```powershell
docker compose up -d --wait
npm.cmd run seed
npm.cmd run dev
```

MongoDB trong Docker tự khởi tạo replica set `rs0`; cổng chỉ mở trên localhost. Nếu dùng MongoDB Atlas, thay `MONGODB_URI` bằng connection string của bạn. Nếu dùng MongoDB cài sẵn, cấu hình `--replSet rs0` rồi chạy `rs.initiate()` trong mongosh. Seed chỉ thêm dữ liệu chưa tồn tại, không xóa hoặc đặt lại dữ liệu hiện có.

**Không có Docker/MongoDB:** mở terminal thứ nhất chạy `npm.cmd run db`. Lần đầu công cụ tải binary MongoDB (cần mạng); đây là MongoDB thực ở chế độ phát triển, dữ liệu giữ trong `.local/mongodb`. Chờ thông báo `MongoDB ready`, giữ terminal này mở, rồi mở terminal thứ hai chạy `npm.cmd run seed` và `npm.cmd run dev`. Không chạy lựa chọn này cùng lúc với Docker hay MongoDB khác đang chiếm cổng 27017. Dùng MongoDB được vận hành riêng khi triển khai thật.

- Giao diện độc giả: http://localhost:5173
- Quản trị: http://localhost:5173/admin (truy cập trực tiếp; trang độc giả không có liên kết sang quản trị)
- API: http://localhost:3000/api/health

Tài khoản mẫu sau khi seed:

| Vai trò | Email            | Mật khẩu   |
| ------- | ---------------- | ---------- |
| Admin   | admin@athena.vn  | Admin@123  |
| Reader  | reader@athena.vn | Reader@123 |

Đổi thông tin tài khoản mẫu trước khi triển khai thật. Tài khoản Reader mới tạo bằng biểu mẫu đăng ký. Nhân viên được cấp riêng trong collection `NhanVien`, mật khẩu phải hash bcrypt; đăng ký công khai không thể tạo nhân viên.

Build và chạy cùng máy chủ Express:

```powershell
npm.cmd run build
npm.cmd start
```

Truy cập http://localhost:3000. `CLIENT_ORIGIN` phải khớp origin khi chạy frontend ở tên miền khác. Các biến môi trường được đọc từ `server/.env` vì lệnh npm chạy trong thư mục server.

## Cấu trúc MVC

```text
server/src/
  app.js                    Khởi động Express, kết nối MongoDB
  models/index.js           5 model theo sơ đồ
  controllers/              Xử lý HTTP: tài khoản, sách, mượn/trả
  routes/index.js           API routing
  middleware/auth.js        JWT và kiểm tra vai trò từ CSDL
  services/search.js        Xếp hạng sách, tính phí quá hạn
  services/ai.js            Tích hợp Ollama và kiểm tra bookId
  seed.js                   Dữ liệu và tài khoản mẫu
client/src/
  App.vue                   Khung ứng dụng, chọn trang và cung cấp state
  views/                    View (giao diện) trong kiến trúc MVC
    HomeView.vue            Trang chủ và tra cứu danh mục sách
    AdminView.vue           Trang quản trị dành cho Admin/Librarian
    LoansView.vue           Trang sách đang mượn của độc giả
    RecommendationsView.vue Trang đề xuất sách
  components/               Header, footer, bảng phiếu, chat và hộp thoại
  composables/useLibrary.js State dùng chung và các thao tác gọi API
  api.js                    HTTP client
  style.css                 Thiết kế và responsive
```

**View nằm ở `client/src/views/`**, vì dự án dùng Vue để hiển thị giao diện và Express cung cấp API JSON. Phía server không cần thư mục `views` cho EJS/Pug. Model và Controller nằm trong `server/src/models/` và `server/src/controllers/`; các View Vue đọc dữ liệu thông qua API của Controller.

## Đối chiếu sơ đồ CSDL

MongoDB dùng collection thay cho bảng SQL. Các mã nghiệp vụ vẫn được giữ đầy đủ, có unique index. Khóa ngoại lưu ObjectId và tham chiếu model tương ứng. Nhãn `NguonGoc/TacGia` trong hình được biểu diễn bằng `NguonGocTacGia`.

| Collection      | Thuộc tính bắt buộc theo hình                                       |
| --------------- | ------------------------------------------------------------------- |
| DOCGIA          | MaDocGia, HoLot, Ten, NgaySinh, Phai, DiaChi, DienThoai             |
| SACH            | MaSach, TenSach, DonGia, SoQuyen, NamXuatBan, MaNXB, NguonGocTacGia |
| NHAXUATBAN      | MaNXB, TenNXB, DiaChi                                               |
| THEODOIMUONSACH | MaDocGia, MaSach, NgayMuon, NgayTra                                 |
| NhanVien        | MSNV, HoTenNV, Password, ChucVu, DiaChi, SoDienThoai                |

Thuộc tính bổ sung gồm email, mật khẩu hash, loại độc giả, thể loại, mô tả, hạn trả, trạng thái phiếu, nhân viên xử lý, tiền phạt, bồi thường, tình trạng sách trả và trạng thái thanh toán. `NgayTra` là null cho đến khi trả thực tế. Mỗi phiếu có `_id` riêng; index duy nhất có điều kiện ngăn mượn trùng một sách khi đang chờ/đang mượn, nhưng cho phép mượn lại sau khi hoàn tất.

`SoQuyen` được định nghĩa là **số bản có thể cho mượn tại thời điểm hiện tại**. Đây là quản lý tồn theo đầu sách, chưa theo barcode từng bản. Sách hỏng/mất không được tự cộng lại vào kho; thủ thư có thể cập nhật tồn sau khi sửa chữa. Dữ liệu sách trong seed là dữ liệu minh họa nghiệp vụ, không phải danh mục thư viện đã xác minh ngoài thực tế.

## Nghiệp vụ

- Tra cứu theo tên/tác giả/thể loại, xem chi tiết và số bản thực tế.
- Reader đăng ký, đăng nhập, gửi yêu cầu, hủy yêu cầu chờ duyệt, xem lịch sử/hạn trả/phí.
- Admin/Librarian duyệt hoặc từ chối; duyệt giữ một bản sách, cấp mã phiếu và chuyển sang chờ nhận; xác nhận giao sách bằng mã phiếu mới bắt đầu trạng thái đang mượn. Hạn trả theo ngày đã đăng ký (tối đa 14 ngày). Duyệt/trả chạy trong transaction, cập nhật tồn có điều kiện; trả lặp bị từ chối.
- Phí quá hạn là số ngày bắt đầu quá hạn × `FINE_PER_DAY` (mặc định 5.000đ). Hạn tính theo thời điểm chính xác, không theo ngày lịch.
- Khi trả: ghi nhận bình thường/hỏng/mất, nhập số tiền bồi thường và ghi chú. Chỉ sách bình thường được cộng lại tồn.
- Thu phí là ghi nhận **thanh toán trực tiếp đã nhận**, có bước xác nhận, chưa tích hợp cổng thanh toán.
- Reader có nợ đã chốt sau trả không thể tạo yêu cầu mới. Khoản quá hạn khi đang mượn là tạm tính.
- Quản trị thêm/sửa sách, thêm nhà xuất bản, xem danh sách độc giả và thống kê thật từ MongoDB. Không xóa sách để bảo toàn lịch sử phiếu.
- Đề xuất theo thể loại lịch sử mượn, loại bỏ sách đã mượn; tài khoản chưa có lịch sử được xếp theo lượt mượn.

## AI tìm sách, chống bịa thông tin

Không cấu hình AI: hệ thống dùng tìm kiếm từ khóa tiếng Việt không dấu và từ đồng nghĩa trên danh mục, không gọi đây là mô hình ngôn ngữ.

Để dùng AI thực, cài và chạy Ollama riêng, tải model phù hợp máy (ví dụ `ollama pull qwen2.5:7b`), rồi bỏ comment trong `server/.env`:

```dotenv
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b
```

Model chỉ chọn tối đa 5 ID trong tối đa 200 sách đầu tiên của danh mục. Máy chủ kiểm tra tất cả ID, loại trùng và đối chiếu CSDL lần nữa để lấy tên, mô tả và số bản mới nhất. Không dùng tên sách, số lượng hoặc lời giải thích tự do do model sinh. Mỗi kết quả chứa `bookId`, thông tin sách, lý do dựa trên mô tả/thể loại và cờ `available`. AI lỗi, timeout hoặc trả ID không hợp lệ thì quay về tìm kiếm danh mục. Tồn có thể thay đổi sau câu trả lời, do đó thao tác duyệt luôn kiểm tra tồn lại trong transaction. Với thư viện lớn hơn, cần nâng cấp truy hồi trước khi gửi candidate cho model.

Ví dụ: “Tôi muốn học Python từ con số 0”, “Có sách về trí tuệ nhân tạo phù hợp sinh viên năm 2 không?”, “Tìm sách bảo mật mạng có thực hành”, “Gợi ý sách quản trị kinh doanh cho người mới”.

## API chính

| Method     | Endpoint                                    | Quyền                                                                          |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------------------ |
| POST       | /api/auth/register, /api/auth/login         | Công khai                                                                      |
| GET        | /api/books, /api/books/:id, /api/publishers | Công khai                                                                      |
| POST       | /api/ai/search                              | Công khai, giới hạn tần suất                                                   |
| GET        | /api/recommendations                        | Reader                                                                         |
| GET        | /api/loans                                  | Reader chỉ xem phiếu của mình; nhân viên xem tất cả                            |
| POST       | /api/loans                                  | Reader, body `{bookId, borrowDate, returnDate, responsibility: true}`          |
| PATCH      | /api/loans/:id                              | Reader chỉ cancel phiếu của mình; nhân viên approve/handover/reject/return/pay |
| POST / PUT | /api/books, /api/books/:id                  | Admin/Librarian                                                                |
| POST       | /api/publishers                             | Admin/Librarian                                                                |
| GET        | /api/admin/stats, /api/admin/readers        | Admin/Librarian                                                                |

`npm.cmd test` chạy kiểm thử tìm kiếm, công thức phạt và từ chối ID AI bịa. Build giao diện: `npm.cmd run build`.

Kiểm thử tích hợp tự khởi tạo replica set MongoDB tạm và tự dọn dữ liệu riêng, không dùng CSDL của ứng dụng:

```powershell
$env:RUN_DB_TEST='1'
npm.cmd test
Remove-Item Env:RUN_DB_TEST
```

Lần đầu có thể cần mạng để tải binary MongoDB. Đã kiểm chứng 5 kiểm thử đạt, bao gồm đăng ký, cô lập vai trò/phiếu, mượn trùng, tranh chấp bản cuối, trả sách hỏng, phạt, bồi thường, thu phí và kiểm tra kết quả tìm sách theo tồn thực. Chưa kiểm thử trình duyệt trực quan hoặc kết nối mô hình Ollama thật trong môi trường này.

## Tách cổng độc giả và quản trị

Cổng `/admin` có giao diện và phiên đăng nhập riêng (`athena-admin-token`); cổng độc giả dùng `athena-token`. Đăng xuất ở một cổng không đăng xuất cổng còn lại. Khi tải lại trang, phiên được xác minh qua `/api/auth/me`. Tài khoản độc giả không đăng nhập được cổng quản trị; các API quản lý kiểm tra quyền Admin/Librarian trên máy chủ. Đường dẫn `/admin` hiển thị màn hình đăng nhập cho người chưa có phiên quản trị hợp lệ.

Quản trị có các mục: tổng quan và thống kê sách theo thể loại, xử lý phiếu mượn/trả, thêm/sửa sách, nhà xuất bản, độc giả, báo cáo và phản hồi. Độc giả mở chi tiết sách để gửi phản hồi, sau đó xem trạng thái và câu trả lời ở trang **Sách của tôi**. Quản trị lọc báo cáo theo trạng thái, ghi câu trả lời và chuyển Mới tiếp nhận → Đang xử lý → Đã xử lý. Hoàn tất xử lý phải có nội dung trả lời.

API báo cáo: `GET /api/reports` (độc giả xem của mình; nhân viên xem tất cả), `POST /api/reports` (Reader, `{bookId, content}`), `PATCH /api/reports/:id` (Admin/Librarian, `{status, response}`). Báo cáo lưu trong collection `BAOCAOSACH`.

## Đăng ký, nhận sách và quản lý bổ sung

Độc giả nhấn **Đăng ký mượn sách** để chọn ngày mượn, ngày trả và xác nhận trách nhiệm. Ngày mượn từ hôm nay, ngày trả sau ngày mượn và không quá 14 ngày (múi giờ Việt Nam). Ngày trả dự kiến được tính đến hết ngày; ngày trả thực tế chỉ ghi khi thư viện nhận lại sách.

Duyệt phiếu giữ một bản sách và cấp mã duy nhất hiển thị trong **Sách của tôi**, trạng thái **Đã duyệt · Chờ nhận sách**. Độc giả cung cấp mã khi đến thư viện; quản trị nhập mã và xác nhận giao sách trong ngày nhận trở đi, trước khi hết hạn trả. API: PATCH /api/loans/:id với {action: 'handover', code: 'PM-…'}. Giao sách không trừ tồn lần nữa, chỉ tăng lượt mượn. Hủy/từ chối phiếu chờ nhận trả lại bản đang giữ; chưa giao sách không phát sinh phạt quá hạn. Phiếu chờ nhận hết lịch cần được quản trị từ chối để trả sách vào kho. Phiếu chờ duyệt cũ chưa có lịch đăng ký cần từ chối và đăng ký lại; phiếu đang mượn cũ tiếp tục trả sách bình thường. Máy chủ và lệnh seed tự cập nhật index chống mượn trùng cho trạng thái chờ nhận, giữ nguyên dữ liệu phiếu.

Thêm/sửa sách hỗ trợ tải ảnh PNG/JPEG/WebP tối đa 1 MB, xem trước và xóa ảnh, chọn danh mục và thể loại. Ảnh lưu cùng sách trong MongoDB dạng data URL, hiển thị ở danh mục, chi tiết, đề xuất và bảng quản lý. Quản lý sách lọc kết hợp danh mục, thể loại, nhà xuất bản và từ khóa; quản lý phiếu tìm theo tên sách, tên độc giả, mã phiếu (không phân biệt dấu), kèm bộ lọc trạng thái.

Mục **Độc giả** cho phép khóa/mở khóa với lý do vi phạm. API: PATCH /api/admin/readers/:id/lock với {locked: true, reason: '…'} hoặc {locked: false}. Tài khoản bị khóa không đăng nhập hoặc gọi API được, kể cả bằng token đã cấp; không được duyệt hoặc giao sách mới. Quản trị vẫn có thể nhận trả, thu phí và hủy phiếu của độc giả bị khóa.

Thể loại sách hỗ trợ chọn nhiều mục bằng checkbox khi thêm/sửa. Các nút lọc nhanh và danh sách chọn của độc giả dùng chung danh sách với quản trị; sách được lọc theo từng thể loại thành viên. Dữ liệu thể loại cũ dạng chuỗi tự chuyển thành mảng khi khởi động/seed. Thống kê theo thể loại tính sách ở mỗi thể loại đã chọn, còn tổng tồn chỉ tính mỗi sách một lần.

Hướng dẫn cấu hình đăng nhập Google/Facebook cho độc giả: [docs/SOCIAL_LOGIN.md](docs/SOCIAL_LOGIN.md).

## Hồ sơ độc giả và đăng xuất

Nhấn tên độc giả trên thanh đầu trang để mở `/account`. Hồ sơ cho phép sửa họ tên, ngày sinh, phái, điện thoại, địa chỉ và loại độc giả; email và mã độc giả chỉ đọc. API `GET /api/auth/profile` và `PATCH /api/auth/profile` chỉ cho Reader xem/sửa hồ sơ của chính mình, không cho đổi vai trò, khóa tài khoản, email hay mật khẩu. Áp dụng cho cả tài khoản mật khẩu và Google. Sau khi lưu, tên hiển thị cập nhật ngay. Nút đăng xuất ở cả cổng độc giả và quản trị yêu cầu xác nhận; chọn Hủy hoặc đóng hộp thoại giữ nguyên phiên.
