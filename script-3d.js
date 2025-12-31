import * as THREE from "https://esm.sh/three@0.160.0";

/* ============================================================
   PYROSHOP WORLD v3 (FIXED)
   - Click cabin/library/about/checkout ONLY from Home
   - After traveling, you can click items in that zone
   - Book modal is truly hidden until opened
   - Campfire flame + flicker works
   - Smooth camera rail animation
   - Uses click-boxes (invisible) around buildings for reliable clicking
============================================================ */

/* -------------------- DOM -------------------- */
const zoneLabel = document.getElementById("zoneLabel");

const panel = document.getElementById("productPanel");
const titleEl = document.getElementById("productTitle");
const descEl = document.getElementById("productDesc");
const priceEl = document.getElementById("productPrice");
const imgEl = document.getElementById("productImg");
const closePanelBtn = document.getElementById("closePanel");
const addBtn = document.getElementById("addToBasket");

const btnHome = document.getElementById("btnHome");

const basket = JSON.parse(localStorage.getItem("basket") || "[]");
const btnBasket = document.getElementById("btnBasket");
const basketPanel = document.getElementById("basketPanel");
const basketItems = document.getElementById("basketItems");
const basketTotal = document.getElementById("basketTotal");
const closeBasketBtn = document.getElementById("closeBasket");

const hoverTip = document.getElementById("hoverTip");

// Book modal
const bookModal = document.getElementById("bookModal");
const bookClose = document.getElementById("bookClose");
const bookTitle = document.getElementById("bookTitle");
const bookMeta = document.getElementById("bookMeta");
const bookPageText = document.getElementById("bookPageText");
const bookPrev = document.getElementById("bookPrev");
const bookNext = document.getElementById("bookNext");

if (closePanelBtn) closePanelBtn.onclick = () => (panel.hidden = true);
if (closeBasketBtn) closeBasketBtn.onclick = () => (basketPanel.hidden = true);

/* -------------------- BASKET HELPERS -------------------- */
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

/* -------------------- BOOK VIEWER -------------------- */
let openBook = null;
let openBookPage = 0;

function openBookViewer(data) {
  openBook = data;
  openBookPage = 0;

  if (bookTitle) bookTitle.textContent = data.title;
  if (bookMeta) bookMeta.textContent = data.date;
  if (bookPageText) bookPageText.textContent = data.pages?.[0] || "";

  if (bookModal) bookModal.hidden = false;
}
function closeBookViewer() {
  if (bookModal) bookModal.hidden = true;
  openBook = null;
}

if (bookClose) bookClose.onclick = closeBookViewer;

if (bookPrev) bookPrev.onclick = () => {
  if (!openBook) return;
  openBookPage = Math.max(0, openBookPage - 1);
  if (bookPageText) bookPageText.textContent = openBook.pages?.[openBookPage] || "";
};
if (bookNext) bookNext.onclick = () => {
  if (!openBook) return;
  const max = (openBook.pages?.length || 1) - 1;
  openBookPage = Math.min(max, openBookPage + 1);
  if (bookPageText) bookPageText.textContent = openBook.pages?.[openBookPage] || "";
};

/* -------------------- CAMERA RAILS -------------------- */
let currentZone = "home";

const CAMERA_POINTS = {
  home: { label: "Home", pos: new THREE.Vector3(0, 1.85, 10.5), look: new THREE.Vector3(0, 1.25, 0) },
  shop: { label: "Shop", pos: new THREE.Vector3(-13.0, 1.85, 8.2), look: new THREE.Vector3(-10, 1.25, 0) },
  blog: { label: "Library", pos: new THREE.Vector3(13.0, 1.85, 8.2), look: new THREE.Vector3(10, 1.25, 0) },
  about: { label: "About", pos: new THREE.Vector3(0, 1.85, -9.5), look: new THREE.Vector3(0, 1.25, -14) },
};

let camTween = null;
const CAM_TRAVEL_MS = 2400;

function easeInOutQuint(x) {
  return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
}

function getCurrentLookPoint(camera) {
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  return camera.position.clone().add(fwd.multiplyScalar(10));
}

function moveCameraTo(zoneName) {
  const p = CAMERA_POINTS[zoneName];
  if (!p || !camera) return;

  currentZone = zoneName;
  if (zoneLabel) zoneLabel.textContent = p.label;

  // Hide overlays while moving
  if (panel) panel.hidden = true;
  if (basketPanel) basketPanel.hidden = true;
  if (hoverTip) hoverTip.hidden = true;

  camTween = {
    t0: performance.now(),
    dur: CAM_TRAVEL_MS,
    fromPos: camera.position.clone(),
    toPos: p.pos.clone(),
    fromLook: getCurrentLookPoint(camera),
    toLook: p.look.clone(),
  };
}

if (btnHome) btnHome.onclick = () => moveCameraTo("home");

/* -------------------- PROCEDURAL THUMBS -------------------- */
function makeProductThumb(name) {
  const c = document.createElement("canvas");
  c.width = 900; c.height = 520;
  const ctx = c.getContext("2d");

  const g = ctx.createLinearGradient(0, 0, 900, 520);
  g.addColorStop(0, "#0b1020");
  g.addColorStop(1, "#141a2a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 900, 520);

  ctx.strokeStyle = "rgba(122,162,255,0.28)";
  ctx.lineWidth = 8;
  ctx.strokeRect(34, 34, 832, 452);

  ctx.fillStyle = "rgba(155,255,207,0.18)";
  ctx.beginPath();
  ctx.roundRect(240, 155, 420, 260, 26);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "800 44px Inter, system-ui, sans-serif";
  ctx.fillText(name, 70, 108);

  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = "600 22px Inter, system-ui, sans-serif";
  ctx.fillText("PyroShop • placeholder image", 70, 150);

  return c.toDataURL("image/png");
}

/* -------------------- 3D INIT -------------------- */
const sceneHost = document.getElementById("scene");
let renderer, scene, camera, raycaster, mouse;

const homeClickables = []; // only active when currentZone === "home"
const shopClickables = []; // only active when currentZone === "shop"
const blogClickables = []; // books active when currentZone === "blog"
const alwaysClickables = []; // (optional) none for now

const productMeshes = [];

let selectedProduct = null;

const products = [
  { id: "p1", name: "Oak Rune Token", desc: "Hand-finished oak token with carved symbol.", price: 18 },
  { id: "p2", name: "Walnut Mini Totem", desc: "Small walnut carving, matte oil finish.", price: 25 },
  { id: "p3", name: "Maple Desk Charm", desc: "Minimal charm piece for desk or shelf.", price: 12 },
  { id: "p4", name: "Ash Key Fob", desc: "Simple key fob, durable and light.", price: 9 },
  { id: "p5", name: "Custom Sigil Block", desc: "Commission block — your design, your vibe.", price: 45 },
  { id: "p6", name: "Workshop Prototype Set", desc: "Placeholder pieces waiting for their final finish.", price: 22 },
  { id: "p7", name: "Craft Bench Mockups", desc: "Assorted experimental trinkets from the craft table.", price: 14 },
  { id: "p8", name: "Ethical Bone Study", desc: "Test carvings that will inform a future bonecraft drop.", price: 38 },
  { id: "p9", name: "Familiar Form Maquette", desc: "Armature and resin guide sculpt for bonecraft commissions.", price: 32 },
];

const BOOKS = [
  { title: "Wood Joinery Notes", date: "2019-06-12", pages: ["Mortise & tenon basics…", "Tools & safety…", "Common mistakes…"] },
  { title: "Field Sketches", date: "2021-09-03", pages: ["Landscape observations…", "Material weathering notes…"] },
  { title: "Bonecraft Reference", date: "2018-02-22", pages: ["Ethical sourcing…", "Carving techniques…", "Finishes…"] },
];

init3D();

/* -------------------- WORLD BUILD -------------------- */
function init3D() {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x07090f, 12, 85);

  camera = new THREE.PerspectiveCamera(60, sceneHost.clientWidth / sceneHost.clientHeight, 0.1, 260);
  camera.position.copy(CAMERA_POINTS.home.pos);
  camera.lookAt(CAMERA_POINTS.home.look);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(sceneHost.clientWidth, sceneHost.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  sceneHost.innerHTML = "";
  sceneHost.appendChild(renderer.domElement);

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.30));

  const moonLight = new THREE.DirectionalLight(0x93b7ff, 0.9);
  moonLight.position.set(14, 20, 10);
  scene.add(moonLight);

  const rim = new THREE.DirectionalLight(0x9bffcf, 0.25);
  rim.position.set(-16, 12, -8);
  scene.add(rim);

  // Moon (visual)
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 24, 18),
    new THREE.MeshStandardMaterial({ color: 0xe6f0ff, emissive: 0xa8c6ff, emissiveIntensity: 0.5, roughness: 0.95 })
  );
  moon.position.set(18, 16, -26);
  scene.add(moon);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: 0x0b1511, roughness: 1.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Simple forest ring
  addForestRing();

  // Dirt paths + torches (simple)
  addPathsAndTorches();

  // Home: campfire + benches
  const campfire = createCampfire();
  campfire.position.set(0, 0, 0);
  scene.add(campfire);

  addBenches();

  // Checkout kiosk (near campfire, right side)
  const checkout = createCheckoutKiosk();
  checkout.position.set(3.2, 0, 0.8);
  scene.add(checkout);

  // Shop building (left)
  const cabin = createCabin();
  cabin.position.set(-10, 0, 0);
  scene.add(cabin);

  // Blog/library building (right)
  const library = createLibrary();
  library.position.set(10, 0, 0);
  scene.add(library);

  // About plinth (forward)
  const about = createAbout();
  about.position.set(0, 0, -14);
  scene.add(about);

  // CLICK BOXES (big invisible hit areas) — ONLY ACTIVE AT HOME
  addHomeClickBox("shop", new THREE.Vector3(-10, 1.6, 0), new THREE.Vector3(8, 4, 8));
  addHomeClickBox("blog", new THREE.Vector3(10, 1.8, 0), new THREE.Vector3(8, 5, 8));
  addHomeClickBox("about", new THREE.Vector3(0, 1.6, -14), new THREE.Vector3(7, 4, 7));
  addHomeClickBox("checkout", new THREE.Vector3(3.2, 0.9, 0.8), new THREE.Vector3(4, 3, 4));

  // Shop products (ONLY ACTIVE IN SHOP)
   addShopProducts(cabin);

  // Library books (ONLY ACTIVE IN BLOG)
  registerLibraryBooks(library);

  // Interaction
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  window.addEventListener("resize", onResize);

  onResize();

  // Start
  if (zoneLabel) zoneLabel.textContent = "Home";
  animate();
}

/* -------------------- BUILD HELPERS -------------------- */
function addForestRing() {
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2a1f14, roughness: 1.0 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x0f3a22, roughness: 1.0 });

  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.22, 2.2, 10);
  const leafGeo = new THREE.ConeGeometry(0.9, 2.6, 10);

  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const r = 40 + Math.random() * 22;
    const x = Math.cos(a) * r + (Math.random() * 4 - 2);
    const z = Math.sin(a) * r + (Math.random() * 4 - 2);

    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 1.1, z);

    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.set(x, 3.2, z);
    leaves.rotation.y = Math.random() * Math.PI;

    const g = new THREE.Group();
    g.add(trunk);
    g.add(leaves);
    g.scale.setScalar(0.85 + Math.random() * 1.3);
    scene.add(g);
  }
}

function addPathsAndTorches() {
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 1.0 });

  function addPath(from, to, width = 2.2) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.sqrt(dx * dx + dz * dz);

    const path = new THREE.Mesh(new THREE.PlaneGeometry(len, width), dirtMat);
    path.rotation.x = -Math.PI / 2;
    path.position.set((from.x + to.x) / 2, 0.02, (from.z + to.z) / 2);
    path.rotation.z = Math.atan2(dz, dx);
    scene.add(path);

    const steps = Math.max(3, Math.floor(len / 4));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = from.x + dx * t;
      const z = from.z + dz * t;
      const side = (i % 2 === 0) ? 1 : -1;
      addTorch(new THREE.Vector3(x, 0, z + side * (width * 0.6)));
    }
  }

  addPath(new THREE.Vector3(0, 0, 2.8), new THREE.Vector3(-10, 0, 0), 2.2);
  addPath(new THREE.Vector3(0, 0, 2.8), new THREE.Vector3(10, 0, 0), 2.2);
  addPath(new THREE.Vector3(0, 0, 0.2), new THREE.Vector3(0, 0, -14), 2.5);
}

function addTorch(pos) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a1f14, roughness: 1.0 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.6, 10), poleMat);
  pole.position.set(pos.x, 0.8, pos.z);
  scene.add(pole);

  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xffaa55,
    emissive: 0xff6a11,
    emissiveIntensity: 0.95,
    roughness: 0.65
  });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 10), flameMat);
  flame.position.set(pos.x, 1.65, pos.z);
  flame.userData.torch = true;
  scene.add(flame);

  const light = new THREE.PointLight(0xff8844, 1.1, 8);
  light.position.set(pos.x, 1.7, pos.z);
  flame.userData.light = light;
  scene.add(light);
}

/* -------------------- HOME OBJECTS -------------------- */
function createCampfire() {
  const g = new THREE.Group();

  const logMat = new THREE.MeshStandardMaterial({ color: 0x2a1f14, roughness: 1.0 });
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.35, 12), logMat);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = i * (Math.PI / 3);
    log.position.set(0, 0.12, 0);
    g.add(log);
  }

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x121a2b, roughness: 1.0 });
  for (let i = 0; i < 12; i++) {
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), stoneMat);
    const a = (i / 12) * Math.PI * 2;
    stone.position.set(Math.cos(a) * 0.95, 0.11, Math.sin(a) * 0.95);
    g.add(stone);
  }

  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xffaa55,
    emissive: 0xff6611,
    emissiveIntensity: 1.0,
    roughness: 0.6
  });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.75, 10), flameMat);
  flame.position.set(0, 0.65, 0);
  g.add(flame);

  const fireLight = new THREE.PointLight(0xff8844, 2.2, 15);
  fireLight.position.set(0, 1.05, 0);
  g.add(fireLight);

  g.userData.fire = { flame, fireLight };
  return g;
}

function addBenches() {
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x2a1f14, roughness: 1.0 });
  const benchGeo = new THREE.CylinderGeometry(0.17, 0.17, 2.4, 14);
  const benchY = 0.22;

  const benches = [
    { x: -1.9, z: 1.4, rot: 0.4 },
    { x: 2.1, z: 1.3, rot: -0.5 },
    { x: -2.0, z: -1.6, rot: -2.6 },
    { x: 2.0, z: -1.7, rot: 2.7 },
  ];

  benches.forEach(b => {
    const bench = new THREE.Mesh(benchGeo, benchMat);
    bench.rotation.z = Math.PI / 2;
    bench.rotation.y = b.rot;
    bench.position.set(b.x, benchY, b.z);
    scene.add(bench);
  });
}

function createCheckoutKiosk() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x101625, roughness: 0.9 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 1.0), mat);
  base.position.set(0, 0.55, 0);
  g.add(base);

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.14, 1.08),
    new THREE.MeshStandardMaterial({ color: 0x151a2a, roughness: 0.7 })
  );
  top.position.set(0, 1.12, 0);
  g.add(top);

  const sign = neonLabel("CHECKOUT", 0xffb86b);
  sign.position.set(0, 1.55, 0.55);
  g.add(sign);

  g.userData.type = "checkout";
  return g;
}

/* -------------------- BUILDINGS -------------------- */
function createCabin() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x2b2a2f, roughness: 0.95 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x151a2a, roughness: 0.95 });
  const innerWallMat = new THREE.MeshStandardMaterial({ color: 0x121824, roughness: 0.9 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0f1420, roughness: 0.95 });
   
  const wallThickness = 0.35;
  const W = 6.0, H = 3.2, D = 4.6;

  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, wallThickness), wood);
  back.position.set(0, H / 2, -D / 2);
  g.add(back);

  const left = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, H, D), wood);
  left.position.set(-W / 2, H / 2, 0);
  g.add(left);

  const right = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, H, D), wood);
  right.position.set(W / 2, H / 2, 0);
  g.add(right);
   
  // Interior floor and lining so the open front reveals depth
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W - 0.4, 0.14, D - 0.4), floorMat);
  floor.position.set(0, 0.07, 0);
  g.add(floor);

  const backInner = new THREE.Mesh(new THREE.BoxGeometry(W - 0.6, H - 0.4, 0.12), innerWallMat);
  backInner.position.set(0, H / 2 + 0.02, -D / 2 + 0.18);
  g.add(backInner);

  const leftInner = new THREE.Mesh(new THREE.BoxGeometry(0.12, H - 0.4, D - 0.5), innerWallMat);
  leftInner.position.set(-W / 2 + 0.18, H / 2 + 0.02, 0);
  g.add(leftInner);

  const rightInner = new THREE.Mesh(new THREE.BoxGeometry(0.12, H - 0.4, D - 0.5), innerWallMat);
  rightInner.position.set(W / 2 - 0.18, H / 2 + 0.02, 0);
  g.add(rightInner);

  // Interior glow to light signage/shelves
  const warmFill = new THREE.PointLight(0x9bffcf, 0.9, 10);
  warmFill.position.set(0, 2.4, 0.4);
  g.add(warmFill);

  const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.6, 4), roof);
  roofMesh.rotation.y = Math.PI / 4;
  roofMesh.position.set(0, H + 1.0, 0);
  g.add(roofMesh);

  // Neon label above
  const label = neonLabel("SHOP", 0x7aa2ff);
  label.position.set(0, 4.1, 2.35);
  label.rotation.y = Math.PI;
  g.add(label);

  return g;
}

function createLibrary() {
  const g = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x0f1424, roughness: 1.0 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x161d30, roughness: 0.9 });

  // Rocky base platform
  const base = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.35, 2.8), new THREE.MeshStandardMaterial({ color: 0x0c101a, roughness: 1.0 }));
  base.position.set(0, 0.175, 0.1);
  g.add(base);

  // Stone wall
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(7.0, 4.3, 1.2),
    stoneMat
  );
  wall.position.set(0, 2.15, 0);
  g.add(wall);
   
  // Stone trim + inset arches
  const band = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.14, 0.28), trimMat);
  band.position.set(0, 0.72, 0.61);
  g.add(band);

  const cornice = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.18, 0.32), trimMat);
  cornice.position.set(0, 3.72, 0.62);
  g.add(cornice);

  function addArch(x) {
    const archGroup = new THREE.Group();
    const pillar = new THREE.BoxGeometry(0.32, 1.6, 0.14);
    const postL = new THREE.Mesh(pillar, trimMat);
    postL.position.set(x - 0.62, 1.52, 0.62);
    const postR = new THREE.Mesh(pillar, trimMat);
    postR.position.set(x + 0.62, 1.52, 0.62);

    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.26, 0.14), trimMat);
    lintel.position.set(x, 2.5, 0.62);

    const archTop = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.06, 12, 24, Math.PI), trimMat);
    archTop.rotation.x = Math.PI / 2;
    archTop.position.set(x, 2.66, 0.62);

    archGroup.add(postL, postR, lintel, archTop);
    g.add(archGroup);
  }

  [-2.4, 0, 2.4].forEach(addArch);

  // shelves
  for (let r = 0; r < 4; r++) {
    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 0.16, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x151a2a, roughness: 0.9 })
    );
    shelf.position.set(0, 0.95 + r * 0.9, 0.25);
    g.add(shelf);
  }

  // Neon label
  const label = neonLabel("LIBRARY", 0x9bffcf);
  label.position.set(0, 4.2, 0.75);
  g.add(label);

     // Ambient archive lights
  const ambientAccent = new THREE.PointLight(0x7aa2ff, 0.32, 6);
  ambientAccent.position.set(0, 4.5, 0.4);
  g.add(ambientAccent);

  const shelfGlowL = new THREE.PointLight(0x9bffcf, 0.24, 4.5);
  shelfGlowL.position.set(-2.6, 2.6, 0.6);
  g.add(shelfGlowL);

  const shelfGlowR = shelfGlowL.clone();
  shelfGlowR.position.set(2.6, 2.6, 0.6);
  g.add(shelfGlowR);

  // Books (children)
  const bookMat = new THREE.MeshStandardMaterial({ color: 0x7aa2ff, roughness: 0.7, emissive: 0x0b1020 });
  let bi = 0;

  for (let r = 0; r < 4; r++) {
    for (let i = 0; i < 10; i++) {
      const bd = BOOKS[bi % BOOKS.length];
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.58 + (i % 3) * 0.06, 0.18), bookMat.clone());
      book.position.set(-2.85 + i * 0.63, 1.12 + r * 0.9, 0.62);
      book.userData = { type: "book", title: bd.title, date: bd.date, pages: bd.pages };
      g.add(book);
      bi++;
    }
  }

     // Flanking oak trees
  function createOakTree() {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 2.8, 12), new THREE.MeshStandardMaterial({ color: 0x3a281a, roughness: 0.9 }));
    trunk.position.set(0, 1.4, 0);
    tree.add(trunk);

    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.6, 14, 12), new THREE.MeshStandardMaterial({ color: 0x163626, roughness: 0.8 }));
    crown.position.set(0, 3.5, 0);
    tree.add(crown);

    const upper = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 12), new THREE.MeshStandardMaterial({ color: 0x1d422d, roughness: 0.8 }));
    upper.position.set(0.2, 4.6, -0.15);
    tree.add(upper);

    return tree;
  }

  const leftOak = createOakTree();
  leftOak.position.set(-4.2, 0, -0.35);
  g.add(leftOak);

  const rightOak = createOakTree();
  rightOak.position.set(4.2, 0, -0.35);
  g.add(rightOak);

  return g;
}

function createAbout() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x101625, roughness: 1.0 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.45, 0.55, 24), mat);
  base.position.set(0, 0.275, 0);
  g.add(base);

  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 1.02, 2.5, 18), mat);
  pillar.position.set(0, 1.8, 0);
  g.add(pillar);

  const label = neonLabel("ABOUT", 0x9bffcf);
  label.position.set(0, 3.8, 1.1);
  g.add(label);

  return g;
}

/* -------------------- CLICK BOXES (HOME ONLY) -------------------- */
function addHomeClickBox(zone, center, sizeVec3) {
  const geo = new THREE.BoxGeometry(sizeVec3.x, sizeVec3.y, sizeVec3.z);
  const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 });
  const box = new THREE.Mesh(geo, mat);
  box.position.copy(center);
  box.userData = { type: "homeBox", zone };
  scene.add(box);
  homeClickables.push(box);
}

function addShopProducts(cabinGroup) {
  if (!cabinGroup) return;

  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x141a2a, roughness: 0.85 });
  const backShelfGeo = new THREE.BoxGeometry(4.8, 0.14, 0.48);
  const sideShelfGeo = new THREE.BoxGeometry(3.8, 0.14, 0.48);

  const W = 6.0, D = 4.6;
  const shelfLevels = [0.9, 1.55, 2.1];
  const backZ = -D / 2 + 0.55;
  const sideX = W / 2 - 0.55;

  // Shelves
  const shelves = new THREE.Group();
  shelfLevels.forEach((y) => {
    const backShelf = new THREE.Mesh(backShelfGeo, shelfMat);
    backShelf.position.set(0, y, backZ);
    shelves.add(backShelf);
  });

  shelfLevels.forEach((y) => {
    const leftShelf = new THREE.Mesh(sideShelfGeo, shelfMat);
    leftShelf.position.set(-sideX, y, 0);
    leftShelf.rotation.y = Math.PI / 2;
    shelves.add(leftShelf);

    const rightShelf = new THREE.Mesh(sideShelfGeo, shelfMat);
    rightShelf.position.set(sideX, y, 0);
    rightShelf.rotation.y = -Math.PI / 2;
    shelves.add(rightShelf);
  });
  cabinGroup.add(shelves);

  // Neon wall labels
  const labels = [
    { text: "WOODWORK", color: 0xffb86b, pos: [0, 3.05, backZ + 0.12], rot: 0 },
    { text: "BITS & BOBS / CRAFTS", color: 0x7aa2ff, pos: [-sideX - 0.05, 3.05, 0], rot: Math.PI / 2 },
    { text: "BONECRAFT", color: 0x9bffcf, pos: [sideX + 0.05, 3.05, 0], rot: -Math.PI / 2 },
  ];
  labels.forEach(({ text, color, pos, rot }) => {
    const l = neonLabel(text, color);
    l.position.set(pos[0], pos[1], pos[2]);
    l.rotation.y = rot;
    cabinGroup.add(l);
  });

  const baseMat = new THREE.MeshStandardMaterial({ color: 0x2a1f14, roughness: 0.9, emissive: 0x0b1020 });
  const yOffsets = shelfLevels.map((y) => y + 0.42);
  const leftX = -sideX + 0.24;
  const rightX = sideX - 0.24;
  const zSpread = [ -1.5, 0, 1.5 ];

  const placements = [
    // Woodwork (back wall)
    { id: "p1", pos: [-1.6, yOffsets[0], backZ] },
    { id: "p2", pos: [0, yOffsets[1], backZ] },
    { id: "p3", pos: [1.6, yOffsets[2], backZ] },
    // Bits & Bobs / Crafts (left wall)
    { id: "p4", pos: [leftX, yOffsets[0], zSpread[0]] },
    { id: "p6", pos: [leftX, yOffsets[1], zSpread[1]] },
    { id: "p7", pos: [leftX, yOffsets[2], zSpread[2]] },
    // Bonecraft (right wall)
    { id: "p5", pos: [rightX, yOffsets[0], zSpread[0]] },
    { id: "p8", pos: [rightX, yOffsets[1], zSpread[1]] },
    { id: "p9", pos: [rightX, yOffsets[2], zSpread[2]] },
  ];

  placements.forEach(({ id, pos }) => {
    const p = products.find((pr) => pr.id === id);
    if (!p) return;

    const box = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.72), baseMat.clone());
    box.position.set(pos[0], pos[1], pos[2]);
    box.userData = { type: "product", ...p };
    cabinGroup.add(box);

    productMeshes.push(box);
    shopClickables.push(box);
  });
}

function registerLibraryBooks(libraryGroup) {
  libraryGroup.traverse((o) => {
    if (o.isMesh && o.userData?.type === "book") {
      blogClickables.push(o);
    }
  });
}

/* -------------------- NEON LABEL (CANVAS TEXTURE) -------------------- */
function neonLabel(text, accentHex) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const ctx = c.getContext("2d");

  ctx.fillStyle = "rgba(11,16,32,0.85)";
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, c.width - 20, c.height - 20);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 88px Inter, system-ui, sans-serif";

  // glow
  ctx.fillStyle = `rgba(${(accentHex>>16)&255}, ${(accentHex>>8)&255}, ${accentHex&255}, 0.30)`;
  for (let i = 0; i < 6; i++) ctx.fillText(text, c.width / 2, c.height / 2);

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(text, c.width / 2, c.height / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissive: new THREE.Color(accentHex),
    emissiveIntensity: 0.55,
    transparent: true,
  });

  return new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.0), mat);
}

/* -------------------- INPUT (ZONE GATED) -------------------- */
function getActiveClickables() {
  if (currentZone === "home") return homeClickables;
  if (currentZone === "shop") return shopClickables;
  if (currentZone === "blog") return blogClickables;
  return alwaysClickables;
}

function onPointerDown(ev) {
  if (!renderer || !camera) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(getActiveClickables(), false);
  if (!hits.length) return;

  const obj = hits[0].object;
  const data = obj.userData || {};

  // HOME: click-box travel only
  if (data.type === "homeBox") {
    if (data.zone === "checkout") {
      basketPanel.hidden = false;
      renderBasket();
      return;
    }
    moveCameraTo(data.zone);
    return;
  }

  // SHOP: product click
  if (data.type === "product") {
    productMeshes.forEach((m) => m.material.emissive.setHex(0x0b1020));
    obj.material.emissive.setHex(0x203060);

    if (titleEl) titleEl.textContent = data.name;
    if (descEl) descEl.textContent = data.desc;
    if (priceEl) priceEl.textContent = money(data.price);
    if (imgEl) imgEl.src = makeProductThumb(data.name);

    selectedProduct = { id: data.id, name: data.name, desc: data.desc, price: data.price };
    if (panel) panel.hidden = false;
    return;
  }

  // BLOG: book click
  if (data.type === "book") {
    openBookViewer(data);
    return;
  }
}

function onPointerMove(ev) {
  // tooltip only in blog zone
  if (currentZone !== "blog") {
    if (hoverTip) hoverTip.hidden = true;
    renderer.domElement.style.cursor = "default";
    return;
  }

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(blogClickables, false);

  if (!hits.length) {
    if (hoverTip) hoverTip.hidden = true;
    renderer.domElement.style.cursor = "default";
    return;
  }

  const data = hits[0].object.userData || {};
  if (data.type !== "book") {
    if (hoverTip) hoverTip.hidden = true;
    renderer.domElement.style.cursor = "default";
    return;
  }

  renderer.domElement.style.cursor = "pointer";
  if (hoverTip) {
    hoverTip.hidden = false;
    hoverTip.textContent = `${data.title} (${data.date})`;
    hoverTip.style.left = (ev.clientX + 12) + "px";
    hoverTip.style.top = (ev.clientY + 12) + "px";
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

/* -------------------- RENDER LOOP -------------------- */
function onResize() {
  if (!renderer || !camera) return;
  const w = sceneHost.clientWidth;
  const h = sceneHost.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

const _tmpLook = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  if (!renderer || !scene || !camera) return;

  const t = performance.now() * 0.001;

  // Smooth camera tween
  if (camTween) {
    const now = performance.now();
    const u = Math.min(1, (now - camTween.t0) / camTween.dur);
    const e = easeInOutQuint(u);

    camera.position.lerpVectors(camTween.fromPos, camTween.toPos, e);
    _tmpLook.lerpVectors(camTween.fromLook, camTween.toLook, e);
    camera.lookAt(_tmpLook);

    if (u >= 1) camTween = null;
  }

  // Campfire + torch flicker
  scene.traverse((o) => {
    if (o.userData?.fire) {
      const { flame, fireLight } = o.userData.fire;
      flame.scale.y = 0.92 + Math.sin(t * 7) * 0.14;
      flame.rotation.y = t * 0.85;
      fireLight.intensity = 2.0 + Math.sin(t * 9) * 0.35;
    }
    if (o.userData?.torch && o.userData.light) {
      o.userData.light.intensity = 1.05 + Math.sin(t * 10 + o.position.x) * 0.18;
    }
  });

  // Products idle
  productMeshes.forEach((m, i) => {
    m.rotation.y = t * 0.6 + i * 0.25;
    m.position.y = 1.58 + Math.sin(t * 1.6 + i) * 0.03;
  });

  renderer.render(scene, camera);
}
