Trong ứng dụng này, em sử dụng dữ liệu cụ thể được khai báo trực tiếp ở backend để thực thi chứ không dùng database nào.

### Chức năng:
- **setup mfa**: thiết lập đăng nhập với MFA cho người dùng.
- **login**: để đăng nhập vào ứng dụng, cần phải setup MFA cho người dùng quét mã QR vào lần đăng nhập đầu tiên.
- **verify mfa**: dùng để xác nhận mã MFA, nếu đúng sẽ truy cập vào trang chủ thành công và trả về long token và short token cho người dùng.
- **authenticate JWT**: khi đăng nhập thành công, những chức năng ở trang chủ sẽ cần phải xác thực short token xem có hợp lệ hay không, nếu short token hết hạn sẽ tiến hành refresh token.
- **get username**: trả về tên username để hiển thị ở trang chủ.
- **disable mfa**: dùng để tắt MFA, người dùng cần phải setup MFA để đăng nhập cho lần sau (hàm này tạo ra để test chức năng setup mfa).
- **refresh token**: trong trường hợp short token hết hạn, long token sẽ được sử dụng để tạo ra short token mới.
