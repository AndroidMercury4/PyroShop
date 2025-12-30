import * as THREE from "https://esm.sh/three@0.160.0";

// -------------------- BASKET (LOCAL STORAGE) --------------------
const basket = JSON.parse(localStorage.getItem("basket") || "[]");

const btnBasket = document.getElementById("btnBasket");
const basketPanel = document.getElementById("basketPanel");
const basketItems = document.getElementById("basketItems");
const basketTotal = document.getElementById("basketTotal");
const closeBasketBtn = document.getElementById("closeBasket");

if (closeBasketBtn) closeBasketBtn.onclick = () => (basketPanel.hidden = true);

if (btnBasket) {
  btnBasket.onclick = () => {
    basketPanel.hidden = false;
    renderBasket();
  };
}

function saveBasket() {
  localStorage.setItem("basket", JSON.stringify(basket));
}

function money(n) {
  return `£${Number(n || 0).toFixed(2)}`;
}

function renderBasket() {
  if (!basketItems || !basketTotal) return;

  basketItems.innerHTML = "";
  let total = 0;

  basket.forEach((item, idx) => {
    total += (item.price || 0) * (item.qty || 0);

    const row = document.createElement("div");
    row.className = "basket-item";
    row.innerHTML = `
      <div>
        <div style="font-weight:800">${item.name}</div>
        <div class="muted tiny">${money(item.price)} each</div>
      </div>
      <div class="qty">
        <button class="btn ghost" data-dec="${idx}">−</button>
        <div>${item.qty}</div>
        <button class="btn ghost" data-inc="${idx}">+</button>
      </div>
    `;
    basketItems.appendChild(row);
  });

  basketTotal.textContent = money(total);

  basketItems.querySelectorAll("[data-inc]").forEach((b) => {
    b.onclick = () => {
      basket[+b.dataset.inc].qty++;
      saveBasket();
      renderBasket();
    };
  });

  basketItems.querySelectorAll("[data-dec]").forEach((b) => {
    b.onclick = () => {
      const i = +b.dataset.dec;
      basket[i].qty--;
      if (basket[i].qty <= 0) basket.splice(i, 1);
      saveBasket();
      renderBasket();
    };
  });
}

// -------------------- PRODUCT PANEL UI --------------------
const panel = document.getElementById("productPanel");
const titleEl = document.getElementById("productTitle");
const descEl = document.getElementById("productDesc");
const priceEl = document.getElementById("productPrice");
const closePanelBtn = document.getElementById("closePanel");
const addBtn = document.getElementById("addToBasket");

if (closePanelBtn) closePanelBtn.onclick = () => (panel.hidden = true);

let selectedProduct = null;

if (addBtn) {
  addBtn.onclick = () => {
    if (!selectedProduct) return;

    const existing = basket.find((item) => item.id === selectedProduct.id);
    if (existing) existing.qty++;
    else basket.push({ ...selectedProduct, qty: 1 });

    saveBasket();
    basketPanel.hidden = false;
    renderBasket();
  };
}

// -------------------- CAMERA RAILS (LOCKED) --------------------
let camTargetPos = null;
let camTargetLook = null;
let camMoving = false;

const CAMERA_POINTS = {
  lobby: {
    pos: new THREE.Vector3(0, 1.7, 8),
    look: new THREE.Vector3(0, 1.6, 0),
  },
  shop: {
    pos: new THREE.Vector3(0, 1.7, 4),
    look: new THREE.Vector3(0, 1.6, -6),
  },
};

function moveCameraTo(pointName) {
  const p = CAMERA_POINTS[pointName];
  if (!p) return;
  camTargetPos = p.pos.clone();
  camTargetLook = p.look.clone();
  camMoving = true;
}

// -------------------- 3D SCENE --------------------
let renderer, scene, camera, raycaster, mouse;
const productMeshes = [];
const sceneHost = document.getElementById("scene");

const products = [
  { id: "p1", name: "Oak Rune Token", desc: "Hand-finished oak token with carved symbol.", price: 18 },
  { id: "p2", name: "Walnut Mini Totem", desc: "Small walnut carving, matte oil finish.", price: 25 },
  { id: "p3", name: "Maple Desk Charm", desc: "Minimal charm piece for desk or shelf.", price: 12 },
  { id: "p4", name: "Ash Key Fob", desc: "Simple key fob, durable and light.", price: 9 },
  { id: "p5", name: "Custom Sigil Block", desc: "Commission block — your design, your vibe.", price: 45 },
];

init3D(); // start in 3D immediately

function init3D() {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x07090f, 6, 22);

  camera = new THREE.PerspectiveCamera(
    60,
    sceneHost.clientWidth / sceneHost.clientHeight,
    0.1,
    200
  );

  camera.position.set(0, 1.7, 9);
  camera.lookAt(0, 1.6, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(sceneHost.clientWidth, sceneHost.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  sceneHost.appendChild(renderer.domElement);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  const key = new THREE.DirectionalLight(0x7aa2ff, 1.2);
  key.position.set(3, 5, 2);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x9bffcf, 0.8);
  rim.position.set(-4, 3, -2);
  scene.add(rim);

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x0b0f1a, roughness: 0.9, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x0b1020,
    roughness: 0.95,
    metalness: 0.0,
  });

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), wallMat);
  backWall.position.set(0, 5, -10);
  scene.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-10, 5, 0);
  scene.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), wallMat);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(10, 5, 0);
  scene.add(rightWall);

  // Shelves
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x141a2a, roughness: 0.7 });
  for (let i = 0; i < 3; i++) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 1.2), shelfMat);
    shelf.position.set(0, 1.0 + i * 1.2, -6);
    scene.add(shelf);
  }

  // Products
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x7aa2ff,
    roughness: 0.35,
    metalness: 0.25,
    emissive: 0x0b1020,
  });

  products.forEach((p, idx) => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), baseMat.clone());
    const col = idx % 5;
    box.position.set(-4 + col * 2, 1.6, -6);
    box.userData = p;
    scene.add(box);
    productMeshes.push(box);
  });

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("resize", onResize);

  // Start in lobby then move to shop (temporary “walk” test)
  moveCameraTo("lobby");
  setTimeout(() => moveCameraTo("shop"), 900);

  animate();
}

function onResize() {
  if (!renderer || !camera) return;
  const w = sceneHost.clientWidth;
  const h = sceneHost.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function onPointerDown(ev) {
  if (!renderer || !camera) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(productMeshes, false);
  if (!hits.length) return;

  const picked = hits[0].object;
  const data = picked.userData;

  productMeshes.forEach((m) => m.material.emissive.setHex(0x0b1020));
  picked.material.emissive.setHex(0x203060);

  if (titleEl) titleEl.textContent = data.name;
  if (descEl) descEl.textContent = data.desc;
  if (priceEl) priceEl.textContent = money(data.price);

  selectedProduct = { id: data.id, name: data.name, desc: data.desc, price: data.price };
  if (panel) panel.hidden = false;
}

function animate() {
  requestAnimationFrame(animate);
  if (!renderer || !scene || !camera) return;

  // Smooth camera rails
  if (camMoving && camTargetPos && camTargetLook) {
    camera.position.lerp(camTargetPos, 0.06);

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const currentLookPoint = camera.position.clone().add(forward);

    currentLookPoint.lerp(camTargetLook, 0.06);
    camera.lookAt(currentLookPoint);

    if (camera.position.distanceTo(camTargetPos) < 0.05) camMoving = false;
  }

  // Product idle animation
  const t = performance.now() * 0.001;
  productMeshes.forEach((m, i) => {
    m.rotation.y = t * 0.4 + i * 0.15;
    m.position.y = 1.6 + Math.sin(t * 1.4 + i) * 0.03;
  });

  renderer.render(scene, camera);
}
