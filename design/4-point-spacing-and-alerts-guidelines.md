# rentOS — Quy Chuẩn 4-Point Spacing System & Cơ Chế Alert Toàn Cục

Tài liệu này là quy chuẩn thiết kế và lập trình frontend chính thức cho toàn bộ team phát triển **rentOS**. Mọi thành viên phát triển giao diện (UI/UX và Frontend Engineers) phải tuân thủ nghiêm ngặt các quy tắc dưới đây.

---

## 1. Quy Tắc Hệ Thống Khoảng Cách 4-Point (4-Point Spacing System)

### 1.1. Nguyên tắc cốt lõi
1. **Chia hết cho 4**: Mọi kích thước liên quan đến không gian gồm `margin`, `padding`, `gap`, `width`, `height` (trừ font size và stroke border) **bắt buộc phải là bội số nguyên của 4px** ($n \times 4\text{px}$).
2. **Tuyệt đối KHÔNG sử dụng các giá trị số lẻ**:
   - ❌ **CẤM**: `px-3.5` (14px), `py-2.5` (10px), `space-y-1.5` (6px), `gap-2.5` (10px), `p-3.5` (14px), `min-h-[46px]`.
   - ✅ **DÙNG**: `px-4` (16px), `py-3` (12px), `space-y-2` (8px), `gap-2` (8px) hoặc `gap-3` (12px), `p-4` (16px), `h-12` (48px).

### 1.2. Thang đo chuẩn (Base Spacing Scale)

| Token CSS | Giá trị px | Tailwind Class | Mục đích áp dụng |
| :--- | :--- | :--- | :--- |
| `--space-1` | `4px` | `p-1`, `m-1`, `gap-1` | Khoảng cách siêu nhỏ (micro-gap), padding badge, viền focus |
| `--space-2` | `8px` | `p-2`, `m-2`, `gap-2` | Khoảng cách giữa label và input, icon margin, sub-text margin |
| `--space-3` | `12px` | `p-3`, `m-3`, `gap-3` | Padding dọc (vertical) cho input, padding tag/chip |
| `--space-4` | `16px` | `p-4`, `m-4`, `gap-4` | Padding ngang (horizontal) cho input, khoảng cách giữa các trường (`space-y-4`) |
| `--space-5` | `20px` | `p-5`, `m-5`, `gap-5` | Khoảng cách phân đoạn phụ trong form / card |
| `--space-6` | `24px` | `p-6`, `m-6`, `gap-6` | Padding bên trong card/panel trên mobile, khoảng cách giữa các block |
| `--space-8` | `32px` | `p-8`, `m-8`, `gap-8` | Padding bên trong card/panel trên desktop, grid gap lớn |
| `--space-10` | `40px` | `p-10`, `m-10`, `gap-10` | Padding modal/dialog, khoảng cách header nổi bật |
| `--space-12` | `48px` | `h-12`, `p-12`, `gap-12` | Chiều cao tiêu chuẩn của Input & Nút bấm Submit |
| `--space-16` | `64px` | `p-16`, `m-16`, `gap-16` | Lề trên/dưới của bố cục trang lớn |

### 1.3. Biến Semantic cho Form
Các biến được định nghĩa tập trung tại `design/tokens/rentos-tokens.css`:
```css
:root {
  --form-input-h: var(--space-12);   /* 48px */
  --form-input-px: var(--space-4);   /* 16px */
  --form-input-py: var(--space-3);   /* 12px */
  --form-gap-field: var(--space-4);  /* 16px */
  --form-gap-label: var(--space-2);  /* 8px */
  --form-card-p: var(--space-8);     /* 32px */
}
```

---

## 2. Quy Chuẩn Giao Diện Form (Unified Form Controls)

1. **Chiều cao Input & Button**: Đồng bộ tuyệt đối cố định `h-12` (48px).
2. **Bo góc (Border Radius)**: Dùng `rounded-xl` (12px, chuẩn 4-point) tạo vẻ hiện đại, thân thiện.
3. **Padding bên trong Input**: `px-4 py-3` (16px ngang, 12px dọc).
4. **Vòng viền Focus (Focus Ring)**: `focus:border-action-primary focus:ring-4 focus:ring-rentos-philadelphia/15 outline-none transition-all`.
5. **Trạng thái Lỗi (Error State)**: `border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15 bg-rose-50/20 text-slate-900`.
6. **Nút Ẩn/Hiện Mật Khẩu (Eye Toggle)**:
   - Tất cả các trường nhập mật khẩu (Đăng nhập, Đăng ký, Quên mật khẩu, Đổi mật khẩu) **bắt buộc** phải tích hợp icon Mắt (Eye / Eye Off) ở góc phải ô input.
   - Có thuộc tính trợ năng `aria-label` đầy đủ.
7. **Nút bấm Submit**:
   - `bg-action-primary hover:bg-[#285584] text-white font-semibold text-sm rounded-xl h-12 shadow-sm transition-all active:scale-[0.99]`.
   - Khi `busy`/`loading`, hiển thị spinner SVG và khóa tương tác `disabled`.

---

## 3. Cẩm Nang & Ma Trận Alert Theo Workflow (Sonner & Feedback Matrix)

Hệ thống sử dụng thư viện **Sonner** làm giải pháp Toast Notification chuẩn cho toàn bộ ứng dụng. 
Cấu hình root đặt tại `frontend/src/app/layout.tsx`:
- **Vị trí**: `top-right` trên Desktop và `top-center` trên Mobile.
- **Thời lượng**: Tự ẩn sau 3.5 giây (`duration={3500}`).

### 3.1. Phân cấp 4 tầng Alert

1. **Cấp 1: Sonner Toast (Non-blocking / Transient)**
   - Nổi ở góc màn hình, tự ẩn sau 3.5s.
   - Dùng cho: Phản hồi hành động đã hoàn tất thành công (Lưu hồ sơ, Đăng nhập thành công, Gửi yêu cầu thuê).
2. **Cấp 2: Field-Level Validation (Inline Error)**
   - Đặt ngay dưới ô input (`mt-2` = 8px), đổi viền input sang màu đỏ.
   - Dùng cho: Lỗi điền dữ liệu (sai định dạng email, mật khẩu quá ngắn, trường bắt buộc bị bỏ trống). **Không dùng Toast để báo lỗi từng ô input**.
3. **Cấp 3: Inline Banner / Callout (`FormMessage`)**
   - Hộp thông báo tĩnh cố định trong trang, chỉ mất khi đổi trạng thái hoặc sửa xong lỗi.
   - Dùng cho: Lỗi toàn trang, token URL hết hạn, rate-limit 429 cần đếm ngược, tài khoản chưa kích hoạt email.
4. **Cấp 4: Confirmation Dialog (Blocking Modal)**
   - Hộp thoại popup chặn tương tác màn hình, buộc chọn Xác nhận / Hủy.
   - Dùng cho: Các hành động có tính phá hủy không thể hoàn tác (Xóa bất động sản, Hủy hợp đồng thuê, Chấm dứt kỳ thuê sớm, Đăng xuất).

### 3.2. Bảng Ma Trận Ánh Xạ Theo Workflow

| Workflow Nghiệp Vụ | Tình huống | Cấp độ Alert | Giao diện & Hành vi cụ thể |
| :--- | :--- | :--- | :--- |
| **Đăng nhập** | Bỏ trống / Sai định dạng email | **Field-Level** | Báo đỏ dưới ô Email / Mật khẩu |
| | Sai email hoặc mật khẩu (401) | **Sonner Error Toast** | Bắn toast: *"Email hoặc mật khẩu không chính xác."* + viền đỏ 2 ô |
| | Đăng nhập thành công | **Sonner Success Toast** | *"Đăng nhập thành công! Đang chuyển hướng..."* $\rightarrow$ `router.push` |
| **Đăng ký** | Mật khẩu yếu / Không khớp | **Field-Level** | Báo lỗi realtime dưới ô Mật khẩu / Xác nhận |
| | Email đã tồn tại (422) | **Field-Level** | Báo dưới ô Email kèm link *"Đăng nhập ngay"* |
| | Đăng ký thành công | **Sonner Success Toast** | *"Tài khoản đã được tạo thành công!"* |
| **Quên mật khẩu** | Gửi email liên kết thành công | **Status Card + Toast** | Đổi sang view "Đã gửi email" + Toast thành công |
| | Thao tác quá nhanh (429) | **Inline Banner** | Banner màu vàng cam đếm ngược 60 giây |
| **Đặt lại mật khẩu** | Token không hợp lệ / Hết hạn | **Inline Banner** | Khóa form, hiển thị banner đỏ kèm nút *"Yêu cầu link mới"* |
| | Đổi mật khẩu thành công | **Sonner Success Toast** | *"Mật khẩu đã đổi thành công! Vui lòng đăng nhập lại."* $\rightarrow$ `/login` |
| **Hồ sơ (Profile)** | Cập nhật họ tên, SĐT thành công | **Sonner Success Toast** | *"Hồ sơ đã được lưu thành công."* |
| | Gửi lại email xác thực | **Sonner Promise Toast** | *"Đang gửi..."* $\rightarrow$ *"Đã gửi email xác minh!"* |
| | Đổi mật khẩu trong Profile | **Sonner Success Toast** | *"Mật khẩu đã đổi! Các phiên khác đã đăng xuất."* $\rightarrow$ `/login` |
| **Cổng Quản lý** | Tạo tin đăng / Duyệt yêu cầu thuê | **Sonner Success Toast** | Toast thành công kèm action button xem chi tiết |
| | Xóa tài sản / Hủy hợp đồng thuê | **Confirmation Dialog** | Modal hỏi xác nhận hủy trước khi gửi request API |
