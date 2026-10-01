async function api(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", "Bearer " + token);
  options.headers = headers;

  const res = await fetch(API_BASE + path, options);
  if (!res.ok) {
    let message = res.statusText || "Request failed";
    try {
      const body = await res.json();
      message = body.message || body.error || message;
    } catch (_) {}
    if (res.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      updatePermissions();
    }
    throw new Error(message);
  }
  return res.status === 204 ? null : res.json();
}

async function login(e) {
  e.preventDefault();
  try {
    const data = await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.value.trim(), password: password.value })
    });
    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.role);
    loginMessage.textContent = `Đăng nhập thành công: ${data.username} (${data.role})`;
    password.value = "";
    updatePermissions();
    await loadCategories();
    await loadProducts();
  } catch (err) {
    loginMessage.textContent = "Đăng nhập thất bại: " + err.message;
  }
}

document.querySelector("#loginForm").addEventListener("submit", login);

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  loginMessage.textContent = "Đã đăng xuất";
  updatePermissions();
}

function role() { return localStorage.getItem("role"); }
function canManage() { return role() === "ADMIN" || role() === "STAFF"; }

async function loadCategories() {
  try {
    const data = await api("/categories");
    pcategory.innerHTML = '<option value="">Không chọn danh mục</option>' +
      data.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  } catch (_) {
    pcategory.innerHTML = '<option value="">Không tải được danh mục</option>';
  }
}

async function loadProducts() {
  try {
    const data = await api("/products");
    products.innerHTML = data.map(p => {
      const img = resolveImageUrl(p.image_url || p.imageUrl);
      const categoryName = p.category?.name || "";
      const category = categoryName ? `<small>Danh mục: ${escapeHtml(categoryName)}</small>` : "";
      return `<article class="product">
        <img src="${escapeAttr(img)}" alt="${escapeAttr(p.name)}" loading="lazy">
        <div class="body">
          <h3>${escapeHtml(p.name)}</h3>
          <p>${escapeHtml(p.description || "")}</p>
          ${category}
          <div class="price">${Number(p.price || 0).toLocaleString("vi-VN")} đ</div>
          <small>Tồn kho: ${Number(p.stock_quantity ?? p.stockQuantity ?? 0)}</small>
        </div>
      </article>`;
    }).join("") || "<p>Chưa có sản phẩm.</p>";
    imageProduct.innerHTML = data.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
  } catch (err) {
    products.innerHTML = `<p>Không thể tải sản phẩm: ${escapeHtml(err.message)}</p>`;
  }
}

document.querySelector("#productForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!canManage()) return alert("Bạn cần đăng nhập bằng Admin hoặc Staff.");
  const categoryId = pcategory.value ? Number(pcategory.value) : null;
  try {
    await api("/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: pname.value.trim(),
        description: pdesc.value.trim(),
        price: Number(pprice.value),
        stockQuantity: Number(pstock.value),
        status: "ACTIVE",
        category: categoryId ? { id: categoryId } : null
      })
    });
    e.target.reset();
    await loadProducts();
    alert("Đã thêm sản phẩm");
  } catch (err) { alert(err.message); }
});

async function uploadImage() {
  if (!canManage()) return alert("Bạn cần đăng nhập bằng Admin hoặc Staff.");
  const id = imageProduct.value;
  const file = imageFile.files[0];
  if (!id || !file) return alert("Hãy chọn sản phẩm và file ảnh.");
  if (file.size > 5 * 1024 * 1024) return alert("Ảnh không được vượt quá 5MB.");
  if (!["image/png","image/jpeg","image/webp","image/gif"].includes(file.type)) return alert("Chỉ PNG, JPG, WEBP, GIF.");
  if (!window.supabase) {
    return alert("Không tải được thư viện Supabase trên trình duyệt.");
  }

  try {
    uploadMessage.textContent = "Đang tải cấu hình upload...";
    const configRes = await fetch("/api/config");
    const publicConfig = await configRes.json();
    if (!configRes.ok) throw new Error(publicConfig.message || "Thiếu cấu hình Supabase");

    uploadMessage.textContent = "Đang tạo link upload...";
    const signed = await api(`/products/${id}/image-sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: file.type })
    });

    const client = window.supabase.createClient(publicConfig.supabaseUrl, publicConfig.anonKey, {
      auth: { persistSession: false }
    });
    const { error } = await client.storage
      .from(publicConfig.bucket)
      .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
    if (error) throw error;

    await api(`/products/${id}/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: signed.path })
    });
    uploadMessage.textContent = "Upload thành công";
    imageFile.value = "";
    await loadProducts();
  } catch (err) {
    uploadMessage.textContent = "Upload thất bại: " + err.message;
  }
}

function resolveImageUrl(imageUrl) {
  if (!imageUrl) return "https://placehold.co/600x400?text=No+Image";
  return imageUrl;
}

function updatePermissions() {
  const show = canManage();
  adminProductCard.style.display = show ? "block" : "none";
  uploadCard.style.display = show ? "block" : "none";
  auth.textContent = role() ? `Role: ${role()}` : "Chưa đăng nhập";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}
function escapeAttr(s) { return escapeHtml(s); }

updatePermissions();
loadCategories();
loadProducts();
