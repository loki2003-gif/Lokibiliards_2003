const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.JWT_SECRET;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';

function db() {
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function send(res, status, body) {
  return res.status(status).json(body);
}

function errorMessage(error) {
  return error?.message || 'Có lỗi xảy ra';
}

function requireSecret() {
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET phải có ít nhất 32 ký tự');
  }
}

function getToken(req) {
  const header = req.headers?.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

function auth(req) {
  requireSecret();
  const token = getToken(req);
  if (!token) return null;
  try {
    return jwt.verify(token, jwtSecret);
  } catch (_) {
    return null;
  }
}

function requireRole(req, roles) {
  const user = auth(req);
  if (!user) {
    return { error: { status: 401, message: 'Chưa đăng nhập hoặc token hết hạn' } };
  }
  if (!roles.includes(user.role)) {
    return { error: { status: 403, message: 'Bạn không có quyền thực hiện thao tác này' } };
  }
  return { user };
}

function jsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body !== 'string' || !req.body.trim()) return {};
  try {
    return JSON.parse(req.body);
  } catch (_) {
    throw new Error('JSON body không hợp lệ');
  }
}

function routeParts(req) {
  // Vercel catch-all functions normally expose the route through req.query.route.
  // Falling back to req.url keeps local testing and older deployments compatible.
  const route = req.query?.route;
  if (Array.isArray(route) && route.length) return route.filter(Boolean);
  if (typeof route === 'string' && route) return route.split('/').filter(Boolean);

  const rawUrl = String(req.url || '/');
  const pathname = rawUrl.split('?')[0].replace(/^\/api\/?/, '').replace(/\/+$/, '');
  return pathname ? pathname.split('/').filter(Boolean) : [];
}

function positiveIntegerId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validateProduct(body) {
  if (!body || !String(body.name || '').trim()) return 'Tên sản phẩm là bắt buộc';

  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0) return 'Giá phải lớn hơn hoặc bằng 0';

  const stock = body.stockQuantity == null || body.stockQuantity === ''
    ? 0
    : Number(body.stockQuantity);
  if (!Number.isInteger(stock) || stock < 0) return 'Tồn kho phải là số nguyên không âm';

  const cost = body.costPrice == null || body.costPrice === '' ? 0 : Number(body.costPrice);
  if (!Number.isFinite(cost) || cost < 0) return 'Giá vốn phải lớn hơn hoặc bằng 0';

  const categoryId = body.category?.id ?? body.categoryId;
  if (categoryId != null && categoryId !== '' && !positiveIntegerId(categoryId)) {
    return 'Danh mục không hợp lệ';
  }

  return null;
}

function productPayload(body) {
  return {
    name: String(body.name).trim(),
    description: body.description == null ? null : String(body.description).trim(),
    price: Number(body.price),
    cost_price: body.costPrice == null || body.costPrice === '' ? 0 : Number(body.costPrice),
    stock_quantity: body.stockQuantity == null || body.stockQuantity === '' ? 0 : Number(body.stockQuantity),
    status: String(body.status || 'ACTIVE').toUpperCase(),
    category_id: body.category?.id
      ? Number(body.category.id)
      : (body.categoryId ? Number(body.categoryId) : null)
  };
}

async function handle(req, res) {
  const parts = routeParts(req);
  const method = String(req.method || 'GET').toUpperCase();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (method === 'OPTIONS') return res.status(204).end();

  if (parts[0] === 'health' && method === 'GET' && parts.length === 1) {
    return send(res, 200, { status: 'UP', service: 'lokibiliards-vercel-api' });
  }

  if (parts[0] === 'config' && method === 'GET' && parts.length === 1) {
    if (!supabaseUrl || !process.env.SUPABASE_ANON_KEY) {
      return send(res, 500, { message: 'Thiếu SUPABASE_URL hoặc SUPABASE_ANON_KEY' });
    }
    return send(res, 200, {
      supabaseUrl,
      anonKey: process.env.SUPABASE_ANON_KEY,
      bucket
    });
  }

  // /api/auth/login is deliberately handled before auth is required.
  if (parts[0] === 'auth' && parts[1] === 'login' && method === 'POST' && parts.length === 2) {
    const client = db();
    const body = jsonBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (!username || !password) {
      return send(res, 400, { message: 'Username và password là bắt buộc' });
    }

    const { data: user, error } = await client
      .from('users')
      .select('id, username, password_hash, full_name, status, role:roles(name)')
      .eq('username', username)
      .maybeSingle();

    if (error) return send(res, 500, { message: errorMessage(error) });
    if (!user || String(user.status).toUpperCase() !== 'ACTIVE') {
      return send(res, 401, { message: 'Sai tài khoản hoặc mật khẩu' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return send(res, 401, { message: 'Sai tài khoản hoặc mật khẩu' });

    requireSecret();
    const role = user.role?.name;
    if (!role) return send(res, 500, { message: 'Tài khoản chưa được gán quyền' });

    const token = jwt.sign(
      { sub: String(user.id), username: user.username, role },
      jwtSecret,
      { expiresIn: '1d' }
    );

    return send(res, 200, {
      token,
      username: user.username,
      fullName: user.full_name,
      role
    });
  }

  const client = db();

  // GET /api/categories
  if (parts[0] === 'categories' && method === 'GET' && parts.length === 1) {
    const { data, error } = await client
      .from('categories')
      .select('*')
      .order('name');
    if (error) return send(res, 500, { message: errorMessage(error) });
    return send(res, 200, data || []);
  }

  // POST /api/categories
  if (parts[0] === 'categories' && method === 'POST' && parts.length === 1) {
    const check = requireRole(req, ['ADMIN', 'STAFF']);
    if (check.error) return send(res, check.error.status, { message: check.error.message });

    const body = jsonBody(req);
    const name = String(body.name || '').trim();
    if (!name) return send(res, 400, { message: 'Tên danh mục là bắt buộc' });

    const { data, error } = await client
      .from('categories')
      .insert({ name, description: body.description ? String(body.description).trim() : null })
      .select('*')
      .single();
    if (error) return send(res, 400, { message: errorMessage(error) });
    return send(res, 201, data);
  }

  // GET /api/products and /api/products/:id
  if (parts[0] === 'products' && method === 'GET' && (parts.length === 1 || parts.length === 2)) {
    let query = client.from('products').select('*, category:categories(id,name,description)');

    if (parts.length === 2) {
      const id = positiveIntegerId(parts[1]);
      if (!id) return send(res, 400, { message: 'ID sản phẩm không hợp lệ' });
      query = query.eq('id', id).maybeSingle();
    } else {
      query = query.order('id', { ascending: false });
    }

    const { data, error } = await query;
    if (error) return send(res, 500, { message: errorMessage(error) });
    if (parts.length === 2 && !data) return send(res, 404, { message: 'Không tìm thấy sản phẩm' });
    return send(res, 200, data || []);
  }

  // POST /api/products
  if (parts[0] === 'products' && method === 'POST' && parts.length === 1) {
    const check = requireRole(req, ['ADMIN', 'STAFF']);
    if (check.error) return send(res, check.error.status, { message: check.error.message });

    const body = jsonBody(req);
    const validation = validateProduct(body);
    if (validation) return send(res, 400, { message: validation });

    const { data, error } = await client
      .from('products')
      .insert(productPayload(body))
      .select('*, category:categories(id,name,description)')
      .single();
    if (error) return send(res, 400, { message: errorMessage(error) });
    return send(res, 201, data);
  }

  // PUT /api/products/:id
  if (parts[0] === 'products' && method === 'PUT' && parts.length === 2) {
    const check = requireRole(req, ['ADMIN', 'STAFF']);
    if (check.error) return send(res, check.error.status, { message: check.error.message });

    const id = positiveIntegerId(parts[1]);
    if (!id) return send(res, 400, { message: 'ID sản phẩm không hợp lệ' });

    const body = jsonBody(req);
    const validation = validateProduct(body);
    if (validation) return send(res, 400, { message: validation });

    const { data, error } = await client
      .from('products')
      .update(productPayload(body))
      .eq('id', id)
      .select('*, category:categories(id,name,description)')
      .maybeSingle();
    if (error) return send(res, 400, { message: errorMessage(error) });
    if (!data) return send(res, 404, { message: 'Không tìm thấy sản phẩm' });
    return send(res, 200, data);
  }

  // DELETE /api/products/:id
  if (parts[0] === 'products' && method === 'DELETE' && parts.length === 2) {
    const check = requireRole(req, ['ADMIN']);
    if (check.error) return send(res, check.error.status, { message: check.error.message });

    const id = positiveIntegerId(parts[1]);
    if (!id) return send(res, 400, { message: 'ID sản phẩm không hợp lệ' });

    const { data, error } = await client
      .from('products')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) return send(res, 400, { message: errorMessage(error) });
    if (!data) return send(res, 404, { message: 'Không tìm thấy sản phẩm' });
    return res.status(204).end();
  }

  // POST /api/products/:id/image-sign
  if (parts[0] === 'products' && parts[2] === 'image-sign' && method === 'POST' && parts.length === 3) {
    const check = requireRole(req, ['ADMIN', 'STAFF']);
    if (check.error) return send(res, check.error.status, { message: check.error.message });

    const productId = positiveIntegerId(parts[1]);
    if (!productId) return send(res, 400, { message: 'ID sản phẩm không hợp lệ' });

    const body = jsonBody(req);
    const contentType = String(body.contentType || '');
    const extensions = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/webp': '.webp',
      'image/gif': '.gif'
    };
    if (!extensions[contentType]) {
      return send(res, 400, { message: 'Định dạng ảnh không được hỗ trợ' });
    }

    const { data: product, error: productError } = await client
      .from('products')
      .select('id')
      .eq('id', productId)
      .maybeSingle();
    if (productError) return send(res, 500, { message: errorMessage(productError) });
    if (!product) return send(res, 404, { message: 'Không tìm thấy sản phẩm' });

    const path = `products/${productId}/${randomUUID()}${extensions[contentType]}`;
    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: false });
    if (error) return send(res, 400, { message: errorMessage(error) });

    return send(res, 200, {
      path,
      token: data.token,
      publicUrl: `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`
    });
  }

  // POST /api/products/:id/image
  if (parts[0] === 'products' && parts[2] === 'image' && method === 'POST' && parts.length === 3) {
    const check = requireRole(req, ['ADMIN', 'STAFF']);
    if (check.error) return send(res, check.error.status, { message: check.error.message });

    const productId = positiveIntegerId(parts[1]);
    if (!productId) return send(res, 400, { message: 'ID sản phẩm không hợp lệ' });

    const body = jsonBody(req);
    const path = String(body.path || '');
    if (!path.startsWith(`products/${productId}/`)) {
      return send(res, 400, { message: 'Đường dẫn ảnh không hợp lệ' });
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
    const { data, error } = await client
      .from('products')
      .update({ image_url: publicUrl })
      .eq('id', productId)
      .select('*, category:categories(id,name,description)')
      .maybeSingle();
    if (error) return send(res, 400, { message: errorMessage(error) });
    if (!data) return send(res, 404, { message: 'Không tìm thấy sản phẩm' });
    return send(res, 200, data);
  }

  return send(res, 404, { message: 'API không tồn tại' });
}

module.exports = async (req, res) => {
  try {
    await handle(req, res);
  } catch (error) {
    console.error(error);
    if (res.headersSent) return;
    return send(res, 500, { message: errorMessage(error) });
  }
};

// Exported only to make local automated smoke tests possible.
module.exports._handle = handle;
