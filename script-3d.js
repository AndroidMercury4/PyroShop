import * as THREE from "https://esm.sh/three@0.160.0";

/* ============================================================
   PYROSHOP WORLD (fixed)
   - Click BOX around each place at Home to travel (smooth tween)
   - Only interact with area items when you are IN that area
   - Cabin/library travel now works
   - Book modal is properly hidden until book click
   - Campfire flame + flicker
   - Removes old early “sign” meshes completely
   - Checkout (home-right of fire): click to open basket
============================================================ */

/* -------------------- DOM -------------------- */
const zoneLabel = document.getElementById("zoneLabel");
const hoverTip = document.getElementById("hoverTip");

const btnHome = document.getElementById("btnHome");
const btnBack = document.getElementById("btnBack");
const btnBasket = document.getElementById("btnBasket");

const panel = document.getElementById("productPanel");
const titleEl = document.getElementById("productTitle");
const descEl = document.getElementById("productDesc");
const priceEl = document.getElementById("productPrice");
const imgEl = document.getElementById("productImg");
const closePanelBtn = document.getElementById("closePanel");
const addBtn = document.getElementById("addToBasket");

const basketPanel = document.getElementById("basketPanel");
const basketItems = document.getElementById("basketItems");
const basketTotal = document.getElementById("basketTotal");
const closeBasketBtn = document.getElementById("closeBasket");

const bookModal = document.getElementById("bookModal");
const bookClose = document.getElementById("bookClose");
const bookTitle = document.getElementById("bookTitle");
const bookMeta = document.getElementById("bookMeta");
const bookPageText = document.getElementById("bookPageText");
const bookPrev = document.getElementById("bookPrev");
const bookNext = document.getElementById("bookNext");

/* -------------------- BASKET -------------------- */
const basket = JSON.parse(localStorage.getItem("basket") || "[]");

function saveBasket() {
  localStorage.setItem("basket", JSON.stringify(basket));
}
function money(n) {
  return `£${Number(n || 0).toFixed(2)}`;
}
function renderBasket() {
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

/* -------------------- BOOK VIEWER -------------------- */
let openBook = null;
let openBookPage = 0;

function openBookViewer(data) {
  openBook = data;
  openBookPage = 0;

  bookTitle.textContent = data.title;
  bookMeta.textContent = data.date;
  bookPageText.textContent = data.pages?.[0] || "";

  bookModal.hidden = false;
}
function closeBookViewer() {
  bookModal.hidden = true;
  openBook = null;
}
bookClose.onclick = closeBookViewer;

bookPrev.onclick = () => {
  if (!openBook) return;
  openBookPage = Math.max(0, openBookPage - 1);
  bookPageText.textContent = openBook.pages?.[openBookPage] || "";
};
bookNext.onclick = () => {
  if (!openBook) return;
  const max = (openBook.pages?.length || 1) - 1;
  openBookPage = Math.min(max, openBookPage + 1);
  bookPageText.textContent = openBook.pages?.[openBookPage] || "";
};

/* -------------------- PRODUCT PANEL -------------------- */
let selectedProduct = null;

function makeProductThumb(name) {
  // copyright-safe generated thumbnail
  const c = document.createElement("canvas");
  c.width = 900;
  c.height = 520;
  const ctx = c.getContext("2d");

  const g = ctx.createLinearGradient(0, 0, 900, 520);
  g.addColorStop(0, "#0b1020");
  g.addColorStop(1, "#141a2a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 900, 520);

  ctx.strokeStyle = "rgba(155,255,207,0.20)";
  ctx.lineWidth = 5;
  ctx.strokeRect(40, 40, 820, 440);

  ctx.fillStyle = "rgba(122,162,255,0.22)";
  ctx.beginPath();
  ctx.roundRect(250, 150, 400, 260, 28);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "800 46px Inter, system-ui, sans-serif";
  ctx.fillText(name, 70, 110);

  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = "600 22px Inter, system-ui, sans-serif";
  ctx.fillText("PyroShop • Generated placeholder image", 70, 150);

  return c.toDataURL("image/png");
}

closePanelBtn.onclick = () => (panel.hidden = true);

addBtn.onclick = () => {
  if (!selectedProduct) return;

  const existing = basket.find((item) => item.id === selectedProduct.id);
  if (existing) existing.qty++;
  else basket.push({ ...selectedProduct, qty: 1 });

  saveBasket();
  basketPanel.hidden = false;
  renderBasket();
};

/* Basket buttons */
btnBasket.onclick = () => {
  basketPanel.hidden = false;
  renderBasket();
};
closeBasketBtn.onclick = () => (basketPanel.hidden = true);

/* -------------------- 3D SETUP -------------------- */
const sceneHost = document.getElementById("scene");
let renderer, scene, camera, raycaster, mouse;

scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x07090f, 12, 90);

camera = new THREE.PerspectiveCamera(60, 1, 0.1, 260);

renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
sceneHost.innerHTML = "";
sceneHost.appendChild(renderer.domElement);

raycaster = new THREE.Raycaster();
mouse = new THREE.Vector2();

/* -------------------- WORLD STATE -------------------- */
let currentZone = "home"; // home | shop | blog | about
let isMoving = false;

const CAM_TRAVEL_MS = 2200; // slower + smoother
let camTween = null;

const CAMERA_POINTS = {
  home: { label: "Home", pos: new THREE.Vector3(0, 1.85, 10.8), look: new THREE.Vector3(0, 1.25, 0) },
  shop: { label: "Shop", pos: new THREE.Vector3(-13.4, 1.85, 8.8), look: new THREE.Vector3(-10, 1.25, 0) },
  blog: { label: "Library", pos: new THREE.Vector3(13.4, 1.85, 8.8), look: new THREE.Vector3(10, 1.25, 0) },
  about: { label: "About", pos: new THREE.Vector3(0, 1.85, -10.5), look: new THREE.Vector3(0, 1.25, -14) },
};

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
function getCurrentLookPoint() {
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  return camera.position.clone().add(fwd.multiplyScalar(10));
}

function setZoneUI(zone) {
  currentZone = zone;
  zoneLabel.textContent = CAMERA_POINTS[zone].label;
  btnBack.hidden = (zone === "home");
}

function moveCameraTo(zoneName) {
  if (!CAMERA_POINTS[zoneName]) return;
  if (isMoving) return;

  // hide overlays when travelling
  panel.hidden = true;
  basketPanel.hidden = true;
  bookModal.hidden = true;
  if (hoverTip) hoverTip.hidden = true;

  isMoving = true;
  setZoneUI(zoneName);

  camTween = {
    t0: performance.now(),
    dur: CAM_TRAVEL_MS,
    fromPos: camera.position.clone(),
    toPos: CAMERA_POINTS[zoneName].pos.clone(),
    fromLook: getCurrentLookPoint(),
    toLook: CAMERA_POINTS[zoneName].look.clone(),
  };
}

btnHome.onclick = () => moveCameraTo("home");
btnBack.onclick = () => moveCameraTo("home");

/* -------------------- MATERIAL HELPERS -------------------- */
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

const TEX = {
  grass: makeCanvasTexture((ctx, s) => {
    ctx.fillStyle = "#08120e";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 18000; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const g = 90 + (Math.random() * 120) | 0;
      ctx.fillStyle = `rgba(40, ${g}, 70, 0.20)`;
      ctx.fillRect(x, y, 1, 1);
    }
  }),
  wood: makeCanvasTexture((ctx, s) => {
    ctx.fillStyle = "#2a1f14";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 120; i++) {
      const y = (i / 120) * s;
      ctx.fillStyle = `rgba(255,210,160,${0.04 + Math.random() * 0.06})`;
      ctx.fillRect(0, y, s, 1 + Math.random() * 2);
    }
  }),
  dirt: makeCanvasTexture((ctx, s) => {
    ctx.fillStyle = "#17110d";
    ctx.fillRect(0, 0, s, s);
    const img = ctx.getImageData(0, 0, s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() * 45) | 0;
      img.data[i] = 28 + n;
      img.data[i + 1] = 20 + (n * 0.8) | 0;
      img.data[i + 2] = 16 + (n * 0.6) | 0;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }),
};

function labelTexture(text, accent = "rgba(122,162,255,0.7)") {
  return makeCanvasTexture((ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = "rgba(11,16,32,0.88)";
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 16;
    ctx.strokeRect(18, 18, s - 36, s - 36);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 96px Inter, system-ui, sans-serif";

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(text, s / 2, s / 2);
  }, 512);
}

/* -------------------- WORLD CONTENT -------------------- */
const zoneTriggers = [];       // clickable boxes at HOME
const shopInteractables = [];  // products etc
const blogInteractables = [];  // books etc
const homeInteractables = [];  // checkout box, etc

const productMeshes = [];
const torchFlames = [];
let campfireData = null;

/* Lighting */
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const moonLight = new THREE.DirectionalLight(0x93b7ff, 0.9);
moonLight.position.set(14, 20, 10);
scene.add(moonLight);

const rim = new THREE.DirectionalLight(0x9bffcf, 0.28);
rim.position.set(-16, 12, -8);
scene.add(rim);

// Moon
const moon = new THREE.Mesh(
  new THREE.SphereGeometry(1.6, 24, 18),
  new THREE.MeshStandardMaterial({ color: 0xe6f0ff, emissive: 0xa8c6ff, emissiveIntensity: 0.55, roughness: 0.9 })
);
moon.position.set(18, 16, -26);
scene.add(moon);

/* Ground */
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300),
  new THREE.MeshStandardMaterial({ map: TEX.grass, roughness: 1.0, metalness: 0.0 })
);
ground.material.map.repeat.set(6, 6);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

/* Dirt paths + torches */
addDirtPathsAndTorches();

/* Home: campfire + benches + checkout */
const campfire = createCampfire();
campfire.position.set(0, 0, 0);
scene.add(campfire);
campfireData = campfire.userData.fire;

addLogBenches();

const checkout = createCheckoutKiosk();
checkout.position.set(2.8, 0, 0.2);
scene.add(checkout);
homeInteractables.push(checkout);

/* Shop: open cabin + products */
const cabin = createOpenCabin();
cabin.position.set(-10, 0, 0);
scene.add(cabin);

addShopProducts();

/* Library: shelves + books */
const library = createLibrary();
library.position.set(10, 0, 0);
scene.add(library);

/* About plinth */
const about = createAboutPlinth();
about.position.set(0, 0, -14);
scene.add(about);

/* Woodland ring */
addWoodlandRing();

/* HOME clickable “boxes” around each location */
addZoneTriggerBox("Shop", "shop", new THREE.Vector3(-10, 1.2, 0), new THREE.Vector3(7, 3.5, 7));
addZoneTriggerBox("Library", "blog", new THREE.Vector3(10, 1.2, 0), new THREE.Vector3(7, 3.5, 7));
addZoneTriggerBox("About", "about", new THREE.Vector3(0, 1.2, -14), new THREE.Vector3(7, 3.5, 7));
addZoneTriggerBox("Checkout", "checkout", new THREE.Vector3(2.8, 0.8, 0.2), new THREE.Vector3(3.2, 2.2, 3.2));

/* -------------------- ZONE TRIGGERS -------------------- */
function addZoneTriggerBox(label, zone, center, size) {
  const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0b1020,
    transparent: true,
    opacity: 0.0,   // invisible but raycastable
    depthWrite: false,
  });
  const box = new THREE.Mesh(geo, mat);
  box.position.copy(center);
  box.userData = { type: "zone", zone };

  // floating label (visible)
  const tex = labelTexture(label, "rgba(122,162,255,0.55)");
  const lbl = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.9),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, emissive: 0x7aa2ff, emissiveIntensity: 0.25 })
  );
  lbl.position.copy(center).add(new THREE.Vector3(0, 2.2, 2.8));
  lbl.rotation.y = Math.PI;
  scene.add(lbl);

  scene.add(box);
  zoneTriggers.push(box);
}

/* -------------------- BUILD PIECES -------------------- */
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
      const side = (i % 2 === 0) ? 1 : -1;
      addTorch(new THREE.Vector3(x, 0, z + side * (width * 0.6)));
    }
  }

  addPath(new THREE.Vector3(0, 0, 2.8), new THREE.Vector3(-10, 0, 0), 2.2);
  addPath(new THREE.Vector3(0, 0, 2.8), new THREE.Vector3(10, 0, 0), 2.2);
  addPath(new THREE.Vector3(0, 0, 0.2), new THREE.Vector3(0, 0, -14), 2.5);
}

function addTorch(pos) {
  const poleMat = new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 1.0 });
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
  scene.add(flame);

  const light = new THREE.PointLight(0xff8844, 1.15, 8);
  light.position.set(pos.x, 1.7, pos.z);
  scene.add(light);

  torchFlames.push({ flame, light, seed: pos.x * 0.7 + pos.z * 0.2 });
}

function createCampfire() {
  const g = new THREE.Group();

  const logMat = new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 1.0 });
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
    emissiveIntensity: 1.3,
    roughness: 0.6,
  });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.75, 10), flameMat);
  flame.position.set(0, 0.65, 0);
  g.add(flame);

  const fireLight = new THREE.PointLight(0xff8844, 2.4, 15);
  fireLight.position.set(0, 1.05, 0);
  g.add(fireLight);

  g.userData.fire = { flame, fireLight };
  return g;
}

function addLogBenches() {
  const benchMat = new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 1.0 });
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

  const tex = labelTexture("CHECKOUT", "rgba(255,184,107,0.55)");
  const signMat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffb86b, emissiveIntensity: 0.35, transparent: true });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), signMat);
  sign.position.set(0, 1.55, 0.55);
  g.add(sign);

  g.userData = { type: "checkout" };
  return g;
}

function createOpenCabin() {
  const g = new THREE.Group();

  const wood = new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 0.95 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x151a2a, roughness: 0.95 });

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

  // label
  const shopTex = labelTexture("SHOP", "rgba(122,162,255,0.55)");
  const shopMat = new THREE.MeshStandardMaterial({ map: shopTex, emissive: 0x7aa2ff, emissiveIntensity: 0.25, transparent: true });
  const shopLabel = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.85), shopMat);
  shopLabel.position.set(0, 3.9, 2.25);
  shopLabel.rotation.y = Math.PI;
  g.add(shopLabel);

  return g;
}

function createLibrary() {
  const g = new THREE.Group();

  const wall = new THREE.MeshStandardMaterial({ color: 0x0f1424, roughness: 0.96 });
  const shelf = new THREE.MeshStandardMaterial({ color: 0x151a2a, roughness: 0.86 });

  const back = new THREE.Mesh(new THREE.BoxGeometry(6.3, 4.2, 1.05), wall);
  back.position.set(0, 2.1, 0);
  g.add(back);

  for (let r = 0; r < 4; r++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(5.9, 0.12, 0.82), shelf);
    plank.position.set(0, 0.85 + r * 0.9, 0.12);
    g.add(plank);
  }

  // label
  const libTex = labelTexture("LIBRARY", "rgba(155,255,207,0.55)");
  const libMat = new THREE.MeshStandardMaterial({ map: libTex, emissive: 0x9bffcf, emissiveIntensity: 0.25, transparent: true });
  const libLabel = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), libMat);
  libLabel.position.set(0, 4.1, 0.75);
  g.add(libLabel);

  // books (interactive, but only in blog zone)
  const bookMat = new THREE.MeshStandardMaterial({ color: 0x7aa2ff, roughness: 0.7, metalness: 0.05, emissive: 0x0b1020 });

  const bookData = [
    { title: "Wood Joinery Notes", date: "2019-06-12", pages: ["Page 1: Mortise & tenon basics...", "Page 2: Tools list...", "Page 3: Common mistakes..."] },
    { title: "Ilam Field Sketches", date: "2021-09-03", pages: ["Page 1: Landscape observations...", "Page 2: Material weathering notes..."] },
    { title: "Bonecraft Reference", date: "2018-02-22", pages: ["Page 1: Ethical sourcing...", "Page 2: Small carving...", "Page 3: Finishes..."] },
  ];

  let bi = 0;
  for (let r = 0; r < 4; r++) {
    for (let i = 0; i < 10; i++) {
      const bd = bookData[bi % bookData.length];
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.58 + (i % 3) * 0.06, 0.18), bookMat.clone());
      book.position.set(-2.55 + i * 0.57, 1.08 + r * 0.9, 0.38);

      book.userData = { type: "book", title: bd.title, date: bd.date, pages: bd.pages };
      g.add(book);
      blogInteractables.push(book);

      bi++;
    }
  }

  return g;
}

function createAboutPlinth() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x101625, roughness: 1.0 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.45, 0.55, 24), mat);
  base.position.set(0, 0.275, 0);
  g.add(base);

  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 1.02, 2.5, 18), mat);
  pillar.position.set(0, 1.8, 0);
  g.add(pillar);

  const plaqueTex = labelTexture("ABOUT", "rgba(155,255,207,0.45)");
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(2.25, 1.05),
    new THREE.MeshStandardMaterial({ map: plaqueTex, emissive: 0x9bffcf, emissiveIntensity: 0.2, transparent: true })
  );
  plaque.position.set(0, 1.8, 1.08);
  g.add(plaque);

  return g;
}

function addShopProducts() {
  const products = [
    { id: "p1", name: "Oak Rune Token", desc: "Hand-finished oak token with carved symbol.", price: 18 },
    { id: "p2", name: "Walnut Mini Totem", desc: "Small walnut carving, matte oil finish.", price: 25 },
    { id: "p3", name: "Maple Desk Charm", desc: "Minimal charm piece for desk or shelf.", price: 12 },
    { id: "p4", name: "Ash Key Fob", desc: "Simple key fob, durable and light.", price: 9 },
    { id: "p5", name: "Custom Sigil Block", desc: "Commission block — your design, your vibe.", price: 45 },
  ];

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
    shopInteractables.push(box);
  });
}

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
}

/* -------------------- INTERACTION RULES --------------------
   HOME: can click zone triggers (Shop/Library/About/Checkout)
   SHOP: can click products only
   BLOG: can click books only
   ABOUT: nothing extra (just scenery)
------------------------------------------------------------ */

function activeRaycastTargets() {
  if (currentZone === "home") return zoneTriggers;
  if (currentZone === "shop") return shopInteractables;
  if (currentZone === "blog") return blogInteractables;
  return [];
}

function onPointerDown(ev) {
  if (isMoving) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);

  raycaster.setFromCamera(mouse, camera);
  const targets = activeRaycastTargets();
  const hits = raycaster.intersectObjects(targets, true);
  if (!hits.length) return;

  const obj = hits[0].object;
  const data = obj.userData || {};

  // HOME zone selection
  if (currentZone === "home" && data.type === "zone") {
    if (data.zone === "checkout") {
      basketPanel.hidden = false;
      renderBasket();
      return;
    }
    moveCameraTo(data.zone);
    return;
  }

  // SHOP product selection
  if (currentZone === "shop" && data.type === "product") {
    productMeshes.forEach((m) => m.material.emissive.setHex(0x0b1020));
    obj.material.emissive.setHex(0x203060);

    titleEl.textContent = data.name;
    descEl.textContent = data.desc;
    priceEl.textContent = money(data.price);
    imgEl.src = makeProductThumb(data.name);

    selectedProduct = { id: data.id, name: data.name, desc: data.desc, price: data.price };
    panel.hidden = false;
    return;
  }

  // BLOG book selection
  if (currentZone === "blog" && data.type === "book") {
    openBookViewer(data);
    return;
  }
}

function onPointerMove(ev) {
  if (currentZone !== "blog" || isMoving) {
    if (hoverTip) hoverTip.hidden = true;
    return;
  }

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(blogInteractables, true);

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
  hoverTip.style.left = (ev.clientX + 12) + "px";
  hoverTip.style.top = (ev.clientY + 12) + "px";
}

/* -------------------- RESIZE -------------------- */
function onResize() {
  const w = sceneHost.clientWidth;
  const h = sceneHost.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

/* -------------------- LOOP -------------------- */
const _tmpLook = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);

  const t = performance.now() * 0.001;

  // camera tween
  if (camTween) {
    const now = performance.now();
    const u = Math.min(1, (now - camTween.t0) / camTween.dur);
    const e = easeInOutCubic(u);

    camera.position.lerpVectors(camTween.fromPos, camTween.toPos, e);
    _tmpLook.lerpVectors(camTween.fromLook, camTween.toLook, e);
    camera.lookAt(_tmpLook);

    if (u >= 1) {
      camTween = null;
      isMoving = false;
    }
  }

  // campfire flicker
  if (campfireData) {
    campfireData.flame.scale.y = 0.92 + Math.sin(t * 7) * 0.18;
    campfireData.flame.rotation.y = t * 0.9;
    campfireData.fireLight.intensity = 2.1 + Math.sin(t * 9) * 0.45;
  }

  // torch flicker
  torchFlames.forEach((tf, i) => {
    tf.flame.scale.y = 0.95 + Math.sin(t * 8 + i) * 0.12;
    tf.light.intensity = 1.05 + Math.sin(t * 10 + tf.seed) * 0.20;
  });

  // products idle (shop only visually, but safe always)
  productMeshes.forEach((m, i) => {
    m.rotation.y = t * 0.6 + i * 0.25;
    m.position.y = 1.58 + Math.sin(t * 1.6 + i) * 0.03;
  });

  renderer.render(scene, camera);
}

/* -------------------- BOOT -------------------- */
renderer.domElement.addEventListener("pointerdown", onPointerDown);
renderer.domElement.addEventListener("pointermove", onPointerMove);
window.addEventListener("resize", onResize);

onResize();
setZoneUI("home");
camera.position.copy(CAMERA_POINTS.home.pos);
camera.lookAt(CAMERA_POINTS.home.look);

animate();
