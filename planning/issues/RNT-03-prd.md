# RNT-03 — PRD: Truy cập tài khoản và quản lý hồ sơ

**Trạng thái:** Đã duyệt; implementation hoàn tất, chờ nghiệm thu  
**Nguồn:** [Issue RNT-03](RNT-03.md)  
**Người phụ trách phạm vi:** Hien  
**Mục đích:** Thu gọn RNT-03 đang quá rộng thành một hạng mục xác thực và quản lý hồ sơ tài khoản có thể review.

## 1. Kết quả cần đạt

Người dùng có thể tạo tài khoản rentOS, xác minh email, đăng nhập và đăng xuất an toàn, xem/cập nhật hồ sơ, cũng như đổi mật khẩu khi đã đăng nhập. Tài khoản dùng một danh tính Laravel duy nhất, có thể hoạt động với vai trò người thuê hoặc chủ nhà.

Hạng mục này cung cấp nền tảng đăng nhập cần thiết để team xây dựng các tính năng được bảo vệ. Hạng mục không bao gồm quản lý personal API token.

## 2. Phạm vi

### Bao gồm

1. Đăng ký bằng tên, email, mật khẩu và xác nhận mật khẩu.
2. Xác minh email bằng liên kết có chữ ký và thời hạn sử dụng.
3. Đăng nhập bằng browser session do Laravel quản lý thông qua Sanctum.
4. Đăng xuất và vô hiệu hóa browser session hiện tại.
5. Xem hồ sơ an toàn của người dùng hiện tại và cập nhật các trường hồ sơ/thông tin liên hệ được phép.
6. Đổi/đặt lại mật khẩu khi đã đăng nhập, sau khi xác nhận mật khẩu hiện tại.
7. Áp dụng kiểm soát xác thực, CSRF, validation, rate limit và che giấu bí mật cho các luồng này.

### Không bao gồm trong PRD này

- UI hoặc API để tạo, liệt kê, xoay vòng hay thu hồi personal API token.
- Luồng quên mật khẩu/khôi phục tài khoản qua email. Luồng đặt lại mật khẩu trong phạm vi này yêu cầu người dùng đã đăng nhập và xác nhận mật khẩu hiện tại.
- Đăng nhập Google/mạng xã hội, xác minh OTP qua điện thoại, chọn vai trò, ảnh đại diện và ngày sinh.
- UI quản trị vai trò/quyền mới. `is_admin` tiếp tục do server quản lý; các endpoint sản phẩm được bảo vệ vẫn phải dùng policy phía backend.
- Supabase Auth hoặc một kho thông tin đăng nhập thứ hai.

## 3. Người dùng và giả định

- **Khách:** có thể đăng ký, xác minh email và đăng nhập.
- **Người dùng đã đăng nhập:** chỉ có thể đọc/cập nhật hồ sơ của chính mình và đổi mật khẩu của mình.
- **Quản trị viên:** không thể nhận đặc quyền từ trường do client gửi; trạng thái admin do server quản lý.
- Laravel API là nguồn có thẩm quyền duy nhất cho thông tin đăng nhập và trạng thái tài khoản. Next.js là browser client, không phải identity provider.
- Một tài khoản dùng được cho cả luồng người thuê và chủ nhà; khi đăng ký không cần chọn vai trò.

## 4. Các luồng người dùng

### 4.1 Đăng ký và xác minh email

Khách gửi tên, email, mật khẩu và xác nhận mật khẩu. Server chuẩn hóa email, kiểm tra mật khẩu, tạo đúng một tài khoản với mật khẩu đã hash và `is_admin=false`, sau đó gửi thông báo xác minh. Người dùng mở liên kết có chữ ký và thời hạn. Liên kết hợp lệ cập nhật `email_verified_at`; liên kết không hợp lệ, hết hạn hoặc đã dùng không được xác minh nhầm tài khoản hay thay đổi dữ liệu tài khoản.

UI hiển thị lỗi validation theo trường và trạng thái rõ ràng như “hãy kiểm tra email”. Gửi lại email xác minh phải có giới hạn tần suất. Trước khi xác minh, người dùng chỉ truy cập được các luồng tài khoản/xác minh giới hạn, không thể ghi dữ liệu sản phẩm được bảo vệ.

### 4.2 Đăng nhập

Browser khởi tạo CSRF cookie của Laravel trước, sau đó gửi thông tin đăng nhập cùng cookie và `X-XSRF-TOKEN` tương ứng. Khi đăng nhập thành công, Laravel xoay session ID. Các API được bảo vệ dùng session đó. Đăng nhập không tạo personal access token.

Thông tin đăng nhập sai trả về lỗi an toàn, không tiết lộ tài khoản có tồn tại hay không. Luồng đăng nhập có rate limit. Tài khoản chưa xác minh được hướng dẫn xác minh và không thể ghi dữ liệu sản phẩm được bảo vệ.

### 4.3 Đăng xuất

Browser gửi yêu cầu đăng xuất có CSRF protection. Laravel vô hiệu hóa session hiện tại và tạo lại CSRF token. Frontend hủy/loại bỏ dữ liệu riêng tư đã cache của tài khoản rồi chuyển đến màn hình công khai. Nếu request lỗi mạng/server, UI phải thể hiện là đăng xuất thất bại, không báo thành công.

### 4.4 Xem và cập nhật hồ sơ

Người dùng đã đăng nhập có thể xem thông tin an toàn của mình và cập nhật tên hiển thị cùng số điện thoại liên hệ tùy chọn. Server xác định account ID từ session đã xác thực. Form hồ sơ không được thay đổi email, trạng thái xác minh, trạng thái tài khoản, UUID hoặc trạng thái admin. Số điện thoại chỉ là thông tin liên hệ, không được trình bày như số đã xác minh quyền sở hữu.

### 4.5 Đổi/đặt lại mật khẩu khi đã đăng nhập

Người dùng đã đăng nhập gửi mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu. Server kiểm tra mật khẩu hiện tại, kiểm tra mật khẩu mới, chỉ lưu password hash, xoay remember credential và vô hiệu hóa mọi session cùng personal access token hiện có sau khi đổi thành công. Người dùng cần đăng nhập lại. UI không đọc hoặc hiển thị thông tin xác thực đã lưu.

## 5. Yêu cầu chức năng

| Mã | Yêu cầu | Ưu tiên |
| --- | --- | --- |
| RNT03-FR01 | Đăng ký người dùng với email duy nhất đã chuẩn hóa, mật khẩu đã hash, `is_admin=false` do server thiết lập; không nhận danh tính/đặc quyền từ client. | P0 |
| RNT03-FR02 | Gửi và xác nhận email bằng liên kết có chữ ký, thời hạn và rate limit; liên kết phải gắn với đúng user/email. | P0 |
| RNT03-FR03 | Xác thực người dùng đã xác minh qua Laravel browser session có CSRF protection và session ID rotation; không cấp PAT khi đăng nhập. | P0 |
| RNT03-FR04 | Đăng xuất vô hiệu hóa session hiện tại và tạo lại trạng thái CSRF. | P0 |
| RNT03-FR05 | Trả về hồ sơ an toàn của người dùng hiện tại và chỉ cho phép người đó cập nhật các trường đã duyệt. | P0 |
| RNT03-FR06 | Chỉ đổi/đặt lại mật khẩu khi người dùng đã đăng nhập và xác nhận mật khẩu hiện tại; hash mật khẩu mới và vô hiệu hóa session/token hiện có. Không có luồng quên mật khẩu qua email. | P0 |
| RNT03-FR07 | Bảo vệ browser mutation bằng CSRF, validation phía server, throttling phù hợp và che giấu thông tin xác thực/bí mật xác minh khỏi log/diagnostic. | P0 |

## 6. Dữ liệu và API

### Phát hiện từ schema hiện tại

- `users` là bảng tài khoản, hiện đã có UUID `id`, `name`, `email` duy nhất, `email_verified_at` nullable, `password`, `remember_token`, `phone` tùy chọn, `is_admin`, `account_status` và timestamps.
- Đã có bảng `sessions` với `user_id` UUID nullable, metadata session và payload.
- Đã có bảng `password_reset_tokens` cho password broker của Laravel; PRD này không triển khai luồng quên mật khẩu/khôi phục qua email.
- Đã có bảng `personal_access_tokens` và Sanctum model trait; UI/API quản lý chúng được hoãn lại.
- Các migration hiện tại không tạo bảng `profiles`. Trong phạm vi này, thông tin hồ sơ nằm trên `users`; không thêm bảng profile nếu chưa có quyết định schema được review.
- Một số acceptance case hiện tại yêu cầu tạo đồng thời `users` và `profiles`, không khớp migration hiện tại. Theo review, giữ nguyên acceptance; ghi nhận sai lệch này trong kế hoạch/báo cáo triển khai, không tự thêm bảng `profiles`.

### Các khả năng API dự kiến

Tên route và response envelope cụ thể sẽ theo convention Laravel hiện có và được chốt trong implementation plan. Các khả năng cần có:

- Đăng ký dành cho khách, trang/thông báo xác minh, gửi lại email và xác nhận bằng signed link.
- Đăng nhập dành cho khách và đăng xuất có CSRF protection.
- Đọc thông tin người dùng hiện tại và cập nhật hồ sơ đã đăng nhập.
- Đổi mật khẩu khi đã đăng nhập.

Response thông tin người dùng phải dùng Resource/allowlist rõ ràng. Không serialize toàn bộ User model. Không trả về password hash, remember token, session ID/payload, verification signature hoặc bí mật personal token.

## 7. Validation và xử lý lỗi

- Dữ liệu không hợp lệ trả về lỗi theo trường (422 nếu theo convention API) và không tạo tài khoản dở dang.
- Email trùng sau chuẩn hóa được chặn bởi unique constraint; đăng ký đồng thời chỉ được tạo tối đa một tài khoản.
- Lỗi thông tin đăng nhập không tiết lộ riêng email hay mật khẩu sai.
- Link xác minh không hợp lệ/hết hạn không thay đổi trạng thái tài khoản; gửi lại email bị giới hạn tần suất.
- Request cần đăng nhập nhưng chưa xác thực trả 401; người dùng đã xác thực nhưng chưa verify/không được phép nhận phản hồi 403 hoặc phản hồi yêu cầu xác minh theo contract đã thống nhất.
- Browser mutation thiếu CSRF hoặc CSRF sai bị chặn trước khi đổi trạng thái (419 theo Laravel baseline được chọn).
- Sai mật khẩu hiện tại trả về lỗi theo trường, không đổi mật khẩu và không thu hồi session.
- Nếu request cập nhật profile có trường bị cấm, server từ chối hoặc bỏ qua nhất quán; không trường đặc quyền nào được thay đổi.
- Đổi mật khẩu thành công vô hiệu hóa mọi session và PAT; thất bại không làm thay đổi thông tin xác thực hoặc session đang hoạt động.

## 8. Yêu cầu bảo mật

- Dùng password hashing của Laravel; không lưu hoặc ghi log mật khẩu dạng plaintext.
- Dùng cơ chế email verification và signed URL có thời hạn của Laravel; không tự triển khai thuật toán chữ ký.
- Áp dụng Laravel CSRF validation cho browser POST/PATCH/PUT/DELETE; giữ nguyên cấu hình credentialed CORS và Sanctum stateful domain chính xác theo RNT-01.
- Xoay session ID khi đăng nhập; vô hiệu hóa session hiện tại khi đăng xuất.
- Validation email/mật khẩu/profile phải chạy phía server; chuẩn hóa email trước khi kiểm tra uniqueness và lưu dữ liệu.
- Dùng xác thực backend và policy hiện hành; không tin `user_id`, `is_admin`, trạng thái xác minh hay trạng thái tài khoản do client gửi.
- Không để lộ thông tin xác thực, cookie, CSRF value, signed verification URL hay token secret trong log, Telescope, cache hoặc public API response.
- Đảm bảo đổi mật khẩu thành công vô hiệu hóa mọi session và PAT hiện có, dù phần quản lý PAT được hoãn lại.

## 9. Tiêu chí nghiệm thu

1. Đăng ký hợp lệ tạo đúng một dòng `users` với email duy nhất đã chuẩn hóa, password hash, `email_verified_at=null`, `is_admin=false` và trạng thái tài khoản active.
2. Dữ liệu không hợp lệ hoặc đăng ký email trùng đồng thời không tạo tài khoản trùng/dở dang và không cấp đặc quyền.
3. Link xác minh hợp lệ chỉ xác minh đúng user; link hết hạn, bị sửa hoặc phát lại không thể xác minh tài khoản khác.
4. Người dùng đã xác minh đăng nhập được sau khi khởi tạo CSRF; session ID thay đổi và không có PAT nào được tạo khi login.
5. CSRF thiếu/sai, thông tin đăng nhập không hợp lệ và request bị throttling không cấp session hoặc thay đổi trạng thái tài khoản được bảo vệ.
6. Đăng xuất vô hiệu hóa session hiện tại; request riêng tư dùng lại session đó thất bại và frontend xóa dữ liệu riêng tư đã cache.
7. Người dùng đọc/cập nhật được các trường hồ sơ cho phép, nhưng không thể đọc/sửa dữ liệu người khác hoặc sửa admin, email verification, identity, account status hay credential fields.
8. Mật khẩu hiện tại đúng cho phép đổi mật khẩu; sai thì thông tin lưu không đổi. Sau khi đổi thành công, session/PAT cũ bị vô hiệu hóa và người dùng phải đăng nhập lại.
9. API response và diagnostic không chứa password/remember hash, session payload, CSRF value hoặc bí mật xác minh.
10. Origin local và deployed dùng đúng cấu hình session/CSRF đã duyệt; browser flow không dựa vào Supabase Auth hoặc provider JWT exchange.

## 10. Công cụ xác minh email và xác thực

**Khuyến nghị:** dùng tính năng có sẵn trong Laravel: `Illuminate\Contracts\Auth\MustVerifyEmail`, `Illuminate\Auth\Events\Verified`, `Illuminate\Auth\Notifications\VerifyEmail` và signed URL. Model `User` hiện đã implements `MustVerifyEmail`; project cũng đang dùng Laravel notifications. Không cần cài package xác minh email riêng.

**Quyết định:** dùng Laravel Fortify làm backend headless cho các auth endpoint. `laravel/fortify` hiện chưa có trong `backend/composer.json`, nên implementation sẽ bổ sung dependency này, bật registration và email verification, đồng thời tắt views để Next.js sở hữu UI. Email verification vẫn dùng cơ chế Laravel có sẵn (`MustVerifyEmail`, notification, signed URL); không cần package verify email riêng. Password broker được cấu hình nhưng không bật luồng quên mật khẩu qua email trong phạm vi này.

Gửi email vẫn cần cấu hình mail transport của Laravel (log/mail catcher ở local, nhà cung cấp được duyệt ở môi trường triển khai). Mã ứng dụng gửi qua lớp Laravel `Mail`/notification; nhà cung cấp mail là cấu hình triển khai, không phải thư viện xác minh email.

## 11. Implementation plan chờ review (chưa bắt đầu triển khai)

1. **Chốt contract và sai lệch tài liệu:** dùng Fortify; thống nhất endpoint/status code. Giữ nguyên acceptance hiện có theo yêu cầu review; ghi nhận sai lệch `profiles` với schema, không thêm bảng profile.
2. **Nền tảng auth backend:** cấu hình đăng ký/đăng nhập/đăng xuất, CSRF/stateful Sanctum và throttling; chuẩn hóa email; lưu user an toàn; giữ các trường đặc quyền do server quản lý.
3. **Xác minh email:** cấu hình notification URL/thời hạn và frontend destination allowlist; triển khai màn hình thông báo/gửi lại/xác nhận; chặn quyền ghi dữ liệu sản phẩm với tài khoản chưa xác minh.
4. **API hồ sơ/mật khẩu:** xây dựng User Resource/FormRequest an toàn cho đọc/cập nhật user hiện tại và đổi/đặt lại mật khẩu có xác nhận mật khẩu hiện tại; khi đổi mật khẩu thì xoay remember credential và thu hồi session/PAT. Không triển khai luồng quên mật khẩu.
5. **Màn hình tài khoản frontend:** đăng ký, đăng nhập, chờ xác minh/gửi lại/kết quả xác minh, xem/sửa hồ sơ, đổi mật khẩu và đăng xuất; gửi cookie/CSRF; xóa dữ liệu query riêng tư khi logout/session hết hạn.
6. **Bằng chứng theo tính năng:** bổ sung kiểm thử backend/API và component frontend tập trung vào validation, permission, session rotation, CSRF, signed verification, profile allowlist và thu hồi session/token. Bao gồm kiểm tra thủ công với origin local.
7. **Tài liệu và review:** cập nhật phạm vi/trạng thái RNT-03 và tài liệu API liên quan; không sửa acceptance; cung cấp lệnh/kết quả thực tế và checklist màn hình đã thay đổi.

**Điểm chờ review:** chỉ bắt đầu implementation sau khi người dùng review PRD và duyệt implementation plan sinh code. Fortify đã được chọn. API quản lý token vẫn để issue sau.

## 12. Công việc để sau / issue tiếp theo

Tạo issue riêng cho Settings API token trong tương lai (tạo/liệt kê/thu hồi, ability được phép, thời hạn hữu hạn, xác nhận mật khẩu và chỉ hiển thị secret một lần), sau khi hoàn tất xác thực tài khoản/hồ sơ/mật khẩu. Luồng quên mật khẩu/khôi phục qua email không thuộc RNT-03 đã thu gọn.
