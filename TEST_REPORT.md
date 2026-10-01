# Test Report - Lokibiliards Vercel + Supabase

Ngày kiểm tra: 2026-10-02

## Static checks

- Node.js syntax `api/[...route].js`: PASS
- Node.js syntax `js/app.js`: PASS
- `package.json`: valid JSON
- `vercel.json`: valid JSON
- `index.html` asset references: PASS
- Không có `localhost:8080` trong project: PASS
- Service role key chỉ xuất hiện trong server-side API/schema comments: PASS

## API smoke tests

Đã chạy local smoke test với mock Supabase/JWT để kiểm tra routing, HTTP status và authorization:

| Endpoint | Kết quả |
|---|---|
| GET /api/health | PASS 200 |
| GET /api/config | PASS 200 |
| POST /api/auth/login | PASS 200 |
| GET /api/categories | PASS 200 |
| POST /api/categories - USER | PASS 403 |
| POST /api/categories - ADMIN | PASS 201 |
| GET /api/products | PASS 200 |
| GET /api/products/:id | PASS 200 |
| POST /api/products - USER | PASS 403 |
| POST /api/products - STAFF | PASS 201 |
| PUT /api/products/:id - STAFF | PASS 200 |
| DELETE /api/products/:id - STAFF | PASS 403 |
| DELETE /api/products/:id - ADMIN | PASS 204 |
| POST /api/products/:id/image-sign | PASS 200 |
| image-sign invalid type | PASS 400 |
| POST /api/products/:id/image | PASS 200 |
| unknown route | PASS 404 |

## Quan trọng

Smoke test trên dùng mock cho Supabase nên không thay thế integration test với project Supabase thật. Cần deploy và kiểm tra `/api/health`, `/api/config`, `/api/categories`, `/api/products` sau khi đã nhập Environment Variables và chạy `database/schema.sql`.
