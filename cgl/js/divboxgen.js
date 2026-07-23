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

// Anchor tabs on a divider's lower edge: one finger-wide tab centered in
// each span between the crossings (and between a crossing and the wall),
// so tabs never collide with the half-lap slots. Tiny spans get no tab.
function anchorTabs(bodyLen, crossings, t, finger) {
  const bounds = [0];
  crossings.forEach(c => bounds.push(c - t / 2, c + t / 2));
  bounds.push(bodyLen);
  const tabs = [];
  for (let i = 0; i < bounds.length; i += 2) {
    const a = bounds[i], b = bounds[i + 1];
    const w = Math.min(finger, (b - a) / 2);
    if (w >= t) tabs.push({ c: (a + b) / 2, w });
  }
  return tabs;
}

// Through slots in the bottom panel for the divider anchor tabs, as
// [x1, y1, x2, y2] rectangles. The bottom panel is drawn width × length
// with the front at the top, so slots need no reorientation.
function bottomSlotRects(cX, cY, tabsL, tabsW, t) {
  const rects = [];
  cX.forEach(c => tabsL.forEach(a =>
    rects.push([t + c - t / 2, t + a.c - a.w / 2, t + c + t / 2, t + a.c + a.w / 2])));
  cY.forEach(c => tabsW.forEach(a =>
    rects.push([t + a.c - a.w / 2, t + c - t / 2, t + a.c + a.w / 2, t + c + t / 2])));
  return rects;
}

// Rectangles as SVG subpaths.
function rectsPath(rects, dx, dy) {
  let d = '';
  rects.forEach(r => {
    d += 'M' + fmtMm(dx + r[0]) + ' ' + fmtMm(dy + r[1]) +
         'L' + fmtMm(dx + r[2]) + ' ' + fmtMm(dy + r[1]) +
         'L' + fmtMm(dx + r[2]) + ' ' + fmtMm(dy + r[3]) +
         'L' + fmtMm(dx + r[0]) + ' ' + fmtMm(dy + r[3]) + 'Z';
  });
  return d;
}

// Closed outline of one divider: body bodyLen wide, hL and hR tall at its
// left and right inner face, drawn with a t margin left and right for the
// end tabs. Unequal heights (sloped boxes) slant the top edge linearly
// across the body; the end strips stay level so the tabs match the wall
// holes. `slots` are half-lap crossings: {c: position in inner coordinates
// along the body, z: the mate plane's height above the bottom} — slotFrom
// tells which edge the slots open to, top slots cut down to z, bottom ones
// up to z, so the two dividers of a crossing interlock flush. `tabs`
// (optional) are bottom anchor tabs sticking out t below.
function dividerPoints(bodyLen, t, hL, hR, finger, slots, slotFrom, tabs) {
  const HD = Math.max(hL, hR);
  const yTop = x => HD - hL + (hL - hR) * (x - t) / bodyLen;
  const nL = divSegments(hL, finger), segL = hL / nL;
  const nR = divSegments(hR, finger), segR = hR / nR;
  const x = (i, base, out) => (i % 2 === 1 ? out : base);
  const pts = [[t, HD - hL]];
  // top edge, left to right, following the slant
  if (slotFrom === 'top') slots.forEach(s => {
    const x1 = t + s.c - t / 2, x2 = t + s.c + t / 2;
    const mid = HD - s.z;
    pts.push([x1, yTop(x1)], [x1, mid], [x2, mid], [x2, yTop(x2)]);
  });
  pts.push([t + bodyLen, HD - hR]);
  // right end, downward, tabs out to t + bodyLen + t
  for (let i = 1; i < nR; i++) {
    const a = x(i - 1, t + bodyLen, t + bodyLen + t), b = x(i, t + bodyLen, t + bodyLen + t);
    if (a !== b) pts.push([a, HD - hR + i * segR], [b, HD - hR + i * segR]);
  }
  pts.push([t + bodyLen, HD]);
  // bottom edge, right to left: half-lap slots (up) and anchor tabs (down)
  const feats = (tabs || []).map(a => ({ c: a.c, w: a.w, y: HD + t }));
  if (slotFrom === 'bottom') slots.forEach(s => feats.push({ c: s.c, w: t, y: HD - s.z }));
  feats.sort((a, b) => b.c - a.c);
  feats.forEach(f => {
    pts.push([t + f.c + f.w / 2, HD], [t + f.c + f.w / 2, f.y],
             [t + f.c - f.w / 2, f.y], [t + f.c - f.w / 2, HD]);
  });
  pts.push([t, HD]);
  // left end, upward, tabs out to 0
  for (let i = nL - 1; i >= 1; i--) {
    const a = x(i, t, 0), b = x(i - 1, t, 0);
    if (a !== b) pts.push([a, HD - hL + i * segL], [b, HD - hL + i * segL]);
  }
  return pts;
}

// The divider outline as an SVG path.
function dividerPath(bodyLen, t, hL, hR, finger, slots, slotFrom, tabs, dx, dy) {
  let d = '';
  dividerPoints(bodyLen, t, hL, hR, finger, slots, slotFrom, tabs).forEach((p, i) => {
    d += (i === 0 ? 'M' : 'L') + fmtMm(p[0] + dx) + ' ' + fmtMm(p[1] + dy);
  });
  return d + 'Z';
}

// Full closed outline of a wall panel — all four edges, ignoring the 2D
// layout's `skip` optimization; the 3D preview needs the complete shape.
function panelOutline(w, h, t, finger, pols, drop) {
  const pts = [];
  panelEdges(w, h, t, finger, pols, drop).forEach(pl => {
    for (let i = 0; i < pl.length - 1; i++) pts.push(pl[i]);
  });
  return pts;
}

// Whether the wall's drawn hole axis runs opposite to its physical axis
// under number-guided assembly (drawn faces out, corner numbers matched).
// The corner number on the drawn-left edge is compared with the corner
// that physically sits at the axis zero: the width axis starts at joint 8
// on the front wall and 7 on the back one, the length axis at joint 5 on
// the right wall and 8 on the left one.
function wallMirrored(p) {
  const zero = { front: 8, back: 7, right: 5, left: 8 }[p.role];
  return p.nums[3] !== zero;
}

// Center of a wall hole column along the drawn hole axis.
function wallHoleCenter(p, c0, t) {
  return wallMirrored(p) ? p.w - t - c0 : t + c0;
}

// Through holes in a wall panel for the divider end tabs, as rectangles
// in panel coordinates. `items` are hole columns: {c: divider position in
// inner coordinates, hd: divider height at this wall, off: gap between
// the wall's rim and the divider top}. Measured from the bottom edge
// (off = wall height - t - hd), so the columns stay right on sloped
// walls too.
function wallHoleRects(p, items, t, finger) {
  const rects = [];
  items.forEach(it => {
    const c = wallHoleCenter(p, it.c, t);
    const n = divSegments(it.hd, finger), seg = it.hd / n;
    for (let i = 1; i < n; i += 2) {
      rects.push([c - t / 2, it.off + i * seg, c + t / 2, it.off + (i + 1) * seg]);
    }
  });
  return rects;
}

// Label position beside a wall hole column.
function holeLabelPos(p, it, t, labelSize) {
  return [wallHoleCenter(p, it.c, t) + t / 2 + labelSize, it.off + it.hd / 2];
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

  // Sloped top: the front wall lower than the back one; the side walls
  // become trapezoids and flush dividers follow the slant.
  let slope = params.slope === true;
  let Hf = H;
  if (slope) {
    Hf = params.frontH;
    if (!(Hf > 0)) return { svg: '', warnings: ['Front height must be a positive number.'] };
    if (Hf >= H) {
      warnings.push('Front height is not lower than the box height — slope ignored.');
      slope = false;
      Hf = H;
    } else if (2 * t >= Hf) {
      return { svg: '', warnings: ['Plywood thickness is too large for the front height.'] };
    }
  }

  const iW = W - 2 * t, iL = L - 2 * t;
  // Divider height: flush with the (possibly slanted) rim unless a lower
  // one is given. Dividers stand on the bottom panel, so lower ones shift
  // the wall hole columns down.
  const full = H - t;       // inner height at the back
  const fullF = Hf - t;     // inner height at the front
  const flush = !(params.divH > 0);
  let hd = flush ? full : params.divH;
  if (!flush && hd > fullF) {
    warnings.push('Divider height exceeds the inner height — using ' + fullF.toFixed(1) + ' mm.');
    hd = fullF;
  }
  const colS = compSizes(iW, params.cols, rw.arr, t);
  const rowS = compSizes(iL, params.rows, rl.arr, t);
  if (!colS || !rowS) {
    return { svg: '', warnings: ['Too many dividers — they do not fit the inner dimensions.'] };
  }
  const cX = divCenters(colS, t); // lengthwise dividers, positions along inner width
  const cY = divCenters(rowS, t); // widthwise dividers, positions along inner length

  // Divider heights at the inner faces. The trapezoid side walls' top edge
  // runs from the front wall's top at the front inner face to the back
  // wall's top at the back one (panelEdges draws the slant between the
  // joint-inset points), so flush lengthwise dividers use exactly those
  // heights — the same line. A widthwise divider is level; it is sized to
  // the slant at the FRONT face of its thickness, so its top edge touches
  // the slanted rim there and nothing pokes above it.
  const hdF = flush ? fullF : hd; // at the front inner face
  const hdB = flush ? full : hd;  // at the back inner face
  const hW = cY.map(c => flush ? hdF + (hdB - hdF) * (c - t / 2) / iL : hd);

  const minComp = Math.min(...colS, ...rowS);
  if (minComp < 2 * t) {
    warnings.push('The smallest compartment is ' + minComp.toFixed(1) + ' mm — barely wider than the material.');
  }
  const minLen = Math.min(W, L, H);
  const minSeg = minLen / Math.max(3, (Math.round(minLen / finger) | 1));
  if (minSeg < t) {
    warnings.push('Fingers are narrower than the plywood thickness (' + minSeg.toFixed(1) + ' mm) — the joint will be fragile. Increase the finger width.');
  }
  if (finger * 3 > minLen) {
    warnings.push('Finger width is large relative to the box — the minimum of 3 segments per edge is used.');
  }
  const divSeg = hdF / divSegments(hdF, finger);
  if (divSeg < t) {
    warnings.push('Divider tabs are narrower than the plywood thickness (' + divSeg.toFixed(1) + ' mm) — increase the finger width.');
  }

  // The box panels come from the shared layout tables (boxgen.js); the
  // joined layout cuts shared edges in a single pass. The slope works in
  // both layouts — with the bottoms aligned, the two panels at every
  // shared vertical joint have the same height right there.
  const layout = params.layout || 'strip';
  const box = boxLayout(W, L, H, t, layout);
  if (slope) {
    box.panels.forEach(p => {
      if (p.role === 'front') {
        p.h = Hf;
        if (layout === 'strip') p.y += H - Hf; // align the bottoms for tiling
      }
      else if (p.role === 'left') p.drop = [0, H - Hf];  // drawn left = back
      else if (p.role === 'right') p.drop = [H - Hf, 0]; // drawn left = front
    });
  }
  const m = 5, g = 5;

  // Optional anchoring of the dividers into the bottom panel.
  const anchor = params.anchor === true;
  const tabsL = anchor && cX.length ? anchorTabs(iL, cY, t, finger) : null;
  const tabsW = anchor && cY.length ? anchorTabs(iW, cX, t, finger) : null;

  // Joint numbers: 1–8 belong to the outer box (see boxLayout); from 9 on,
  // each divider end pairs with its wall hole column.
  const numLF = cX.map((c, i) => 9 + 2 * i);                 // lengthwise ↔ front
  const numLB = cX.map((c, i) => 10 + 2 * i);                // lengthwise ↔ back
  const numWL = cY.map((c, i) => 9 + 2 * cX.length + 2 * i); // widthwise ↔ left
  const numWR = cY.map((c, i) => 10 + 2 * cX.length + 2 * i);// widthwise ↔ right

  let cuts = '', texts = '';
  const parts = []; // 3D preview parts, one per panel/divider
  const txt = (x, y, num) => {
    texts += '<text x="' + fmtMm(x) + '" y="' + fmtMm(y) + '" font-size="' + labelSize +
      '" text-anchor="middle" dominant-baseline="middle">' + num + '</text>\n';
  };

  box.panels.forEach(p => {
    // Hole columns for this wall: divider height at this wall's face and
    // the gap below the wall's rim.
    const items = (p.role === 'front' || p.role === 'back')
      ? cX.map(c => { const h = p.role === 'front' ? hdF : hdB; return { c, hd: h, off: p.h - t - h }; })
      : (p.role === 'left' || p.role === 'right')
        ? cY.map((c, i) => ({ c, hd: hW[i], off: p.h - t - hW[i] }))
        : null;
    const wallNums = p.role === 'front' ? numLF : p.role === 'back' ? numLB
      : p.role === 'left' ? numWL : p.role === 'right' ? numWR : null;
    const holeRects = items ? wallHoleRects(p, items, t, finger)
      : (p.role === 'bottom' && anchor) ? bottomSlotRects(cX, cY, tabsL || [], tabsW || [], t)
      : [];
    let d = buildPath(panelEdges(p.w, p.h, t, finger, p.pols, p.drop), m + p.x, m + p.y, p);
    d += rectsPath(holeRects, m + p.x, m + p.y);
    cuts += '<path d="' + d + '"/>\n';

    // 3D part: the full outline (ignoring `skip`) in assembled-space 2D
    // coordinates — mirrored panels get unmirrored, sy points up from the
    // outer bottom. See js/box3d.js for axis/at.
    const mir = p.role !== 'bottom' && wallMirrored(p);
    const map = p.role === 'bottom'
      ? q => [q[0], q[1]]
      : q => [mir ? p.w - q[0] : q[0], p.h - q[1]];
    const AT = {
      bottom: { axis: 'z', at: [0, 0, 0] },
      front:  { axis: 'y', at: [0, t, 0] },
      back:   { axis: 'y', at: [0, L, 0] },
      left:   { axis: 'x', at: [0, 0, 0] },
      right:  { axis: 'x', at: [W - t, 0, 0] },
    }[p.role];
    parts.push({
      role: p.role, t, axis: AT.axis, at: AT.at,
      pts: panelOutline(p.w, p.h, t, finger, p.pols, p.drop).map(map),
      holes: holeRects.map(r =>
        [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]].map(map)),
    });
    if (labels) {
      // Outer box joint numbers at the middle of each edge (as in boxgen);
      // on trapezoid walls the vertical edges are shortened by the drop.
      const inset = t + labelSize;
      const dl = p.drop ? p.drop[0] : 0, dr = p.drop ? p.drop[1] : 0;
      const at = [
        [p.w / 2, inset],
        [p.w - inset, (dr + p.h) / 2],
        [p.w / 2, p.h - inset],
        [inset, (dl + p.h) / 2],
      ];
      p.nums.forEach((num, e) => {
        if (num !== null) txt(m + p.x + at[e][0], m + p.y + at[e][1], num);
      });
      if (items) items.forEach((it, i) => {
        const q = holeLabelPos(p, it, t, labelSize);
        txt(m + p.x + q[0], m + p.y + q[1], wallNums[i]);
      });
    }
  });

  // Divider rows below the box block. The drawn-left end of a lengthwise
  // divider is its front end; of a widthwise one, its left end.
  let y = box.totalH - 2 * m;
  const endInset = 2 * t + labelSize;

  // Lengthwise dividers (body iL, crossed by widthwise ones at cY); with a
  // slope their front end (drawn left) is the lower one. Crossings mate at
  // half of the widthwise divider's height.
  const HD = Math.max(hdF, hdB);
  const slotsL = cY.map((c, i) => ({ c, z: hW[i] / 2 }));
  if (cX.length) {
    y += g;
    cX.forEach((c, i) => {
      const x = i * (iL + 2 * t + g);
      cuts += '<path d="' + dividerPath(iL, t, hdF, hdB, finger, slotsL, 'top', tabsL, m + x, m + y) + '"/>\n';
      parts.push({
        role: 'divider', t, axis: 'x', at: [t + c - t / 2, 0, 0],
        pts: dividerPoints(iL, t, hdF, hdB, finger, slotsL, 'top', tabsL).map(q => [q[0], t + HD - q[1]]),
        holes: [],
      });
      if (labels) {
        txt(m + x + endInset, m + y + HD - hdF / 2, numLF[i]);
        txt(m + x + iL + 2 * t - endInset, m + y + HD - hdB / 2, numLB[i]);
      }
    });
    y += HD + (anchor ? t : 0);
  }
  // Widthwise dividers (body iW, crossed by lengthwise ones at cX); each
  // is level, at the slant height of its own position.
  if (cY.length) {
    y += g;
    cY.forEach((c, i) => {
      const x = i * (iW + 2 * t + g);
      const slotsW = cX.map(cc => ({ c: cc, z: hW[i] / 2 }));
      cuts += '<path d="' + dividerPath(iW, t, hW[i], hW[i], finger, slotsW, 'bottom', tabsW, m + x, m + y) + '"/>\n';
      parts.push({
        role: 'divider', t, axis: 'y', at: [0, t + c + t / 2, 0],
        pts: dividerPoints(iW, t, hW[i], hW[i], finger, slotsW, 'bottom', tabsW).map(q => [q[0], t + hW[i] - q[1]]),
        holes: [],
      });
      if (labels) {
        txt(m + x + endInset, m + y + hW[i] / 2, numWL[i]);
        txt(m + x + iW + 2 * t - endInset, m + y + hW[i] / 2, numWR[i]);
      }
    });
    y += Math.max(...hW) + (anchor ? t : 0);
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
  return { svg: svgDoc(totalW, totalH, body), warnings, parts3d: { parts, W, L, H } };
}
