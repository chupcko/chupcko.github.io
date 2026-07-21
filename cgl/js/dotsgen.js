// Dot pattern generator: grids of small circles (drill/engrave marks) laid
// out on the vertices of a square, triangular or hexagonal lattice.
// All dimensions are in millimeters; spacing = center-to-center distance
// between neighboring dots (= lattice edge length for every pattern).
'use strict';

const SQRT3 = Math.sqrt(3);

// Deduplication key: coordinates rounded to 1 µm.
function ptKey(p) {
  return Math.round(p[0] * 1000) + ',' + Math.round(p[1] * 1000);
}

// Vertices of a pointy-top hexagon with side s, relative to its center.
function hexVerts(s) {
  const w = s * SQRT3 / 2;
  return [[0, -s], [w, -s / 2], [w, s / 2], [0, s], [-w, s / 2], [-w, -s / 2]];
}

// Pattern points with pitch s that fall inside the region [0,W]×[0,H].
function areaPoints(pattern, W, H, s) {
  const eps = 1e-6;
  const pts = [];
  if (pattern === 'square') {
    for (let j = 0; j * s <= H + eps; j++)
      for (let i = 0; i * s <= W + eps; i++)
        pts.push([i * s, j * s]);
  } else if (pattern === 'triangular') {
    const h = s * SQRT3 / 2;
    for (let j = 0; j * h <= H + eps; j++) {
      const off = (j % 2) * s / 2;
      for (let i = 0; off + i * s <= W + eps; i++)
        pts.push([off + i * s, j * h]);
    }
  } else { // hexagonal: vertices of a honeycomb of pointy-top hexagons
    const w = s * SQRT3, verts = hexVerts(s);
    const seen = new Set();
    for (let j = 0; (j - 1) * 1.5 * s <= H + eps; j++) {
      const cy = j * 1.5 * s;
      const off = (j % 2) * w / 2;
      for (let i = -1; (i - 1) * w + off <= W + eps; i++) {
        const cx = i * w + off;
        verts.forEach(v => {
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

// Pattern points for an exact count: nx × ny dots (square/triangular) or
// nx × ny hexagons (hexagonal — the dots are their vertices).
function countPoints(pattern, nx, ny, s) {
  const pts = [];
  if (pattern === 'square') {
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++)
        pts.push([i * s, j * s]);
  } else if (pattern === 'triangular') {
    const h = s * SQRT3 / 2;
    for (let j = 0; j < ny; j++) {
      const off = (j % 2) * s / 2;
      for (let i = 0; i < nx; i++)
        pts.push([off + i * s, j * h]);
    }
  } else {
    const w = s * SQRT3, verts = hexVerts(s);
    const seen = new Set();
    for (let j = 0; j < ny; j++) {
      const cy = j * 1.5 * s;
      const off = (j % 2) * w / 2;
      for (let i = 0; i < nx; i++) {
        const cx = i * w + off;
        verts.forEach(v => {
          const p = [cx + v[0], cy + v[1]];
          const k = ptKey(p);
          if (!seen.has(k)) { seen.add(k); pts.push(p); }
        });
      }
    }
  }
  return pts;
}

// Main entry point: returns { svg, warnings, ext: {w, h} }
function generateDots(params) {
  const warnings = [];
  const pattern = params.pattern || 'square';
  const s = params.spacing;
  const d = params.diameter;
  const stroke = params.stroke > 0 ? params.stroke : 0.08;
  const color = params.color || COLORS.black;
  const boxColor = params.boxColor || COLORS.black;
  const filled = params.style === 'fill';

  if (!(s > 0 && d > 0)) {
    return { svg: '', warnings: ['Spacing and dot diameter must be positive numbers.'] };
  }
  if (d > s) warnings.push('Dots are larger than the spacing — they overlap.');

  let pts;
  if (params.mode === 'count') {
    const nx = Math.round(params.nx), ny = Math.round(params.ny);
    if (!(nx >= 1 && ny >= 1)) {
      return { svg: '', warnings: ['Dot counts must be at least 1.'] };
    }
    if (nx * ny > 20000) {
      return { svg: '', warnings: ['Too many dots (' + nx * ny + ') — reduce the counts.'] };
    }
    pts = countPoints(pattern, nx, ny, s);
  } else {
    const W = params.width, H = params.height;
    if (!(W > 0 && H > 0)) {
      return { svg: '', warnings: ['Area dimensions must be positive numbers.'] };
    }
    if ((W / s + 2) * (H / s + 2) > 100000) {
      return { svg: '', warnings: ['Too many dots — increase the spacing.'] };
    }
    pts = areaPoints(pattern, W, H, s);
  }
  if (!pts.length) {
    return { svg: '', warnings: warnings.concat('No dots fit the given area.') };
  }

  // Bounding box of the generated points = pattern extent.
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
      return { svg: '', warnings: warnings.concat('Box dimensions must be positive.'), ext: { w: ew, h: eh } };
    }
    if (ew + d > bw || eh + d > bh) warnings.push('The pattern does not fit inside the box.');
    totalW = bw + 2 * m;
    totalH = bh + 2 * m;
    x0 = m + (bw - ew) / 2 - minX;
    y0 = m + (bh - eh) / 2 - minY;
    box = '<rect x="' + m + '" y="' + m + '" width="' + bw + '" height="' + bh +
      '" fill="none" stroke="' + boxColor + '" stroke-width="' + stroke + '"/>\n';
  } else {
    totalW = ew + d + 2 * m;
    totalH = eh + d + 2 * m;
    x0 = m + d / 2 - minX;
    y0 = m + d / 2 - minY;
  }

  let dots = '';
  const r = fmtMm(d / 2);
  pts.forEach(p => {
    dots += '<circle cx="' + fmtMm(p[0] + x0) + '" cy="' + fmtMm(p[1] + y0) + '" r="' + r + '"/>\n';
  });
  const g = filled
    ? '<g fill="' + color + '" stroke="none">\n'
    : '<g fill="none" stroke="' + color + '" stroke-width="' + stroke + '">\n';

  return {
    svg: svgDoc(totalW, totalH, box + g + dots + '</g>\n'),
    warnings,
    ext: { w: ew + d, h: eh + d },
  };
}
