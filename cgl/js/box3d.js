// 3D preview of the assembled box. Every part from generateDivBox's
// parts3d is an extrusion of its real cut outline, so the preview shows
// exactly what the laser output assembles into — thickness, fingers,
// holes, slopes and all. Each part gets its own color so the joints read
// clearly. Drag to rotate, scroll to zoom.
//
// Part format: {role, t, pts, holes, axis, at}. pts/holes are 2D loops in
// millimeters with sy pointing up from the outer bottom; the shape is
// extruded t along `axis` ('z' = the bottom lying flat, 'y' = front/back
// walls and widthwise dividers, 'x' = side walls and lengthwise dividers)
// and then moved by `at`. Talks to box.js through the window.CglBox3d
// global (box.js is a classic script, this is a module for the CDN
// three.js import — same pattern as the index page).
import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';

const holder = document.getElementById('preview3d');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
holder.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f1ea);
const camera = new THREE.PerspectiveCamera(40, 1, 1, 10000);
scene.add(new THREE.HemisphereLight(0xffffff, 0x888877, 0.95));
const sun = new THREE.DirectionalLight(0xffffff, 0.6);
sun.position.set(150, 300, 200);
scene.add(sun);

// pivot carries the drag rotation; inner turns the box's z-up millimeter
// coordinates into three's y-up world and centers the model.
const pivot = new THREE.Group();
scene.add(pivot);
const inner = new THREE.Group();
inner.rotation.x = -Math.PI / 2;
pivot.add(inner);
pivot.rotation.x = 0.5;
pivot.rotation.y = -0.6;

const WALL_COLORS = {
  bottom: 0xa1887f, front: 0xe57373, back: 0x64b5f6,
  left: 0x81c784, right: 0xffb74d,
};
const DIV_COLORS = [0xba68c8, 0x4dd0e1, 0xf06292, 0xdce775, 0x7986cb, 0x4db6ac, 0xffd54f, 0x90a4ae];
const edgeMat = new THREE.LineBasicMaterial({ color: 0x33302c });

// three wants the outline counter-clockwise and holes clockwise.
function ring(pts, cw) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return ((a < 0) === cw) ? pts : pts.slice().reverse();
}

// Edge lines built from the part's own loops (outline + holes) — both faces
// of the plate plus the verticals at every corner. EdgesGeometry would try
// to reconstruct them from the triangulation and draws artifacts on faces
// with several holes.
function loopEdges(loops, t) {
  const pos = [];
  loops.forEach(lp => {
    for (let i = 0; i < lp.length; i++) {
      const a = lp[i], b = lp[(i + 1) % lp.length];
      pos.push(a[0], a[1], 0, b[0], b[1], 0,
               a[0], a[1], t, b[0], b[1], t,
               a[0], a[1], 0, a[0], a[1], t);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

// Orient a geometry per the part's extrusion axis and place it.
function place(geo, part, data) {
  if (part.axis === 'y') {
    geo.rotateX(Math.PI / 2);                        // shape → xz plane, extrude → -y
  } else if (part.axis === 'x') {
    geo.rotateX(Math.PI / 2);
    geo.rotateZ(Math.PI / 2);                        // shape → yz plane, extrude → +x
  }
  geo.translate(part.at[0] - data.W / 2, part.at[1] - data.L / 2, part.at[2] - data.H / 2);
  return geo;
}

let dist = 300;

function update(data) {
  inner.clear();
  let divIdx = 0;
  data.parts.forEach(part => {
    const outline = ring(part.pts, false);
    const holes = part.holes.map(hl => ring(hl, true));
    const shape = new THREE.Shape(outline.map(p => new THREE.Vector2(p[0], p[1])));
    holes.forEach(hl => shape.holes.push(new THREE.Path(hl.map(p => new THREE.Vector2(p[0], p[1])))));
    const geo = place(new THREE.ExtrudeGeometry(shape, { depth: part.t, bevelEnabled: false }), part, data);
    const color = part.role === 'divider'
      ? DIV_COLORS[divIdx++ % DIV_COLORS.length]
      : WALL_COLORS[part.role];
    inner.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })));
    inner.add(new THREE.LineSegments(place(loopEdges([outline, ...holes], part.t), part, data), edgeMat));
  });
  dist = Math.max(data.W, data.L, data.H) * 2.4;
}

let drag = null;
renderer.domElement.addEventListener('pointerdown', e => {
  drag = [e.clientX, e.clientY];
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', e => {
  if (!drag) return;
  pivot.rotation.y += (e.clientX - drag[0]) * 0.01;
  pivot.rotation.x = Math.min(1.5, Math.max(-1.5, pivot.rotation.x + (e.clientY - drag[1]) * 0.01));
  drag = [e.clientX, e.clientY];
});
renderer.domElement.addEventListener('pointerup', () => { drag = null; });
renderer.domElement.addEventListener('wheel', e => {
  e.preventDefault();
  dist *= e.deltaY > 0 ? 1.1 : 1 / 1.1;
}, { passive: false });

function frame() {
  const w = holder.clientWidth, h = holder.clientHeight;
  if (w && h) {
    const sz = new THREE.Vector2();
    renderer.getSize(sz);
    if (sz.x !== w || sz.y !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
frame();

window.CglBox3d = { update, pivot };
if (window.cglParts3d) update(window.cglParts3d);
