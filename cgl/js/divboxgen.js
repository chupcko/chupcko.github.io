// Divider box generator: the finger-joint box from boxgen.js (open top,
// bottom + 4 sides) plus internal dividers forming a grid of compartments.
// Requires boxgen.js for the shared panel helpers (panelEdges, buildPath).
//
// Dividers are full height (flush with the box top), stand on the bottom
// panel and carry tabs on their vertical ends that go through matching
// holes cut in the walls. Where dividers cross they interlock with
// half-lap slots: lengthwise dividers are slotted from the top, widthwise
// ones from the bottom. The two walls of each pair are cut identical —
// flipping one over at assembly mirrors its hole pattern into place.
'use strict';

// Odd number of segments (>= 3) for a divider end of height h; tabs sit on
// the odd segments, so the holes never touch a wall edge.
function divSegments(h, finger) {
  let n = Math.round(h / finger);
  if (n % 2 === 0) n -= 1;
  return Math.max(n, 3);
}

// Compartment sizes along one axis: `ratios` (if given) are scaled to fill
// the inner dimension, otherwise `count` equal compartments. Null when the
// dividers alone don't fit.
function compSizes(inner, count, ratios, t) {
  const n = ratios ? ratios.length : Math.max(1, Math.round(count));
  const avail = inner - (n - 1) * t;
  if (avail <= 0) return null;
  if (!ratios) return Array(n).fill(avail / n);
  const sum = ratios.reduce((a, b) => a + b, 0);
  return ratios.map(r => r / sum * avail);
}

// Divider center positions in inner coordinates.
function divCenters(sizes, t) {
  const cs = [];
  let x = 0;
  for (let i = 0; i < sizes.length - 1; i++) {
    x += sizes[i];
    cs.push(x + t / 2);
    x += t;
  }
  return cs;
}

// Ratio text field: empty → equal compartments, else positive numbers
// separated by commas/spaces.
function parseRatios(str) {
  if (!str || !str.trim()) return { arr: null };
  const parts = str.trim().split(/[,;\s]+/).map(v => parseFloat(v));
  if (!parts.length || parts.some(v => !(v > 0))) return { bad: true };
  return { arr: parts.length > 1 ? parts : null };
}

// Closed outline of one divider: body bodyLen wide and hd tall, drawn with
// a t margin left and right for the end tabs. `slots` are cross positions
// (inner coordinates along the body); slotFrom tells which edge the
// half-lap slots open to.
function dividerPath(bodyLen, t, hd, finger, slots, slotFrom, dx, dy) {
  const n = divSegments(hd, finger), seg = hd / n;
  const x = (i, base, out) => (i % 2 === 1 ? out : base);
  const pts = [[t, 0]];
  // top edge, left to right
  if (slotFrom === 'top') slots.forEach(c => {
    pts.push([t + c - t / 2, 0], [t + c - t / 2, hd / 2],
             [t + c + t / 2, hd / 2], [t + c + t / 2, 0]);
  });
  pts.push([t + bodyLen, 0]);
  // right end, downward, tabs out to t + bodyLen + t
  for (let i = 1; i < n; i++) {
    const a = x(i - 1, t + bodyLen, t + bodyLen + t), b = x(i, t + bodyLen, t + bodyLen + t);
    if (a !== b) pts.push([a, i * seg], [b, i * seg]);
  }
  pts.push([t + bodyLen, hd]);
  // bottom edge, right to left
  if (slotFrom === 'bottom') slots.slice().reverse().forEach(c => {
    pts.push([t + c + t / 2, hd], [t + c + t / 2, hd / 2],
             [t + c - t / 2, hd / 2], [t + c - t / 2, hd]);
  });
  pts.push([t, hd]);
  // left end, upward, tabs out to 0
  for (let i = n - 1; i >= 1; i--) {
    const a = x(i, t, 0), b = x(i - 1, t, 0);
    if (a !== b) pts.push([a, i * seg], [b, i * seg]);
  }
  let d = '';
  pts.forEach((p, i) => { d += (i === 0 ? 'M' : 'L') + fmtMm(p[0] + dx) + ' ' + fmtMm(p[1] + dy); });
  return d + 'Z';
}

// Whether the wall's drawn hole axis runs opposite to its physical axis
// under number-guided assembly (drawn faces out, corner numbers matched).
// The corner number at the drawn start of the axis is compared with the
// corner that physically sits at the axis zero: the width axis starts at
// joint 8 on the front wall and 7 on the back one, the length axis at
// joint 5 on the right wall and 8 on the left one.
function wallMirrored(p) {
  const f = p.pols.indexOf('flat');
  const start = (f % 2 === 0) ? 3 : 0; // drawn axis start: left or top edge
  const zero = { front: 8, back: 7, right: 5, left: 8 }[p.role];
  return p.nums[start] !== zero;
}

// Center of a wall hole column along the drawn hole axis.
function wallHoleCenter(p, c0, t) {
  const f = p.pols.indexOf('flat');
  const axis = (f % 2 === 0) ? p.w : p.h;
  return wallMirrored(p) ? axis - t - c0 : t + c0;
}

// Through holes in a wall panel for the divider end tabs. `centers` are
// divider positions in inner coordinates; dx/dy place the panel. The wall's
// flat edge (the open box top) tells the panel's orientation in the layout:
// hole columns run from the flat edge inward, divider positions run along
// it. Upright walls have it on top; in joined layouts the rotated walls
// have it left/right/bottom and the holes rotate along. `off` is the gap
// between the box rim and the divider top (lower dividers).
function wallHoles(p, centers, t, hd, finger, dx, dy, off) {
  const f = p.pols.indexOf('flat');
  const n = divSegments(hd, finger), seg = hd / n;
  let d = '';
  centers.forEach(c0 => {
    const c = wallHoleCenter(p, c0, t);
    for (let i = 1; i < n; i += 2) {
      let x1, x2, y1, y2;
      if (f === 0)      { x1 = c - t / 2; x2 = c + t / 2; y1 = off + i * seg; y2 = off + (i + 1) * seg; }
      else if (f === 2) { x1 = c - t / 2; x2 = c + t / 2; y1 = p.h - off - (i + 1) * seg; y2 = p.h - off - i * seg; }
      else if (f === 3) { y1 = c - t / 2; y2 = c + t / 2; x1 = off + i * seg; x2 = off + (i + 1) * seg; }
      else              { y1 = c - t / 2; y2 = c + t / 2; x1 = p.w - off - (i + 1) * seg; x2 = p.w - off - i * seg; }
      d += 'M' + fmtMm(dx + x1) + ' ' + fmtMm(dy + y1) +
           'L' + fmtMm(dx + x2) + ' ' + fmtMm(dy + y1) +
           'L' + fmtMm(dx + x2) + ' ' + fmtMm(dy + y2) +
           'L' + fmtMm(dx + x1) + ' ' + fmtMm(dy + y2) + 'Z';
    }
  });
  return d;
}

// Label position beside a wall hole column, oriented like the holes.
function holeLabelPos(p, c0, t, hd, labelSize, off) {
  const f = p.pols.indexOf('flat');
  const C = wallHoleCenter(p, c0, t), lo = t / 2 + labelSize;
  if (f === 0) return [C + lo, off + hd / 2];
  if (f === 2) return [C + lo, p.h - off - hd / 2];
  if (f === 3) return [off + hd / 2, C + lo];
  return [p.w - off - hd / 2, C + lo];
}

// Main entry point: returns { svg, warnings }
function generateDivBox(params) {
  const W = params.width, L = params.length, H = params.height;
  const t = params.thickness, finger = params.finger;
  const stroke = params.stroke > 0 ? params.stroke : 0.08;
  const color = params.color || COLORS.black;
  const labels = params.labels === true;
  const labelSize = params.labelSize > 0 ? params.labelSize : 3;
  const numColor = params.numColor || COLORS.black;

  const warnings = [];
  if (!(W > 0 && L > 0 && H > 0 && t > 0 && finger > 0)) {
    return { svg: '', warnings: ['All values must be positive numbers.'] };
  }
  if (2 * t >= Math.min(W, L, H)) {
    return { svg: '', warnings: ['Plywood thickness is too large for the box dimensions.'] };
  }
  const rw = parseRatios(params.ratiosW);
  const rl = parseRatios(params.ratiosL);
  if (rw.bad || rl.bad) {
    return { svg: '', warnings: ['Compartment ratios must be positive numbers separated by commas.'] };
  }

  const iW = W - 2 * t, iL = L - 2 * t;
  // Divider height: full (flush with the rim) unless a lower one is given.
  // Dividers stand on the bottom panel, so lower ones shift the wall hole
  // columns down by the difference `off`.
  const full = H - t;
  let hd = params.divH > 0 ? params.divH : full;
  if (hd > full) {
    warnings.push('Divider height exceeds the inner height — using ' + full.toFixed(1) + ' mm.');
    hd = full;
  }
  const off = full - hd;
  const colS = compSizes(iW, params.cols, rw.arr, t);
  const rowS = compSizes(iL, params.rows, rl.arr, t);
  if (!colS || !rowS) {
    return { svg: '', warnings: ['Too many dividers — they do not fit the inner dimensions.'] };
  }
  const cX = divCenters(colS, t); // lengthwise dividers, positions along inner width
  const cY = divCenters(rowS, t); // widthwise dividers, positions along inner length
  if (cX.length + cY.length === 0) {
    warnings.push('No dividers — this is a plain box; the box generator does it with nicer layouts.');
  }
  const minComp = Math.min(...colS, ...rowS);
  if (minComp < 2 * t) {
    warnings.push('The smallest compartment is ' + minComp.toFixed(1) + ' mm — barely wider than the material.');
  }
  const minLen = Math.min(W, L, H);
  const minSeg = minLen / Math.max(3, (Math.round(minLen / finger) | 1));
  if (minSeg < t) {
    warnings.push('Fingers are narrower than the plywood thickness (' + minSeg.toFixed(1) + ' mm) — the joint will be fragile. Increase the finger width.');
  }
  const divSeg = hd / divSegments(hd, finger);
  if (divSeg < t) {
    warnings.push('Divider tabs are narrower than the plywood thickness (' + divSeg.toFixed(1) + ' mm) — increase the finger width.');
  }

  // The box panels come from the shared layout tables (boxgen.js), so the
  // joined layouts cut shared edges in a single pass here too. The divider
  // holes go into the walls by role; rotated panels get rotated holes.
  const layout = params.layout || 'strip';
  const box = boxLayout(W, L, H, t, layout);
  const m = 5, g = 5;

  // Joint numbers: 1–8 belong to the outer box (see boxLayout); from 9 on,
  // each divider end pairs with its wall hole column.
  const numLF = cX.map((c, i) => 9 + 2 * i);                 // lengthwise ↔ front
  const numLB = cX.map((c, i) => 10 + 2 * i);                // lengthwise ↔ back
  const numWL = cY.map((c, i) => 9 + 2 * cX.length + 2 * i); // widthwise ↔ left
  const numWR = cY.map((c, i) => 10 + 2 * cX.length + 2 * i);// widthwise ↔ right

  let cuts = '', texts = '';
  const txt = (x, y, num) => {
    texts += '<text x="' + fmtMm(x) + '" y="' + fmtMm(y) + '" font-size="' + labelSize +
      '" text-anchor="middle" dominant-baseline="middle">' + num + '</text>\n';
  };

  box.panels.forEach(p => {
    const centers = (p.role === 'front' || p.role === 'back') ? cX
      : (p.role === 'left' || p.role === 'right') ? cY : null;
    const wallNums = p.role === 'front' ? numLF : p.role === 'back' ? numLB
      : p.role === 'left' ? numWL : p.role === 'right' ? numWR : null;
    let d = '';
    if (p.skip !== 'all') d += buildPath(panelEdges(p.w, p.h, t, finger, p.pols), m + p.x, m + p.y, p);
    if (centers) d += wallHoles(p, centers, t, hd, finger, m + p.x, m + p.y, off);
    if (d) cuts += '<path d="' + d + '"/>\n';
    if (labels) {
      // Outer box joint numbers at the middle of each edge (as in boxgen).
      const inset = t + labelSize;
      const at = [
        [p.w / 2, inset],
        [p.w - inset, p.h / 2],
        [p.w / 2, p.h - inset],
        [inset, p.h / 2],
      ];
      p.nums.forEach((num, e) => {
        if (num !== null) txt(m + p.x + at[e][0], m + p.y + at[e][1], num);
      });
      if (centers) centers.forEach((c, i) => {
        const q = holeLabelPos(p, c, t, hd, labelSize, off);
        txt(m + p.x + q[0], m + p.y + q[1], wallNums[i]);
      });
    }
  });

  // Divider rows below the box block. The drawn-left end of a lengthwise
  // divider is its front end; of a widthwise one, its left end.
  let y = box.totalH - 2 * m;
  const endInset = 2 * t + labelSize;

  // Lengthwise dividers (body iL, crossed by widthwise ones at cY).
  if (cX.length) {
    y += g;
    cX.forEach((c, i) => {
      const x = i * (iL + 2 * t + g);
      cuts += '<path d="' + dividerPath(iL, t, hd, finger, cY, 'top', m + x, m + y) + '"/>\n';
      if (labels) {
        txt(m + x + endInset, m + y + hd / 2, numLF[i]);
        txt(m + x + iL + 2 * t - endInset, m + y + hd / 2, numLB[i]);
      }
    });
    y += hd;
  }
  // Widthwise dividers (body iW, crossed by lengthwise ones at cX).
  if (cY.length) {
    y += g;
    cY.forEach((c, i) => {
      const x = i * (iW + 2 * t + g);
      cuts += '<path d="' + dividerPath(iW, t, hd, finger, cX, 'bottom', m + x, m + y) + '"/>\n';
      if (labels) {
        txt(m + x + endInset, m + y + hd / 2, numWL[i]);
        txt(m + x + iW + 2 * t - endInset, m + y + hd / 2, numWR[i]);
      }
    });
    y += hd;
  }

  const rowW = Math.max(
    box.totalW - 2 * m,
    cX.length ? cX.length * (iL + 2 * t) + (cX.length - 1) * g : 0,
    cY.length ? cY.length * (iW + 2 * t) + (cY.length - 1) * g : 0);
  const totalW = 2 * m + rowW;
  const totalH = 2 * m + y;

  const body =
    '<g fill="none" stroke="' + color + '" stroke-width="' + stroke + '">\n' + cuts + '</g>\n' +
    (texts ? '<g fill="' + numColor + '" font-family="sans-serif">\n' + texts + '</g>\n' : '');
  return { svg: svgDoc(totalW, totalH, body), warnings };
}
