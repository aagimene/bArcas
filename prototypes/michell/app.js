import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Presentation State ---
const slides = [
  {
    title: "1. History",
    content: "<p>In 1867, William Froude tested two model hulls: the sharp <strong>Raven</strong> and the blunt <strong>Swan</strong>.</p><p>He proved that wave resistance doesn't follow a simple 'sharp is better' rule, paving the way for mathematical optimization.</p><div style='text-align:center; padding: 10px; border: 1px dashed var(--text-muted); color: var(--text-muted); margin-top: 1rem;'><em>[Placeholder: Please provide the Swan/Raven picture URLs!]</em></div>"
  },
  {
    title: "2. Parameterization",
    content: "<p>In naval architecture, we use a standard 3D coordinate system: <br><br><span class=\"vec-x\">X (Red) = Bow/Stern (Length)</span> <br><span class=\"vec-y\">Y (Green) = Beam (Half-breadth)</span> <br><span class=\"vec-z\">Z (Blue) = Draft (Downwards)</span></p><p>For Michell's equations, we define the hull surface mathematically as: <br><strong><span class=\"vec-y\">y</span> = f(<span class=\"vec-x\">x</span>, <span class=\"vec-z\">z</span>)</strong>.</p>"
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
camera.position.set(4, 3, -2.5); // Looking from starboard forward, slightly above
camera.up.set(0, 0, -1); // Z is down, so 'up' for the camera is -Z

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(host.clientWidth, host.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
host.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
// Adjust controls for Z-down
controls.minPolarAngle = 0; 
controls.maxPolarAngle = Math.PI;

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(5, 5, 5); // Light from below (positive Z) and starboard (positive Y) to illuminate the hull
scene.add(dirLight);

// --- Objects ---

// 1. RGB Vector Gizmo (For Slide 2)
const gizmoGroup = new THREE.Group();

function createArrow(dir, color, length = 2.5) {
  const arrowHelper = new THREE.ArrowHelper(dir, new THREE.Vector3(0,0,0), length, color, 0.2, 0.1);
  return arrowHelper;
}
const xArrow = createArrow(new THREE.Vector3(1,0,0), 0xef4444); // Red (X - Bow)
const yArrow = createArrow(new THREE.Vector3(0,1,0), 0x22c55e); // Green (Y - Beam)
const zArrow = createArrow(new THREE.Vector3(0,0,1), 0x3b82f6); // Blue (Z - Draft/Down)
gizmoGroup.add(xArrow, yArrow, zArrow);

// Add a basic Diamond hull half-breadth
const L = 4.0;
const B = 1.0;
const T = 0.5;
const numX = 20;
const numZ = 10;

const diamondGeo = new THREE.BufferGeometry();
const vertices = [];
const indices = [];

// Generate vertices for y = f(x,z)
for (let iz = 0; iz <= numZ; iz++) {
  const z = (iz / numZ) * T;
  const termZ = 1.0 - (z / T);
  
  for (let ix = 0; ix <= numX; ix++) {
    const x = -L/2 + (ix / numX) * L;
    const termX = 1.0 - Math.abs(2.0 * x / L);
    
    const y = (B / 2.0) * termX * termZ;
    vertices.push(x, y, z);
  }
}

// Generate faces
for (let iz = 0; iz < numZ; iz++) {
  for (let ix = 0; ix < numX; ix++) {
    const a = iz * (numX + 1) + ix;
    const b = a + 1;
    const c = (iz + 1) * (numX + 1) + ix;
    const d = c + 1;
    // Triangle 1
    indices.push(a, b, d);
    // Triangle 2
    indices.push(a, d, c);
  }
}

diamondGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
diamondGeo.setIndex(indices);
diamondGeo.computeVertexNormals();

const hullMat = new THREE.MeshPhongMaterial({ 
  color: 0x94a3b8, 
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.9
});
const diamondMesh = new THREE.Mesh(diamondGeo, hullMat);

// Add wireframe over the shaded hull
const wireframeGeo = new THREE.WireframeGeometry(diamondGeo);
const wireframeMat = new THREE.LineBasicMaterial({ 
  color: 0x1e293b, 
  opacity: 0.5, 
  transparent: true,
  polygonOffset: true,
  polygonOffsetFactor: -1, // Pull wireframe forward
  polygonOffsetUnits: -1
});
const wireframe = new THREE.LineSegments(wireframeGeo, wireframeMat);
diamondMesh.add(wireframe);

gizmoGroup.add(diamondMesh);

// Centerplane intersection line (y=0 plane outline)
const lineGeo = new THREE.BufferGeometry();
const linePts = [
  -L/2, 0, 0,   // Stern deck
  L/2, 0, 0,    // Bow deck
  L/2, 0, T,    // Bow keel
  -L/2, 0, T,   // Stern keel
  -L/2, 0, 0    // Close loop
];
lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));
const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
const intersectionLine = new THREE.Line(lineGeo, lineMat);
gizmoGroup.add(intersectionLine);

// XZ Plane Grid helper to visualize the centerplane (y=0)
const gridHelper = new THREE.GridHelper(L * 1.5, 10, 0x444444, 0x222222);
gridHelper.position.set(0, 0, T/2); // Center it on the draft
gizmoGroup.add(gridHelper);

scene.add(gizmoGroup);

// --- Scene Logic ---
function updateSceneForSlide() {
  gizmoGroup.visible = false;
  
  if (currentSlide === 0) {
    // History
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
