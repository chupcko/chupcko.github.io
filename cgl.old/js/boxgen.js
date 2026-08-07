// Finger-joint panel helpers for the laser-cut plywood box (see divboxgen.js).
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
// drop (optional) = [left, right] lowers the two top corners, making a
// trapezoid with a slanted top edge — the top polarity must be 'flat', and
// the vertical joints are segmented over their actual (shortened) lengths.
function panelEdges(w, h, t, finger, pols, drop) {
  const dl = drop ? drop[0] : 0, dr = drop ? drop[1] : 0;
  const corners = [[0, dl], [w, dr], [w, h], [0, h]];
  const nrms = [[0, 1], [-1, 0], [0, -1], [1, 0]]; // inward normals
  const lens = [w, h - dr, w, h - dl];
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
// A fully closed result is emitted with Z, otherwise as open subpaths.
function buildPath(edges, dx, dy, opts) {
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
  const E = edges.map(pl => pl.map(p => p.slice()));
  if (typeof opts.skip === 'number') E[opts.skip] = null;

  // Stitch consecutive polylines into subpaths; a skip introduces a gap
  // and starts a new subpath.
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
// 'right').
//
// In the joined layout complementary edges tile perfectly when neighboring
// panels overlap by the plywood thickness, so one laser pass cuts both
// profiles. `skip` marks the edge whose cut line belongs to a neighbor.
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
  } else {
    // Joined strip (4+1): sides in one row front|left|back|right with
    // shared vertical cuts, bottom hangs under the front sharing its
    // bottom edge.
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
