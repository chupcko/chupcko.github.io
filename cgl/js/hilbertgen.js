// Hilbert curve generator: a space-filling curve drawn as one SVG polyline
// that fills a square of the given size (in millimeters).
'use strict';

// Points of a Hilbert curve of the given order in the unit square [0,1]²,
// one point per grid cell center, in traversal order (4^order points).
function hilbertPoints(order) {
  const pts = [];
  function hil(x0, y0, xi, xj, yi, yj, n) {
    if (n <= 0) {
      pts.push([x0 + (xi + yi) / 2, y0 + (xj + yj) / 2]);
      return;
    }
    hil(x0, y0, yi / 2, yj / 2, xi / 2, xj / 2, n - 1);
    hil(x0 + xi / 2, y0 + xj / 2, xi / 2, xj / 2, yi / 2, yj / 2, n - 1);
    hil(x0 + xi / 2 + yi / 2, y0 + xj / 2 + yj / 2, xi / 2, xj / 2, yi / 2, yj / 2, n - 1);
    hil(x0 + xi / 2 + yi, y0 + xj / 2 + yj, -yi / 2, -yj / 2, -xi / 2, -xj / 2, n - 1);
  }
  // Oriented so the curve starts in the bottom-left corner and ends in the
  // bottom-right one (SVG coordinates, y grows downward).
  hil(0, 1, 0, -1, 1, 0, order);
  return pts;
}

// Main entry point: returns { svg, warnings }
function generateHilbert(params) {
  const warnings = [];
  const size = params.size;
  const order = Math.round(params.order);
  const stroke = params.stroke > 0 ? params.stroke : 0.08;
  const color = params.color || COLORS.black;
  const boxColor = params.boxColor || COLORS.black;

  if (!(size > 0)) return { svg: '', warnings: ['Size must be a positive number.'] };
  if (!(order >= 1 && order <= 10)) return { svg: '', warnings: ['Iterations must be between 1 and 10.'] };

  const step = size / Math.pow(2, order); // grid cell size
  if (step < 2 * stroke) {
    warnings.push('Lines are ' + step.toFixed(2) + ' mm apart — too dense for the line width.');
  }

  const m = 5;
  let totalW, totalH, x0, y0, box = '';
  if (params.withBox) {
    const bw = params.boxW, bh = params.boxH;
    if (!(bw > 0 && bh > 0)) return { svg: '', warnings: warnings.concat('Box dimensions must be positive.') };
    if (size > bw || size > bh) warnings.push('The curve does not fit inside the box.');
    totalW = bw + 2 * m;
    totalH = bh + 2 * m;
    x0 = m + (bw - size) / 2;
    y0 = m + (bh - size) / 2;
    box = '<rect x="' + m + '" y="' + m + '" width="' + bw + '" height="' + bh +
      '" fill="none" stroke="' + boxColor + '" stroke-width="' + stroke + '"/>\n';
  } else {
    totalW = size + 2 * m;
    totalH = size + 2 * m;
    x0 = m;
    y0 = m;
  }

  // Unit square → mm; cell centers keep a step/2 margin inside the square.
  let d = '';
  hilbertPoints(order).forEach((p, i) => {
    d += (i === 0 ? 'M' : 'L') + fmtMm(x0 + p[0] * size) + ' ' + fmtMm(y0 + p[1] * size);
  });

  const body = box +
    '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '"/>\n';

  return { svg: svgDoc(totalW, totalH, body), warnings };
}
