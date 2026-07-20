// Stencil text generator: lays out a line of text with a parsed font (see
// font.js) and renders it as SVG outlines sized in millimeters.
'use strict';

// Lay out a line of text in font units: positioned contours + ink bbox.
function layoutText(font, text) {
  const glyphs = [], missing = [];
  let penX = 0;
  const bb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const grow = (x, y) => {
    if (x < bb.x0) bb.x0 = x;
    if (x > bb.x1) bb.x1 = x;
    if (y < bb.y0) bb.y0 = y;
    if (y > bb.y1) bb.y1 = y;
  };
  for (const ch of text) {
    const g = font.glyphId(ch.codePointAt(0));
    if (g === 0 && ch !== ' ') { missing.push(ch); continue; }
    const contours = font.outlineOf(g);
    contours.forEach(cont => {
      cont.start[0] += penX;
      grow(cont.start[0], cont.start[1]);
      cont.segs.forEach(seg => {
        for (let i = 0; i < seg.p.length; i += 2) {
          seg.p[i] += penX;
          grow(seg.p[i], seg.p[i + 1]);
        }
      });
    });
    glyphs.push(contours);
    penX += font.advance(g);
  }
  return { glyphs, bb, missing };
}

// Contour → SVG path data; tx maps font units to final SVG coordinates.
function contourToPath(cont, tx) {
  const P = (px, py) => { const q = tx(px, py); return fmtMm(q[0]) + ' ' + fmtMm(q[1]); };
  let d = 'M' + P(cont.start[0], cont.start[1]);
  cont.segs.forEach(seg => {
    d += seg.c;
    for (let i = 0; i < seg.p.length; i += 2) d += (i ? ' ' : '') + P(seg.p[i], seg.p[i + 1]);
  });
  return d + 'Z';
}

// Main entry point: returns { svg, warnings, textW, textH }
function generateStencil(font, params) {
  const warnings = [];
  const text = params.text || '';
  const stroke = params.stroke > 0 ? params.stroke : 0.08;
  const textColor = params.textColor || COLORS.black;
  const boxColor = params.boxColor || COLORS.black;
  if (!text.trim()) return { svg: '', warnings: ['Enter some text.'], textW: 0, textH: 0 };
  if (!(params.sizeValue > 0)) return { svg: '', warnings: ['Size must be a positive number.'], textW: 0, textH: 0 };

  const lay = layoutText(font, text);
  if (lay.missing.length) {
    warnings.push('Not in this font: ' + [...new Set(lay.missing)].join(' '));
  }
  const bbW = lay.bb.x1 - lay.bb.x0, bbH = lay.bb.y1 - lay.bb.y0;
  if (!(bbW > 0)) return { svg: '', warnings: warnings.concat('Nothing to draw.'), textW: 0, textH: 0 };

  const s = params.sizeMode === 'height' ? params.sizeValue / bbH : params.sizeValue / bbW;
  const textW = bbW * s, textH = bbH * s;

  const m = 5;
  let totalW, totalH, x0, y0, box = '';
  if (params.withBox) {
    const bw = params.boxW, bh = params.boxH;
    if (!(bw > 0 && bh > 0)) return { svg: '', warnings: warnings.concat('Box dimensions must be positive.'), textW, textH };
    if (textW > bw || textH > bh) warnings.push('Text does not fit inside the box.');
    totalW = bw + 2 * m;
    totalH = bh + 2 * m;
    x0 = m + (bw - textW) / 2;
    y0 = m + (bh - textH) / 2;
    box = '<rect x="' + m + '" y="' + m + '" width="' + bw + '" height="' + bh +
      '" fill="none" stroke="' + boxColor + '" stroke-width="' + stroke + '"/>\n';
  } else {
    totalW = textW + 2 * m;
    totalH = textH + 2 * m;
    x0 = m;
    y0 = m;
  }

  // Font units → mm, y flipped, ink bbox anchored at (x0, y0).
  const tx = (px, py) => [x0 + (px - lay.bb.x0) * s, y0 + (lay.bb.y1 - py) * s];
  let d = '';
  lay.glyphs.forEach(contours => contours.forEach(cont => { d += contourToPath(cont, tx); }));

  const body = box +
    '<path d="' + d + '" fill="none" stroke="' + textColor + '" stroke-width="' + stroke + '"/>\n';

  return { svg: svgDoc(totalW, totalH, body), warnings, textW, textH };
}
