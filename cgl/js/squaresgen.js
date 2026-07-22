// Square mask generator: a grid of square holes, each rotated by the same
// angle around its center — a plywood mask/grille. Row and column spacings
// (center to center) are independent; the staggered arrangement shifts
// every other row by half the column spacing (brick bond).
'use strict';

// Grid points filling [0,W]×[0,H] with pitches sx, sy.
function gridAreaPoints(W, H, sx, sy, stagger) {
  const eps = 1e-6, pts = [];
  for (let j = 0; j * sy <= H + eps; j++) {
    const off = stagger ? (j % 2) * sx / 2 : 0;
    for (let i = 0; off + i * sx <= W + eps; i++) pts.push([off + i * sx, j * sy]);
  }
  return pts;
}

// Grid points for an exact count: ny rows of nx squares.
function gridCountPoints(nx, ny, sx, sy, stagger) {
  const pts = [];
  for (let j = 0; j < ny; j++) {
    const off = stagger ? (j % 2) * sx / 2 : 0;
    for (let i = 0; i < nx; i++) pts.push([off + i * sx, j * sy]);
  }
  return pts;
}

// Main entry point: returns { svg, warnings, ext: {w, h} }
function generateSquares(params) {
  const warnings = [];
  const sx = params.spacingX, sy = params.spacingY;
  const side = params.side;
  const stagger = params.grid === 'stagger';
  const ang = (params.angle || 0) * Math.PI / 180;
  const stroke = params.stroke > 0 ? params.stroke : 0.08;
  const color = params.color || COLORS.black;
  const boxColor = params.boxColor || COLORS.black;
  const filled = params.style === 'fill';

  if (!(sx > 0 && sy > 0 && side > 0)) {
    return { svg: '', warnings: ['Spacings and square side must be positive numbers.'] };
  }
  const cos = Math.cos(ang), sin = Math.sin(ang);
  // Axis-aligned half-extent of a rotated square (used for the margins).
  const half = side / 2 * (Math.abs(cos) + Math.abs(sin));
  // Bridge of material to the nearest hole: for each neighbor offset, the
  // center distance minus the square's width projected onto that direction
  // (two identical shapes displaced by v sit exactly that far apart).
  const dirs = stagger
    ? [[sx, 0], [sx / 2, sy], [-sx / 2, sy], [0, 2 * sy]]
    : [[sx, 0], [0, sy], [sx, sy], [-sx, sy]];
  let bridge = Infinity;
  dirs.forEach(v => {
    const th = Math.atan2(v[1], v[0]) - ang;
    const w = side * (Math.abs(Math.cos(th)) + Math.abs(Math.sin(th)));
    bridge = Math.min(bridge, Math.hypot(v[0], v[1]) - w);
  });
  if (bridge <= 0) {
    warnings.push('Squares overlap or touch — reduce the side or the angle, or increase the spacing.');
  } else if (bridge < 2) {
    warnings.push('Only ' + bridge.toFixed(1) + ' mm of material is left between the holes — a fragile mask.');
  }

  let pts;
  if (params.mode === 'count') {
    const nx = Math.round(params.nx), ny = Math.round(params.ny);
    if (!(nx >= 1 && ny >= 1)) {
      return { svg: '', warnings: ['Square counts must be at least 1.'] };
    }
    if (nx * ny > 20000) {
      return { svg: '', warnings: ['Too many squares (' + nx * ny + ') — reduce the counts.'] };
    }
    pts = gridCountPoints(nx, ny, sx, sy, stagger);
  } else {
    const W = params.width, H = params.height;
    if (!(W > 0 && H > 0)) {
      return { svg: '', warnings: ['Area dimensions must be positive numbers.'] };
    }
    if ((W / sx + 2) * (H / sy + 2) > 100000) {
      return { svg: '', warnings: ['Too many squares — increase the spacings.'] };
    }
    pts = gridAreaPoints(W, H, sx, sy, stagger);
  }
  if (!pts.length) {
    return { svg: '', warnings: warnings.concat('No squares fit the given area.') };
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
      return { svg: '', warnings: warnings.concat('Box dimensions must be positive.'), ext: { w: ew + 2 * half, h: eh + 2 * half } };
    }
    if (ew + 2 * half > bw || eh + 2 * half > bh) warnings.push('The pattern does not fit inside the box.');
    totalW = bw + 2 * m;
    totalH = bh + 2 * m;
    x0 = m + (bw - ew) / 2 - minX;
    y0 = m + (bh - eh) / 2 - minY;
    box = '<rect x="' + m + '" y="' + m + '" width="' + bw + '" height="' + bh +
      '" fill="none" stroke="' + boxColor + '" stroke-width="' + stroke + '"/>\n';
  } else {
    totalW = ew + 2 * half + 2 * m;
    totalH = eh + 2 * half + 2 * m;
    x0 = m + half - minX;
    y0 = m + half - minY;
  }

  // Corners of one rotated square, relative to its center.
  const h2 = side / 2;
  const rel = [[-h2, -h2], [h2, -h2], [h2, h2], [-h2, h2]]
    .map(q => [q[0] * cos - q[1] * sin, q[0] * sin + q[1] * cos]);

  let sq = '';
  pts.forEach(p => {
    rel.forEach((r, i) => {
      sq += (i === 0 ? 'M' : 'L') + fmtMm(p[0] + x0 + r[0]) + ' ' + fmtMm(p[1] + y0 + r[1]);
    });
    sq += 'Z';
  });
  const g = filled
    ? '<g fill="' + color + '" stroke="none">\n'
    : '<g fill="none" stroke="' + color + '" stroke-width="' + stroke + '">\n';

  return {
    svg: svgDoc(totalW, totalH, box + g + '<path d="' + sq + '"/>\n</g>\n'),
    warnings,
    ext: { w: ew + 2 * half, h: eh + 2 * half },
  };
}
