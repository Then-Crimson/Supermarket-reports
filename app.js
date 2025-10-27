/***************************
 * app.js - Control de caducidad
 ***************************/

const STORAGE_KEY = 'supermarket_products_v2';
const ALERT_DAYS = 3;

function loadProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProducts(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function daysUntil(dateStr) {
  const now = new Date();
  const target = new Date(dateStr + 'T23:59:59');
  const diff = target - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/* ---------- UI Elements ---------- */
const form = document.getElementById('product-form');
const nameInput = document.getElementById('name');
const categoryInput = document.getElementById('category');
const qtyInput = document.getElementById('quantity');
const weightInput = document.getElementById('weight');
const expiryInput = document.getElementById('expiry');
const imageInput = document.getElementById('image');

const productListEl = document.getElementById('product-list');
const alertArea = document.getElementById('alert-area');
const searchInput = document.getElementById('search');
const filterSelect = document.getElementById('filter');
const clearBtn = document.getElementById('clear-storage');
const exportBtn = document.getElementById('export-json');
const importBtn = document.getElementById('import-json-btn');
const importFileInput = document.getElementById('import-file');

let products = loadProducts();

/* ---------- Render ---------- */
function render() {
  const q = searchInput.value.trim().toLowerCase();
  const filter = filterSelect.value;

  productListEl.innerHTML = '';

  const sorted = [...products].sort((a, b) => new Date(a.expiry) - new Date(b.expiry));

  for (const p of sorted) {
    if (q && !(p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q))) continue;

    const days = daysUntil(p.expiry);
    const isExpired = days < 0;
    const isSoon = days <= ALERT_DAYS && days >= 0;

    if (filter === 'expired' && !isExpired) continue;
    if (filter === 'soon' && !isSoon) continue;
    if (filter === 'ok' && (isSoon || isExpired)) continue;

    const item = document.createElement('div');
    item.className = 'product';

    const info = document.createElement('div');
    info.className = 'info';
    info.innerHTML = `
      <strong>${escapeHtml(p.name)}</strong>
      <small>${escapeHtml(p.category || '—')}</small>
      <small>Cantidad: ${p.quantity}</small>
      <small>Gramaje/Litros: ${escapeHtml(p.weight || '—')}</small>
    `;

    const meta = document.createElement('div');
    meta.className = 'meta';

    let badgeClass = 'ok';
    let badgeText = `Vence en ${days} día(s)`;
    if (isExpired) { badgeClass = 'expired'; badgeText = `Caducado hace ${Math.abs(days)} día(s)`; }
    else if (isSoon) { badgeClass = 'soon'; badgeText = `Próximo a vencer (${days} día(s))`; }

    meta.innerHTML = `
      <div class="date"><small>Caduca: ${p.expiry}</small></div>
      <div style="margin-top:6px">
        <span class="badge ${badgeClass}">${escapeHtml(badgeText)}</span>
      </div>
      <div style="margin-top:8px">
        <button data-action="edit" data-id="${p.id}">Editar</button>
        <button data-action="delete" data-id="${p.id}" style="margin-left:6px">Eliminar</button>
      </div>
    `;

    if (p.image) {
      const img = document.createElement('img');
      img.src = p.image;
      item.prepend(img);
    }

    item.appendChild(info);
    item.appendChild(meta);
    productListEl.appendChild(item);
  }

  const upcoming = products.filter(p => {
    const d = daysUntil(p.expiry);
    return d <= ALERT_DAYS && d >= 0;
  });
  const expired = products.filter(p => daysUntil(p.expiry) < 0);

  if (upcoming.length > 0)
    alertArea.textContent = `⚠️ Atención: ${upcoming.length} producto(s) próximo(s) a vencer.`;
  else if (expired.length > 0)
    alertArea.textContent = `❗ Hay ${expired.length} producto(s) caducado(s).`;
  else alertArea.textContent = '';
}

function escapeHtml(str) {
  return str?.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m])) || '';
}

/* ---------- Form ---------- */
function resetForm() {
  form.reset();
  qtyInput.value = 1;
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const category = categoryInput.value.trim();
  const qty = parseInt(qtyInput.value) || 1;
  const weight = weightInput.value.trim();
  const expiry = expiryInput.value;
  let imageBase64 = '';

  if (!name || !expiry) return alert('Completa nombre y fecha de caducidad');

  const file = imageInput.files[0];
  if (file) imageBase64 = await fileToBase64(file);

  const id = Date.now().toString();
  products.push({ id, name, category, quantity: qty, weight, expiry, image: imageBase64 });

  saveProducts(products);
  render();
  resetForm();
  flash(`Producto "${name}" guardado`);
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- Edit/Delete ---------- */
productListEl.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;

  if (btn.dataset.action === 'delete') {
    if (!confirm('¿Eliminar este producto?')) return;
    products = products.filter(p => p.id !== id);
    saveProducts(products);
    render();
    flash('Producto eliminado');
  }

  if (btn.dataset.action === 'edit') {
    const p = products.find(x => x.id === id);
    if (!p) return;
    if (!confirm('Se cargará el producto para edición. Al guardar se creará una nueva entrada.')) return;
    nameInput.value = p.name;
    categoryInput.value = p.category;
    qtyInput.value = p.quantity;
    weightInput.value = p.weight;
    expiryInput.value = p.expiry;
    products = products.filter(x => x.id !== id);
    saveProducts(products);
    render();
  }
});

/* ---------- Otros controles ---------- */
searchInput.addEventListener('input', render);
filterSelect.addEventListener('change', render);
clearBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar TODOS los productos?')) return;
  localStorage.removeItem(STORAGE_KEY);
  products = [];
  render();
});

exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(products, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'productos.json';
  a.click();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener('click', () => importFileInput.click());
importFileInput.addEventListener('change', async ev => {
  const file = ev.target.files[0];
  if (!file) return;
  const txt = await file.text();
  try {
    const arr = JSON.parse(txt);
    if (!Array.isArray(arr)) throw new Error('Formato inválido');
    products = products.concat(arr);
    saveProducts(products);
    render();
  } catch (err) {
    alert('Error importando: ' + err.message);
  } finally {
    importFileInput.value = '';
  }
});

/* ---------- Flash ---------- */
function flash(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.position = 'fixed';
  el.style.right = '18px';
  el.style.bottom = '18px';
  el.style.background = '#111827';
  el.style.color = 'white';
  el.style.padding = '10px 14px';
  el.style.borderRadius = '8px';
  el.style.boxShadow = '0 8px 20px rgba(0,0,0,0.12)';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

/* ---------- Init ---------- */
render();

