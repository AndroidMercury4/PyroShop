import * as THREE from "https://esm.sh/three@0.160.0";

/* ============================================================
   PYROSHOP WORLD v2 (FIXED)
   - Single 3D world from start (no routing)
   - Smooth, slower camera rails (eased)
   - Smaller/lower signs with readable text (canvas textures)
   - Campfire + log benches
   - Grass + woodland background
   - Moon + ambient light
   - Dirt paths + torches to each location
   - Procedural textures (no downloads)
   - Copyright-safe product images (generated thumbnails)
   - Stars + clouds + fireflies + animals (animated)
============================================================ */

/* -------------------- DOM -------------------- */
const zoneLabel = document.getElementById("zoneLabel");

const panel = document.getElementById("productPanel");
const titleEl = document.getElementById("productTitle");
const descEl = document.getElementById("productDesc");
const priceEl = document.getElementById("productPrice");
const imgEl = document.getElementById("productImg"); // optional

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

// Book viewer DOM (optional - only works if you added it in HTML)
const bookModal = document.getElementById("bookModal");
const bookClose = document.getElementById("bookClose");
const bookTitle = document.getElementById("bookTitle");
const bookMeta = document.getElementById("bookMeta");
const bookPageText = document.getElementById("bookPageText");
const bookPrev = document.getElementById("bookPrev");
const bookNext = document.getElementById("bookNext");

// Hover tip (optional)
const hoverTip = document.getElementById("hoverTip");

/* -------------------- HELPERS -------------------- */
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
    if (basketPanel) basketPanel.hidden = false;
    renderBasket();
  };
}

/* -------------------- BOOK VIEWER -------------------- */
let openBook = null;
let openBookPage = 0;

function openBookViewer(data) {
  openBook = data;
  openBookPage = 0;

  if (bookTitle) bookTitle.textContent = data.title || "Untitled";
  if (bookMeta) bookMeta.textContent = data.date || "";
  if (bookPageText) bookPageText.textContent = data.pages?.[0] || "";

  if (bookModal) bookModal.hidden = false;
}
function closeBookViewer() {
  if (bookModal) bookModal.hidden = true;
  openBook = null;
}
if (bookClose) bookClose.onclick = closeBookViewer;

if (bookPrev)
  bookPrev.onclick = () => {
    if (!openBook) return;
    openBookPage = Math.max(0, openBookPage - 1);
    if (bookPageText) bookPageText.textContent = openBook.pages?.[openBookPage] || "";
  };

if (bookNext)
  bookNext.onclick = () => {
    if (!openBook) return;
    const max = (openBook.pages?.length || 1) - 1;
    openBookPage = Math.min(max, openBookPage + 1);
    if (bookPageText) bookPageText.textContent = openBook.pages?.[openBookPage] || "";
  };

/* -------------------- CAMERA RAILS (SMOOTH + SLOW) -------------------- */
let currentZone = "home";

// Rail stops
const CAMERA_POINTS = {
  home: { label: "Home", pos: new THREE.Vector3(0, 1.85, 10.5), look: new THREE.Vector3(0, 1.25, 0) },
  shop: { label: "Shop", pos: new THREE.Vector3(-13.2, 1.85, 8.2), look: new THREE.Vector3(-10, 1.25, 0) },
  blog: { label: "Blog", pos: new THREE.Vector3(13.2, 1.85, 8.2), look: new THREE.Vector3(10, 1.25, 0) },
  about: { label: "About", pos: new THREE.Vector3(0, 1.85, -9.5), look: new THREE.Vector3(0, 1.25, -14) },
};

let camTween = null;
const CAM_TRAVEL_MS = 2200; // slower

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
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
  if (bookModal) bookModal.hidden = true;
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

/* -------------------- 3D GLOBALS -------------------- */
const sceneHost = document.getElementById("scene");
let renderer, scene, camera, raycaster, mouse;

const interactables = []; // clickable meshes
const productMeshes = [];
let selectedProduct = null;

// Animated world groups (MUST be top-level so animate can access them)
let _stars = null;
let _clouds = [];
let _fireflies = [];
let _animals = [];

// Products
const products = [
  { id: "p1", name: "Oak Rune Token", desc: "Hand-finished oak token with carved symbol.", price: 18 },
  { id: "p2", name: "Walnut Mini Totem", desc: "Small walnut carving, matte oil finish.", price: 25 },
  { id: "p3", name: "Maple Desk Charm", desc: "Minimal charm piece for desk or shelf.", price: 12 },
  { id: "p4", name: "Ash Key Fob", desc: "Simple key fob, durable and light.", price: 9 },
  { id: "p5", name: "Custom Sigil Block", desc: "Commission block — your design, your vibe.", price: 45 },
];

/* -------------------- PROCEDURAL TEXTURES -------------------- */
function makeCanvasTexture(drawFn, size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  drawFn(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function texWood() {
  return makeCanvasTexture((ctx, s) => {
    ctx.fillStyle = "#2a1f14";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 140; i++) {
      const y = (i / 140) * s;
      const a = 0.06 + Math.random() * 0.07;
      ctx.fillStyle = `rgba(255, 210, 160, ${a})`;
      ctx.fillRect(0, y, s, 1 + Math.random() * 2);
    }
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = `rgba(0,0,0,0.15)`;
      ctx.lineWidth = 3 + Math.random() * 4;
      ctx.beginPath();
      const y = Math.random() * s;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(s * 0.3, y + Math.random() * 30, s * 0.7, y + Math.random() * 30, s, y);
      ctx.stroke();
    }
  });
}

function texDirt() {
  return makeCanvasTexture((ctx, s) => {
    ctx.fillStyle = "#1a1410";
    ctx.fillRect(0, 0, s, s);

    const img = ctx.getImageData(0, 0, s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() * 50) | 0;
      img.data[i] = 30 + n;
      img.data[i + 1] = 22 + ((n * 0.8) | 0);
      img.data[i + 2] = 18 + ((n * 0.6) | 0);
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);

    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.ellipse(
        Math.random() * s,
        Math.random() * s,
        80 + Math.random() * 140,
        50 + Math.random() * 120,
        Math.random(),
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  });
}

function texGrass() {
  return makeCanvasTexture((ctx, s) => {
    ctx.fillStyle = "#0b1511";
    ctx.fillRect(0, 0, s, s);

    for (let i = 0; i < 20000; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const g = 90 + ((Math.random() * 120) | 0);
      ctx.fillStyle = `rgba(40, ${g}, 70, 0.22)`;
      ctx.fillRect(x, y, 1, 1);
    }

    for (let i = 0; i < 1500; i++) {
      ctx.strokeStyle = "rgba(90,200,120,0.15)";
      ctx.lineWidth = 1;
      const x = Math.random() * s;
      const y = Math.random() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() * 8 - 4), y - (5 + Math.random() * 18));
      ctx.stroke();
    }
  });
}

function makeProductThumb(name) {
  const c = document.createElement("canvas");
  c.width = 800;
  c.height = 500;
  const ctx = c.getContext("2d");

  const g = ctx.createLinearGradient(0, 0, 800, 500);
  g.addColorStop(0, "#0b1020");
  g.addColorStop(1, "#141a2a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 800, 500);

  ctx.fillStyle = "rgba(122,162,255,0.25)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(220, 120, 360, 260, 22);
  else ctx.rect(220, 120, 360, 260);
  ctx.fill();

  ctx.strokeStyle = "rgba(155,255,207,0.25)";
  ctx.lineWidth = 4;
  ctx.strokeRect(50, 50, 700, 400);

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "700 44px Inter, system-ui, sans-serif";
  ctx.fillText(name, 70, 95);

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "500 22px Inter, system-ui, sans-serif";
  ctx.fillText("PyroShop • Handmade Woodcraft", 70, 135);

  return c.toDataURL("image/png");
}

const TEX = { wood: texWood(), dirt: texDirt(), grass: texGrass() };

/* -------------------- SIGN + NEON TEXTURES -------------------- */
function neonTextTexture(text, accent = "#7aa2ff") {
  return makeCanvasTexture((ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = "rgba(11,16,32,0.85)";
    ctx.fillRect(0, 0, s, s);

    ctx.strokeStyle = "rgba(122,162,255,0.45)";
    ctx.lineWidth = 14;
    ctx.strokeRect(18, 18, s - 36, s - 36);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 96px Inter, system-ui, sans-serif";

    ctx.fillStyle = accent;
    for (let i = 0; i < 6; i++) {
      ctx.globalAlpha = 0.12;
      ctx.fillText(text, s / 2, s / 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(text, s / 2, s / 2);
  }, 512);
}

function makeSignTexture(text) {
  return makeCanvasTexture((ctx, s) => {
    ctx.fillStyle = "rgba(11,16,32,1)";
    ctx.fillRect(0, 0, s, s);

    ctx.strokeStyle = "rgba(122,162,255,0.55)";
    ctx.lineWidth = 18;
    ctx.strokeRect(20, 20, s - 40, s - 40);

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "800 120px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, s / 2, s / 2);
  }, 512);
}

function addSign(text, zoneName, position) {
  const tex = makeSignTexture(text);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.65,
    metalness: 0.1,
    emissive: 0x0b1020,
    emissiveIntensity: 0.12,
  });

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.65), mat);
  sign.position.copy(position).add(new THREE.Vector3(0, 1.05, 0));
  sign.rotation.y = Math.PI;

  const postMat = new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 1.0 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.2, 10), postMat);
  post.position.copy(position).add(new THREE.Vector3(0, 0.6, 0));

  sign.userData = { type: "sign", zone: zoneName, label: text };

  scene.add(sign);
  scene.add(post);
  interactables.push(sign);
}

/* -------------------- WORLD FX: STARS/CLOUDS/FIREFLIES/ANIMALS -------------------- */
function addStars() {
  const count = 1400;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 90 + Math.random() * 120;
    const a = Math.random() * Math.PI * 2;
    const y = 18 + Math.random() * 55;
    pos[i * 3 + 0] = Math.cos(a) * r + (Math.random() * 10 - 5);
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = Math.sin(a) * r + (Math.random() * 10 - 5);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.85 });
  _stars = new THREE.Points(geo, mat);
  scene.add(_stars);
}

function cloudTexture() {
  return makeCanvasTexture((ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = "rgba(0,0,0,0)";
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * s,
        y = Math.random() * s;
      const r = 40 + Math.random() * 110;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.16)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 512);
}

function addClouds() {
  const tex = cloudTexture();
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    roughness: 1.0,
    metalness: 0,
  });
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(22, 12), mat.clone());
    m.position.set(-40 + Math.random() * 80, 16 + Math.random() * 10, -40 + Math.random() * 80);
    m.rotation.y = Math.random() * Math.PI * 2;
    m.userData = { vx: 0.2 + Math.random() * 0.25 };
    _clouds.push(m);
    scene.add(m);
  }
}

function addFireflies() {
  const geo = new THREE.BufferGeometry();
  const count = 140;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3 + 0] = Math.random() * 18 - 9;
    pos[i * 3 + 1] = 0.6 + Math.random() * 2.2;
    pos[i * 3 + 2] = Math.random() * 18 - 9;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0x9bffcf, size: 0.1, transparent: true, opacity: 0.85 });
  const pts = new THREE.Points(geo, mat);
  _fireflies.push(pts);
  scene.add(pts);
}

function addAnimals() {
  const mat1 = new THREE.MeshStandardMaterial({ color: 0x2a1f14, roughness: 1.0 });
  const mat2 = new THREE.MeshStandardMaterial({ color: 0x101625, roughness: 1.0 });

  for (let i = 0; i < 6; i++) {
    const a = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), i % 2 ? mat1 : mat2);
    a.position.set(Math.random() * 22 - 11, 0.18, Math.random() * 22 - 11);
    a.userData = {
      t: Math.random() * 10,
      speed: 0.25 + Math.random() * 0.25,
      radius: 3.5 + Math.random() * 7.5,
      center: new THREE.Vector3(Math.random() * 10 - 5, 0, Math.random() * 10 - 5),
    };
    _animals.push(a);
    scene.add(a);
  }
}

/* -------------------- PATHS + TORCHES -------------------- */
function addTorch(pos) {
  const poleMat = new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 1.0 });
  poleMat.map.repeat.set(1, 2);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.6, 10), poleMat);
  pole.position.set(pos.x, 0.8, pos.z);
  scene.add(pole);

  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xffaa55,
    emissive: 0xff6a11,
    emissiveIntensity: 0.95,
    roughness: 0.65,
  });

  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 10), flameMat);
  flame.position.set(pos.x, 1.65, pos.z);
  flame.userData = { torch: true };
  scene.add(flame);

  const light = new THREE.PointLight(0xff8844, 1.15, 8);
  light.position.set(pos.x, 1.7, pos.z);
  scene.add(light);

  flame.userData.light = light;
}

function addDirtPathsAndTorches() {
  const dirtMat = new THREE.MeshStandardMaterial({ map: TEX.dirt, roughness: 1.0, metalness: 0.0 });
  dirtMat.map.repeat.set(4, 4);

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
      const side = i % 2 === 0 ? 1 : -1;
      addTorch(new THREE.Vector3(x, 0, z + side * (width * 0.6)));
    }
  }

  addPath(new THREE.Vector3(0, 0, 2.8), new THREE.Vector3(-10, 0, 0), 2.2);
  addPath(new THREE.Vector3(0, 0, 2.8), new THREE.Vector3(10, 0, 0), 2.2);
  addPath(new THREE.Vector3(0, 0, 0.2), new THREE.Vector3(0, 0, -14), 2.5);
}

/* -------------------- HOME: CAMPFIRE + BENCHES -------------------- */
function createCampfire() {
  const g = new THREE.Group();

  const logMat = new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 1.0 });
  logMat.map.repeat.set(2, 1);

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
    roughness: 0.6,
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

function addLogBenches() {
  const benchMat = new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 1.0 });
  benchMat.map.repeat.set(2, 1);

  const benchGeo = new THREE.CylinderGeometry(0.17, 0.17, 2.4, 14);
  const benchY = 0.22;

  const benches = [
    { x: -1.9, z: 1.4, rot: 0.4 },
    { x: 2.1, z: 1.3, rot: -0.5 },
    { x: -2.0, z: -1.6, rot: -2.6 },
    { x: 2.0, z: -1.7, rot: 2.7 },
  ];

  benches.forEach((b) => {
    const bench = new THREE.Mesh(benchGeo, benchMat);
    bench.rotation.z = Math.PI / 2;
    bench.rotation.y = b.rot;
    bench.position.set(b.x, benchY, b.z);
    scene.add(bench);
  });
}

/* -------------------- CHECKOUT KIOSK -------------------- */
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

  const tex = neonTextTexture("CHECKOUT", "#ffb86b");
  const signMat = new THREE.MeshStandardMaterial({
    map: tex,
    emissive: 0xffb86b,
    emissiveIntensity: 0.65,
    transparent: true,
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), signMat);
  sign.position.set(0, 1.55, 0.55);
  g.add(sign);

  g.userData = { type: "checkout" };
  return g;
}

/* -------------------- SHOP: CABIN -------------------- */
function createCabin() {
  const g = new THREE.Group();

  const wood = new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 0.95 });
  wood.map.repeat.set(2, 1);

  const roof = new THREE.MeshStandardMaterial({ color: 0x151a2a, roughness: 0.95 });

  const wallThickness = 0.35;
  const W = 6.0,
    H = 3.2,
    D = 4.6;

  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, wallThickness), wood);
  back.position.set(0, H / 2, -D / 2);
  g.add(back);

  const left = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, H, D), wood);
  left.position.set(-W / 2, H / 2, 0);
  g.add(left);

  const right = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, H, D), wood);
  right.position.set(W / 2, H / 2, 0);
  g.add(right);

  const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.6, 4), roof);
  roofMesh.rotation.y = Math.PI / 4;
  roofMesh.position.set(0, H + 1.0, 0);
  g.add(roofMesh);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.3, D - 0.3),
    new THREE.MeshStandardMaterial({ color: 0x0b0f1a, roughness: 1.0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.02, 0);
  g.add(floor);

  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x141a2a, roughness: 0.85 });

  // back shelves
  for (let r = 0; r < 3; r++) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.18, 0.75), shelfMat);
    shelf.position.set(0, 1.0 + r * 0.85, -1.7);
    g.add(shelf);
  }
  // left shelves
  for (let r = 0; r < 3; r++) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 0.75), shelfMat);
    shelf.rotation.y = Math.PI / 2;
    shelf.position.set(-2.2, 1.0 + r * 0.85, 0);
    g.add(shelf);
  }
  // right shelves
  for (let r = 0; r < 3; r++) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 0.75), shelfMat);
    shelf.rotation.y = -Math.PI / 2;
    shelf.position.set(2.2, 1.0 + r * 0.85, 0);
    g.add(shelf);
  }

  function neonSign(text, accent, pos, rotY) {
    const tex = neonTextTexture(text, accent);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: new THREE.Color(accent),
      emissiveIntensity: 0.55,
      roughness: 0.4,
      transparent: true,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.9), mat);
    plane.position.copy(pos);
    plane.rotation.y = rotY;
    g.add(plane);
  }

  neonSign("WOODWORK", "#7aa2ff", new THREE.Vector3(0, 2.85, -2.05), 0);
  neonSign("BITS & BOBS", "#9bffcf", new THREE.Vector3(-2.05, 2.85, 0), Math.PI / 2);
  neonSign("BONECRAFT", "#ffb86b", new THREE.Vector3(2.05, 2.85, 0), -Math.PI / 2);

  const shopTex = neonTextTexture("SHOP", "#7aa2ff");
  const shopMat = new THREE.MeshStandardMaterial({
    map: shopTex,
    emissive: 0x7aa2ff,
    emissiveIntensity: 0.65,
    transparent: true,
  });
  const shopLabel = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.85), shopMat);
  shopLabel.position.set(0, 3.9, 2.25);
  shopLabel.rotation.y = Math.PI;
  g.add(shopLabel);

  g.userData = { type: "building", zone: "shop" };
  return g;
}

/* -------------------- BLOG: LIBRARY -------------------- */
function stoneTexture() {
  return makeCanvasTexture((ctx, s) => {
    ctx.fillStyle = "#111726";
    ctx.fillRect(0, 0, s, s);
    const img = ctx.getImageData(0, 0, s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() * 70) | 0;
      img.data[i] = 18 + n;
      img.data[i + 1] = 22 + n;
      img.data[i + 2] = 35 + n;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 16; i++) {
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 3 + Math.random() * 4;
      ctx.beginPath();
      ctx.moveTo(Math.random() * s, Math.random() * s);
      ctx.lineTo(Math.random() * s, Math.random() * s);
      ctx.stroke();
    }
  }, 512);
}

function createOakTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.55, 4.0, 10),
    new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 1.0 })
  );
  trunk.position.y = 2.0;
  g.add(trunk);

  const leaves = new THREE.Mesh(
    new THREE.SphereGeometry(1.9, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0x0f3a22, roughness: 1.0 })
  );
  leaves.position.y = 4.6;
  g.add(leaves);
  return g;
}

function createLibrary() {
  const g = new THREE.Group();

  const t1 = createOakTree();
  t1.position.set(-3.9, 0, 1.2);
  const t2 = createOakTree();
  t2.position.set(3.9, 0, 1.2);
  g.add(t1);
  g.add(t2);

  const stoneTex = stoneTexture();
  const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 1.0 });
  stoneMat.map.repeat.set(2, 2);

  const wall = new THREE.Mesh(new THREE.BoxGeometry(7.0, 4.3, 1.2), stoneMat);
  wall.position.set(0, 2.15, 0);
  g.add(wall);

  const shelfMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 1.0 });
  for (let r = 0; r < 4; r++) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 0.9), shelfMat);
    shelf.position.set(0, 0.95 + r * 0.9, 0.25);
    g.add(shelf);
  }

  const libTex = neonTextTexture("LIBRARY", "#9bffcf");
  const libMat = new THREE.MeshStandardMaterial({
    map: libTex,
    emissive: 0x9bffcf,
    emissiveIntensity: 0.65,
    transparent: true,
  });
  const libLabel = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), libMat);
  libLabel.position.set(0, 4.15, 0.75);
  g.add(libLabel);

  const bookMat = new THREE.MeshStandardMaterial({
    color: 0x7aa2ff,
    roughness: 0.7,
    metalness: 0.05,
    emissive: 0x0b1020,
  });

  const bookData = [
    {
      title: "Wood Joinery Notes",
      date: "2019-06-12",
      pages: ["Page 1: Mortise & tenon basics...\n\n(placeholder text)", "Page 2: Tools list...\n\n(placeholder text)"],
    },
    { title: "Ilam Field Sketches", date: "2021-09-03", pages: ["Page 1: Landscape observations...\n\n(placeholder text)"] },
    {
      title: "Bonecraft Reference",
      date: "2018-02-22",
      pages: ["Page 1: Ethical sourcing...\n\n(placeholder text)", "Page 2: Techniques...\n\n(placeholder text)"],
    },
  ];

  let bi = 0;
  for (let r = 0; r < 4; r++) {
    for (let i = 0; i < 10; i++) {
      const bd = bookData[bi % bookData.length];
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.58 + (i % 3) * 0.06, 0.18), bookMat.clone());
      book.position.set(-2.85 + i * 0.63, 1.12 + r * 0.9, 0.62);
      book.userData = { type: "book", title: bd.title, date: bd.date, pages: bd.pages };
      g.add(book);
      bi++;
    }
  }

  g.userData = { type: "building", zone: "blog" };
  return g;
}

/* -------------------- ABOUT: PLINTH -------------------- */
function createAboutPlinth() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x101625, roughness: 1.0 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.45, 0.55, 24), mat);
  base.position.set(0, 0.275, 0);
  g.add(base);

  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 1.02, 2.5, 18), mat);
  pillar.position.set(0, 1.8, 0);
  g.add(pillar);

  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(2.25, 1.05),
    new THREE.MeshStandardMaterial({ color: 0x0b1020, emissive: 0x9bffcf, emissiveIntensity: 0.28 })
  );
  plaque.position.set(0, 1.8, 1.08);
  g.add(plaque);

  g.userData = { type: "building", zone: "about" };
  return g;
}

/* -------------------- PRODUCTS -------------------- */
function addShopProducts() {
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x141a2a, roughness: 0.85 });
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.22, 1.25), shelfMat);
  shelf.position.set(-10, 1.05, 2.85);
  scene.add(shelf);

  const baseMat = new THREE.MeshStandardMaterial({
    map: TEX.wood,
    roughness: 0.9,
    metalness: 0.05,
    emissive: 0x0b1020,
  });

  products.forEach((p, idx) => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.72), baseMat.clone());
    box.position.set(-12.8 + idx * 1.25, 1.58, 2.85);
    box.userData = { type: "product", ...p };
    scene.add(box);

    productMeshes.push(box);
    interactables.push(box);
  });
}

/* -------------------- WOODLAND BACKDROP -------------------- */
function addWoodlandRing() {
  const trunkMat = new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 1.0 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x0f3a22, roughness: 1.0 });

  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.22, 2.0, 10);
  const leafGeo = new THREE.ConeGeometry(0.85, 2.4, 10);

  for (let i = 0; i < 110; i++) {
    const a = (i / 110) * Math.PI * 2;
    const r = 40 + Math.random() * 22;
    const x = Math.cos(a) * r + (Math.random() * 4 - 2);
    const z = Math.sin(a) * r + (Math.random() * 4 - 2);

    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 1.0, z);

    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.set(x, 2.7, z);
    leaves.rotation.y = Math.random() * Math.PI;

    const g = new THREE.Group();
    g.add(trunk);
    g.add(leaves);

    const s = 0.85 + Math.random() * 1.25;
    g.scale.setScalar(s);

    scene.add(g);
  }

  const tuftMat = new THREE.MeshStandardMaterial({ color: 0x1a6b3a, roughness: 1.0 });
  const tuftGeo = new THREE.ConeGeometry(0.12, 0.45, 6);
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * 28 - 14;
    const z = Math.random() * 28 - 14;
    if (Math.abs(x) < 3 && Math.abs(z) < 3) continue;

    const tuft = new THREE.Mesh(tuftGeo, tuftMat);
    tuft.position.set(x, 0.22, z);
    tuft.rotation.y = Math.random() * Math.PI;
    tuft.scale.setScalar(0.6 + Math.random() * 1.0);
    scene.add(tuft);
  }
}

/* -------------------- INPUT -------------------- */
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

  if (data.type === "sign") {
    moveCameraTo(data.zone);
    return;
  }

  if (data.type === "building") {
    moveCameraTo(data.zone);
    return;
  }

  if (data.type === "book") {
    openBookViewer(data);
    return;
  }

  if (data.type === "checkout") {
    if (basketPanel) basketPanel.hidden = false;
    renderBasket();
    return;
  }

  if (data.type === "product") {
    productMeshes.forEach((m) => m.material.emissive.setHex(0x0b1020));
    obj.material.emissive.setHex(0x203060);

    if (titleEl) titleEl.textContent = data.name;
    if (descEl) descEl.textContent = data.desc;
    if (priceEl) priceEl.textContent = money(data.price);

    if (imgEl) imgEl.src = makeProductThumb(data.name);

    selectedProduct = { id: data.id, name: data.name, desc: data.desc, price: data.price };
    if (panel) panel.hidden = false;
  }
}

function onPointerMove(ev) {
  if (!hoverTip || !renderer || !camera || !raycaster || !mouse) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(interactables, false);

  if (!hits.length) {
    hoverTip.hidden = true;
    return;
  }

  const data = hits[0].object.userData || {};
  if (data.type !== "book") {
    hoverTip.hidden = true;
    return;
  }

  hoverTip.hidden = false;
  hoverTip.textContent = `${data.title} (${data.date})`;
  hoverTip.style.left = ev.clientX + 12 + "px";
  hoverTip.style.top = ev.clientY + 12 + "px";
}

/* -------------------- RESIZE -------------------- */
function onResize() {
  if (!renderer || !camera) return;
  const w = sceneHost.clientWidth;
  const h = sceneHost.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

/* -------------------- MAIN INIT -------------------- */
init3D();

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
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  const moonLight = new THREE.DirectionalLight(0x93b7ff, 0.9);
  moonLight.position.set(14, 20, 10);
  scene.add(moonLight);

  const rim = new THREE.DirectionalLight(0x9bffcf, 0.35);
  rim.position.set(-16, 12, -8);
  scene.add(rim);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 24, 18),
    new THREE.MeshStandardMaterial({
      color: 0xe6f0ff,
      emissive: 0xa8c6ff,
      emissiveIntensity: 0.55,
      roughness: 0.9,
    })
  );
  moon.position.set(18, 16, -26);
  scene.add(moon);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ map: TEX.grass, roughness: 1.0, metalness: 0.0 })
  );
  ground.material.map.repeat.set(6, 6);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);

  // FX that require scene
  _clouds = [];
  _fireflies = [];
  _animals = [];
  addStars();
  addClouds();
  addFireflies();
  addAnimals();

  // Paths + torches
  addDirtPathsAndTorches();

  // Home
  const campfire = createCampfire();
  campfire.position.set(0, 0, 0);
  scene.add(campfire);
  addLogBenches();

  // Checkout (right of fire)
  const checkout = createCheckoutKiosk();
  checkout.position.set(2.6, 0, 0.2);
  scene.add(checkout);
  checkout.traverse((o) => {
    if (o.isMesh) {
      o.userData = o.userData || {};
      o.userData.type = "checkout";
      interactables.push(o);
    }
  });

  // Shop cabin
  const cabin = createCabin();
  cabin.position.set(-10, 0, 0);
  scene.add(cabin);
  cabin.traverse((o) => {
    if (o.isMesh) interactables.push(o);
  });

  // Blog library
  const library = createLibrary();
  library.position.set(10, 0, 0);
  scene.add(library);
  library.traverse((o) => {
    if (o.isMesh) interactables.push(o);
  });

  // About
  const about = createAboutPlinth();
  about.position.set(0, 0, -14);
  scene.add(about);
  about.traverse((o) => {
    if (o.isMesh) interactables.push(o);
  });

  // Signs
  addSign("SHOP", "shop", new THREE.Vector3(-5.8, 0, 3.6));
  addSign("BLOG", "blog", new THREE.Vector3(5.8, 0, 3.6));
  addSign("ABOUT", "about", new THREE.Vector3(0, 0, -6.4));
  addSign("HOME", "home", new THREE.Vector3(0, 0, 6.2));

  // Products
  addShopProducts();

  // Woodland
  addWoodlandRing();

  // Input
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);

  window.addEventListener("resize", onResize);
  onResize();

  // UI
  if (zoneLabel) zoneLabel.textContent = "Home";

  animate();
}

/* -------------------- ADD TO BASKET -------------------- */
if (addBtn) {
  addBtn.onclick = () => {
    if (!selectedProduct) return;
    const existing = basket.find((item) => item.id === selectedProduct.id);
    if (existing) existing.qty++;
    else basket.push({ ...selectedProduct, qty: 1 });
    saveBasket();
    if (basketPanel) basketPanel.hidden = false;
    renderBasket();
  };
}

/* -------------------- ANIMATE -------------------- */
const _tmpLook = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  if (!renderer || !scene || !camera) return;

  const t = performance.now() * 0.001;

  // Clouds drift
  _clouds.forEach((c) => {
    c.position.x += c.userData.vx * 0.01;
    if (c.position.x > 60) c.position.x = -60;
  });

  // Fireflies wiggle
  _fireflies.forEach((pts) => {
    const a = pts.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const ix = i * 3;
      a.array[ix + 1] += Math.sin(t * 2 + i) * 0.0015;
      a.array[ix + 0] += Math.cos(t * 1.5 + i) * 0.0010;
    }
    a.needsUpdate = true;
  });

  // Animals wander
  _animals.forEach((an, i) => {
    const ud = an.userData;
    ud.t += 0.008 * ud.speed;
    an.position.x = ud.center.x + Math.cos(ud.t + i) * ud.radius;
    an.position.z = ud.center.z + Math.sin(ud.t + i) * ud.radius;
    an.rotation.y = -(ud.t + i);
  });

  // Smooth camera tween
  if (camTween) {
    const now = performance.now();
    const u = Math.min(1, (now - camTween.t0) / camTween.dur);
    const e = easeInOutCubic(u);

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

  // Product idle
  productMeshes.forEach((m, i) => {
    m.rotation.y = t * 0.6 + i * 0.25;
    m.position.y = 1.58 + Math.sin(t * 1.6 + i) * 0.03;
  });

  renderer.render(scene, camera);
}
