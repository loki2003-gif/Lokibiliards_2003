CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(30) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(80) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(120),
    phone VARCHAR(30),
    email VARCHAR(120),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    role_id BIGINT NOT NULL REFERENCES roles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT REFERENCES categories(id),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price NUMERIC(14,2) NOT NULL DEFAULT 0,
    cost_price NUMERIC(14,2) NOT NULL DEFAULT 0,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    image_url VARCHAR(1000),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS billiard_tables (
    id BIGSERIAL PRIMARY KEY,
    table_number VARCHAR(30) UNIQUE NOT NULL,
    table_type VARCHAR(80),
    price_per_hour NUMERIC(14,2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE'
);

CREATE TABLE IF NOT EXISTS reservations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    table_id BIGINT REFERENCES billiard_tables(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    note VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    staff_id BIGINT REFERENCES users(id),
    table_id BIGINT REFERENCES billiard_tables(id),
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    payment_status VARCHAR(30) NOT NULL DEFAULT 'UNPAID',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    price NUMERIC(14,2) NOT NULL,
    subtotal NUMERIC(14,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    amount NUMERIC(14,2) NOT NULL,
    method VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PAID',
    paid_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles(name) VALUES ('ADMIN'), ('STAFF'), ('USER')
ON CONFLICT (name) DO NOTHING;

INSERT INTO users(username,password_hash,full_name,status,role_id)
SELECT 'admin', '$2y$10$xhpjha4Tci4n0EAnMmATd.jJOVQ5mbO6h7PuKXBdONcV6SUf8wqNi', 'Administrator', 'ACTIVE', id
FROM roles WHERE name='ADMIN'
ON CONFLICT (username) DO NOTHING;

INSERT INTO users(username,password_hash,full_name,status,role_id)
SELECT 'staff', '$2y$10$oi8KS6zrKxOZITc5Wcb5auWnAPDKgTxB/midxzii.X939JkJy.BNK', 'Staff Demo', 'ACTIVE', id
FROM roles WHERE name='STAFF'
ON CONFLICT (username) DO NOTHING;

INSERT INTO users(username,password_hash,full_name,status,role_id)
SELECT 'user', '$2y$10$Ey4S//NtNg2.WbNtwbv0iudxBtOyHU6MA8LeicK77XIJ8kuSJtsb.', 'User Demo', 'ACTIVE', id
FROM roles WHERE name='USER'
ON CONFLICT (username) DO NOTHING;

INSERT INTO categories(name, description) VALUES
('Đồ uống', 'Nước ngọt, cà phê, trà'),
('Đồ ăn vặt', 'Khoai tây, xúc xích, nem chua rán...'),
('Khác', 'Sản phẩm khác')
ON CONFLICT (name) DO NOTHING;

INSERT INTO products(category_id, name, description, price, stock_quantity)
SELECT c.id, 'Coca Cola', 'Nước ngọt lon', 15000, 100
FROM categories c WHERE c.name='Đồ uống'
AND NOT EXISTS (SELECT 1 FROM products WHERE name='Coca Cola');

INSERT INTO products(category_id, name, description, price, stock_quantity)
SELECT c.id, 'Khoai tây chiên', 'Khoai tây chiên giòn', 35000, 50
FROM categories c WHERE c.name='Đồ ăn vặt'
AND NOT EXISTS (SELECT 1 FROM products WHERE name='Khoai tây chiên');

INSERT INTO billiard_tables(table_number, table_type, price_per_hour)
VALUES ('B01','Pool',80000),('B02','Pool',80000),('B03','Carom',100000)
ON CONFLICT (table_number) DO NOTHING;

-- Tự cập nhật updated_at khi sản phẩm thay đổi.
CREATE OR REPLACE FUNCTION set_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_products_updated_at();

-- Sau khi tạo bucket product-images trong Supabase Storage, đặt bucket ở chế độ Public.
-- Không bao giờ đưa SUPABASE_SERVICE_ROLE_KEY vào frontend.
