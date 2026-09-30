// SVG-to-STL business card: an uploaded SVG's brightness map drives per-cell
// material thickness (relief) or a solid/cavity fill (hollow), exported as a
// binary STL. No external libraries — plain canvas + typed arrays.
'use strict';

const el = (id) => document.getElementById(id);
const fields = {
  mode: el('modelType'), width: el('cardWidth'), height: el('cardHeight'), fit: el('fitMode'), invert: el('invert'),
  min: el('minThick'), max: el('maxThick'), blur: el('blurMM'), cell: el('cellSize'), border: el('borderMM')
};
const statusMsg = el('statusMsg');
const downloadBtn = el('downloadBtn');
const fileLabel = el('fileLabel');
const thumbCanvas = el('thumbCanvas');

function setStatus(text, isErr){
  statusMsg.textContent = text;
  statusMsg.classList.toggle('err', !!isErr);
}

// ---------- geometry building (plain arrays, no libraries) ----------
// Generic closed solid over the index range [iMin,iMax] x [jMin,jMax]: a top
// surface (topZFn) and a bottom surface (bottomZFn), joined by side walls.
// Assumes topZFn(i,j) >= bottomZFn(i,j) everywhere; produces outward normals
// for a standalone solid (reverse with reverseWinding() to carve a cavity).
function buildGridShell(iMin, iMax, jMin, jMax, xAt, yAt, topZFn, bottomZFn){
  const pos = [];
  const P = (i, j, z) => [xAt(i), yAt(j), z];
  const push3 = (a, b, c) => { pos.push(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2]); };

  for (let j = jMin; j < jMax; j++){
    for (let i = iMin; i < iMax; i++){
      const A = P(i,j,topZFn(i,j)), B = P(i+1,j,topZFn(i+1,j)), C = P(i+1,j+1,topZFn(i+1,j+1)), D = P(i,j+1,topZFn(i,j+1));
      push3(A,B,C); push3(A,C,D);
    }
  }
  for (let j = jMin; j < jMax; j++){
    for (let i = iMin; i < iMax; i++){
      const A = P(i,j,bottomZFn(i,j)), B = P(i+1,j,bottomZFn(i+1,j)), C = P(i+1,j+1,bottomZFn(i+1,j+1)), D = P(i,j+1,bottomZFn(i,j+1));
      push3(A,C,B); push3(A,D,C);
    }
  }

  const boundary = [];
  for (let i = iMin; i <= iMax; i++) boundary.push([i, jMin]);
  for (let j = jMin + 1; j <= jMax; j++) boundary.push([iMax, j]);
  for (let i = iMax - 1; i >= iMin; i--) boundary.push([i, jMax]);
  for (let j = jMax - 1; j >= jMin + 1; j--) boundary.push([iMin, j]);
  const n = boundary.length;
  for (let k = 0; k < n; k++){
    const [i0, j0] = boundary[k];
    const [i1, j1] = boundary[(k + 1) % n];
    const p0top = P(i0, j0, topZFn(i0,j0));
    const p1top = P(i1, j1, topZFn(i1,j1));
    const p0bot = P(i0, j0, bottomZFn(i0,j0));
    const p1bot = P(i1, j1, bottomZFn(i1,j1));
    push3(p0top, p1bot, p1top);
    push3(p0top, p0bot, p1bot);
  }
  return pos;
}

// Flips every triangle's winding (swaps its 2nd and 3rd vertex), inverting
// its normals. Used to turn a standalone solid into a cavity to subtract.
function reverseWinding(pos){
  const out = pos.slice();
  for (let k = 0; k < out.length; k += 9){
    for (let c = 0; c < 3; c++){
      const tmp = out[k+3+c]; out[k+3+c] = out[k+6+c]; out[k+6+c] = tmp;
    }
  }
  return out;
}

function boxShellPositions(W, H, zTop, zBot){
  return buildGridShell(0, 1, 0, 1, (i) => i * W, (j) => j * H, () => zTop, () => zBot);
}

function triangleCountForGrid(nx, ny){
  const top = (nx - 1) * (ny - 1) * 2;
  const bottom = top;
  const perimeter = 2 * (nx + ny - 2);
  const sides = perimeter * 2;
  return top + bottom + sides;
}

// Relief: thickness per grid cell from luminance, min..max (or inverted).
function thicknessFromLum(lum, params){
  const out = new Float32Array(lum.length);
  for (let k = 0; k < lum.length; k++){
    const l = lum[k];
    out[k] = params.invert ? (params.max - l * (params.max - params.min)) : (params.min + l * (params.max - params.min));
  }
  return out;
}

// Hollow: builds the outer flat shell (always) + the internal "fill" solid
// that gets subtracted from (cavity where fill < Gap). fill=0 -> fully
// hollow (just the two skins); fill=Gap -> fully solid (opaque).
function buildHollowParts(lum, nx, ny, params){
  const T = params.max, skin = params.min;
  const Gap = T - 2 * skin;
  if (!(Gap > 0)) throw new Error('The skin (min.) is too thick for the total thickness T (max.) — T must be greater than 2× skin.');
  let borderCells = Math.round(params.border / params.cell);
  const maxBX = Math.floor((nx - 2) / 2), maxBY = Math.floor((ny - 2) / 2);
  borderCells = Math.max(0, Math.min(borderCells, maxBX, maxBY));
  const iMin = borderCells, iMax = nx - 1 - borderCells, jMin = borderCells, jMax = ny - 1 - borderCells;

  const fill = new Float32Array(lum.length);
  for (let k = 0; k < lum.length; k++){
    const l = lum[k];
    fill[k] = params.invert ? (Gap - l * Gap) : (l * Gap);
  }
  return { T, skin, Gap, fill, iMin, iMax, jMin, jMax };
}

function hollowExportPositions(nx, ny, params, parts){
  const xAt = (i) => i / (nx - 1) * params.width, yAt = (j) => j / (ny - 1) * params.height;
  const outer = boxShellPositions(params.width, params.height, parts.T, 0);
  const cavityRaw = buildGridShell(parts.iMin, parts.iMax, parts.jMin, parts.jMax, xAt, yAt,
    () => parts.T - parts.skin,
    (i, j) => parts.skin + parts.fill[j * nx + i]);
  return outer.concat(reverseWinding(cavityRaw));
}

// ---------- binary STL writer (no libraries) ----------
function triangleNormal(a, b, c){
  const ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2];
  const vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2];
  let nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
  const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
  return [nx/len, ny/len, nz/len];
}

function buildBinarySTL(pos){
  const triCount = pos.length / 9;
  const buf = new ArrayBuffer(84 + triCount * 50);
  const view = new DataView(buf);
  const header = 'Business Card STL';
  for (let i = 0; i < 80; i++) view.setUint8(i, i < header.length ? header.charCodeAt(i) : 0);
  view.setUint32(80, triCount, true);
  let off = 84;
  for (let t = 0; t < triCount; t++){
    const base = t * 9;
    const a = [pos[base], pos[base+1], pos[base+2]];
    const b = [pos[base+3], pos[base+4], pos[base+5]];
    const c = [pos[base+6], pos[base+7], pos[base+8]];
    const n = triangleNormal(a, b, c);
    view.setFloat32(off, n[0], true); view.setFloat32(off+4, n[1], true); view.setFloat32(off+8, n[2], true);
    off += 12;
    for (const p of [a, b, c]){
      view.setFloat32(off, p[0], true); view.setFloat32(off+4, p[1], true); view.setFloat32(off+8, p[2], true);
      off += 12;
    }
    view.setUint16(off, 0, true);
    off += 2;
  }
  return buf;
}

// ---------- SVG rasterization ----------
function drawFitted(ctx, img, w, h, mode){
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  if (mode === 'stretch'){
    ctx.drawImage(img, 0, 0, w, h);
    return;
  }
  const iw = img.naturalWidth || w, ih = img.naturalHeight || h;
  const scale = mode === 'contain' ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih);
  const dw = iw * scale, dh = ih * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function loadImageFromBlob(blob){
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function sizeThumbCanvas(width, height){
  const maxDim = 400;
  let tw, th;
  if (width / height >= 1){ tw = maxDim; th = Math.round(maxDim * height / width); }
  else { th = maxDim; tw = Math.round(maxDim * width / height); }
  thumbCanvas.width = tw;
  thumbCanvas.height = th;
}

function computeLumGrid(img, params){
  const targetLong = 1400;
  const aspect = params.width / params.height;
  const rw = aspect >= 1 ? targetLong : Math.round(targetLong * aspect);
  const rh = aspect >= 1 ? Math.round(targetLong / aspect) : targetLong;

  const raster = document.createElement('canvas');
  raster.width = rw; raster.height = rh;
  drawFitted(raster.getContext('2d'), img, rw, rh, params.fit);

  const blurred = document.createElement('canvas');
  blurred.width = rw; blurred.height = rh;
  const bctx = blurred.getContext('2d');
  const blurPx = (params.blur / params.width) * rw;
  bctx.filter = blurPx > 0.05 ? `blur(${blurPx}px)` : 'none';
  bctx.drawImage(raster, 0, 0);

  const nx = Math.max(2, Math.round(params.width / params.cell) + 1);
  const ny = Math.max(2, Math.round(params.height / params.cell) + 1);
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = nx; gridCanvas.height = ny;
  const gctx = gridCanvas.getContext('2d');
  gctx.imageSmoothingEnabled = true;
  gctx.imageSmoothingQuality = 'high';
  gctx.drawImage(blurred, 0, 0, rw, rh, 0, 0, nx, ny);
  const data = gctx.getImageData(0, 0, nx, ny).data;

  const lum = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++){
    const srcRow = ny - 1 - j;
    for (let i = 0; i < nx; i++){
      const idx = (srcRow * nx + i) * 4;
      lum[j * nx + i] = (0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2]) / 255;
    }
  }

  // on-page thumbnail of the raw luminance map, sized to the card's aspect.
  // gridCanvas is already in normal (non-flipped) top-down orientation,
  // matching the source artwork, so it's drawn as-is (no vertical flip —
  // that flip is only needed for lum[], to match the mesh's Y-up axis).
  sizeThumbCanvas(params.width, params.height);
  const tctx = thumbCanvas.getContext('2d');
  tctx.clearRect(0, 0, thumbCanvas.width, thumbCanvas.height);
  tctx.imageSmoothingEnabled = false;
  tctx.drawImage(gridCanvas, 0, 0, nx, ny, 0, 0, thumbCanvas.width, thumbCanvas.height);

  return { lum, nx, ny };
}

// ---------- card size auto-detection from the SVG's own dimensions ----------
const SVG_UNIT_TO_MM = { mm:1, cm:10, in:25.4, pt:25.4/72, pc:25.4/6, px:25.4/96, '':25.4/96 };

function parseSVGLength(str){
  if (!str) return null;
  const m = String(str).trim().match(/^([\d.eE+-]+)\s*([a-z%]*)$/i);
  if (!m) return null;
  const unit = m[2].toLowerCase();
  if (!SVG_UNIT_TO_MM.hasOwnProperty(unit)) return null; // e.g. "%" has no fixed physical size
  return parseFloat(m[1]) * SVG_UNIT_TO_MM[unit];
}

// Reads the <svg> root's width/height (if given in a physical unit) and/or
// viewBox, to auto-fill the card size instead of guessing it by hand.
function parseSVGSize(svgText){
  const svg = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg') return null;

  const widthMM = parseSVGLength(svg.getAttribute('width'));
  const heightMM = parseSVGLength(svg.getAttribute('height'));

  let aspect = null;
  const viewBox = svg.getAttribute('viewBox');
  if (viewBox){
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) aspect = parts[2] / parts[3];
  }
  if (aspect === null && widthMM && heightMM) aspect = widthMM / heightMM;

  return { widthMM, heightMM, aspect };
}

// If the SVG declares a real physical size (width/height in mm/cm/in/...),
// use it directly. Otherwise a viewBox only fixes the aspect ratio, not the
// absolute size, so we just match the card's height to it and leave width
// as-is — better than silently guessing a wrong physical size.
let artworkAspect = null; // width/height of the loaded SVG, for the fit-mode visibility check below

function applySVGSize(svgText){
  const size = parseSVGSize(svgText);
  artworkAspect = size ? size.aspect : null;
  if (!size) return;
  const round1 = (n) => Math.round(n * 10) / 10;
  if (size.widthMM && size.heightMM){
    fields.width.value = round1(size.widthMM);
    fields.height.value = round1(size.heightMM);
  } else if (size.aspect){
    const width = parseFloat(fields.width.value) || 85;
    fields.height.value = round1(width / size.aspect);
  }
}

// Stretch/Fit/Cover only differ when the card's aspect ratio doesn't match
// the artwork's — which right after loading it never does. Hide the choice
// until the user manually edits Width/Height away from that match.
function updateFitVisibility(){
  const fitField = el('fitField');
  const w = parseFloat(fields.width.value), h = parseFloat(fields.height.value);
  if (artworkAspect == null || !(w > 0) || !(h > 0)){
    fitField.style.display = '';
    return;
  }
  const matches = Math.abs((w / h) - artworkAspect) / artworkAspect < 0.01;
  fitField.style.display = matches ? 'none' : '';
}

function readParams(){
  const width = parseFloat(fields.width.value);
  const height = parseFloat(fields.height.value);
  const min = parseFloat(fields.min.value);
  const max = parseFloat(fields.max.value);
  const blur = parseFloat(fields.blur.value);
  const cell = parseFloat(fields.cell.value);
  const fit = fields.fit.value;
  const invert = fields.invert.checked;
  const mode = fields.mode.value;
  const border = parseFloat(fields.border.value);
  if (!(max > min)) throw new Error('The maximum value must be greater than the minimum.');
  return { mode, width, height, min, max, blur, cell, fit, invert, border };
}

let currentImage = null;
let lastNX = 0, lastNY = 0, lastParams = null;
let lastThickness = null;  // relief mode
let lastHollow = null;     // hollow mode: { T, skin, Gap, fill, iMin, iMax, jMin, jMax }

function updateModeUI(){
  const isHollow = fields.mode.value === 'hollow';
  el('borderField').style.display = isHollow ? '' : 'none';
  el('minThickLabel').textContent = isHollow ? 'Skin (mm)' : 'Min. (black, mm)';
  el('maxThickLabel').textContent = isHollow ? 'Total thickness T (mm)' : 'Max. (white, mm)';
  el('thickHint').textContent = isHollow
    ? 'T must be greater than 2× skin (the difference is the space for the cavity/fill). Choose a multiple of your layer height for clean edges.'
    : 'For clean layer lines, choose a multiple of your layer height (e.g. 0.2 / 0.4 / 0.6 / 0.8 mm for a 0.2 mm layer).';
  el('thumbCaption').textContent = isHollow
    ? 'Artwork brightness map: lighter = more solid fill (opaque), darker = more cavity (lets light through) — reversed if "Invert" is checked.'
    : 'Artwork brightness map: lighter = thicker material (white), darker = thinner material (black) — reversed if "Invert" is checked.';
}

async function generate(){
  if (!currentImage) return false; // nothing to show until an SVG is loaded
  try{
    setStatus('Generating…');
    const params = readParams();
    const { lum, nx, ny } = computeLumGrid(currentImage, params);
    lastNX = nx; lastNY = ny; lastParams = params;

    let tris;
    if (params.mode === 'relief'){
      lastThickness = thicknessFromLum(lum, params);
      lastHollow = null;
      tris = triangleCountForGrid(nx, ny);
    } else {
      lastHollow = buildHollowParts(lum, nx, ny, params);
      lastThickness = null;
      tris = triangleCountForGrid(2, 2) + triangleCountForGrid(lastHollow.iMax - lastHollow.iMin + 1, lastHollow.jMax - lastHollow.jMin + 1);
    }

    const sizeBytes = 84 + tris * 50;
    el('statGrid').textContent = `${nx} × ${ny}`;
    el('statTris').textContent = tris.toLocaleString('en-US');
    el('statSize').textContent = sizeBytes > 1e6 ? `${(sizeBytes / 1e6).toFixed(1)} MB` : `${(sizeBytes / 1e3).toFixed(0)} KB`;

    downloadBtn.disabled = false;
    setStatus('Ready.');
    return true;
  } catch(err){
    console.error(err);
    setStatus('Error: ' + err.message, true);
    return false;
  }
}

function downloadSTL(){
  if (!lastParams) return;
  const nx = lastNX, ny = lastNY;
  let pos;
  if (lastParams.mode === 'relief'){
    const xAt = (i) => i / (nx - 1) * lastParams.width, yAt = (j) => j / (ny - 1) * lastParams.height;
    pos = buildGridShell(0, nx - 1, 0, ny - 1, xAt, yAt, (i, j) => lastThickness[j * nx + i], () => 0);
  } else {
    pos = hollowExportPositions(nx, ny, lastParams, lastHollow);
  }
  const buf = buildBinarySTL(pos);
  const blob = new Blob([buf], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'business-card.stl';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

el('svgFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  fileLabel.textContent = file.name;
  try{
    applySVGSize(await file.text());
    currentImage = await loadImageFromBlob(file);
    el('paramsPanel').style.display = '';
    el('previewPanel').style.display = '';
    updateFitVisibility();
    await generate();
  } catch(err){
    setStatus('Could not load the SVG file.', true);
  }
});

downloadBtn.addEventListener('click', async () => {
  if (await generate()) downloadSTL();
});
fields.mode.addEventListener('change', () => { updateModeUI(); generate(); });

fields.width.addEventListener('change', updateFitVisibility);
fields.height.addEventListener('change', updateFitVisibility);

['width','height','fit','invert','min','max','blur','cell','border'].forEach((key) => {
  fields[key].addEventListener('change', generate);
});

updateModeUI();
