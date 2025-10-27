/***************************
 * app.js - Control de caducidad
 ***************************/

/* ---------- Config ---------- */
const STORAGE_KEY = 'supermarket_products_v1';
const ALERT_DAYS = 3; // días para considerar "próximo a vencer"

/* ---------- Utils ---------- */

function loadProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error leyendo storage', e);
    return [];
  }
}

function saveProducts(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function daysUntil(dateStr) {
  const now = new Date();
  const target = new Date(dateStr + 'T23:59:59'); // incluir todo el día
  const diff = target - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/* ---------- UI Refs ---------- */
const form = document.getElementById('product-form');
const nameInput = document.getElementById('name');
const categoryInput = document.getElementById('category');
const qtyInput = document.getElementById('quantity');
const expiryInput = document.getElementById('expiry');

const productListEl = document.getElementById('product-list');
const alertArea = document.getElementById('alert-area');

const searchInput = document.getElementById('search');
const filterSelect = document.getElementById('filter');

const clearBtn = document.getElementById('clear-storage');
const exportBtn = document.getElementById('export-json');
const importBtn = document.getElementById('import-json-btn');
const importFileInput = document.getElementById('import-file');

/* ---------- State ---------- */
let products = loadProducts();

/* ---------- Render ---------- */
function render() {
  const q = searchInput.value.trim().toLowerCase();
  const filter = filterSelect.value;

  productListEl.innerHTML = '';

  const sorted = [...products].sort((a,b)=>{
    return new Date(a.expiry) - new Date(b.expiry);
  });

  let soonCount = 0;
  let expiredCount = 0;

  for (const p of sorted) {
    if (q && !(p.name.toLowerCase().includes(q) || (p.category||'').toLowerCase().includes(q))) continue;

    const days = daysUntil(p.expiry);
    const isExpired = days < 0;
    const isSoon = days <= ALERT_DAYS && days >= 0;

    if (isExpired) expiredCount++;
    if (isSoon) soonCount++;

    if (filter === 'expired' && !isExpired) continue;
    if (filter === 'soon' && !isSoon) continue;
    if (filter === 'ok' && (isSoon || isExpired)) continue;

    const item = document.createElement('div');
    item.className = 'product';

    const info = document.createElement('div');
    info.className = 'info';
    info.innerHTML = `<strong>${escapeHtml(p.name)}</strong>
                      <small>${escapeHtml(p.category || '—')}</small>
                      <small>Cantidad: ${p.quantity}</small>`;

    const meta = document.createElement('div');
    meta.className = 'meta';

    let badgeClass = 'ok';
    let badgeText = `Vence en ${days} día(s)`;
    if (isExpired) { badgeClass = 'expired'; badgeText = `Caducado hace ${Math.abs(days)} día(s)`; }
    else if (isSoon) { badgeClass = 'soon'; badgeText = `Próximo a vencer (${days} día(s))`; }

    meta.innerHTML = `<div class="date"><small>Caduca: ${p.expiry}</small></div>
                      <div style="margin-top:6px">
                        <span class="badge ${badgeClass}">${escapeHtml(badgeText)}</span>
                      </div>
                      <div style="margin-top:8px">
                        <button data-action="edit" data-id="${p.id}">Editar</button>
                        <button data-action="delete" data-id="${p.id}" style="margin-left:6px">Eliminar</button>
                      </div>`;

    item.appendChild(info);
    item.appendChild(meta);

    productListEl.appendChild(item);
  }

  // alert summary
  const upcoming = products.filter(p => {
    const d = daysUntil(p.expiry);
    return d <= ALERT_DAYS && d >= 0;
  });
  const expired = products.filter(p => daysUntil(p.expiry) < 0);

  if (upcoming.length > 0) {
    alertArea.textContent = `⚠️ Atención: ${upcoming.length} producto(s) próximo(s) a vencer.`;
  } else if (expired.length > 0) {
    alertArea.textContent = `❗ Hay ${expired.length} producto(s) caducado(s).`;
  } else {
    alertArea.textContent = '';
  }
}

/* Prevent XSS in names */
function escapeHtml(unsafe) {
  if (unsafe == null) return '';
  return unsafe.replace(/[&<"'>]/g, function(m){
    return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m];
  });
}

/* ---------- Form handlers ---------- */

function resetForm() {
  form.reset();
  quantityDefault();
}

/* set default qty */
function quantityDefault(){
  if(!qtyInput.value) qtyInput.value = 1;
}

form.addEventListener('submit', e=>{
  e.preventDefault();
  const name = nameInput.value.trim();
  const category = categoryInput.value.trim();
  const qty = parseInt(qtyInput.value) || 1;
  const expiry = expiryInput.value;

  if(!name || !expiry) {
    alert('Completa nombre y fecha de caducidad');
    return;
  }

  const id = Date.now().toString();

  products.push({ id, name, category, quantity: qty, expiry });
  saveProducts(products);
  render();
  resetForm();

  // pequeña notificación visual
  flash(`Producto "${name}" guardado`);
});

/* ---------- Click handlers for edit/delete ---------- */
productListEl.addEventListener('click', e=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if(action === 'delete') {
    if(!confirm('¿Eliminar este producto?')) return;
    products = products.filter(p => p.id !== id);
    saveProducts(products);
    render();
    flash('Producto eliminado');
    return;
  }
  if(action === 'edit'){
    const p = products.find(x=>x.id===id);
    if(!p) return;
    // rellenar formulario para edición (simple: borrar y re-guardar)
    if(!confirm('Se cargará el producto en el formulario para editar. Al guardar se creará una nueva entrada.')) return;
    nameInput.value = p.name;
    categoryInput.value = p.category;
    qtyInput.value = p.quantity;
    expiryInput.value = p.expiry;
    // eliminar original
    products = products.filter(x=>x.id!==id);
    saveProducts(products);
    render();
    flash('Edita los campos y presiona "Guardar producto"');
  }
});

/* ---------- Search & filters ---------- */
searchInput.addEventListener('input', render);
filterSelect.addEventListener('change', render);

/* ---------- Clear all ---------- */
clearBtn.addEventListener('click', ()=>{
  if(!confirm('¿Borrar TODOS los productos? Esta acción no se puede deshacer.')) return;
  localStorage.removeItem(STORAGE_KEY);
  products = [];
  render();
  flash('Storage vaciado');
});

/* ---------- Export / Import ---------- */
exportBtn.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(products, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'productos.json';
  a.click();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener('click', ()=> importFileInput.click());
importFileInput.addEventListener('change', async (ev)=>{
  const file = ev.target.files[0];
  if(!file) return;
  const txt = await file.text();
  try{
    const arr = JSON.parse(txt);
    if(!Array.isArray(arr)) throw new Error('Formato inválido');
    // asignar ids si faltan
    const normalized = arr.map(x=>({
      id: x.id || Date.now().toString() + Math.random().toString(36).slice(2,6),
      name: x.name || 'Sin nombre',
      category: x.category || '',
      quantity: x.quantity || 1,
      expiry: x.expiry || new Date().toISOString().slice(0,10)
    }));
    products = products.concat(normalized);
    saveProducts(products);
    render();
    flash('Importación completada');
  } catch(err){
    alert('Error importando: ' + err.message);
  } finally {
    importFileInput.value = '';
  }
});

/* ---------- Small helpers ---------- */
function flash(msg){
  const prev = document.getElementById('flash-msg');
  if(prev) prev.remove();
  const el = document.createElement('div');
  el.id = 'flash-msg';
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
  setTimeout(()=> el.remove(), 2800);
}

/* ---------- Initial demo data (solo al ejecutar primera vez) ---------- */
(function seedIfEmpty(){
  if(products.length === 0){
    const demo = [
      { id: 'd1', name: 'Leche', category: 'Lácteos', quantity: 6, expiry: addDaysISO(2) },
      { id: 'd2', name: 'Pan Integral', category: 'Panadería', quantity: 10, expiry: addDaysISO(0) },
      { id: 'd3', name: 'Manzana', category: 'Frutas', quantity: 20, expiry: addDaysISO(8) },
    ];
    products = demo;
    saveProducts(products);
  }
})();

function addDaysISO(days){
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}

/* ---------- Auto-check periódica (cada 30s dentro de la sesión) ---------- */
setInterval(()=> {
  render();
}, 30 * 1000);

/* ---------- Inicial ----- */
quantityDefault();
render();
