import * as THREE from "https://esm.sh/three@0.160.0";

/* ------------------------------------------------------------
  PYROSHOP WORLD (PLACEHOLDER VERSION)
  - Starts at HOME (campfire)
  - Around you: Shop (cabin), Blog (library), About (plinth)
  - Click in-world signs to ride camera rails (locked)
  - Click product cubes in Shop for details + Add to basket
-------------------------------------------------------------*/

// -------------------- DOM --------------------
const zoneLabel = document.getElementById("zoneLabel");

const panel = document.getElementById("productPanel");
const titleEl = document.getElementById("productTitle");
const descEl = document.getElementById("productDesc");
const priceEl = document.getElementById("productPrice");
const imgTextEl = document.getElementById("productImgText");

const closePanelBtn = document.getElementById("closePanel");
if (closePanelBtn) closePanelBtn.onclick = () => (panel.hidden = true);

const addBtn = document.getElementById("addToBasket");

// Basket DOM
const basket = JSON.parse(localStorage.getItem("basket") || "[]");
const btnBasket = document.getElementById("btnBasket");
const basketPanel = document.getElementById("basketPanel");
const basketItems = document.getElementById("basketItems");
const basketTotal = document.getElementById("basketTotal");
const closeBasketBtn = document.getElementById("closeBasket");
if (closeBasketBtn) closeBasketBtn.onclick = () => (basketPanel.hidden = true);

const btnHome = document.getElementById("btnHome");

// -------------------- HELPERS --------------------
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

if (btnBasket) {
  btnBasket.onclick = () => {
    basketPanel.hidden = false;
    renderBasket();
  };
}

// -------------------- CAMERA RAILS --------------------
let camTargetPos = null;
let camTargetLook = null;
let camMoving = false;
let currentZone = "home";

const CAMERA_POINTS = {
  home: {
    label: "Home",
    pos: new THREE.Vector3(0, 1.7, 8),
    look: new THREE.Vector3(0, 1.4, 0),
  },
  shop: {
    label: "Shop (Cabin)",
    pos: new THREE.Vector3(-10, 1.7, 6),
    look: new THREE.Vector3(-10, 1.4, 0),
  },
  blog: {
    label: "Blog (Library)",
    pos: new THREE.Vector3(10, 1.7, 6),
    look: new THREE.Vector3(10, 1.4, 0),
  },
  about: {
    label: "About",
    pos: new THREE.Vector3(0, 1.7, -8),
    look: new THREE.Vector3(0, 1.4, -14),
  },
};

function moveCameraTo(zoneName) {
  const p = CAMERA_POINTS[zoneName];
  if (!p) return;
  camTargetPos = p.pos.clone();
  camTargetLook = p.look.clone();
  camMoving = true;
  currentZone = zoneName;
  if (zoneLabel) zoneLabel.textContent = p.label;

  // Hide panels when traveling
  if (panel) panel.hidden = true;
  if (basketPanel) basketPanel.hidden = true;
}

if (btnHome) btnHome.onclick = () => moveCameraTo("home");

// -------------------- 3D INIT --------------------
const sceneHost = document.getElementById("scene");
let renderer, scene, camera, raycaster, mouse;

const interactables = [];      // signs + products
const productMeshes = [];      // only products
let selectedProduct = null;

// Placeholder product data (shop zone)
const products = [
  { id: "p1", name: "Oak Rune Token", desc: "Hand-finished oak token with carved symbol.", price: 18, img: "WOODCRAFT_01" },
  { id: "p2", name: "Walnut Mini Totem", desc: "Small walnut carving, matte oil finish.", price: 25, img: "WOODCRAFT_02" },
  { id: "p3", name: "Maple Desk Charm", desc: "Minimal charm piece for desk or shelf.", price: 12, img: "WOODCRAFT_03" },
  { id: "p4", name: "Ash Key Fob", desc: "Simple key fob, durable and light.", price: 9, img: "WOODCRAFT_04" },
  { id: "p5", name: "Custom Sigil Block", desc: "Commission block — your design, your vibe.", price: 45, img: "CUSTOM_SIGIL" },
];

init3D();

function init3D() {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x07090f, 8, 40);

  camera = new THREE.PerspectiveCamera(60, sceneHost.clientWidth / sceneHost.clientHeight, 0.1, 200);
  camera.position.copy(CAMERA_POINTS.home.pos.clone().add(new THREE.Vector3(0, 0, 1)));
  camera.lookAt(CAMERA_POINTS.home.look);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(sceneHost.clientWidth, sceneHost.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  sceneHost.appendChild(renderer.domElement);

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0x7aa2ff, 1.0);
  key.position.set(6, 8, 4);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x9bffcf, 0.7);
  rim.position.set(-8, 6, -3);
  scene.add(rim);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x0b0f1a, roughness: 0.95, metalness: 0.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);

  // Soft “path” stones (placeholder)
  addPathStones();

  // HOME: campfire placeholder
  const campfire = createCampfire();
  campfire.position.set(0, 0, 0);
  scene.add(campfire);

  // SHOP: cabin placeholder
  const cabin = createCabin();
  cabin.position.set(-10, 0, 0);
  scene.add(cabin);

  // BLOG: library placeholder
  const library = createLibrary();
  library.position.set(10, 0, 0);
  scene.add(library);

  // ABOUT: plinth placeholder
  const about = createAboutPlinth();
  about.position.set(0, 0, -14);
  scene.add(about);

  // In-world signs (clickable)
  addSign("SHOP", "shop", new THREE.Vector3(-6, 0, 3));
  addSign("BLOG", "blog", new THREE.Vector3(6, 0, 3));
  addSign("ABOUT", "about", new THREE.Vector3(0, 0, -6));
  addSign("HOME", "home", new THREE.Vector3(0, 0, 5)); // optional

  // Shop products (placed near cabin)
  addShopProducts();

  // Interaction
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("resize", onResize);

  // Start at home
  moveCameraTo("home");

  animate();
}

// -------------------- WORLD BUILDERS (PLACEHOLDERS) --------------------
function addPathStones() {
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x101625, roughness: 1.0 });
  for (let i = 0; i < 20; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.08, 10), stoneMat);
    s.position.set(
      (Math.sin(i * 0.55) * 2.2),
      0.04,
      6 - i * 0.7
    );
    s.rotation.y = i * 0.25;
    scene.add(s);
  }
}

function createCampfire() {
  const g = new THREE.Group();

  // logs
  const logMat = new THREE.MeshStandardMaterial({ color: 0x2a1f14, roughness: 1.0 });
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 12), logMat);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = i * (Math.PI / 3);
    log.position.set(0, 0.12, 0);
    g.add(log);
  }

  // stones ring
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x121a2b, roughness: 1.0 });
  for (let i = 0; i < 10; i++) {
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), stoneMat);
    const a = (i / 10) * Math.PI * 2;
    stone.position.set(Math.cos(a) * 0.8, 0.12, Math.sin(a) * 0.8);
    g.add(stone);
  }

  // flame (placeholder) + point light animation
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xffaa55,
    emissive: 0xff6611,
    emissiveIntensity: 1.0,
    roughness: 0.6
  });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 10), flameMat);
  flame.position.set(0, 0.55, 0);
  g.add(flame);

  const fireLight = new THREE.PointLight(0xff8844, 2.2, 12);
  fireLight.position.set(0, 1.0, 0);
  g.add(fireLight);

  g.userData.fire = { flame, fireLight };
  return g;
}

function createCabin() {
  const g = new THREE.Group();

  const wood = new THREE.MeshStandardMaterial({ color: 0x2b2a2f, roughness: 0.9 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x151a2a, roughness: 0.9 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(5.4, 2.8, 4.2), wood);
  base.position.set(0, 1.4, 0);
  g.add(base);

  const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(3.8, 2.2, 4), roof);
  roofMesh.rotation.y = Math.PI / 4;
  roofMesh.position.set(0, 3.3, 0);
  g.add(roofMesh);

  // door glow (placeholder “open shop” vibe)
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x0b1020, emissive: 0x7aa2ff, emissiveIntensity: 0.4 });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.0), doorMat);
  door.position.set(0, 1.2, 2.11);
  g.add(door);

  g.userData = { type: "cabin" };
  return g;
}

function createLibrary() {
  const g = new THREE.Group();

  const wall = new THREE.MeshStandardMaterial({ color: 0x0f1424, roughness: 0.95 });
  const shelf = new THREE.MeshStandardMaterial({ color: 0x151a2a, roughness: 0.85 });

  const back = new THREE.Mesh(new THREE.BoxGeometry(6.0, 4.0, 1.0), wall);
  back.position.set(0, 2.0, 0);
  g.add(back);

  // shelves + “books”
  for (let r = 0; r < 4; r++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.12, 0.8), shelf);
    plank.position.set(0, 0.8 + r * 0.85, 0.1);
    g.add(plank);

    for (let i = 0; i < 10; i++) {
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.55 + (i % 3) * 0.06, 0.18),
        new THREE.MeshStandardMaterial({ color: 0x7aa2ff, roughness: 0.7, metalness: 0.05, emissive: 0x0b1020 })
      );
      book.position.set(-2.4 + i * 0.55, 1.05 + r * 0.85, 0.35);
      g.add(book);
    }
  }

  return g;
}

function createAboutPlinth() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x101625, roughness: 1.0 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.5, 24), mat);
  base.position.set(0, 0.25, 0);
  g.add(base);

  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 2.4, 18), mat);
  pillar.position.set(0, 1.7, 0);
  g.add(pillar);

  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x0b1020, emissive: 0x9bffcf, emissiveIntensity: 0.25 })
  );
  plaque.position.set(0, 1.7, 1.05);
  g.add(plaque);

  return g;
}

// Clickable sign (simple billboard)
function addSign(text, zoneName, position) {
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.1, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x0b1020, roughness: 0.6, metalness: 0.1, emissive: 0x0b1020 })
  );
  sign.position.copy(position).add(new THREE.Vector3(0, 1.35, 0));
  sign.userData = { type: "sign", zone: zoneName, label: text };

  // “post”
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 1.35, 10),
    new THREE.MeshStandardMaterial({ color: 0x151a2a, roughness: 0.9 })
  );
  post.position.copy(position).add(new THREE.Vector3(0, 0.7, 0));

  scene.add(sign);
  scene.add(post);
  interactables.push(sign);
}

function addShopProducts() {
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x141a2a, roughness: 0.7 });
  // simple shelf near cabin
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.22, 1.2), shelfMat);
  shelf.position.set(-10, 1.05, 2.6);
  scene.add(shelf);

  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x7aa2ff,
    roughness: 0.35,
    metalness: 0.25,
    emissive: 0x0b1020,
  });

  products.forEach((p, idx) => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), baseMat.clone());
    box.position.set(-12.5 + idx * 1.2, 1.55, 2.6);
    box.userData = { type: "product", ...p };
    scene.add(box);
    productMeshes.push(box);
    interactables.push(box);
  });
}

// -------------------- INPUT --------------------
function onPointerDown(ev) {
  if (!renderer || !camera) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);

  raycaster.setFromCamera(mouse, camera);

  const hits = raycaster.intersectObjects(interactables, false);
  if (!hits.length) return;

  const obj = hits[0].object;
  const data = obj.userData || {};

  // Click sign -> travel
  if (data.type === "sign") {
    moveCameraTo(data.zone);
    return;
  }

  // Click product -> open panel
  if (data.type === "product") {
    productMeshes.forEach((m) => m.material.emissive.setHex(0x0b1020));
    obj.material.emissive.setHex(0x203060);

    if (titleEl) titleEl.textContent = data.name;
    if (descEl) descEl.textContent = data.desc;
    if (priceEl) priceEl.textContent = money(data.price);
    if (imgTextEl) imgTextEl.textContent = data.img || "WOODCRAFT_XX";

    selectedProduct = { id: data.id, name: data.name, desc: data.desc, price: data.price };
    if (panel) panel.hidden = false;
    return;
  }
}

// Add to basket
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

// -------------------- RENDER LOOP --------------------
function onResize() {
  if (!renderer || !camera) return;
  const w = sceneHost.clientWidth;
  const h = sceneHost.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

let _tmpForward = new THREE.Vector3();
let _tmpLookPoint = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  if (!renderer || !scene || !camera) return;

  // Camera rails
  if (camMoving && camTargetPos && camTargetLook) {
    camera.position.lerp(camTargetPos, 0.06);

    camera.getWorldDirection(_tmpForward);
    _tmpLookPoint.copy(camera.position).add(_tmpForward);
    _tmpLookPoint.lerp(camTargetLook, 0.06);
    camera.lookAt(_tmpLookPoint);

    if (camera.position.distanceTo(camTargetPos) < 0.05) camMoving = false;
  }

  // Campfire animation
  // Find campfire group by scanning (simple, OK for placeholder)
  const t = performance.now() * 0.001;
  scene.traverse((o) => {
    if (o.userData?.fire) {
      const { flame, fireLight } = o.userData.fire;
      flame.scale.y = 0.9 + Math.sin(t * 7) * 0.12;
      flame.rotation.y = t * 0.8;
      fireLight.intensity = 2.0 + Math.sin(t * 9) * 0.35;
    }
  });

  // Products idle
  productMeshes.forEach((m, i) => {
    m.rotation.y = t * 0.6 + i * 0.25;
    m.position.y = 1.55 + Math.sin(t * 1.6 + i) * 0.03;
  });

  renderer.render(scene, camera);
}

onResize();
window.addEventListener("resize", onResize);
animate();
