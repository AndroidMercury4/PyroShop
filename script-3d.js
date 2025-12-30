import * as THREE from "https://esm.sh/three@0.160.0";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";

const views = {
  home: document.getElementById("view-home"),
  shop: document.getElementById("view-shop"),
};

function setRoute(route) {
  Object.values(views).forEach(v => v.classList.remove("is-active"));
  views[route].classList.add("is-active");

  // Lazy-load the 3D scene when you first enter Shop
  if (route === "shop") init3DOnce();
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-route]");
  if (!btn) return;
  setRoute(btn.dataset.route);
});

// ---------- 3D SCENE ----------
let started = false;
let renderer, scene, camera, controls, raycaster, mouse;
let productMeshes = [];
const sceneHost = document.getElementById("scene");

// UI panel
const panel = document.getElementById("productPanel");
const titleEl = document.getElementById("productTitle");
const descEl = document.getElementById("productDesc");
document.getElementById("closePanel").addEventListener("click", () => {
  panel.hidden = true;
});

const products = [
  { id: "p1", name: "Oak Rune Token", desc: "Hand-finished oak token with carved symbol." },
  { id: "p2", name: "Walnut Mini Totem", desc: "Small walnut carving, matte oil finish." },
  { id: "p3", name: "Maple Desk Charm", desc: "Minimal charm piece for desk or shelf." },
  { id: "p4", name: "Ash Key Fob", desc: "Simple key fob, durable and light." },
  { id: "p5", name: "Custom Sigil Block", desc: "Commission block — your design, your vibe." },
];

function init3DOnce() {
  if (started) return;
  started = true;

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x07090f, 6, 22);

  camera = new THREE.PerspectiveCamera(
    60,
    sceneHost.clientWidth / sceneHost.clientHeight,
    0.1,
    200
  );
  camera.position.set(0, 2.2, 7);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(sceneHost.clientWidth, sceneHost.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  sceneHost.appendChild(renderer.domElement);

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0x7aa2ff, 1.2);
  key.position.set(3, 5, 2);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x9bffcf, 0.8);
  rim.position.set(-4, 3, -2);
  scene.add(rim);

  // Floor
  const floorGeo = new THREE.PlaneGeometry(30, 30);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0b0f1a,
    roughness: 0.9,
    metalness: 0.05,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  // Walls (simple room)
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

  // Products as clickable cubes
  const prodMat = new THREE.MeshStandardMaterial({
    color: 0x7aa2ff,
    roughness: 0.35,
    metalness: 0.25,
    emissive: 0x0b1020,
  });

  products.forEach((p, idx) => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), prodMat.clone());
    const row = Math.floor(idx / 5);
    const col = idx % 5;

    box.position.set(-4 + col * 2, 1.0 + row * 1.2 + 0.6, -6);
    box.userData = p;
    scene.add(box);
    productMeshes.push(box);
  });

  // Controls (drag to look around)
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 3.5;
  controls.maxDistance = 12;
  controls.maxPolarAngle = Math.PI / 2.05;

  // Raycasting for clicks
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  renderer.domElement.addEventListener("pointerdown", onPointerDown);

  window.addEventListener("resize", onResize);

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
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(productMeshes, false);
  if (!hits.length) return;

  const picked = hits[0].object;
  const data = picked.userData;

  // simple “selected” feedback
  productMeshes.forEach(m => (m.material.emissive.setHex(0x0b1020)));
  picked.material.emissive.setHex(0x203060);

  // show UI panel
  titleEl.textContent = data.name;
  descEl.textContent = data.desc;
  panel.hidden = false;

  // smooth camera nudge toward the product
  const target = picked.position.clone();
  controls.target.lerp(target, 0.25);
}

function animate() {
  requestAnimationFrame(animate);

  // subtle float on products (nice “alive” feel)
  const t = performance.now() * 0.001;
  productMeshes.forEach((m, i) => {
    m.rotation.y = t * 0.5 + i * 0.15;
    m.position.y += Math.sin(t * 1.4 + i) * 0.0009;
  });

  controls.update();
  renderer.render(scene, camera);
}

// Start on home
setRoute("home");
