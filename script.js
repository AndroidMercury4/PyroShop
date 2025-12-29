const products = [
  { id: "p1", name: "Oak Rune Token", price: 18, desc: "Hand-finished oak token with carved symbol." },
  { id: "p2", name: "Walnut Mini Totem", price: 32, desc: "Small walnut carving, smooth edges, matte oil." },
  { id: "p3", name: "Pine Pendant", price: 12, desc: "Lightweight pendant with clean lines and seal." },
  { id: "p4", name: "Custom Sigil Block", price: 45, desc: "Commission-style block, choose your design." },
  { id: "p5", name: "Maple Desk Charm", price: 22, desc: "Minimal charm piece for desk or shelf." },
  { id: "p6", name: "Ash Key Fob", price: 10, desc: "Simple key fob, durable and light." },
];

const grid = document.getElementById("productGrid");
const search = document.getElementById("search");

const modal = document.getElementById("modal");
const modalBackdrop = document.getElementById("modalBackdrop");
const closeModal = document.getElementById("closeModal");
const modalTitle = document.getElementById("modalTitle");
const modalDesc = document.getElementById("modalDesc");
const modalPrice = document.getElementById("modalPrice");
const addToCartBtn = document.getElementById("addToCartBtn");
let activeProduct = null;

const drawer = document.getElementById("drawer");
const cartBtn = document.getElementById("cartBtn");
const closeDrawer = document.getElementById("closeDrawer");
const cartItems = document.getElementById("cartItems");
const subtotalEl = document.getElementById("subtotal");
const cartCount = document.getElementById("cartCount");
const clearCart = document.getElementById("clearCart");
const randomBtn = document.getElementById("randomBtn");

const cart = new Map(); // id -> qty

function money(n) {
  return `£${n.toFixed(2)}`;
}

function renderProducts(list) {
  grid.innerHTML = "";
  list.forEach((p, i) => {
    const card = document.createElement("article");
    card.className = "card";
    card.style.animationDelay = `${i * 60}ms`;

    card.innerHTML = `
      <div class="card-top"></div>
      <div class="card-inner">
        <h3>${p.name}</h3>
        <p class="muted">${p.desc}</p>
        <div class="card-actions">
          <span class="price">${money(p.price)}</span>
          <button class="btn ghost" data-view="${p.id}">View</button>
          <button class="btn primary" data-add="${p.id}">Add</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function openModal(product) {
  activeProduct = product;
  modalTitle.textContent = product.name;
  modalDesc.textContent = product.desc;
  modalPrice.textContent = money(product.price);
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeModalFn() {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  activeProduct = null;
}

function openDrawer() {
  drawer.classList.add("show");
  drawer.setAttribute("aria-hidden", "false");
}

function closeDrawerFn() {
  drawer.classList.remove("show");
  drawer.setAttribute("aria-hidden", "true");
}

function addToCart(id) {
  cart.set(id, (cart.get(id) || 0) + 1);
  updateCartUI();
}

function removeOne(id) {
  const qty = cart.get(id) || 0;
  if (qty <= 1) cart.delete(id);
  else cart.set(id, qty - 1);
  updateCartUI();
}

function updateCartUI() {
  let total = 0;
  let count = 0;

  cartItems.innerHTML = "";

  for (const [id, qty] of cart.entries()) {
    const p = products.find(x => x.id === id);
    if (!p) continue;

    total += p.price * qty;
    count += qty;

    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div>
        <div><strong>${p.name}</strong></div>
        <div class="muted">${money(p.price)} • Qty ${qty}</div>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <button class="icon-btn" data-minus="${id}">−</button>
        <button class="icon-btn" data-plus="${id}">+</button>
      </div>
    `;
    cartItems.appendChild(row);
  }

  subtotalEl.textContent = money(total);
  cartCount.textContent = String(count);
  if (count === 0) cartItems.innerHTML = `<p class="muted">Cart is empty.</p>`;
}

grid.addEventListener("click", (e) => {
  const viewId = e.target?.dataset?.view;
  const addId = e.target?.dataset?.add;

  if (viewId) {
    const p = products.find(x => x.id === viewId);
    if (p) openModal(p);
  }

  if (addId) {
    addToCart(addId);
    openDrawer();
  }
});

addToCartBtn.addEventListener("click", () => {
  if (!activeProduct) return;
  addToCart(activeProduct.id);
  closeModalFn();
  openDrawer();
});

modalBackdrop.addEventListener("click", closeModalFn);
closeModal.addEventListener("click", closeModalFn);

cartBtn.addEventListener("click", openDrawer);
closeDrawer.addEventListener("click", closeDrawerFn);

drawer.addEventListener("click", (e) => {
  const plus = e.target?.dataset?.plus;
  const minus = e.target?.dataset?.minus;
  if (plus) addToCart(plus);
  if (minus) removeOne(minus);
});

clearCart.addEventListener("click", () => {
  cart.clear();
  updateCartUI();
});

search.addEventListener("input", () => {
  const q = search.value.trim().toLowerCase();
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)
  );
  renderProducts(filtered);
});

randomBtn.addEventListener("click", () => {
  const p = products[Math.floor(Math.random() * products.length)];
  openModal(p);
});

renderProducts(products);
updateCartUI();

// Keyboard accessibility: ESC closes modal/drawer
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModalFn();
    closeDrawerFn();
  }
});
