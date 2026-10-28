// SVG-to-3MF business card, direct vector route: filled SVG shapes become a
// raised relief on a flat base plate — no rasterization, no blur, no grid.
// Any filled shape counts as solid (usually black); the empty background
// stays base plate only. The slicer does the rest: crisp vertical walls,
// exact dimensions, its own layer logic. Strokes, <text>, <use> and raster
// <image> elements are ignored (<text> needs font outlines — convert it to
// paths first, e.g. Inkscape "Object to Path"). Holes use the even-odd rule:
// a loop inside an odd number of other loops is a hole.
// No external libraries. Pure functions run in browser and node alike.
'use strict';

// ---------- 2D geometry (y-down mm, same convention as foldbox.js) ----------
function sampleCubic(p0, c1, c2, p3, n) {
  const pts = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([u*u*u*p0[0] + 3*u*u*t*c1[0] + 3*u*t*t*c2[0] + t*t*t*p3[0],
              u*u*u*p0[1] + 3*u*u*t*c1[1] + 3*u*t*t*c2[1] + t*t*t*p3[1]]);
  }
  return pts;
}
function sampleQuad(p0, c, p1, n) {
  const pts = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([u*u*p0[0] + 2*u*t*c[0] + t*t*p1[0], u*u*p0[1] + 2*u*t*c[1] + t*t*p1[1]]);
  }
  return pts;
}
function sampleArcPts(cx, cy, r, a0deg, a1deg, n) {
  const pts = [];
  for (let i = 1; i <= n; i++) {
    const a = (a0deg + (a1deg - a0deg) * i / n) * Math.PI / 180;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}
function rectPoly(x, y, w, h) {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}
function roundedRectLoop(x, y, w, h, rx, ry) {
  rx = Math.min(Math.max(rx || 0, 0), w / 2);
  ry = Math.min(Math.max(ry || 0, 0), h / 2);
  if (!(rx > 0) && !(ry > 0)) return rectPoly(x, y, w, h);
  const n = 6, loop = [[x + rx, y], [x + w - rx, y]];
  const corner = (cx, cy, a0, a1) => {
    for (let i = 1; i <= n; i++) {
      const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
      loop.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    }
  };
  corner(x + w - rx, y + ry, 270, 360);
  loop.push([x + w, y + h - ry]);
  corner(x + w - rx, y + h - ry, 0, 90);
  loop.push([x + rx, y + h]);
  corner(x + rx, y + h - ry, 90, 180);
  loop.push([x, y + ry]);
  corner(x + rx, y + ry, 180, 270);
  return loop;
}
function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}
function normLoop(pts) {
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-9) out.push(p);
  }
  if (out.length > 1) {
    const f = out[0], l = out[out.length - 1];
    if (Math.hypot(f[0] - l[0], f[1] - l[1]) <= 1e-9) out.pop();
  }
  return out;
}
function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// Ear-clipping triangulation with hole bridging. Loops must be simple.
function ptInTri(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const e = 1e-12;
  return !(((d1 < -e) || (d2 < -e) || (d3 < -e)) && ((d1 > e) || (d2 > e) || (d3 > e)));
}
function clipEars(poly) {
  const idx = poly.map((_, i) => i), tris = [];
  const cross = (a, b, c) => (poly[b][0] - poly[a][0]) * (poly[c][1] - poly[b][1]) - (poly[b][1] - poly[a][1]) * (poly[c][0] - poly[b][0]);
  let guard = 0;
  while (idx.length > 3 && guard++ < 100000) {
    let found = false;
    for (let k = 0; k < idx.length; k++) {
      const a = idx[(k - 1 + idx.length) % idx.length], b = idx[k], c = idx[(k + 1) % idx.length];
      if (cross(a, b, c) <= 0) continue;
      let ok = true;
      for (const m of idx) {
        if (m === a || m === b || m === c) continue;
        const p = poly[m];
        const same = (q) => Math.abs(p[0] - poly[q][0]) < 1e-9 && Math.abs(p[1] - poly[q][1]) < 1e-9;
        if (same(a) || same(b) || same(c)) continue;
        if (ptInTri(p[0], p[1], poly[a][0], poly[a][1], poly[b][0], poly[b][1], poly[c][0], poly[c][1])) { ok = false; break; }
      }
      if (!ok) continue;
      tris.push([a, b, c]); idx.splice(k, 1); found = true; break;
    }
    if (!found) break;
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  return { tris, rest: idx.length };
}
function samePt(p, q) {
  return Math.abs(p[0] - q[0]) < 1e-9 && Math.abs(p[1] - q[1]) < 1e-9;
}
function segProperInt(p1, p2, p3, p4) {
  const o = function (a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); };
  const d1 = o(p3, p4, p1), d2 = o(p3, p4, p2), d3 = o(p1, p2, p3), d4 = o(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
function segCrossesAny(a, b, loops) {
  for (const lp of loops) {
    for (let i = 0; i < lp.length; i++) {
      const c = lp[i], d = lp[(i + 1) % lp.length];
      if (samePt(a, c) || samePt(a, d) || samePt(b, c) || samePt(b, d)) continue;
      if (segProperInt(a, b, c, d)) return true;
    }
  }
  return false;
}
// Splice a hole into the outer loop through a bridge segment that crosses
// nothing (earcut-style). Returns the merged loop, or null when the hole
// has no visible outer vertex yet (later holes may open the way).
function bridgeHole(outer, hole) {
  let hi = 0;
  for (let i = 1; i < hole.length; i++) {
    if (hole[i][0] < hole[hi][0] || (hole[i][0] === hole[hi][0] && hole[i][1] < hole[hi][1])) hi = i;
  }
  const hp = hole[hi];
  const cands = [];
  for (let i = 0; i < outer.length; i++) {
    if (!samePt(outer[i], hp)) cands.push(i);
  }
  cands.sort(function (a, b) {
    const da = (outer[a][0] - hp[0]) ** 2 + (outer[a][1] - hp[1]) ** 2;
    const db = (outer[b][0] - hp[0]) ** 2 + (outer[b][1] - hp[1]) ** 2;
    return da - db;
  });
  for (const bi of cands) {
    const v = outer[bi];
    if (segCrossesAny(hp, v, [outer, hole])) continue;
    const res = outer.slice(0, bi + 1);
    for (let k = 0; k <= hole.length; k++) res.push(hole[(hi + k) % hole.length]);
    res.push(outer[bi]);
    return res.concat(outer.slice(bi + 1));
  }
  return null;
}
function triangulate(outer, holes) {
  let loop = normLoop(outer.slice());
  if (signedArea(loop) < 0) loop.reverse();
  let pending = (holes || []).map(function (h) {
    const hl = normLoop(h.slice());
    if (signedArea(hl) > 0) hl.reverse();
    return hl;
  });
  let guard = pending.length * (pending.length + 1) + 1;
  while (pending.length && guard-- > 0) {
    let progressed = false;
    for (let i = 0; i < pending.length; i++) {
      const merged = bridgeHole(loop, pending[i]);
      if (merged) {
        loop = normLoop(merged);
        pending = pending.slice(0, i).concat(pending.slice(i + 1));
        progressed = true;
        break;
      }
    }
    if (!progressed) return { tris: [], rest: loop.length, loop: loop, broken: true };
  }
  if (pending.length) return { tris: [], rest: loop.length, loop: loop, broken: true };
  const r = clipEars(loop);
  const out = { tris: r.tris, rest: r.rest, loop: loop };
  if (r.rest !== 0 && r.rest !== 3) out.broken = true;
  return out;
}
// Closed prism from a flat loop with optional holes. Returns indexed mesh.
function prismPiece(outer, holes, z0, z1) {
  const clean = normLoop(outer.slice());
  if (clean.length < 3 || Math.abs(signedArea(clean)) < 1e-9) return { v: [], t: [] };
  const tg = triangulate(clean, holes || []);
  if (tg.broken) return { v: [], t: [], broken: true };
  const tris = tg.tris, loop = tg.loop;
  const n = loop.length, v = [], t = [];
  for (const p of loop) v.push([p[0], p[1], z1]);
  for (const p of loop) v.push([p[0], p[1], z0]);
  for (const [a, b, c] of tris) t.push([a, c, b]);
  for (const [a, b, c] of tris) t.push([n + a, n + b, n + c]);
  for (let i = 0; i < n; i++) {
    const p = i, q = (i + 1) % n;
    t.push([p, n + p, n + q], [p, n + q, q]);
  }
  return { v, t, caps: tris.length };
}
function triArea2(a, b, c) {
  return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
}

// ---------- tiny SVG reader (plain text, no DOM needed) ----------
const SEG_MM = 0.25;
function clampN(n, lo, hi) { return Math.max(lo, Math.min(hi, Math.ceil(n))); }
function attrStr(attrs, name) {
  const m = attrs.match(new RegExp(name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))'));
  return m ? (m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : m[4])) : null;
}
function numAttr(attrs, name, fallback) {
  const s = attrStr(attrs, name);
  if (s === null) return fallback;
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : fallback;
}
function styleFill(attrs, inherited) {
  const s = attrStr(attrs, 'style');
  if (s) {
    const m = s.match(/fill\s*:\s*([^;]+)/i);
    if (m) return m[1].trim();
  }
  const f = attrStr(attrs, 'fill');
  return f !== null ? f.trim() : inherited;
}
// Fill color -> black (raises) / white (stays flat) / null (skip).
// Unknown colors default to black so they stay visible.
const NAMED_RGB = {
  black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], lime: [0, 255, 0],
  green: [0, 128, 0], blue: [0, 0, 255], yellow: [255, 255, 0], cyan: [0, 255, 255],
  aqua: [0, 255, 255], magenta: [255, 0, 255], fuchsia: [255, 0, 255],
  gray: [128, 128, 128], grey: [128, 128, 128], silver: [192, 192, 192],
  maroon: [128, 0, 0], olive: [128, 128, 0], navy: [0, 0, 128],
  purple: [128, 0, 128], teal: [0, 128, 128], orange: [255, 165, 0]
};
function rgbIsBlack(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}
function fillIsBlack(fill) {
  if (!fill) return true; // SVG default fill is black
  const f = fill.trim().toLowerCase();
  if (f === 'none' || f === 'transparent') return null;
  let m = f.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return rgbIsBlack(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
  }
  m = f.match(/^rgba?\(([^)]*)\)$/);
  if (m) {
    const parts = m[1].split(',').map(function (s) { return s.trim(); });
    const ch = function (s, max) {
      if (s.endsWith('%')) return parseFloat(s) / 100 * max;
      return parseFloat(s);
    };
    if (parts.length >= 3) {
      if (parts.length >= 4 && parseFloat(parts[3]) === 0) return null;
      return rgbIsBlack(ch(parts[0], 255), ch(parts[1], 255), ch(parts[2], 255));
    }
    return true;
  }
  if (Object.prototype.hasOwnProperty.call(NAMED_RGB, f)) {
    const c = NAMED_RGB[f];
    return rgbIsBlack(c[0], c[1], c[2]);
  }
  return true;
}
function matMul(m1, m2) {
  const a1 = m1[0], b1 = m1[1], c1 = m1[2], d1 = m1[3], e1 = m1[4], f1 = m1[5];
  const a2 = m2[0], b2 = m2[1], c2 = m2[2], d2 = m2[3], e2 = m2[4], f2 = m2[5];
  return [a1*a2 + c1*b2, b1*a2 + d1*b2, a1*c2 + c1*d2, b1*c2 + d1*d2, a1*e2 + c1*f2 + e1, b1*e2 + d1*f2 + f1];
}
function parseTransform(str) {
  let m = [1, 0, 0, 1, 0, 0];
  if (!str) return m;
  const re = /(translate|scale|rotate|matrix|skewX|skewY)\s*\(([^)]*)\)/g;
  let t;
  while ((t = re.exec(str))) {
    const args = t[2].trim().split(/[\s,]+/).filter(function (s) { return s.length; }).map(Number).filter(Number.isFinite);
    let mi = null;
    if (t[1] === 'translate' && args.length >= 1) mi = [1, 0, 0, 1, args[0], args.length > 1 ? args[1] : 0];
    else if (t[1] === 'scale' && args.length >= 1) mi = [args[0], 0, 0, args.length > 1 ? args[1] : args[0], 0, 0];
    else if (t[1] === 'rotate' && args.length >= 1) {
      const a = args[0] * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      mi = [c, s, -s, c, 0, 0];
      if (args.length >= 3) mi = matMul([1, 0, 0, 1, args[1], args[2]], matMul(mi, [1, 0, 0, 1, -args[1], -args[2]]));
    }
    else if (t[1] === 'matrix' && args.length >= 6) mi = args.slice(0, 6);
    else if (t[1] === 'skewX' && args.length >= 1) mi = [1, 0, Math.tan(args[0] * Math.PI / 180), 1, 0, 0];
    else if (t[1] === 'skewY' && args.length >= 1) mi = [1, Math.tan(args[0] * Math.PI / 180), 0, 1, 0, 0];
    if (mi) m = matMul(m, mi);
  }
  return m;
}
function xformPts(pts, m) {
  return pts.map(function (p) { return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]; });
}
function arcCenter(x0, y0, rx, ry, phiDeg, laf, sf, x1, y1) {
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (!(rx > 0) || !(ry > 0)) return null;
  const phi = phiDeg * Math.PI / 180, cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (x0 - x1) / 2, dy = (y0 - y1) / 2;
  const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  let lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry);
  if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const f = Math.sqrt(Math.max(0, den > 0 ? num / den : 0)) * ((laf === sf) ? -1 : 1);
  const cxp = f * rx * y1p / ry, cyp = -f * ry * x1p / rx;
  const cx = cp * cxp - sp * cyp + (x0 + x1) / 2, cy = sp * cxp + cp * cyp + (y0 + y1) / 2;
  const ang = function (ux, uy, vx, vy) {
    const d = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = d > 0 ? Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / d))) : 0;
    if (ux * vy - uy * vx < 0) a = -a;
    return a * 180 / Math.PI;
  };
  const t0 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sf && dt > 0) dt -= 360;
  if (sf && dt < 0) dt += 360;
  return { cx: cx, cy: cy, rx: rx, ry: ry, phi: phiDeg, t0: t0, dt: dt };
}
function flattenPathD(d) {
  const toks = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) || [];
  const subs = [];
  let cur = null, start = null;
  let x = 0, y = 0, cmd = null, pcx = null, pcy = null, pqx = null, pqy = null;
  const need = { L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };
  const begin = function (nx, ny) {
    if (cur && cur.length > 1) subs.push(cur);
    cur = [[nx, ny]]; start = [nx, ny]; x = nx; y = ny;
  };
  const line = function (nx, ny) { if (!cur) begin(x, y); cur.push([nx, ny]); x = nx; y = ny; };
  let i = 0;
  const arg = function () { return parseFloat(toks[i++]); };
  const isCmd = function (s) { return !!s && /[MmLlHhVvCcSsQqTtAaZz]/.test(s); };
  while (i < toks.length) {
    if (isCmd(toks[i])) cmd = toks[i++];
    if (!cmd) { i++; continue; }
    const up = cmd.toUpperCase(), rel = cmd !== up;
    if (up === 'Z') {
      if (cur && start) { cur.push([start[0], start[1]]); x = start[0]; y = start[1]; }
      pcx = pcy = pqx = pqy = null; cmd = null; continue;
    }
    if (up === 'M') {
      if (i + 1 >= toks.length || isCmd(toks[i]) || isCmd(toks[i + 1])) { cmd = null; continue; }
      begin(arg() + (rel ? x : 0), arg() + (rel ? y : 0));
      pcx = pcy = pqx = pqy = null;
      cmd = rel ? 'l' : 'L'; continue;
    }
    const n = need[up] || 0;
    if (!n) { cmd = null; continue; }
    let advanced = false;
    while (i < toks.length && !isCmd(toks[i])) {
      if (toks.length - i < n) break;
      if (up === 'L') line(arg() + (rel ? x : 0), arg() + (rel ? y : 0));
      else if (up === 'H') line(arg() + (rel ? x : 0), y);
      else if (up === 'V') line(x, arg() + (rel ? y : 0));
      else if (up === 'C' || up === 'S') {
        let c1;
        if (up === 'C') c1 = [arg() + (rel ? x : 0), arg() + (rel ? y : 0)];
        else c1 = (pcx === null) ? [x, y] : [2 * x - pcx, 2 * y - pcy];
        const c2 = [arg() + (rel ? x : 0), arg() + (rel ? y : 0)];
        const p3 = [arg() + (rel ? x : 0), arg() + (rel ? y : 0)];
        const est = Math.hypot(c1[0] - x, c1[1] - y) + Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) + Math.hypot(p3[0] - c2[0], p3[1] - c2[1]);
        if (!cur) begin(x, y);
        cur.push.apply(cur, sampleCubic([x, y], c1, c2, p3, clampN(est / SEG_MM, 4, 64)));
        x = p3[0]; y = p3[1]; pcx = c2[0]; pcy = c2[1]; pqx = pqy = null;
      }
      else if (up === 'Q' || up === 'T') {
        let c;
        if (up === 'Q') c = [arg() + (rel ? x : 0), arg() + (rel ? y : 0)];
        else c = (pqx === null) ? [x, y] : [2 * x - pqx, 2 * y - pqy];
        const p1 = [arg() + (rel ? x : 0), arg() + (rel ? y : 0)];
        const est = Math.hypot(c[0] - x, c[1] - y) + Math.hypot(p1[0] - c[0], p1[1] - c[1]);
        if (!cur) begin(x, y);
        cur.push.apply(cur, sampleQuad([x, y], c, p1, clampN(est / SEG_MM, 3, 48)));
        x = p1[0]; y = p1[1]; pqx = c[0]; pqy = c[1]; pcx = pcy = null;
      }
      else if (up === 'A') {
        const rx = arg(), ry = arg(), phi = arg(), laf = arg(), sf = arg();
        const p1 = [arg() + (rel ? x : 0), arg() + (rel ? y : 0)];
        const ac = arcCenter(x, y, rx, ry, phi, laf, sf, p1[0], p1[1]);
        if (!cur) begin(x, y);
        if (ac) {
          const k = clampN(Math.abs(ac.dt) * Math.PI / 180 * Math.max(ac.rx, ac.ry) / SEG_MM, 4, 128);
          const ph = ac.phi * Math.PI / 180, cph = Math.cos(ph), sph = Math.sin(ph);
          for (let j = 1; j <= k; j++) {
            const a = (ac.t0 + ac.dt * j / k) * Math.PI / 180;
            const ex = ac.rx * Math.cos(a), ey = ac.ry * Math.sin(a);
            cur.push([ac.cx + ex * cph - ey * sph, ac.cy + ex * sph + ey * cph]);
          }
        } else cur.push([p1[0], p1[1]]);
        x = p1[0]; y = p1[1]; pcx = pcy = pqx = pqy = null;
      }
      advanced = true;
    }
    if (!advanced) { i++; cmd = null; }
  }
  if (cur && cur.length > 1) subs.push(cur);
  return subs.map(normLoop).filter(function (s) { return s.length >= 3 && Math.abs(signedArea(s)) > 1e-9; });
}
function parsePointsAttr(s) {
  const nums = (s.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) || []).map(Number).filter(Number.isFinite);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts;
}
// All filled loops of the artwork in SVG user units, with the root viewBox
// and physical size. Strokes, <text>, <use>, raster <image>: counted, skipped.
function extractArt(svgText) {
  const loops = [];
  const skipped = { text: 0, use: 0, image: 0, stroke: 0, empty: 0 };
  let vb = null, widthMM = null, heightMM = null, rootSeen = false;
  const stack = [{ m: [1, 0, 0, 1, 0, 0], fill: 'black' }];
  const tagRe = /<(\/?)(svg|g|rect|circle|ellipse|line|polyline|polygon|path|text|use|image)\b([^<>]*)(\/?)>/g;
  let tm;
  while ((tm = tagRe.exec(svgText))) {
    const closing = tm[1] === '/', name = tm[2], attrs = tm[3] || '', selfClose = tm[4] === '/';
    if (closing) {
      if ((name === 'g' || name === 'svg') && stack.length > 1) stack.pop();
      continue;
    }
    if (name === 'svg' && !rootSeen) {
      rootSeen = true;
      const vbs = attrStr(attrs, 'viewBox');
      if (vbs) {
        const p = vbs.trim().split(/[\s,]+/).map(Number);
        if (p.length === 4 && p.every(Number.isFinite) && p[2] > 0 && p[3] > 0) vb = p;
      }
      widthMM = parseSVGLength(attrStr(attrs, 'width'));
      heightMM = parseSVGLength(attrStr(attrs, 'height'));
      stack.push({ m: stack[stack.length - 1].m.slice(), fill: styleFill(attrs, stack[stack.length - 1].fill) });
      if (selfClose && stack.length > 1) stack.pop();
      continue;
    }
    if (name === 'g') {
      const top = stack[stack.length - 1];
      stack.push({ m: matMul(top.m, parseTransform(attrStr(attrs, 'transform'))), fill: styleFill(attrs, top.fill) });
      if (selfClose && stack.length > 1) stack.pop();
      continue;
    }
    const top = stack[stack.length - 1];
    const m = matMul(top.m, parseTransform(attrStr(attrs, 'transform')));
    const fill = styleFill(attrs, top.fill);
    if (name === 'text') { skipped.text++; continue; }
    if (name === 'use') { skipped.use++; continue; }
    if (name === 'image') { skipped.image++; continue; }
    if (name === 'line') { skipped.stroke++; continue; }
    const fb = fillIsBlack(fill);
    if (fb === null) { skipped.empty++; continue; }
    let local = [];
    if (name === 'rect') {
      const x = numAttr(attrs, 'x', 0), y = numAttr(attrs, 'y', 0);
      const w = numAttr(attrs, 'width', 0), h = numAttr(attrs, 'height', 0);
      if (!(w > 0) || !(h > 0)) { skipped.empty++; continue; }
      local = [roundedRectLoop(x, y, w, h, numAttr(attrs, 'rx', numAttr(attrs, 'ry', 0)), numAttr(attrs, 'ry', numAttr(attrs, 'rx', 0)))];
    }
    else if (name === 'circle') {
      const r = numAttr(attrs, 'r', 0);
      if (!(r > 0)) { skipped.empty++; continue; }
      const cx = numAttr(attrs, 'cx', 0), cy = numAttr(attrs, 'cy', 0);
      const k = clampN(2 * Math.PI * r / SEG_MM, 16, 160);
      const ring = [];
      for (let j = 0; j < k; j++) { const a = 2 * Math.PI * j / k; ring.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
      local = [ring];
    }
    else if (name === 'ellipse') {
      const rx = numAttr(attrs, 'rx', 0), ry = numAttr(attrs, 'ry', 0);
      if (!(rx > 0) || !(ry > 0)) { skipped.empty++; continue; }
      const cx = numAttr(attrs, 'cx', 0), cy = numAttr(attrs, 'cy', 0);
      const k = clampN(2 * Math.PI * Math.max(rx, ry) / SEG_MM, 16, 160);
      const ring = [];
      for (let j = 0; j < k; j++) { const a = 2 * Math.PI * j / k; ring.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
      local = [ring];
    }
    else if (name === 'polygon' || name === 'polyline') {
      const pts = parsePointsAttr(attrStr(attrs, 'points') || '');
      if (pts.length < 3) { skipped.empty++; continue; }
      local = [normLoop(pts)];
    }
    else if (name === 'path') {
      const dd = attrStr(attrs, 'd');
      if (!dd) { skipped.empty++; continue; }
      local = flattenPathD(dd);
    }
    for (const lp of local) {
      const wp = normLoop(xformPts(lp, m));
      if (wp.length >= 3 && Math.abs(signedArea(wp)) > 1e-9) loops.push({ pts: wp, black: fb });
    }
  }
  return { loops: loops, skipped: skipped, vb: vb, widthMM: widthMM, heightMM: heightMM };
}

// ---------- loops -> solid pieces (even-odd holes) ----------
function loopKey(lp) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of lp) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  return lp.length + ':' + Math.abs(signedArea(lp)).toFixed(3) + ':' + x0.toFixed(3) + ',' + y0.toFixed(3) + ',' + x1.toFixed(3) + ',' + y1.toFixed(3);
}
// Dedupe keeping the first entry (color flag included).
function dedupeObjLoops(entries) {
  const seen = new Set(), out = [];
  for (const e of entries) {
    const key = e.black + ':' + loopKey(e.pts);
    if (!seen.has(key)) { seen.add(key); out.push(e); }
  }
  return out;
}
function loopBBox(lp) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of lp) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  return { x0: x0, y0: y0, x1: x1, y1: y1 };
}
function bboxStrictlyInside(a, b) {
  const e = 1e-7; // touching edges do NOT count: shared borders bridge badly
  return a.x0 > b.x0 + e && a.y0 > b.y0 + e && a.x1 < b.x1 - e && a.y1 < b.y1 - e;
}
function bboxOverlap(a, b) {
  return !(a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0);
}
// Intersection point of two properly crossing segments (+ edge params).
function segXPoint(p1, p2, p3, p4) {
  const dx1 = p2[0] - p1[0], dy1 = p2[1] - p1[1];
  const dx2 = p4[0] - p3[0], dy2 = p4[1] - p3[1];
  const d = dx1 * dy2 - dy1 * dx2;
  const ta = ((p3[0] - p1[0]) * dy2 - (p3[1] - p1[1]) * dx2) / d;
  return [p1[0] + ta * dx1, p1[1] + ta * dy1, ta];
}
// Union of two same-orientation simple loops (Greiner-Hormann over proper
// crossings only). B is deterministically jittered so touches resolve into
// micro-overlaps or clean gaps. Returns merged loops, or null when the pair
// does not properly cross (disjoint or nested -> keep as is).
function ghUnion(A, B) {
  return ghUnionShifted(A, B, 1e-7, 3e-7) || ghUnionShifted(A, B, -2e-7, 1e-7) || ghUnionShifted(A, B, 3e-7, -1e-7) || null;
}
// Union attempt with B shifted by (jx, jy): exact touches resolve into
// micro-overlaps (merged) or micro-gaps (kept separate, both bridgeable).
// Returns merged loops, or null when the pair does not properly cross.
function ghUnionShifted(A, B, jx, jy) {
  const Bj = B.map(function (p) { return [p[0] + jx, p[1] + jy]; });
  const nA = A.length, nB = Bj.length;
  const xA = [], xB = [];
  for (let i = 0; i < nA; i++) xA.push([]);
  for (let j = 0; j < nB; j++) xB.push([]);
  for (let i = 0; i < nA; i++) {
    const a1 = A[i], a2 = A[(i + 1) % nA];
    for (let j = 0; j < nB; j++) {
      const b1 = Bj[j], b2 = Bj[(j + 1) % nB];
      if (!segProperInt(a1, a2, b1, b2)) continue;
      const cr = segXPoint(a1, a2, b1, b2);
      const P = [cr[0], cr[1]];
      const ux = b2[0] - b1[0], uy = b2[1] - b1[1];
      const tb = ((P[0] - b1[0]) * ux + (P[1] - b1[1]) * uy) / (ux * ux + uy * uy);
      const ca = { t: cr[2], P: P, used: false, twin: null };
      const cb = { t: tb, P: P, used: false, twin: ca };
      ca.twin = cb;
      xA[i].push(ca); xB[j].push(cb);
    }
  }
  for (const l of xA) l.sort(function (p, q) { return p.t - q.t; });
  for (const l of xB) l.sort(function (p, q) { return p.t - q.t; });
  const nAaug = [], nBaug = [];
  for (let i = 0; i < nA; i++) { nAaug.push({ p: A[i], cross: null }); for (const c of xA[i]) { c.aIdx = nAaug.length; nAaug.push({ p: c.P, cross: c }); } }
  for (let j = 0; j < nB; j++) { nBaug.push({ p: Bj[j], cross: null }); for (const c of xB[j]) { c.bIdx = nBaug.length; nBaug.push({ p: c.P, cross: c }); } }
  // Strictly-inside test for a point just off a boundary: midpoints of
  // boundary-hugging segments are unreliable, so step slightly along.
  const goesInside = function (from, to, lp) {
    const dx = to[0] - from[0], dy = to[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    const t = 1e-7;
    return pointInPoly(from[0] + dx / len * t, from[1] + dy / len * t, lp);
  };
  const result = [];
  const starts = [];
  for (const l of xA) for (const c of l) starts.push(c);
  for (const st of starts) {
    if (st.used) continue;
    st.used = true; st.twin.used = true;
    // leave along an exterior half-edge (exactly two border it; either traces the same cycle)
    const candW = [
      ['A', st.aIdx, 1], ['A', st.aIdx, -1],
      ['B', st.twin.bIdx, 1], ['B', st.twin.bIdx, -1]
    ];
    let w = 'A', idx = st.aIdx, dir = 1, ok = false;
    for (const cand of candW) {
      const cw = cand[0], ci = cand[1], cd = cand[2];
      const nodes = cw === 'A' ? nAaug : nBaug;
      const nx = nodes[(ci + cd + nodes.length) % nodes.length];
      if (samePt(nx.p, st.P)) continue;
      const other = cw === 'A' ? Bj : A;
      if (!goesInside(st.P, nx.p, other)) { w = cw; idx = ci; dir = cd; ok = true; break; }
    }
    if (!ok) continue;
    const cyc = [st.P.slice()];
    let prev = st.P;
    let guard = 4 * (nAaug.length + nBaug.length) + 4;
    while (guard-- > 0) {
      const nodes = w === 'A' ? nAaug : nBaug;
      const ni = (idx + dir + nodes.length) % nodes.length;
      const nd = nodes[ni];
      if (samePt(nd.p, prev)) { idx = ni; continue; }
      cyc.push(nd.p.slice());
      prev = nd.p;
      if (nd.cross && nd.cross.used) break;
      if (nd.cross) {
        nd.cross.used = true; nd.cross.twin.used = true;
        const tw = nd.cross.twin;
        w = (w === 'A') ? 'B' : 'A';
        const tn = w === 'A' ? nAaug : nBaug;
        const ti = (w === 'A') ? tw.aIdx : tw.bIdx;
        const back = w === 'A' ? Bj : A;
        const fw = tn[(ti + 1) % tn.length], bw = tn[(ti - 1 + tn.length) % tn.length];
        const fwOut = !samePt(fw.p, prev) && !goesInside(prev, fw.p, back);
        if (fwOut) { idx = ti; dir = 1; }
        else { idx = ti; dir = -1; }
        continue;
      }
      idx = ni;
    }
    const loop = normLoop(cyc);
    if (loop.length >= 3 && Math.abs(signedArea(loop)) > 1e-9) {
      if (signedArea(loop) < 0) loop.reverse();
      result.push(loop);
    }
  }
  return result.length ? result : null;
}
// Merge every overlapping/touching pair (fixpoint). Nested and disjoint
// loops pass through untouched with exact coordinates.
function unionAll(loops) {
  const work = loops.slice();
  let changed = true;
  let guard = work.length * work.length + 2;
  while (changed && guard-- > 0) {
    changed = false;
    for (let i = 0; i < work.length && !changed; i++) {
      for (let j = i + 1; j < work.length && !changed; j++) {
        if (!bboxOverlap(loopBBox(work[i]), loopBBox(work[j]))) continue;
        const u = ghUnion(work[i], work[j]);
        if (u) { work.splice(j, 1); work.splice(i, 1, ...u); changed = true; }
      }
    }
  }
  return work;
}
function loopsToPieces(loops) {
  const n = loops.length, areas = loops.map(function (lp) { return Math.abs(signedArea(lp)); });
  const boxes = loops.map(loopBBox);
  const order = loops.map(function (_, i) { return i; }).sort(function (x, y) { return areas[y] - areas[x]; });
  const parent = new Array(n).fill(-1), depth = new Array(n).fill(0);
  for (const i of order) {
    let best = -1, bestArea = Infinity;
    for (const j of order) {
      if (i === j || areas[j] < areas[i] - 1e-9) continue;
      if (Math.abs(areas[j] - areas[i]) <= 1e-9 && j > i) continue; // identical twins: no containment
      if (!bboxStrictlyInside(boxes[i], boxes[j])) continue;
      if (!pointInPoly(loops[i][0][0], loops[i][0][1], loops[j])) continue;
      if (areas[j] < bestArea) { bestArea = areas[j]; best = j; }
    }
    parent[i] = best;
    depth[i] = best < 0 ? 0 : depth[best] + 1;
  }
  const pieces = [];
  const byOuter = new Map();
  for (let i = 0; i < n; i++) {
    if (depth[i] % 2 === 0) { byOuter.set(i, { outer: loops[i], holes: [] }); pieces.push(byOuter.get(i)); }
  }
  for (let i = 0; i < n; i++) {
    if (depth[i] % 2 === 1) {
      const pc = byOuter.get(parent[i]);
      if (pc) pc.holes.push(loops[i]);
      else { byOuter.set(i, { outer: loops[i], holes: [] }); pieces.push(byOuter.get(i)); }
    }
  }
  return pieces;
}

// ---------- mesh: flat base plate + raised shapes ----------
const SVG_UNIT_TO_MM = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6, px: 25.4 / 96, '': 25.4 / 96 };
function parseSVGLength(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^([\d.eE+-]+)\s*([a-z%]*)$/i);
  if (!m) return null;
  const unit = m[2].toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(SVG_UNIT_TO_MM, unit)) return null;
  return parseFloat(m[1]) * SVG_UNIT_TO_MM[unit];
}
function cardMesh(svgText, params) {
  const W = params.width, H = params.height, base = params.base, emb = params.emboss;
  const art = extractArt(svgText);
  if (!art.loops.length) throw new Error('No filled shapes found — nothing to raise. (<text> needs converting to outlines.)');
  let vx = 0, vy = 0, vbw = art.widthMM || W, vbh = art.heightMM || H;
  if (art.vb) { vx = art.vb[0]; vy = art.vb[1]; vbw = art.vb[2]; vbh = art.vb[3]; }
  if (!(vbw > 0) || !(vbh > 0)) throw new Error('SVG has no usable size.');
  const s = Math.min(W / vbw, H / vbh); // uniform fit, centered: as in the SVG
  const ox = (W - vbw * s) / 2 - vx * s, oy = (H - vbh * s) / 2 - vy * s;
  // One pipeline: mirror flips the geometry, then black loops rise
  // and the rest stays flat — or, with invert, black stays down and
  // everything else rises. Overlapping black shapes are separate
  // solids in normal mode (the slicer unions them) and get merged
  // into the background cutout in invert mode.
  let mapped = art.loops
    .map(function (entry) {
      return {
        pts: normLoop(entry.pts.map(function (p) { return [ox + p[0] * s, oy + p[1] * s]; })),
        black: entry.black
      };
    })
    .filter(function (entry) { return entry.pts.length >= 3 && Math.abs(signedArea(entry.pts)) > 1e-9; });
  if (params.mirror) mapped = mapped.map(function (entry) {
    return { pts: entry.pts.map(function (p) { return [W - p[0], p[1]]; }).reverse(), black: entry.black };
  });
  mapped = dedupeObjLoops(mapped);
  const black = mapped.filter(function (entry) { return entry.black; }).map(function (entry) { return entry.pts; });
  let solids;
  if (!params.invert) {
    solids = loopsToPieces(black);
  } else {
    const cardBox = { x0: 0, y0: 0, x1: W, y1: H };
    const merged = unionAll(black);
    // Nudge boundary-touching vertices slightly inward: shared borders
    // bridge badly, and 1e-6 mm is invisible. Loops fully outside the
    // card still stay down.
    const pull = function (lp) {
      return lp.map(function (p) {
        let x = p[0], y = p[1];
        if (Math.abs(x) < 1e-6) x = 1e-6; else if (Math.abs(x - W) < 1e-6) x = W - 1e-6;
        if (Math.abs(y) < 1e-6) y = 1e-6; else if (Math.abs(y - H) < 1e-6) y = H - 1e-6;
        return [x, y];
      });
    };
    const holes = merged.map(pull).filter(function (lp) { return bboxStrictlyInside(loopBBox(lp), cardBox); });
    // Fully covered by black -> flat plate, no relief.
    const inBlack = function (px, py) {
      let c = 0;
      for (const lp of merged) if (pointInPoly(px, py, lp)) c++;
      return c % 2 === 1;
    };
    let bg = false;
    for (let gx = 0; gx < 5 && !bg; gx++) {
      for (let gy = 0; gy < 5 && !bg; gy++) {
        if (!inBlack((gx + 0.5) * W / 5, (gy + 0.5) * H / 5)) bg = true;
      }
    }
    solids = bg ? loopsToPieces([rectPoly(0, 0, W, H)].concat(holes)) : [];
  }
  if (!art.loops.length) throw new Error('No filled shapes found — nothing to raise. (<text> needs converting to outlines.)');
  // SVG y grows down, mesh y grows up: flip, then reverse to keep the
  // foldbox winding convention (outward normals, positive volume).
  const flip = function (lp) { return lp.map(function (p) { return [p[0], H - p[1]]; }).reverse(); };
  const pieces = [], broken = [];
  const bp = prismPiece(rectPoly(0, 0, W, H), [], 0, base);
  if (bp.broken || !bp.v.length) broken.push('base');
  else pieces.push({ id: 'base', v: bp.v, t: bp.t });
  solids.forEach(function (sd, k) {
    const pr = prismPiece(flip(sd.outer), sd.holes.map(flip), base, base + emb);
    if (pr.broken || !pr.v.length) { broken.push('relief-' + k); return; }
    pieces.push({ id: 'relief-' + k, v: pr.v, t: pr.t });
  });
  let tris = 0;
  for (const pc of pieces) tris += pc.t.length;
  return { pieces: pieces, broken: broken, stats: { loops: mapped.length, solids: solids.length, tris: tris }, skipped: art.skipped,
    preview: solids.map(function (sd) { return { outer: sd.outer, holes: sd.holes }; }) };
}

// ---------- multi-object 3MF package ----------
function crc32(u8) {
  let tbl = crc32.t;
  if (!tbl) {
    tbl = crc32.t = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      tbl[i] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < u8.length; i++) c = tbl[(c ^ u8[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function buildZipStored(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = (typeof f.data === 'string') ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0, true);
    lh.setUint16(8, 0, true); lh.setUint16(10, 0x21, true); lh.setUint16(12, 0x3c, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
    lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
    ch.setUint16(8, 0, true); ch.setUint16(10, 0, true); ch.setUint16(12, 0x21, true); ch.setUint16(14, 0x3c, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
    ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const centralSize = central.reduce(function (a, b) { return a + b.length; }, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true); end.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + 22);
  let o = 0;
  const chunks = parts.concat(central, [new Uint8Array(end.buffer)]);
  for (const b of chunks) { out.set(b, o); o += b.length; }
  return out;
}
function modelXML(pieces) {
  let s = '<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n <resources>\n';
  pieces.forEach(function (pc, i) {
    s += '  <object id="' + (i + 1) + '" type="model" name="card-' + pc.id + '">\n   <mesh>\n    <vertices>\n';
    for (const p of pc.v) s += '     <vertex x="' + p[0].toFixed(3) + '" y="' + p[1].toFixed(3) + '" z="' + p[2].toFixed(3) + '" />\n';
    s += '    </vertices>\n    <triangles>\n';
    for (const tr of pc.t) s += '     <triangle v1="' + tr[0] + '" v2="' + tr[1] + '" v3="' + tr[2] + '" />\n';
    s += '    </triangles>\n   </mesh>\n  </object>\n';
  });
  s += ' </resources>\n <build>\n';
  pieces.forEach(function (pc, i) { s += '  <item objectid="' + (i + 1) + '" />\n'; });
  s += ' </build>\n</model>\n';
  return s;
}
const RELS_XML = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" /></Relationships>';
const TYPES_XML = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" /><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" /></Types>';
function card3MF(svgText, params) {
  const mesh = cardMesh(svgText, params);
  if (mesh.broken.length) throw new Error('Broken pieces: ' + mesh.broken.join(', '));
  const enc = new TextEncoder();
  return buildZipStored([
    { name: '3D/3dmodel.model', data: enc.encode(modelXML(mesh.pieces)) },
    { name: '_rels/.rels', data: enc.encode(RELS_XML) },
    { name: '[Content_Types].xml', data: enc.encode(TYPES_XML) }
  ]);
}

// ---------- page wiring ----------
const el = function (id) { return document.getElementById(id); };
let svgText = null, svgName = null;
// 3MF name follows the SVG: stem + mirror flag (m) or normal (n)
// + invert flag (i) or normal (n), e.g. art-m-i.3mf.
function embossFileName(svgFileName, params) {
  const stem = String(svgFileName || 'card-emboss').replace(/\.svg$/i, '') || 'card-emboss';
  return stem + '-' + (params.mirror ? 'm' : 'n') + '-' + (params.invert ? 'i' : 'n') + '.3mf';
}
function setStatus(text, isErr) {
  el('statusMsg').textContent = text;
  el('statusMsg').classList.toggle('err', !!isErr);
}
function readParams() {
  const width = parseFloat(el('cardWidth').value);
  const height = parseFloat(el('cardHeight').value);
  const base = parseFloat(el('baseThick').value);
  const emboss = parseFloat(el('embossThick').value);
  for (const pair of [['Width', width], ['Height', height], ['Base', base], ['Relief', emboss]]) {
    if (!Number.isFinite(pair[1]) || !(pair[1] > 0)) throw new Error(pair[0] + ' must be a positive number.');
  }
  return { width: width, height: height, base: base, emboss: emboss,
    mirror: el('mirror').checked, invert: el('invert').checked };
}
function autoSize() {
  if (!svgText) return;
  const art = extractArt(svgText);
  const round1 = function (n) { return Math.round(n * 10) / 10; };
  if (art.widthMM && art.heightMM) {
    el('cardWidth').value = round1(art.widthMM);
    el('cardHeight').value = round1(art.heightMM);
  } else if (art.vb) {
    const w = parseFloat(el('cardWidth').value) || 85;
    el('cardHeight').value = round1(w * art.vb[3] / art.vb[2]);
  }
}
function generate() {
  if (!svgText) return false;
  try {
    setStatus('Generating…');
    const params = readParams();
    const mesh = cardMesh(svgText, params);
    if (mesh.broken.length) throw new Error('Broken pieces: ' + mesh.broken.join(', '));
    drawPreview(params, mesh.preview);
    el('statShapes').textContent = String(mesh.stats.solids);
    el('statTris').textContent = mesh.stats.tris.toLocaleString('en-US');
    const bytes = 2048 + mesh.stats.tris * 70;
    el('statSize').textContent = bytes > 1e6 ? (bytes / 1e6).toFixed(1) + ' MB' : Math.round(bytes / 1e3) + ' KB';
    const sk = [];
    if (mesh.skipped.text) sk.push(mesh.skipped.text + ' <text> (convert to outlines)');
    if (mesh.skipped.use) sk.push(mesh.skipped.use + ' <use>');
    if (mesh.skipped.image) sk.push(mesh.skipped.image + ' <image>');
    setStatus((mesh.stats.solids ? 'Ready.' : 'Ready — nothing to raise.') + (sk.length ? ' Skipped: ' + sk.join(', ') + '.' : ''));
    el('downloadBtn').disabled = false;
    return true;
  } catch (err) {
    setStatus('Error: ' + err.message, true);
    return false;
  }
}
function drawPreview(params, solids) {
  const cv = el('artPreview');
  const W = Math.max(40, Math.round(400 * params.height / params.width));
  cv.width = 400; cv.height = W;
  const ctx = cv.getContext('2d');
  const k = cv.width / params.width;
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(0, 0, cv.width, cv.height);
  for (const sd of solids) {
    ctx.beginPath();
    const trace = function (lp) {
      lp.forEach(function (p, i) {
        const x = p[0] * k, y = p[1] * k;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.closePath();
    };
    trace(sd.outer);
    for (const h of sd.holes) trace(h);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill('evenodd');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
function download3MF() {
  if (!svgText) return;
  try {
    const params = readParams();
    const blob = new Blob([card3MF(svgText, params)], { type: 'model/3mf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = embossFileName(svgName, params);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  } catch (err) {
    setStatus('Error: ' + err.message, true);
  }
}
el('svgFile').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;
  el('fileLabel').textContent = file.name;
  svgName = file.name;
  const rd = new FileReader();
  rd.onload = function () {
    svgText = String(rd.result);
    try {
      autoSize();
      el('paramsPanel').style.display = '';
      el('previewPanel').style.display = '';
      generate();
    } catch (err) {
      setStatus('Could not load the SVG file.', true);
    }
  };
  rd.readAsText(file);
});
el('downloadBtn').addEventListener('click', download3MF);
['cardWidth', 'cardHeight', 'baseThick', 'embossThick', 'mirror', 'invert'].forEach(function (id) {
  el(id).addEventListener('change', generate);
});

