// Finger-joint box generator: SVG templates for a laser-cut plywood box.
// All dimensions are in millimeters and represent the OUTER size of the box.
//
// Principle: every edge where two panels join is divided into an odd number
// of segments. A "male" edge has fingers on even segments (material extends
// to the outer line), a "female" edge has pockets in the same places
// (material inset by the plywood thickness). An odd segment count makes the
// pattern symmetric, so panel orientation doesn't matter.
'use strict';

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // clockwise edge directions

// For an edge of given length, return the offset per segment.
// pol: 'male' | 'female' | 'flat'
function edgeOffsets(len, t, finger, pol) {
  if (pol === 'flat') return [0];
  let n = Math.round(len / finger);
  if (n % 2 === 0) n -= 1;
  if (n < 3) n = 3;
  const offs = [];
  for (let i = 0; i < n; i++) {
    const isFinger = i % 2 === 0; // even segments = finger positions of a male edge
    offs.push(pol === 'male' ? (isFinger ? 0 : t) : (isFinger ? t : 0));
  }
  return offs;
}

// Outline of one panel as 4 edge polylines. Each polyline starts at its
// edge's start point and ends at the next edge's start point, so together
// they form a closed loop. w, h = panel dimensions; pols = edge polarities
// [top, right, bottom, left], walked clockwise (SVG coords, y grows down).
function panelEdges(w, h, t, finger, pols) {
  const corners = [[0, 0], [w, 0], [w, h], [0, h]];
  const nrms = [[0, 1], [-1, 0], [0, -1], [1, 0]]; // inward normals
  const lens = [w, h, w, h];
  const offs = pols.map((p, i) => edgeOffsets(lens[i], t, finger, p));

  // Edge start point: the corner shifted by this edge's first offset (along
  // its normal) and by the previous edge's final offset (along its direction).
  const startPt = [];
  for (let e = 0; e < 4; e++) {
    const prev = offs[(e + 3) % 4];
    const po = prev[prev.length - 1];
    const c = corners[e], d = DIRS[e], n = nrms[e];
    startPt.push([c[0] + n[0] * offs[e][0] + d[0] * po, c[1] + n[1] * offs[e][0] + d[1] * po]);
  }

  const edges = [];
  for (let e = 0; e < 4; e++) {
    const o = offs[e], c = corners[e], d = DIRS[e], n = nrms[e];
    const s = lens[e] / o.length;
    const pl = [startPt[e]];
    let pos = 0;
    for (let i = 0; i < o.length - 1; i++) {
      pos += s;
      if (o[i] !== o[i + 1]) {
        const bx = c[0] + d[0] * pos, by = c[1] + d[1] * pos;
        pl.push([bx + n[0] * o[i], by + n[1] * o[i]]);
        pl.push([bx + n[0] * o[i + 1], by + n[1] * o[i + 1]]);
      }
    }
    pl.push(startPt[(e + 1) % 4]);
    edges.push(pl);
  }
  return edges;
}

// Build an SVG path from the edge polylines.
// opts.skip: index of an edge to omit — its cut line coincides with a
//   neighboring panel's outline and is already cut there.
// opts.breaks: [{edge, at: 'start'|'end', len}] — trim a short stub off an
//   edge's polyline where it would coincide with a perpendicular neighbor's
//   already-cut line; the path splits into subpaths around the gap.
// A fully closed result is emitted with Z, otherwise as open subpaths.
function buildPath(edges, dx, dy, opts) {
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
  const E = edges.map(pl => pl.map(p => p.slice()));

  (opts.breaks || []).forEach(b => {
    const d = DIRS[b.edge], pl = E[b.edge];
    if (b.at === 'start') {
      pl[0] = [pl[0][0] + d[0] * b.len, pl[0][1] + d[1] * b.len];
    } else {
      const q = pl[pl.length - 1];
      pl[pl.length - 1] = [q[0] - d[0] * b.len, q[1] - d[1] * b.len];
    }
  });
  if (typeof opts.skip === 'number') E[opts.skip] = null;

  // Stitch consecutive polylines into subpaths; a skip or a trimmed stub
  // introduces a gap and starts a new subpath.
  const subs = [];
  let cur = null;
  for (let e = 0; e < 4; e++) {
    const pl = E[e];
    if (!pl) { if (cur) { subs.push(cur); cur = null; } continue; }
    if (cur && same(cur[cur.length - 1], pl[0])) cur.push(...pl.slice(1));
    else { if (cur) subs.push(cur); cur = pl.slice(); }
  }
  if (cur) subs.push(cur);
  if (!subs.length) return '';
  if (subs.length > 1) {
    // The loop may wrap: merge the last subpath into the first one.
    const first = subs[0], last = subs[subs.length - 1];
    if (same(last[last.length - 1], first[0])) {
      subs.pop();
      subs[0] = last.concat(first.slice(1));
    }
  }

  let out = '';
  subs.forEach(pl => {
    const closed = subs.length === 1 && same(pl[0], pl[pl.length - 1]);
    const pts = closed ? pl.slice(0, -1) : pl;
    pts.forEach((p, i) => {
      out += (i === 0 ? 'M' : 'L') + fmtMm(p[0] + dx) + ' ' + fmtMm(p[1] + dy);
    });
    if (closed) out += 'Z';
  });
  return out;
}

// Panel table for one of the box layouts, shared with the divider box.
//
// Edge polarities (pols): [top, right, bottom, left]. The bottom panel is
// "female" on all 4 edges; front/back are "male" on their side and bottom
// edges; left/right are "female" on the verticals and "male" on the
// bottom. The top edge is flat (open box).
// nums: joint number per edge [top, right, bottom, left] — edges with the
// same number fit together during assembly (null = edge without a joint).
// role: which box panel this is ('bottom', 'front', 'back', 'left',
// 'right') — rotated panels keep the role of the wall they represent.
//
// In joined layouts complementary edges tile perfectly when neighboring
// panels overlap by the plywood thickness, so one laser pass cuts both
// profiles. `skip` marks the edge whose cut line belongs to a neighbor
// ('all' = the whole outline is covered by the neighbors' cuts).
function boxLayout(W, L, H, t, layout) {
  const FRONT = ['flat', 'male', 'male', 'male'];
  const SIDE  = ['flat', 'female', 'male', 'female'];
  const FEM4  = ['female', 'female', 'female', 'female'];
  const m = 5;
  let panels, totalW, totalH;

  if (layout === 'separate') {
    // Every panel on its own, nothing shared.
    const g = 5;
    const row1h = Math.max(L, H);
    panels = [
      { role: 'bottom', w: W, h: L, pols: FEM4,  nums: [1, 2, 3, 4],    skip: null, x: 0,           y: 0 },
      { role: 'front',  w: W, h: H, pols: FRONT, nums: [null, 5, 1, 8], skip: null, x: W + g,       y: 0 },
      { role: 'back',   w: W, h: H, pols: FRONT, nums: [null, 7, 3, 6], skip: null, x: 2 * (W + g), y: 0 },
      { role: 'right',  w: L, h: H, pols: SIDE,  nums: [null, 6, 2, 5], skip: null, x: 0,           y: row1h + g },
      { role: 'left',   w: L, h: H, pols: SIDE,  nums: [null, 8, 4, 7], skip: null, x: L + g,       y: row1h + g },
    ];
    totalW = 2 * m + Math.max(3 * W + 2 * g, 2 * L + g);
    totalH = 2 * m + row1h + g + H;
  } else if (layout === 'cross') {
    // Bottom in the center, the four sides around it (1+3+1). Back is
    // rotated 180°, left/right by ∓90°, so every male bottom edge faces the
    // bottom panel and all 4 of its edges are shared cuts — the bottom
    // panel itself emits no path at all. The side arms trim a stub of
    // length t off their perpendicular edges where those would re-cut the
    // front/back corner fingers.
    const o = H - t;
    const west = [{ edge: 0, at: 'end', len: t }, { edge: 2, at: 'start', len: t }];
    const east = [{ edge: 0, at: 'start', len: t }, { edge: 2, at: 'end', len: t }];
    panels = [
      { role: 'bottom', w: W, h: L, pols: FEM4, nums: [1, 2, 3, 4], skip: 'all', x: o, y: o },
      { role: 'front',  w: W, h: H, pols: ['flat', 'male', 'male', 'male'],     nums: [null, 5, 1, 8], skip: null, x: o,         y: 0 },
      { role: 'left',   w: H, h: L, pols: ['female', 'male', 'female', 'flat'], nums: [8, 4, 7, null], skip: null, breaks: west, x: 0,         y: o },
      { role: 'right',  w: H, h: L, pols: ['female', 'flat', 'female', 'male'], nums: [5, null, 6, 2], skip: null, breaks: east, x: o + W - t, y: o },
      { role: 'back',   w: W, h: H, pols: ['male', 'male', 'flat', 'male'],     nums: [3, 6, null, 7], skip: null, x: o,         y: o + L - t },
    ];
    totalW = 2 * m + W + 2 * o;
    totalH = 2 * m + L + 2 * o;
  } else if (layout === 'grid32') {
    // 3+2: row one is a strip front|left|back with shared vertical cuts,
    // row two is the right side rotated 90° next to the bottom panel. The
    // bottom shares its top edge with the front and its west edge with the
    // rotated right side. That side trims only its top stub (covered by the
    // front's corner finger); its bottom stub must stay — the bottom
    // panel's female outline is pulled in by t and does not cover it.
    const o = H - t;
    panels = [
      { role: 'front',  w: W, h: H, pols: FRONT, nums: [null, 5, 1, 8], skip: null, x: o,                 y: 0 },
      { role: 'right',  w: L, h: H, pols: SIDE,  nums: [null, 6, 2, 5], skip: 3,    x: o + W - t,         y: 0 },
      { role: 'back',   w: W, h: H, pols: FRONT, nums: [null, 7, 3, 6], skip: 3,    x: o + W + L - 2 * t, y: 0 },
      { role: 'bottom', w: W, h: L, pols: FEM4,  nums: [1, 2, 3, 4],    skip: 0,    x: o,                 y: H - t },
      { role: 'left',   w: H, h: L, pols: ['female', 'male', 'female', 'flat'], nums: [8, 4, 7, null], skip: 1,
        breaks: [{ edge: 0, at: 'end', len: t }], x: 0, y: H - t },
    ];
    totalW = 2 * m + o + 2 * W + L - 2 * t;
    totalH = 2 * m + H - t + L;
  } else {
    // Strip (4+1): sides in one row front|left|back|right with shared
    // vertical cuts, bottom hangs under the front sharing its bottom edge.
    panels = [
      { role: 'front',  w: W, h: H, pols: FRONT, nums: [null, 5, 1, 8], skip: null, x: 0,                 y: 0 },
      { role: 'right',  w: L, h: H, pols: SIDE,  nums: [null, 6, 2, 5], skip: 3,    x: W - t,             y: 0 },
      { role: 'back',   w: W, h: H, pols: FRONT, nums: [null, 7, 3, 6], skip: 3,    x: W + L - 2 * t,     y: 0 },
      { role: 'left',   w: L, h: H, pols: SIDE,  nums: [null, 8, 4, 7], skip: 3,    x: 2 * W + L - 3 * t, y: 0 },
      { role: 'bottom', w: W, h: L, pols: FEM4,  nums: [1, 2, 3, 4],    skip: 0,    x: 0,                 y: H - t },
    ];
    totalW = 2 * m + 2 * W + 2 * L - 3 * t;
    totalH = 2 * m + H - t + L;
  }
  return { panels, totalW, totalH };
}

// Main entry point: returns { svg, warnings }
function generateBox(params) {
  const W = params.width, L = params.length, H = params.height;
  const t = params.thickness, finger = params.finger;
  const stroke = params.stroke > 0 ? params.stroke : 0.08;
  const labelSize = params.labelSize > 0 ? params.labelSize : 3;
  const labels = params.labels !== false;
  const layout = params.layout || 'strip';
  const cutColor = params.cutColor || COLORS.black;
  const numColor = params.numColor || COLORS.black;

  const warnings = [];
  if (!(W > 0 && L > 0 && H > 0 && t > 0 && finger > 0)) {
    return { svg: '', warnings: ['All values must be positive numbers.'] };
  }
  if (2 * t >= Math.min(W, L, H)) {
    warnings.push('Plywood thickness is too large for the box dimensions.');
  }
  const minLen = Math.min(W, L, H);
  const minSeg = minLen / Math.max(3, (Math.round(minLen / finger) | 1));
  if (minSeg < t) {
    warnings.push('Fingers are narrower than the plywood thickness (' + minSeg.toFixed(1) + ' mm) — the joint will be fragile. Increase the finger width.');
  }
  if (finger * 3 > minLen) {
    warnings.push('Finger width is large relative to the box — the minimum of 3 segments per edge is used.');
  }

  const m = 5;
  const { panels, totalW, totalH } = boxLayout(W, L, H, t, layout);

  let cuts = '', texts = '';
  panels.forEach(p => {
    if (p.skip !== 'all') {
      const edges = panelEdges(p.w, p.h, t, finger, p.pols);
      cuts += '<path d="' + buildPath(edges, m + p.x, m + p.y, p) + '"/>\n';
    }
    if (labels) {
      // A discreet joint number at the middle of each edge, inset past the fingers.
      const inset = t + labelSize;
      const at = [
        [p.w / 2, inset],          // top
        [p.w - inset, p.h / 2],    // right
        [p.w / 2, p.h - inset],    // bottom
        [inset, p.h / 2],          // left
      ];
      p.nums.forEach((num, e) => {
        if (num === null) return;
        texts += '<text x="' + (m + p.x + at[e][0]) + '" y="' + (m + p.y + at[e][1]) +
          '" font-size="' + labelSize + '" text-anchor="middle" dominant-baseline="middle">' +
          num + '</text>\n';
      });
    }
  });

  const body =
    '<g fill="none" stroke="' + cutColor + '" stroke-width="' + stroke + '">\n' + cuts + '</g>\n' +
    (texts ? '<g fill="' + numColor + '" font-family="sans-serif">\n' + texts + '</g>\n' : '');

  return { svg: svgDoc(totalW, totalH, body), warnings };
}
