# Testing Environment Guide

Tài liệu này hướng dẫn cách cấu hình và chạy test backend cho dự án **rentOS** một cách an toàn, độc lập và không gây ảnh hưởng đến cơ sở dữ liệu dùng chung của team.

---

## 1. Nguyên Tắc An Toàn (Database Boundary Isolation)

- **Tuyệt đối không dùng DB dùng chung cho Testing**: Các bài kiểm thử sử dụng `RefreshDatabase` sẽ chạy `migrate:fresh`, xóa sạch toàn bộ các bảng trong database được kết nối. Do đó, môi trường test phải hoàn toàn tách biệt.
- **Mặc định trên CI Runner**: GitHub Actions tự động khởi chạy service container `postgres:17` tại `127.0.0.1:5432` với database `rentos_test`. Cấu hình trong [phpunit.xml](file:///Users/hientruongthmh/Documents/Web_Jobs/rentOS/backend/phpunit.xml) đã được thiết lập để kết nối vào service container này.

---

## 2. Chạy Kiểm Thử Cục Bộ (Local Testing)

### Cách 1: Sử dụng Docker PostgreSQL cục bộ (Khuyến nghị)

Khởi động container PostgreSQL cục bộ bằng lệnh:

```bash
docker run --name rentos-test-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=rentos_test -p 5432:5432 -d postgres:17
```

Sau khi container hoạt động, chạy toàn bộ test:

```bash
cd backend
php artisan test
```

### Cách 2: Sử dụng file cấu hình `.env.testing` riêng

Nếu bạn có PostgreSQL riêng trên máy hoặc container đang chạy ở port khác, bạn có thể tạo file `backend/.env.testing`:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=rentos_test
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_SSLMODE=disable
```

> [!NOTE]
> File `.env.testing` đã được thêm vào `.gitignore` nên bạn có thể thoải mái cấu hình thông số riêng trên máy cá nhân mà không sợ bị commit lên Git.

---

## 3. Kiểm Tra Code Style Trước Khi Đẩy Code

Dự án sử dụng **Laravel Pint** để chuẩn hóa định dạng code:

```bash
cd backend
./vendor/bin/pint --test
```

Nếu có file chưa đúng định dạng, tự động format bằng:

```bash
./vendor/bin/pint
```
