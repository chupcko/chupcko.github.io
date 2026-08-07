// CGL logo generator: the letters C, G and L as closed single-line contours
// on a unit grid, traced from CGL.svg (where 1 unit = 1 mm) and scaled by
// the chosen unit size. The optional frame keeps a one-unit padding around
// the letters, as in the original.
'use strict';

// Letter contours in grid units, origin at the top-left corner of the
// letter block; each polyline closes back to its first point.
const CGL_LETTERS = [
  // C
  [[1, 0], [4, 0], [5, 1], [1, 1], [1, 4], [5, 4], [4, 5], [1, 5], [0, 4], [0, 1]],
  // G
  [[7, 0], [10, 0], [11, 1], [7, 1], [7, 4], [10, 4], [10, 3], [8, 3], [8, 2], [11, 2], [11, 5], [7, 5], [6, 4], [6, 1]],
  // L
  [[12, 0], [13, 0], [13, 4], [17, 4], [17, 5], [12, 5]],
];
const CGL_W = 17, CGL_H = 5; // letter block size in grid units
const CGL_PAD = 1;           // frame padding in grid units

// Main entry point: returns { svg, warnings }
function generateCgl(params) {
  const warnings = [];
  const u = params.unit;
  const stroke = params.stroke > 0 ? params.stroke : 0.08;
  const color = params.color || COLORS.black;
  const frameColor = params.frameColor || COLORS.black;

  if (!(u > 0)) return { svg: '', warnings: ['The unit must be a positive number.'] };
  // the bars of the letters and the gaps between them are one unit wide
  if (u < 2 * stroke) {
    warnings.push('The unit is barely wider than the line — increase it or reduce the line width.');
  }

  const m = 5;
  const pad = params.frame ? CGL_PAD * u : 0;
  const W = CGL_W * u + 2 * pad;
  const H = CGL_H * u + 2 * pad;

  let d = '';
  CGL_LETTERS.forEach(pts => {
    pts.forEach((p, i) => {
      d += (i === 0 ? 'M' : 'L') + fmtMm(m + pad + p[0] * u) + ' ' + fmtMm(m + pad + p[1] * u);
    });
    d += 'Z';
  });

  let body = '<path d="' + d + '" fill="none" stroke="' + color +
    '" stroke-width="' + stroke + '"/>\n';
  if (params.frame) {
    body += '<rect x="' + m + '" y="' + m + '" width="' + fmtMm(W) + '" height="' + fmtMm(H) +
      '" fill="none" stroke="' + frameColor + '" stroke-width="' + stroke + '"/>\n';
  }

  return { svg: svgDoc(W + 2 * m, H + 2 * m, body), warnings };
}
