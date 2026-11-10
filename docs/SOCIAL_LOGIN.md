# Đăng nhập độc giả bằng Google

Mã nguồn đã hỗ trợ OAuth authorization code phía máy chủ. Tính năng chỉ bật cho từng nhà cung cấp sau khi điền đủ cấu hình. Không áp dụng cho tài khoản quản trị. Cần tạo ứng dụng trong tài khoản Google/Meta của chủ website; mã nguồn không tự tạo được các khóa này.

## Cấu hình Render

Trong Environment của Web Service, thêm các biến bên dưới. Hai origin phải là URL thật của cùng website, không có đường dẫn hoặc dấu / cuối; ví dụ https://ten-dich-vu.onrender.com. Không đặt khóa vào frontend, GitHub hoặc gửi trong chat.

| Biến                   | Giá trị                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| OAUTH_PUBLIC_ORIGIN    | https://TEN-SERVICE.onrender.com                                              |
| CLIENT_ORIGIN          | Cùng URL với OAUTH_PUBLIC_ORIGIN                                              |
| GOOGLE_CLIENT_ID       | Client ID của OAuth Web application trên Google                               |
| GOOGLE_CLIENT_SECRET   | Client Secret của ứng dụng Google                                             |
| FACEBOOK_CLIENT_ID     | App ID trên Meta                                                              |
| FACEBOOK_CLIENT_SECRET | App Secret trên Meta                                                          |
| FACEBOOK_GRAPH_VERSION | Phiên bản Graph API dùng cho app, lấy từ Meta Dashboard, định dạng v<số>.<số> |

Giữ JWT_SECRET và MONGODB_URI hiện tại. Có thể chỉ cấu hình Google hoặc chỉ Facebook. Lưu biến rồi redeploy; API GET /api/auth/oauth/providers chỉ trả trạng thái bật/tắt, không trả khóa.

## Google

1. Mở https://console.cloud.google.com/, tạo/chọn project và vào Google Auth Platform (hoặc APIs & Services → OAuth consent screen/Credentials).
2. Cấu hình Branding, email hỗ trợ, Audience phù hợp. Khi ở chế độ Testing, thêm email được phép thử vào Test users.
3. Tạo OAuth Client, loại Web application.
4. Thêm Authorized redirect URI chính xác: https://TEN-SERVICE.onrender.com/api/auth/oauth/google/callback
5. Sao chép Client ID và Client Secret vào các biến Render bên trên. Chỉ yêu cầu openid, email, profile.
6. Khi muốn người dùng ngoài danh sách test đăng nhập, cấu hình trạng thái phát hành và các yêu cầu xác minh được Google Console hiển thị.

Tài liệu: https://developers.google.com/identity/openid-connect/openid-connect

## Facebook

Facebook hiện đã tắt theo yêu cầu: không hiển thị nút và API không cho bắt đầu đăng nhập, kể cả khi còn biến cấu hình Facebook trên Render. Chỉ cần cấu hình Google.

## Hành vi và dữ liệu

- Người dùng chọn Google/Facebook → xác thực tại nhà cung cấp → callback → đổi mã một lần, gắn với trình duyệt bắt đầu đăng nhập.
- Google ID token được kiểm chữ ký, issuer, audience, hạn dùng bằng google-auth-library, kèm nonce và email_verified. Facebook token được kiểm qua debug_token, app ID và user ID; hồ sơ lấy trực tiếp từ Graph API.
- Người dùng mới cần điền họ/tên, ngày sinh, phái, địa chỉ, điện thoại, loại độc giả trước khi được cấp phiên Reader. Email lấy từ nhà cung cấp, không nhận email hoặc vai trò do trình duyệt tự gửi. Không tạo mật khẩu giả hoặc mật khẩu mặc định.
- Độc giả xã hội dùng GoogleId/FacebookId với unique sparse indexes trong DOCGIA. Tài khoản email/mật khẩu cũ vẫn hoạt động. Không tự gộp theo email: nếu email đã thuộc tài khoản chưa liên kết, yêu cầu dùng phương thức đăng nhập ban đầu; tính năng liên kết tài khoản chưa được triển khai.
- Kiểm tra khóa tài khoản trước khi cấp phiên; mọi API được bảo vệ vẫn kiểm tra trạng thái khóa trong database.
- Không đưa token của Google/Facebook hoặc JWT phiên vào URL. Chỉ mã dùng một lần xuất hiện trong fragment callback; frontend xóa ngay khi xử lý. Vé tạm OAUTH_TICKETS có hạn 10 phút, lưu mã dưới dạng hash và có TTL index. Mã dùng một lần bị xóa khi đổi, hồ sơ đăng ký hết hạn cần đăng nhập lại.
- Hosting hiện tại hỗ trợ frontend/backend chung một origin trên Render. Chạy local có thể đặt cả OAUTH_PUBLIC_ORIGIN và CLIENT_ORIGIN là http://localhost:5173, sử dụng proxy /api của Vite, rồi đăng ký callback tương ứng trong console nhà cung cấp nếu được phép. Không trộn localhost và 127.0.0.1.

## Kiểm tra

Build: npm run build. Kiểm thử tích hợp: đặt RUN_DB_TEST=1 rồi chạy npm test. Bài kiểm thử giả lập phản hồi Google/Facebook, kiểm tra state, ràng buộc cookie, mã một lần, chống đổi email/vai trò, hồ sơ mới, tài khoản trùng email, tài khoản khóa và vé hết hạn. Cần kiểm tra thực tế với Client ID/Secret và tài khoản thử trên website sau khi cấu hình console; chưa có khóa thật trong mã nguồn.
