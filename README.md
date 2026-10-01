# Lokibiliards - Vercel + Supabase

Phiên bản này chạy theo mô hình chỉ **Vercel + Supabase**:

- Frontend: HTML/CSS/JavaScript tĩnh trên Vercel.
- Backend: Vercel Function Node.js tại `api/[...route].js`.
- Database: Supabase PostgreSQL.
- Ảnh sản phẩm: Supabase Storage + signed upload URL.
- Auth: JWT + bcrypt.

## Cấu trúc

```text
billiards-management/
├── api/[...route].js
├── css/style.css
├── js/app.js
├── js/config.js
├── index.html
├── database/schema.sql
├── package.json
└── vercel.json
```

## Biến môi trường Vercel

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=product-images
JWT_SECRET
```

`SUPABASE_SERVICE_ROLE_KEY` chỉ được dùng trong Vercel Function, tuyệt đối không đưa vào frontend.

## Kiểm tra sau deploy

```text
GET  /api/health
GET  /api/config
POST /api/auth/login
GET  /api/categories
GET  /api/products
GET  /api/products/:id
POST /api/categories
POST /api/products
PUT  /api/products/:id
DELETE /api/products/:id
POST /api/products/:id/image-sign
POST /api/products/:id/image
```

Các route ghi dữ liệu yêu cầu JWT và role phù hợp.

Tài khoản demo sau khi chạy `database/schema.sql`:

```text
admin / admin123
staff / staff123
user  / user123
```

Đổi mật khẩu demo trước khi sử dụng thực tế.
