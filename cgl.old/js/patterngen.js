// Pattern generator: circles, triangles, squares or hexagons laid out on a
// grid — square (optionally with every other row shifted by an offset),
// triangular or honeycomb vertices. Cut it from plywood for a mask or
// grille, or engrave it. All dimensions in millimeters; spacings are
// center-to-center distances.
'use strict';

const SQRT3 = Math.sqrt(3);

// Deduplication key: coordinates rounded to 1 µm.
function ptKey(p) {
  return Math.round(p[0] * 1000) + ',' + Math.round(p[1] * 1000);
}

// Vertices of a pointy-top hexagon with side s, relative to its center
// (honeycomb construction).
function hexCell(s) {
  const w = s * SQRT3 / 2;
  return [[0, -s], [w, -s / 2], [w, s / 2], [0, s], [-w, s / 2], [-w, -s / 2]];
}

// Vertices of one shape rotated by ang, relative to its center; s is the
// circle diameter, the triangle/square side, or the hexagon width across
// flats. Circles return null — they stay circles.
function shapeVerts(shape, s, ang) {
  let v;
  if (shape === 'square') {
    const h = s / 2;
    v = [[-h, -h], [h, -h], [h, h], [-h, h]];
  } else if (shape === 'triangle') {
    const R = s / SQRT3;
    v = [0, 1, 2].map(i => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / 3;
      return [R * Math.cos(a), R * Math.sin(a)];
    });
  } else if (shape === 'hexagon') {
    const R = s / SQRT3;
    v = [0, 1, 2, 3, 4, 5].map(i => {
      const a = i * Math.PI / 3;
      return [R * Math.cos(a), R * Math.sin(a)];
    });
  } else return null;
  const c = Math.cos(ang), n = Math.sin(ang);
  return v.map(q => [q[0] * c - q[1] * n, q[0] * n + q[1] * c]);
}

// Width of the shape projected onto direction `dir` (for the bridge
// warning); circles (verts null) are s wide in every direction.
function shapeWidth(verts, s, dir) {
  if (!verts) return s;
  const len = Math.hypot(dir[0], dir[1]);
  let lo = Infinity, hi = -Infinity;
  verts.forEach(v => {
    const p = (v[0] * dir[0] + v[1] * dir[1]) / len;
    lo = Math.min(lo, p);
    hi = Math.max(hi, p);
  });
  return hi - lo;
}

// Grid points inside the region [0,W]×[0,H]. Column pitch sx; row pitch sy
// applies to the square/staggered grids, the triangular and hexagonal
// lattices are rigid on sx. `off` shifts every other staggered row.
function gridAreaPoints(grid, W, H, sx, sy, off) {
  const eps = 1e-6, pts = [];
  if (grid === 'square' || grid === 'stagger') {
    for (let j = 0; j * sy <= H + eps; j++) {
      const o = grid === 'stagger' ? (j % 2) * off : 0;
      for (let i = 0; o + i * sx <= W + eps; i++) pts.push([o + i * sx, j * sy]);
    }
  } else if (grid === 'triangular') {
    const h = sx * SQRT3 / 2;
    for (let j = 0; j * h <= H + eps; j++) {
      const o = (j % 2) * sx / 2;
      for (let i = 0; o + i * sx <= W + eps; i++) pts.push([o + i * sx, j * h]);
    }
  } else { // hexagonal: vertices of a honeycomb with side sx (+ centers)
    const s = sx, w = s * SQRT3, verts = hexCell(s);
    const cells = grid === 'hexcenter' ? verts.concat([[0, 0]]) : verts;
    const seen = new Set();
    for (let j = 0; (j - 1) * 1.5 * s <= H + eps; j++) {
      const cy = j * 1.5 * s;
      const o = (j % 2) * w / 2;
      for (let i = -1; (i - 1) * w + o <= W + eps; i++) {
        const cx = i * w + o;
        cells.forEach(v => {
          const p = [cx + v[0], cy + v[1]];
          if (p[0] < -eps || p[0] > W + eps || p[1] < -eps || p[1] > H + eps) return;
          const k = ptKey(p);
          if (!seen.has(k)) { seen.add(k); pts.push(p); }
        });
      }
    }
  }
  return pts;
}

// Grid points for an exact count: nx × ny shapes (square/staggered/
// triangular) or nx × ny hexagon cells (hexagonal — the shapes sit on
// their vertices).
function gridCountPoints(grid, nx, ny, sx, sy, off) {
  const pts = [];
  if (grid === 'square' || grid === 'stagger') {
    for (let j = 0; j < ny; j++) {
      const o = grid === 'stagger' ? (j % 2) * off : 0;
      for (let i = 0; i < nx; i++) pts.push([o + i * sx, j * sy]);
    }
  } else if (grid === 'triangular') {
    const h = sx * SQRT3 / 2;
    for (let j = 0; j < ny; j++) {
      const o = (j % 2) * sx / 2;
      for (let i = 0; i < nx; i++) pts.push([o + i * sx, j * h]);
    }
  } else {
    const s = sx, w = s * SQRT3, verts = hexCell(s);
    const cells = grid === 'hexcenter' ? verts.concat([[0, 0]]) : verts;
    const seen = new Set();
    const add = p => {
      const k = ptKey(p);
      if (!seen.has(k)) { seen.add(k); pts.push(p); }
    };
    for (let j = 0; j < ny; j++) {
      const cy = j * 1.5 * s;
      const o = (j % 2) * w / 2;
      for (let i = 0; i < nx; i++) {
        const cx = i * w + o;
        cells.forEach(v => add([cx + v[0], cy + v[1]]));
      }
    }
    if (grid === 'hexcenter') {
      // Cells outside the nx × ny block still drop lattice points (their
      // centers and vertices) inside the block's bounding box — without
      // them the pattern's edges look holey. Sweep one extra ring of cells
      // and keep what falls inside.
      const eps = 1e-6;
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      pts.forEach(p => {
        x1 = Math.min(x1, p[0]); x2 = Math.max(x2, p[0]);
        y1 = Math.min(y1, p[1]); y2 = Math.max(y2, p[1]);
      });
      for (let j = -1; j <= ny; j++) {
        const cy = j * 1.5 * s;
        const o = (Math.abs(j) % 2) * w / 2;
        for (let i = -1; i <= nx; i++) {
          const cx = i * w + o;
          cells.forEach(v => {
            const p = [cx + v[0], cy + v[1]];
            if (p[0] >= x1 - eps && p[0] <= x2 + eps &&
                p[1] >= y1 - eps && p[1] <= y2 + eps) add(p);
          });
        }
      }
    }
  }
  return pts;
}

// Main entry point: returns { svg, warnings, ext: {w, h} }
function generatePattern(params) {
  const warnings = [];
  const shape = params.shape || 'circle';
  const grid = params.grid || 'square';
  const sx = params.spacingX;
  const rowPitch = grid === 'square' || grid === 'stagger';
  const sy = rowPitch ? params.spacingY : sx;
  const off = params.offset > 0 ? params.offset : sx / 2;
  const size = params.size;
  const ang = (params.angle || 0) * Math.PI / 180;
  const stroke = params.stroke > 0 ? params.stroke : 0.08;
  const color = params.color || COLORS.black;
  const boxColor = params.boxColor || COLORS.black;
  const filled = params.style === 'fill';

  if (!(sx > 0 && sy > 0 && size > 0)) {
    return { svg: '', warnings: ['Spacings and shape size must be positive numbers.'] };
  }

  const verts = shapeVerts(shape, size, ang);
  // Half extents of one shape (margins around the pattern).
  let hx = size / 2, hy = size / 2;
  if (verts) {
    hx = Math.max(...verts.map(v => Math.abs(v[0])));
    hy = Math.max(...verts.map(v => Math.abs(v[1])));
  }

  // Material bridge to the nearest hole: center distance minus the shape's
  // width projected onto each neighbor direction.
  const dirs = grid === 'square' ? [[sx, 0], [0, sy], [sx, sy], [-sx, sy]]
    : grid === 'stagger' ? [[sx, 0], [off, sy], [off - sx, sy], [0, 2 * sy]]
    : grid === 'triangular' ? [[sx, 0], [sx / 2, sx * SQRT3 / 2], [-sx / 2, sx * SQRT3 / 2]]
    : [[0, sx], [sx * SQRT3 / 2, sx / 2], [-sx * SQRT3 / 2, sx / 2]];
  let bridge = Infinity;
  dirs.forEach(v => {
    bridge = Math.min(bridge, Math.hypot(v[0], v[1]) - shapeWidth(verts, size, v));
  });
  if (bridge <= 0) {
    warnings.push('Shapes overlap or touch — reduce the size or the angle, or increase the spacing.');
  } else if (bridge < 2) {
    warnings.push('Only ' + bridge.toFixed(1) + ' mm of material is left between the holes — a fragile mask.');
  }

  let pts;
  if (params.mode === 'count') {
    const nx = Math.round(params.nx), ny = Math.round(params.ny);
    if (!(nx >= 1 && ny >= 1)) {
      return { svg: '', warnings: ['Counts must be at least 1.'] };
    }
    if (nx * ny > 20000) {
      return { svg: '', warnings: ['Too many shapes (' + nx * ny + ') — reduce the counts.'] };
    }
    pts = gridCountPoints(grid, nx, ny, sx, sy, off);
  } else {
    const W = params.width, H = params.height;
    if (!(W > 0 && H > 0)) {
      return { svg: '', warnings: ['Area dimensions must be positive numbers.'] };
    }
    if ((W / sx + 2) * (H / sy + 2) > 100000) {
      return { svg: '', warnings: ['Too many shapes — increase the spacings.'] };
    }
    pts = gridAreaPoints(grid, W, H, sx, sy, off);
  }
  if (!pts.length) {
    return { svg: '', warnings: warnings.concat('No shapes fit the given area.') };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  pts.forEach(p => {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  });
  const ew = maxX - minX, eh = maxY - minY;

  const m = 5;
  let totalW, totalH, x0, y0, box = '';
  if (params.withBox) {
    const bw = params.boxW, bh = params.boxH;
    if (!(bw > 0 && bh > 0)) {
      return { svg: '', warnings: warnings.concat('Box dimensions must be positive.'), ext: { w: ew + 2 * hx, h: eh + 2 * hy } };
    }
    if (ew + 2 * hx > bw || eh + 2 * hy > bh) warnings.push('The pattern does not fit inside the box.');
    totalW = bw + 2 * m;
    totalH = bh + 2 * m;
    x0 = m + (bw - ew) / 2 - minX;
    y0 = m + (bh - eh) / 2 - minY;
    box = '<rect x="' + m + '" y="' + m + '" width="' + bw + '" height="' + bh +
      '" fill="none" stroke="' + boxColor + '" stroke-width="' + stroke + '"/>\n';
  } else {
    totalW = ew + 2 * hx + 2 * m;
    totalH = eh + 2 * hy + 2 * m;
    x0 = m + hx - minX;
    y0 = m + hy - minY;
  }

  let body = '';
  if (!verts) {
    const r = fmtMm(size / 2);
    pts.forEach(p => {
      body += '<circle cx="' + fmtMm(p[0] + x0) + '" cy="' + fmtMm(p[1] + y0) + '" r="' + r + '"/>\n';
    });
  } else {
    let d = '';
    pts.forEach(p => {
      verts.forEach((v, i) => {
        d += (i === 0 ? 'M' : 'L') + fmtMm(p[0] + x0 + v[0]) + ' ' + fmtMm(p[1] + y0 + v[1]);
      });
      d += 'Z';
    });
    body = '<path d="' + d + '"/>\n';
  }
  const g = filled
    ? '<g fill="' + color + '" stroke="none">\n'
    : '<g fill="none" stroke="' + color + '" stroke-width="' + stroke + '">\n';

  return {
    svg: svgDoc(totalW, totalH, box + g + body + '</g>\n'),
    warnings,
    ext: { w: ew + 2 * hx, h: eh + 2 * hy },
  };
}
