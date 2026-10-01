# Deploy Lokibiliards bằng Vercel + Supabase

## 1. GitHub / Vercel
Repository phải có các file ngay tại root:
- `index.html`
- `api/[...route].js`
- `css/`
- `js/`
- `database/schema.sql`
- `package.json`
- `vercel.json`

Trong Vercel:
- Root Directory: `.`
- Framework Preset: Other
- Build Command: để trống
- Output Directory: `.`
- Node.js Version: `22.x` (hoặc 24.x)

`vercel.json` chỉ cấu hình `maxDuration`; không khai báo `runtime: nodejs22.x` trong `functions`.

## 2. Supabase Database
Mở SQL Editor và chạy toàn bộ `database/schema.sql`.

Sau khi chạy, kiểm tra các bảng `roles`, `users`, `categories`, `products`, `billiard_tables` và dữ liệu demo.

## 3. Supabase Storage
Tạo bucket:
- Name: `product-images`
- Public: bật để URL ảnh sản phẩm có thể hiển thị trực tiếp.

## 4. Vercel Environment Variables
Thêm các biến:
- `SUPABASE_URL` = URL project Supabase.
- `SUPABASE_ANON_KEY` = publishable/anon key.
- `SUPABASE_SERVICE_ROLE_KEY` = service role key, CHỈ ở Vercel server-side.
- `SUPABASE_STORAGE_BUCKET` = `product-images`.
- `JWT_SECRET` = chuỗi bí mật ít nhất 32 ký tự.

Không đưa `SUPABASE_SERVICE_ROLE_KEY` vào frontend, GitHub hoặc `js/config.js`.

## 5. Kiểm tra sau deploy
Mở lần lượt:
- `/api/health` → HTTP 200
- `/api/config` → HTTP 200 khi có public Supabase config
- `/api/categories` → HTTP 200
- `/api/products` → HTTP 200

Đăng nhập bằng tài khoản demo:
- `admin / admin123`
- `staff / staff123`
- `user / user123`

## 6. API
- GET `/api/health`
- GET `/api/config`
- POST `/api/auth/login`
- GET `/api/categories`
- POST `/api/categories` (ADMIN/STAFF)
- GET `/api/products`
- GET `/api/products/:id`
- POST `/api/products` (ADMIN/STAFF)
- PUT `/api/products/:id` (ADMIN/STAFF)
- DELETE `/api/products/:id` (ADMIN)
- POST `/api/products/:id/image-sign` (ADMIN/STAFF)
- POST `/api/products/:id/image` (ADMIN/STAFF)

## 7. Lưu ý
- API dùng service role key ở server nên không cần mở quyền ghi database cho frontend.
- Storage signed upload vẫn dùng public anon key ở trình duyệt để upload bằng signed URL.
- Đổi mật khẩu demo trước khi dùng thật.
