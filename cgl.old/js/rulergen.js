// Ruler generator: an engraved ruler for laser cutting with an independent
// scale on each edge. Each edge picks its own unit, direction, tick lengths
// and digits (optionally upside down), so every way a ruler is printed and
// held is covered. Ticks and numbers are engraved in one color, the
// outline is cut in another.
'use strict';

const INCH = 25.4;

// Single-stroke digits for engraving (a "stick font"): polylines in a
// 0.6 × 1 box, y running down from the cap line to the baseline. Outline
// fonts engrave every stem as a double line — the laser draws these in
// one clean pass, like dedicated engraving fonts do.
const DIGITS = {
  0: [[[0.15, 0], [0.45, 0], [0.6, 0.2], [0.6, 0.8], [0.45, 1], [0.15, 1], [0, 0.8], [0, 0.2], [0.15, 0]]],
  1: [[[0.08, 0.22], [0.35, 0], [0.35, 1]]],
  2: [[[0.03, 0.22], [0.12, 0.05], [0.3, 0], [0.48, 0.05], [0.57, 0.22], [0.52, 0.42], [0.02, 1], [0.6, 1]]],
  3: [[[0.05, 0.13], [0.2, 0], [0.42, 0], [0.56, 0.12], [0.56, 0.36], [0.42, 0.48], [0.22, 0.48]],
      [[0.42, 0.48], [0.58, 0.6], [0.58, 0.86], [0.43, 1], [0.18, 1], [0.04, 0.87]]],
  4: [[[0.45, 1], [0.45, 0], [0, 0.7], [0.6, 0.7]]],
  5: [[[0.55, 0], [0.1, 0], [0.05, 0.45], [0.3, 0.4], [0.5, 0.47], [0.6, 0.63], [0.6, 0.8], [0.47, 0.96], [0.24, 1], [0.04, 0.9]]],
  6: [[[0.5, 0.06], [0.32, 0], [0.14, 0.1], [0.04, 0.35], [0.04, 0.75], [0.15, 0.95], [0.34, 1], [0.52, 0.9], [0.58, 0.72], [0.51, 0.56], [0.32, 0.48], [0.13, 0.55], [0.04, 0.7]]],
  7: [[[0, 0], [0.6, 0], [0.25, 1]]],
  8: [[[0.3, 0.47], [0.14, 0.38], [0.08, 0.2], [0.16, 0.05], [0.3, 0], [0.44, 0.05], [0.52, 0.2], [0.46, 0.38], [0.3, 0.47], [0.11, 0.57], [0.05, 0.78], [0.14, 0.95], [0.3, 1], [0.46, 0.95], [0.55, 0.78], [0.49, 0.57], [0.3, 0.47]]],
  9: [[[0.1, 0.94], [0.28, 1], [0.46, 0.9], [0.56, 0.65], [0.56, 0.25], [0.45, 0.05], [0.26, 0], [0.08, 0.1], [0.02, 0.28], [0.09, 0.44], [0.28, 0.52], [0.47, 0.45], [0.56, 0.3]]],
};
const DIGIT_ADV = 0.75, DIGIT_W = 0.6;

// A number as engraved stroke paths, centered at cx with the baseline at
// baseY, digit height = size. With flip the whole number is rotated 180°
// around its center — upside down, for a scale read with the ruler turned.
function digitsPath(num, cx, baseY, size, flip) {
  const str = String(num);
  let d = '';
  const cy = baseY - size / 2;
  let x = cx - (((str.length - 1) * DIGIT_ADV + DIGIT_W) * size) / 2;
  for (const ch of str) {
    (DIGITS[ch] || []).forEach(pl => {
      pl.forEach((p, i) => {
        const X = x + p[0] * size, Y = baseY - size + p[1] * size;
        d += (i === 0 ? 'M' : 'L') + (flip
          ? fmtMm(2 * cx - X) + ' ' + fmtMm(2 * cy - Y)
          : fmtMm(X) + ' ' + fmtMm(Y));
      });
    });
    x += DIGIT_ADV * size;
  }
  return d;
}

// Ticks of one scale as [position in mm, length in mm, label or null],
// covering positions 0 .. lenMm; the scale includes a labeled 0 at its
// start. `t` supplies the tick lengths (tick05/tick1/tick5/tick10).
// Scale codes:
// 'mm': three levels (1 mm / 5 mm / 1 cm), numbers on centimeters; `fine`
// adds half-millimeter ticks of the tiny length.
// 'inchdec': 1/10, 1/2 and whole inch levels; `fine` adds 1/20 ticks.
// 'inchbin': 1/16 .. 1 inch, the in-between levels interpolated between
// the smallest and middle tick lengths; `fine` adds 1/32 ticks.
function rulerTicks(scale, fine, lenMm, t) {
  const t1 = t.tick1, t5 = t.tick5, t10 = t.tick10;
  const t0 = t.tick05 > 0 ? t.tick05 : t1 * 0.6;
  const ticks = [];
  const eps = 1e-6;
  if (scale === 'inchbin') {
    const t4 = t1 + (t5 - t1) * 2 / 3;
    const t8 = t1 + (t5 - t1) / 3;
    const d = fine ? 32 : 16;
    for (let i = 0; i * INCH / d <= lenMm + eps; i++) {
      const k = i * (32 / d); // index in 1/32 units
      const len = k % 32 === 0 ? t10 : k % 16 === 0 ? t5 : k % 8 === 0 ? t4
        : k % 4 === 0 ? t8 : k % 2 === 0 ? t1 : t0;
      ticks.push([i * INCH / d, len, i % d === 0 ? i / d : null]);
    }
  } else if (scale === 'inchdec') {
    const d = fine ? 20 : 10; // fine halves the tenths
    for (let i = 0; i * INCH / d <= lenMm + eps; i++) {
      const k = i * (20 / d);
      const len = k % 20 === 0 ? t10 : k % 10 === 0 ? t5 : k % 2 === 0 ? t1 : t0;
      ticks.push([i * INCH / d, len, i % d === 0 ? i / d : null]);
    }
  } else if (fine) {
    for (let i = 0; i / 2 <= lenMm + eps; i++) {
      const len = i % 20 === 0 ? t10 : i % 10 === 0 ? t5 : i % 2 === 0 ? t1 : t0;
      ticks.push([i / 2, len, i % 20 === 0 ? i / 20 : null]);
    }
  } else {
    for (let i = 0; i <= lenMm + eps; i++) {
      const len = i % 10 === 0 ? t10 : i % 5 === 0 ? t5 : t1;
      ticks.push([i, len, i % 10 === 0 ? i / 10 : null]);
    }
  }
  return ticks;
}

// Main entry point: returns { svg, warnings }
// params: { length, marginL, marginR, height, stroke, markColor, boxColor,
//           top, bottom } where length is the scale span in mm and top /
// bottom describe one edge each (or null for a blank edge):
//   { scale: 'mm'|'inchbin'|'inchdec', rtl, flip, fine,
//     tick05, tick1, tick5, tick10, labels, labelSize }
function generateRuler(params) {
  const warnings = [];
  const H = params.height;
  const stroke = params.stroke > 0 ? params.stroke : 0.08;
  const markColor = params.markColor || COLORS.black;
  const boxColor = params.boxColor || COLORS.red;

  if (!(params.length > 0 && H > 0)) {
    return { svg: '', warnings: ['All values must be positive numbers.'] };
  }
  const mL = params.marginL > 0 ? params.marginL : 0;
  const mR = params.marginR > 0 ? params.marginR : 0;
  const scaleW = params.length;
  const W = mL + scaleW + mR;
  if (scaleW > 4000) {
    return { svg: '', warnings: ['The ruler is too long.'] };
  }

  const edges = [];
  if (params.bottom) edges.push([params.bottom, false]);
  if (params.top) edges.push([params.top, true]);
  if (!edges.length) warnings.push('No scale on either edge — the ruler is blank.');

  // the vertical space one edge needs: its long ticks plus a row of digits
  const need = e => e.tick10 + (e.labels ? (e.labelSize > 0 ? e.labelSize : 3) + 1 : 0);
  for (const [e, top] of edges) {
    const name = top ? 'Top scale: ' : 'Bottom scale: ';
    if (!(e.tick1 > 0 && e.tick5 > 0 && e.tick10 > 0)) {
      return { svg: '', warnings: ['All values must be positive numbers.'] };
    }
    if (Math.max(e.tick1, e.tick5, e.tick10) >= H) {
      warnings.push(name + 'ticks are longer than the ruler height.');
    }
    if (e.labels && e.tick10 + (e.labelSize > 0 ? e.labelSize : 3) + 2 > H) {
      warnings.push(name + 'numbers do not fit next to the longest ticks — lower them or raise the height.');
    }
    const step = e.scale === 'inchbin' ? INCH / (e.fine ? 32 : 16)
      : e.scale === 'inchdec' ? INCH / (e.fine ? 20 : 10)
      : (e.fine ? 0.5 : 1);
    if (step - stroke < 0.2) {
      warnings.push(name + 'ticks are nearly as wide as their spacing — reduce the line width.');
    }
  }
  if (edges.length === 2 && need(params.bottom) + need(params.top) > H) {
    warnings.push('The top and bottom scales overlap — raise the height.');
  }

  const m = 5;
  let marks = '';
  // One edge of ticks with numbers next to the long ticks. Both edges span
  // the same width between the same margins; rtl puts the zero at the
  // right end, flip rotates each number 180° in place.
  const drawEdge = (e, top) => {
    const labelSize = e.labelSize > 0 ? e.labelSize : 3;
    rulerTicks(e.scale, e.fine === true, scaleW, e).forEach(([x, len, num]) => {
      // margins shift the scale off the ends
      const px = e.rtl === true ? mL + scaleW - x : mL + x;
      // a tick right on a cut edge would be cut away anyway — skip it
      if (px > 0.01 && px < W - 0.01) {
        marks += 'M' + fmtMm(m + px) + ' ' + fmtMm(m + (top ? 0 : H)) +
          'L' + fmtMm(m + px) + ' ' + fmtMm(m + (top ? len : H - len));
      }
      if (e.labels === true && num !== null) {
        // keep the digits inside the cut edges
        const hw = ((String(num).length - 1) * 0.75 + 0.6) * labelSize / 2 + 0.5;
        const lx = Math.max(hw, Math.min(px, W - hw));
        marks += digitsPath(num, m + lx,
          top ? m + e.tick10 + 1 + labelSize : m + H - e.tick10 - 1,
          labelSize, e.flip === true);
      }
    });
  };
  for (const [e, top] of edges) drawEdge(e, top);

  const body =
    '<path d="' + marks + '" fill="none" stroke="' + markColor + '" stroke-width="' + stroke +
    '" stroke-linecap="round" stroke-linejoin="round"/>\n' +
    '<rect x="' + m + '" y="' + m + '" width="' + fmtMm(W) + '" height="' + fmtMm(H) +
    '" fill="none" stroke="' + boxColor + '" stroke-width="' + stroke + '"/>\n';

  return { svg: svgDoc(W + 2 * m, H + 2 * m, body), warnings };
}
