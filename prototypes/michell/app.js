import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Presentation State ---
const slides = [
  {
    title: "1. History",
    content: "<p>In 1867, William Froude tested two model hulls: the sharp <strong>Raven</strong> and the blunt <strong>Swan</strong>.</p><p>He proved that wave resistance doesn't follow a simple 'sharp is better' rule, paving the way for mathematical optimization.</p>"
  },
  {
    title: "2. Parameterization",
    content: "<p>Before we build a boat, we need to understand 3D math.</p><p>A parametric surface is defined by equations mapped to the <span class=\"vec-x\">X (Red)</span>, <span class=\"vec-y\">Y (Green)</span>, and <span class=\"vec-z\">Z (Blue)</span> axes.</p><p>For Michell's equations, we define the half-breadth of the hull as <br><strong><span class=\"vec-y\">y</span> = f(<span class=\"vec-x\">x</span>, <span class=\"vec-z\">z</span>)</strong>.</p>"
  },
  {
    title: "3. Defining the Hull",
    content: "<p>Let's apply this to a real hull. This is the <strong>Wigley Hull</strong>, a standard benchmark.</p><p>We only show half the hull so the equation curve is visible.</p>"
  }
];

let currentSlide = 0;

// UI Elements
const uiTitle = document.getElementById('slide-title');
const uiBody = document.getElementById('slide-body');
const uiIndicator = document.getElementById('slide-indicator');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');

function updateSlideUI() {
  const slide = slides[currentSlide];
  uiTitle.innerHTML = slide.title;
  uiBody.innerHTML = slide.content;
  uiIndicator.textContent = `${currentSlide + 1} / ${slides.length}`;
  
  btnPrev.disabled = (currentSlide === 0);
  btnNext.disabled = (currentSlide === slides.length - 1);
  
  updateSceneForSlide();
}

btnPrev.addEventListener('click', () => {
  if (currentSlide > 0) {
    currentSlide--;
    updateSlideUI();
  }
});

btnNext.addEventListener('click', () => {
  if (currentSlide < slides.length - 1) {
    currentSlide++;
    updateSlideUI();
  }
});

// --- Three.js Setup ---
const host = document.getElementById('three-host');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f172a); // Match CSS bg-color

const camera = new THREE.PerspectiveCamera(45, host.clientWidth / host.clientHeight, 0.1, 100);
camera.position.set(4, 3, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(host.clientWidth, host.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
host.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 1.5); // Soft white light
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(5, 10, 7.5);
scene.add(dirLight);

// --- Objects ---

// 1. RGB Vector Gizmo (For Slide 2)
const gizmoGroup = new THREE.Group();

function createArrow(dir, color, length = 2) {
  const arrowHelper = new THREE.ArrowHelper(dir, new THREE.Vector3(0,0,0), length, color, 0.2, 0.1);
  return arrowHelper;
}
const xArrow = createArrow(new THREE.Vector3(1,0,0), 0xef4444); // Red
const yArrow = createArrow(new THREE.Vector3(0,1,0), 0x22c55e); // Green
const zArrow = createArrow(new THREE.Vector3(0,0,1), 0x3b82f6); // Blue
gizmoGroup.add(xArrow, yArrow, zArrow);

// Add a simple math surface to the gizmo
const mathSurfaceGeo = new THREE.PlaneGeometry(2, 2, 10, 10);
mathSurfaceGeo.rotateX(-Math.PI / 2);
const pos = mathSurfaceGeo.attributes.position;
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i);
  const z = pos.getZ(i);
  // Simple saddle y = x^2 - z^2
  pos.setY(i, 0.2 * (x*x - z*z));
}
mathSurfaceGeo.computeVertexNormals();
const mathSurfaceMat = new THREE.MeshPhongMaterial({ color: 0x94a3b8, side: THREE.DoubleSide, wireframe: true });
const mathSurface = new THREE.Mesh(mathSurfaceGeo, mathSurfaceMat);
gizmoGroup.add(mathSurface);

scene.add(gizmoGroup);

// --- Scene Logic ---
function updateSceneForSlide() {
  // Hide everything first
  gizmoGroup.visible = false;
  
  if (currentSlide === 0) {
    // History: Empty for now, maybe add pictures later
  } else if (currentSlide === 1) {
    // Parameterization
    gizmoGroup.visible = true;
  } else if (currentSlide === 2) {
    // Defining Hull (Wigley) - To be implemented
  }
}

// --- Window Resize ---
window.addEventListener('resize', () => {
  camera.aspect = host.clientWidth / host.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(host.clientWidth, host.clientHeight);
});

// --- Render Loop ---
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// Initialize
updateSlideUI();
animate();
