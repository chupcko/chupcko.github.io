let MESH_PARTS = [];
function rect(id, x, y, w, h, stroke) {
  MESH_PARTS.push({ id, poly: rectPoly(x, y, w, h), holes: [] });
  return `<rect id="${id}" x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${stroke}" stroke-width="0.1"/>`;
}
// Green fold strip as a grooved solid (V like folding box multi size.3mf,
// but 0.5*T deep): groove from the top over the full strip width, apex
// centered at 0.5*T (0.5*T membrane left). SVG stays a plain green rectangle.
function grooveSolid(x, y, w, h, T) {
  const alongX = w >= h;
  const L = alongX ? w : h;
  if (!(T > 0) || !(L > 0)) return { v: [], t: [], caps: 0 };
  const ax = T / 2, apex = 0.5 * T;
  const prof = [[-ax, 0], [ax, 0], [ax, T], [0, apex], [-ax, T]]; // CCW in (u,z)
  const P = (u, vv, z) => alongX ? [x + vv, y + ax - u, z] : [x + ax + u, y + vv, z];
  const v = [];
  for (let e = 0; e <= 1; e++) for (const [u, z] of prof) v.push(P(u, e * L, z));
  const t = [];
  // Sides per profile edge P->Q (CCW): (P0,Q1,Q0),(P0,P1,Q1), outward.
  const edge = (p, q) => { t.push([p, q + 5, q], [p, p + 5, q + 5]); };
  // V walls first (smoke counts them as caps: they project to the footprint).
  edge(2, 3); edge(3, 4); // C->D, D->E
  edge(0, 1); // bottom A->B (outward -z)
  edge(1, 2); // right wall B->C (outward +u)
  edge(4, 0); // left wall E->A (outward -u)
  // End caps: near ring as-clipped (CCW), far ring reversed.
  const clip = clipEars(prof);
  if (clip.rest !== 0 && clip.rest !== 3) return { v: [], t: [], caps: 0, broken: true };
  for (const [a, b, c] of clip.tris) t.push([a, b, c]);
  for (const [a, b, c] of clip.tris) t.push([5 + a, 5 + c, 5 + b]);
  return { v, t, caps: 4 };
}
function greenFlap(id, x, y, w, h, T) {
  MESH_PARTS.push({ id, flap: [x, y, w, h, T] });
  return `<rect id="${id}" x="${x}" y="${y}" width="${w}" height="${h}" fill="blue" stroke="none"/>`;
}

// ---- shared 2D geometry: single source for SVG paths and 3MF mesh ----
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
function polyPath(pts, f) {
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${f(pts[i][0])} ${f(pts[i][1])}`;
  return d + ` Z`;
}
function rectPoly(x, y, w, h) {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
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
// Square with two rounded corners on the outer side (samples the old arcs).
function outerSquarePoly(x, y, s, r, side) {
  r = Math.min(r, s / 2);
  if (!(r > 0)) return rectPoly(x, y, s, s);
  const n = Math.max(4, Math.ceil(1.6 * r)); // denser arcs for big radii
  const pts = [];
  if (side === "left") {
    pts.push([x + r, y], [x + s, y], [x + s, y + s], [x + r, y + s]);
    pts.push(...sampleArcPts(x + r, y + s - r, r, 90, 180, n));
    pts.push([x, y + r]);
    pts.push(...sampleArcPts(x + r, y + r, r, 180, 270, n));
  } else {
    pts.push([x, y], [x + s - r, y]);
    pts.push(...sampleArcPts(x + s - r, y + r, r, 270, 360, n));
    pts.push([x + s, y + s - r]);
    pts.push(...sampleArcPts(x + s - r, y + s - r, r, 0, 90, n));
    pts.push([x, y + s]);
  }
  return pts;
}
function outerSquare(id, x, y, s, r, side) {
  const pts = outerSquarePoly(x, y, s, r, side);
  if (!(Math.min(r, s / 2) > 0)) return rect(id, x, y, s, s, "black");
  const mpts = pts.slice();
  if (signedArea(mpts) < 0) mpts.reverse();
  MESH_PARTS.push({ id, poly: mpts, holes: [] });
  return `<path id="${id}" d="${polyPath(pts, String)}" fill="none" stroke="black" stroke-width="0.1"/>`;
}
// Smile slot loop (U band), absolute mm. Center (scx, sTop+6.25), outer r=6.25.
function smileLoopAbs(scx, sTop) {
  const loop = [[scx - 6.25, sTop]];
  loop.push(...sampleArcPts(scx, sTop, 6.25, 180, 0, 16));
  loop.push([scx + 6, sTop]);
  loop.push(...sampleArcPts(scx, sTop, 6, 0, 180, 16));
  return loop;
}
// Rounded-slot loop, absolute mm. Center (cx, cy), size w*h, corner r.
function roundRectLoop(cx, cy, w, h, r) {
  const x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2;
  const loop = [[x0 + r, y0], [x1 - r, y0]];
  loop.push(...sampleArcPts(x1 - r, y0 + r, r, 270, 360, 4));
  loop.push([x1, y1 - r]);
  loop.push(...sampleArcPts(x1 - r, y1 - r, r, 0, 90, 4));
  loop.push([x0 + r, y1]);
  loop.push(...sampleArcPts(x0 + r, y1 - r, r, 90, 180, 4));
  loop.push([x0, y0 + r]);
  loop.push(...sampleArcPts(x0 + r, y0 + r, r, 180, 270, 4));
  return loop;
}
// Base outline with teeth slots cut as notches on both side edges.
function basePart(id, x, y, w, h, slotW) {
  MESH_PARTS.push({ id, poly: baseNotchPoly(x, y, w, h, slotW), holes: [] });
  return `<rect id="${id}" x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="black" stroke-width="0.1"/>`;
}
// Base outline with teeth slots cut as notches on both side edges.
function baseNotchPoly(x, y, w, h, slotW) {
  const bands = [[0.125, 0.375], [0.625, 0.875]];
  const pts = [[x, y], [x + w, y]];
  for (const [a, b] of bands) {
    const y0 = y + a * h, y1 = y + b * h;
    pts.push([x + w, y0], [x + w - slotW, y0], [x + w - slotW, y1], [x + w, y1]);
  }
  pts.push([x + w, y + h], [x, y + h]);
  for (const [a, b] of [[0.625, 0.875], [0.125, 0.375]]) {
    const y0 = y + a * h, y1 = y + b * h;
    pts.push([x, y1], [x + slotW, y1], [x + slotW, y0], [x, y0]);
  }
  return pts;
}
// Ear-clipping triangulation with hole bridging. Loops must be simple.
function ptInTri(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  // Strict: points on the edge do NOT block an ear. Bridge corridors have
  // zero width, so their vertices lie exactly on candidate ear edges.
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
        // Bridge corridors revisit coordinates (bp twice): a test point
        // coincident with a/b/c is that vertex, not an interior blocker.
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
function bridgeHole(outer, hole) {
  let hi = 0;
  for (let i = 1; i < hole.length; i++) {
    if (hole[i][0] < hole[hi][0] || (hole[i][0] === hole[hi][0] && hole[i][1] < hole[hi][1])) hi = i;
  }
  const hp = hole[hi];
  let bi = -1, bx = -Infinity;
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i], b = outer[(i + 1) % outer.length];
    if (a[1] === b[1]) continue;
    const y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    if (hp[1] < y0 || hp[1] >= y1) continue;
    const x = a[0] + (hp[1] - a[1]) / (b[1] - a[1]) * (b[0] - a[0]);
    if (x < hp[0] && x > bx) { bx = x; bi = i; }
  }
  if (bi < 0) {
    let bd = Infinity;
    for (let i = 0; i < outer.length; i++) {
      const d = (outer[i][0] - hp[0]) ** 2 + (outer[i][1] - hp[1]) ** 2;
      if (d < bd) { bd = d; bi = i; }
    }
    const res = outer.slice(0, bi + 1);
    for (let k = 0; k <= hole.length; k++) res.push(hole[(hi + k) % hole.length]);
    res.push(outer[bi]);
    return res.concat(outer.slice(bi + 1));
  }
  const bp = [bx, hp[1]];
  const res = outer.slice(0, bi + 1).concat([bp]);
  // Close the hole back to hi (len+1 points): the dropped edge hi-1 -> hi
  // would otherwise cut its triangle (bp, hi, hi-1) out of the plate.
  for (let k = 0; k <= hole.length; k++) res.push(hole[(hi + k) % hole.length]);
  res.push(bp);
  return res.concat(outer.slice(bi + 1));
}
function triangulate(outer, holes) {
  let loop = normLoop(outer.slice());
  if (signedArea(loop) < 0) loop.reverse();
  for (const h of holes || []) {
    let hl = normLoop(h.slice());
    if (signedArea(hl) > 0) hl.reverse();
    loop = normLoop(bridgeHole(loop, hl));
  }
  const r = clipEars(loop);
  return { tris: r.tris, rest: r.rest, loop };
}
// Closed prism from a flat loop (CCW) with optional holes. Returns indexed mesh.
function prismPiece(outer, holes, z0, z1) {
  const clean = normLoop(outer.slice());
  if (clean.length < 3 || Math.abs(signedArea(clean)) < 1e-9) return { v: [], t: [] };
  const { tris, rest, loop } = triangulate(clean, holes || []);
  if (rest !== 0 && rest !== 3) return { v: [], t: [], broken: true };
  const n = loop.length, v = [], t = [];
  for (const p of loop) v.push([p[0], p[1], z1]);
  for (const p of loop) v.push([p[0], p[1], z0]);
  // Loop order is CCW in y-down coords = CW seen from +z, so the top
  // cap (z1) takes the reversed triangle and the bottom cap (z0) the
  // original; both normals then point outward. Sides verified outward.
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
// Assemble the full plate: re-run the SVG emitters to collect black loops
// (red loops become holes/notches, green flaps are plate material too),
// prism each from z=0 to z=T so the plate rests on the XY plane.
// Pieces stay separate 3MF objects sharing edges, so every piece is a
// closed manifold solid on its own.
function buildPlateMesh(p) {
  MESH_PARTS = [];
  generateBoxSVG(p);
  const pieces = [];
  let area = 0, capArea = 0;
  const broken = [];
  for (const part of MESH_PARTS) {
    if (part.flap) {
      const [fx, fy, fw, fh, fT] = part.flap;
      const m = grooveSolid(fx, fy, fw, fh, fT);
      if (m.broken) { broken.push(part.id); continue; }
      if (!m.v.length) continue;
      for (let i = 0; i < m.caps; i++) {
        const [a, b, c] = m.t[i];
        capArea += triArea2(m.v[a], m.v[b], m.v[c]);
      }
      pieces.push({ id: part.id, v: m.v, t: m.t });
      area += fw * fh; // V walls project exactly onto the strip footprint
      continue;
    }
    const op = normLoop(part.poly.slice());
    if (signedArea(op) < 0) op.reverse(); // caps assume positive (y-down) order
    const m = prismPiece(op, part.holes, 0, p.thickness);
    if (m.broken) { broken.push(part.id); continue; }
    if (!m.v.length) continue;
    for (let i = 0; i < m.caps; i++) {
      const [a, b, c] = m.t[i];
      capArea += triArea2(m.v[a], m.v[b], m.v[c]);
    }
    pieces.push({ id: part.id, v: m.v, t: m.t });
    area += Math.abs(signedArea(op));
    for (const h of part.holes) area -= Math.abs(signedArea(normLoop(h.slice())));
  }
  return { pieces, area, capArea, broken };
}
function build3MFBytes(p) {
  const mesh = buildPlateMesh(p);
  const enc = new TextEncoder();
  return zipStore([
    { name: "3D/3dmodel.model", data: enc.encode(modelXML(mesh.pieces)) },
    { name: "_rels/.rels", data: enc.encode(RELS_XML) },
    { name: "[Content_Types].xml", data: enc.encode(TYPES_XML) }
  ]);
}
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
function zipStore(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = f.data;
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
  const centralSize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true); end.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + 22);
  let o = 0;
  for (const b of [...parts, ...central, new Uint8Array(end.buffer)]) { out.set(b, o); o += b.length; }
  return out;
}
function modelXML(pieces) {
  let s = `<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n <resources>\n`;
  pieces.forEach((pc, i) => {
    s += `  <object id="${i + 1}" type="model" name="folding-box-${pc.id}">\n   <mesh>\n    <vertices>\n`;
    for (const p of pc.v) s += `     <vertex x="${p[0].toFixed(3)}" y="${p[1].toFixed(3)}" z="${p[2].toFixed(3)}" />\n`;
    s += `    </vertices>\n    <triangles>\n`;
    for (const tr of pc.t) s += `     <triangle v1="${tr[0]}" v2="${tr[1]}" v3="${tr[2]}" />\n`;
    s += `    </triangles>\n   </mesh>\n  </object>\n`;
  });
  s += ` </resources>\n <build>\n`;
  pieces.forEach((pc, i) => { s += `  <item objectid="${i + 1}" />\n`; });
  s += ` </build>\n</model>\n`;
  return s;
}
const RELS_XML = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" /></Relationships>`;
const TYPES_XML = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" /><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" /></Types>`;

const SHAPE_DEFAULTS = {
  lidSlantFx: 0.03162, lidSlantFy: 0.51949,
  lidCornerC1x: 0.03684, lidCornerC1y: 0.60318, lidCornerC2x: 0.05717, lidCornerC2y: 0.66924,
  lidCornerFx: 0.08014, lidCornerFy: 0.67839,
  lidShoulderFx: 0.29441, lidShoulderFy: 0.77458,
  lidRiseC1x: 0.31920, lidRiseC1y: 0.78017, lidRiseC2x: 0.33340, lidRiseC2y: 0.86208,
  lidRiseFx: 0.34304, lidRiseFy: 0.93644,
  lidTopC1x: 0.35136, lidTopC1y: 0.97678, lidTopC2x: 0.36498, lidTopC2y: 0.99979,
  lidTopFx: 0.37854,
  botDepth: 5,
  botX0: 0.31772, botC1x: 0.36176, botC1y: 0.03523, botC2x: 0.38824, botC2y: 0.96477,
  botX1: 0.43228
};
// Human names and hover help for the shape tuning sliders (x = fraction of
// part width, y = fraction of part height or notch depth).
const SHAPE_LABELS = {
  lidSlantFx: ["Slant end X", "End of the slanted edge from the fold corner, fraction of tongue width."],
  lidSlantFy: ["Slant end Y", "End of the slanted edge from the fold corner, fraction of tongue height."],
  lidCornerC1x: ["Corner control 1 X", "First control point of the corner rounding."],
  lidCornerC1y: ["Corner control 1 Y", "First control point of the corner rounding."],
  lidCornerC2x: ["Corner control 2 X", "Second control point of the corner rounding."],
  lidCornerC2y: ["Corner control 2 Y", "Second control point of the corner rounding."],
  lidCornerFx: ["Corner end X", "End of the corner rounding, fraction of tongue width."],
  lidCornerFy: ["Corner end Y", "End of the corner rounding, fraction of tongue height."],
  lidShoulderFx: ["Shoulder X", "Point where the curve leaves the corner toward the top."],
  lidShoulderFy: ["Shoulder Y", "Point where the curve leaves the corner toward the top."],
  lidRiseC1x: ["Rise control 1 X", "First control point of the rise toward the flat top."],
  lidRiseC1y: ["Rise control 1 Y", "First control point of the rise toward the flat top."],
  lidRiseC2x: ["Rise control 2 X", "Second control point of the rise toward the flat top."],
  lidRiseC2y: ["Rise control 2 Y", "Second control point of the rise toward the flat top."],
  lidRiseFx: ["Rise end X", "End of the rise toward the flat top."],
  lidRiseFy: ["Rise end Y", "End of the rise toward the flat top."],
  lidTopC1x: ["Top control 1 X", "First control point of the flat top section."],
  lidTopC1y: ["Top control 1 Y", "First control point of the flat top section."],
  lidTopC2x: ["Top control 2 X", "Second control point of the flat top section."],
  lidTopC2y: ["Top control 2 Y", "Second control point of the flat top section."],
  lidTopFx: ["Top flat end", "End of the flat top section, fraction of tongue width from the side."],
  botDepth: ["Notch depth (mm)", "How deep the notch cuts into the bottom wall edge."],
  botX0: ["Notch start", "Where the notch curve leaves the bottom edge, fraction of wall width."],
  botC1x: ["Notch control 1 X", "First control point of the notch curve."],
  botC1y: ["Notch control 1 Y", "First control point of the notch curve."],
  botC2x: ["Notch control 2 X", "Second control point of the notch curve."],
  botC2y: ["Notch control 2 Y", "Second control point of the notch curve."],
  botX1: ["Notch flat start", "Where the flat notch bottom begins, fraction of wall width."]
};
const SHAPE_GROUPS = [
  ["Lid tongue", ["lidSlantFx", "lidSlantFy",
    "lidCornerC1x", "lidCornerC1y", "lidCornerC2x", "lidCornerC2y",
    "lidCornerFx", "lidCornerFy", "lidShoulderFx", "lidShoulderFy",
    "lidRiseC1x", "lidRiseC1y", "lidRiseC2x", "lidRiseC2y",
    "lidRiseFx", "lidRiseFy", "lidTopC1x", "lidTopC1y", "lidTopC2x",
    "lidTopC2y", "lidTopFx"]],
  ["Bottom notch", ["botX0", "botC1x", "botC1y", "botC2x", "botC2y",
    "botX1"]]
];
function buildShapeInputs() {
  const host = document.getElementById("shapeParams");
  for (const [title, keys] of SHAPE_GROUPS) {
    const fs = document.createElement("fieldset");
    fs.id = title === "Lid tongue" ? "fsLidTongue" : "fsBottomNotch";
    const lg = document.createElement("legend");
    lg.textContent = title;
    fs.appendChild(lg);
    for (const k of keys) {
      const lab = document.createElement("label");
      const nm = SHAPE_LABELS[k] || [k, ""];
      lab.textContent = nm[0];
      lab.title = nm[1];
      const inp = document.createElement("input");
      inp.id = k;
      inp.title = nm[1];
      inp.type = "range";
      inp.min = "0";
      inp.max = "1";
      inp.step = "0.00001";
      inp.value = SHAPE_DEFAULTS[k];
      const val = document.createElement("span");
      val.className = "v";
      val.textContent = SHAPE_DEFAULTS[k];
      inp.addEventListener("input", () => { val.textContent = inp.value; render(); });
      lab.appendChild(inp);
      lab.appendChild(val);
      fs.appendChild(lab);
    }
    host.appendChild(fs);
  }
}
function generateBoxSVG(p) {
  const W = p.width, D = p.depth, H = p.height, T = p.thickness, R = p.cornerRadius;
  const P = Math.min(Math.max(p.trapezoidHeight || 0, 0), H); // range: 0 (nothing) to height
  // Teeth: protrusion 4*T, holes 2*T wide, tip radius 1*T. Bands from 3MF.
  const TD = 4 * T;
  function wallTeethPoly(x, y, w, h, side) {
    const r = Math.min(T, TD / 2, h * 0.125);
    const Y = (f) => y + f * h;
    const bands = [[0.125, 0.375], [0.625, 0.875]];
    const pts = [];
    const quad = (p0, c, p1) => pts.push(...sampleQuad(p0, c, p1, 4));
    if (side === `L`) {
      const xe = x - TD;
      pts.push([x, Y(0)]);
      for (const [a, b] of bands) {
        const y0 = Y(a), y1 = Y(b);
        pts.push([x, y0], [xe + r, y0]);
        quad([xe + r, y0], [xe, y0], [xe, y0 + r]);
        pts.push([xe, y1 - r]);
        quad([xe, y1 - r], [xe, y1], [xe + r, y1]);
        pts.push([x, y1]);
      }
      pts.push([x, Y(1)], [x + w, Y(1)], [x + w, Y(0)]);
    } else {
      const xe = x + w + TD;
      pts.push([x + w, Y(0)]);
      for (const [a, b] of bands) {
        const y0 = Y(a), y1 = Y(b);
        pts.push([x + w, y0], [xe - r, y0]);
        quad([xe - r, y0], [xe, y0], [xe, y0 + r]);
        pts.push([xe, y1 - r]);
        quad([xe, y1 - r], [xe, y1], [xe - r, y1]);
        pts.push([x + w, y1]);
      }
      pts.push([x + w, Y(1)], [x, Y(1)], [x, Y(0)]);
    }
    return pts;
  }
  function wallTeethPath(id, x, y, w, h, side) {
    const pts = wallTeethPoly(x, y, w, h, side);
    const mpts = pts.slice();
    if (signedArea(mpts) < 0) mpts.reverse();
    MESH_PARTS.push({ id, poly: mpts, holes: [] });
    const X = (v) => v.toFixed(2);
    const d = polyPath(pts, (v) => X(v));
    return `<path id="${id}" d="${d}" fill="none" stroke="black" stroke-width="0.1"/>`;
  }
  const baseX = 2 * H + 4 * T;
  const totalW = W + 4 * H + 8 * T;
  const minY = -(D + 2 * H + 3 * T); // above the tongue (lid + T fold strip)
  const maxY = D + H + T;
  const totalH = maxY - minY;

  const M = 5; // display margin around the net (mm)
  const topY = -(H + T);      // top-wall y
  const bottomY = D + T;      // bottom-wall y
  const lidY = topY - T - D;   // top-lid y (T fold strip to the top wall)
  const lidX = baseX + T;
  const lidW = W - 2 * T;

  // Lid side trapezoids: green fold line first, then the ear.
  // Long base along the lid edge, 45-degree corners.
  let ears = "";
  if (P > 0) {
    ears += greenFlap("lid-flap-left", lidX - T, lidY, T, D, T);
    const trapL = [[lidX - T, lidY], [lidX - T, lidY + D], [lidX - T - P, lidY + D - P], [lidX - T - P, lidY + P]];
    MESH_PARTS.push({ id: "lid-trapezoid-left", poly: trapL, holes: [] });
    ears += `<polygon id="lid-trapezoid-left" points="${trapL.map(q => q.join(",")).join(" ")}" fill="none" stroke="black" stroke-width="0.1"/>`;
    ears += greenFlap("lid-flap-right", lidX + lidW, lidY, T, D, T);
    const trapR = [[lidX + lidW + T, lidY], [lidX + lidW + T + P, lidY + P], [lidX + lidW + T + P, lidY + D - P], [lidX + lidW + T, lidY + D]];
    MESH_PARTS.push({ id: "lid-trapezoid-right", poly: trapR, holes: [] });
    ears += `<polygon id="lid-trapezoid-right" points="${trapR.map(q => q.join(",")).join(" ")}" fill="none" stroke="black" stroke-width="0.1"/>`;
  }

  // Ears and teeth can stick out past the net, so fit the view to all.
  const viewMinX = Math.min(0, -TD, P > 0 ? lidX - T - P : 0) - M;
  const viewMaxX = Math.max(totalW, totalW + TD, P > 0 ? lidX + lidW + T + P : 0) + M;

  // Lid-top closure: straight fold at the bottom, bezier shoulders
  // rising to a center tongue. Max height is exactly H.
  // Tongue outline fitted from folding box multi size.3mf (flat 0.5 plate).
  // Left side base->top as fractions of (w, h), all tunable from the page.
  // Fit error per cubic at 3MF scale: corner 0.005mm, rise 0.049mm, top 0.0mm.
  // Start is fixed: top corner of the green flap. Slant goes straight to its end.
  const LID_SIDE = [
    { t: `L`, p: [p.lidSlantFx, p.lidSlantFy] },
    { t: `C`, c1: [p.lidCornerC1x, p.lidCornerC1y], c2: [p.lidCornerC2x, p.lidCornerC2y], p: [p.lidCornerFx, p.lidCornerFy] },
    { t: `L`, p: [p.lidShoulderFx, p.lidShoulderFy] },
    { t: `C`, c1: [p.lidRiseC1x, p.lidRiseC1y], c2: [p.lidRiseC2x, p.lidRiseC2y], p: [p.lidRiseFx, p.lidRiseFy] },
    { t: `C`, c1: [p.lidTopC1x, p.lidTopC1y], c2: [p.lidTopC2x, p.lidTopC2y], p: [p.lidTopFx, 1.0] }
  ];
  const LID_TOP_R = 1 - p.lidTopFx; // right end of the flat top
  function lidTopPath(x, yB, w, h) {
    if (!p.showTongue) return ``;
    // Smile slot from the 3MF, absolute mm so width changes can't deform it.
    // Outer r=6.25, inner r=6.0, top line 6.5 below the tongue top.
    const smileAt = (scx, sTop) => {
      const f = (v) => v.toFixed(2);
      return `<path id="lid-smile" d="M ${f(scx - 6.25)} ${f(sTop)} A 6.25 6.25 0 0 0 ${f(scx + 6.25)} ${f(sTop)} L ${f(scx + 6)} ${f(sTop)} A 6 6 0 0 1 ${f(scx - 6)} ${f(sTop)} Z" fill="none" stroke="red" stroke-width="0.1"/>`;
    };
    if (!p.bezierTongue) {
      const poly = rectPoly(x, yB - h, w, h);
      const scx = x + w / 2, sTop = yB - h + 6.5;
      MESH_PARTS.push({ id: "lid-top", poly, holes: p.showSmile ? [smileLoopAbs(scx, sTop)] : [] });
      return `<rect id="lid-top" x="${x}" y="${yB - h}" width="${w}" height="${h}" fill="none" stroke="black" stroke-width="0.1"/>` + (p.showSmile ? smileAt(scx, sTop) : ``);
    }
    const X = fx => (x + fx * w).toFixed(2);
    const Y = fy => (yB - fy * h).toFixed(2);
    const mir = fx => 1 - fx;
    const dots = [];
    const dotOp = (op, i, suffix) => {
      const mfx = fx => suffix ? mir(fx) : fx;
      const nm = s => suffix ? `${s}-mirror` : s;
      if (op.t === `L`) dots.push([mfx(op.p[0]), op.p[1], `blue`, nm(`L${i} end`)]);
      else {
        dots.push([mfx(op.c1[0]), op.c1[1], `darkorange`, nm(`C${i} c1`)]);
        dots.push([mfx(op.c2[0]), op.c2[1], `darkorange`, nm(`C${i} c2`)]);
        dots.push([mfx(op.p[0]), op.p[1], `blue`, nm(`C${i} end`)]);
      }
    };
    const pts = [[0, 0]];
    for (let i = 0; i < LID_SIDE.length; i++) {
      const op = LID_SIDE[i];
      dotOp(op, i, false);
      const c = pts[pts.length - 1];
      if (op.t === `L`) pts.push(op.p);
      else pts.push(...sampleCubic(c, op.c1, op.c2, op.p, 8));
    }
    pts.push([LID_TOP_R, 1]);
    dots.push([LID_TOP_R, 1, `blue`, `topFlat end`]);
    // Mirror traversal runs top->bottom: each reversed segment starts at the
    // mirror of its own end and must land on the mirror of its own start
    // (previous op's end, or M for the first op).
    for (let i = LID_SIDE.length - 1; i >= 0; i--) {
      const op = LID_SIDE[i];
      dotOp(op, i, true);
      const startP = (i === 0) ? [0, 0] : LID_SIDE[i - 1].p;
      if (op.t === `L`) pts.push([mir(startP[0]), startP[1]]);
      else {
        const c = pts[pts.length - 1];
        const a = [mir(op.c2[0]), op.c2[1]], b = [mir(op.c1[0]), op.c1[1]], e = [mir(startP[0]), startP[1]];
        pts.push(...sampleCubic(c, a, b, e, 8));
      }
    }
    const absPts = pts.map(([fx, fy]) => [x + fx * w, yB - fy * h]);
    const d = polyPath(absPts, (v) => v.toFixed(2));
    // Smile slot from the 3MF, absolute mm so width changes can't deform it.
    const scx = x + w / 2, sTop = yB - h + 6.5;
    MESH_PARTS.push({ id: "lid-top", poly: absPts, holes: p.showSmile ? [smileLoopAbs(scx, sTop)] : [] });
    let dotStr = ``;
    if (p.showLidPoints) {
      for (const [fx, fy, color, name] of dots) {
        dotStr += `<circle cx="${X(fx)}" cy="${Y(fy)}" r="0.5" fill="${color}"><title>${name}</title></circle>`;
      }
    }
    return `<path id="lid-top" d="${d}" fill="none" stroke="black" stroke-width="0.1"/>` + (p.showSmile ? smileAt(scx, sTop) : ``) + dotStr;
  }

  // Upper rectangles with their green folds (tongue + lid + ears).
  // Top wall and everything below always stay. Built only when shown so
  // the mesh collector sees exactly the visible parts.
  let s = "";
  if (p.showLidTop) {
    s += lidTopPath(lidX, lidY - T, lidW, H);
    if (p.showTongue) s += greenFlap("lid-top-flap", lidX, lidY - T, lidW, T, T);
    s += rect("top-lid", lidX, lidY, lidW, D, "black");
    s += greenFlap("top-lid-flap", baseX, lidY + D, W, T, T);
    s += ears;
  }
  s += outerSquare("top-square-left", baseX - T - H, topY, H, R, "left");
  s += greenFlap("top-flap-left", baseX - T, topY, T, H, T);
  s += rect("top-wall", baseX, topY, W, H, "black");
  s += greenFlap("top-flap-right", baseX + W, topY, T, H, T);
  s += outerSquare("top-square-right", baseX + W + T, topY, H, R, "right");
  s += greenFlap("top-flap", baseX, -T, W, T, T);

  s += wallTeethPath("left-wall-2", 0, 0, H, D, "L");
  s += greenFlap("left-flap-2a", H, 0, T, D, T);
  s += rect("left-flap-2b", H + T, 0, T, D, "black");
  s += greenFlap("left-flap-2c", H + 2 * T, 0, T, D, T);
  s += rect("left-wall-1", H + 3 * T, 0, H, D, "black");
  s += greenFlap("left-flap-1", 2 * H + 3 * T, 0, T, D, T);
  s += basePart("base", baseX, 0, W, D, TD / 2);
  s += greenFlap("right-flap-1", baseX + W, 0, T, D, T);
  s += rect("right-wall-1", baseX + W + T, 0, H, D, "black");
  // Slots for the outer teeth (red = cut), same bands as the teeth, from 3MF.
  // Slot edge sits exactly on the base edge; corners rounded with 1*T.
  const slotW = TD / 2;
  const slotL = baseX, slotR = baseX + W;
  [["slot-l-1", slotL, 0.125, 0.375], ["slot-l-2", slotL, 0.625, 0.875],
   ["slot-r-1", slotR - slotW, 0.125, 0.375], ["slot-r-2", slotR - slotW, 0.625, 0.875]
  ].forEach(([id, sx, f0, f1]) => {
    s += `<rect id="${id}" x="${sx}" y="${f0 * D}" width="${slotW}" height="${(f1 - f0) * D}" rx="${T}" fill="none" stroke="red" stroke-width="0.1"/>`;
  });
  s += greenFlap("right-flap-2a", baseX + W + T + H, 0, T, D, T);
  s += rect("right-flap-2b", baseX + W + T + H + T, 0, T, D, "black");
  s += greenFlap("right-flap-2c", baseX + W + T + H + 2 * T, 0, T, D, T);
  s += wallTeethPath("right-wall-2", baseX + W + T + H + 3 * T, 0, H, D, "R");

  // Bottom wall with center notch, fitted from folding box multi size.3mf.
  // Notch depth is always trapezoidHeight; shape numbers are fractions of it.
  // Fit err 0.037mm at 3MF scale.
  const BOT_NOTCH = {
    nx0: p.botX0, c1: [p.botC1x, p.botC1y], c2: [p.botC2x, p.botC2y],
    nx1: p.botX1
  };
  function bottomWallPath(x, yT, w, h) {
    if (!p.bottomNotch) return rect("bottom-wall", x, yT, w, h, "black");
    const ND = Math.max(p.botDepth || 0, 0); // separate notch depth (mm)
    const N = BOT_NOTCH;
    const X = fx => (x + fx * w).toFixed(2);
    const YT = f => (yT + f * h).toFixed(2);
    const YD = fd => (yT + h - fd * ND).toFixed(2); // fd fraction of notch depth
    const mir = fx => 1 - fx;
    const yBot = yT + h;
    const abs = (fx, y) => [x + fx * w, y];
    const absPts = [abs(0, yT), abs(0, yBot), abs(N.nx0, yBot)];
    absPts.push(...sampleCubic(abs(N.nx0, yBot), abs(N.c1[0], yBot - N.c1[1] * ND), abs(N.c2[0], yBot - N.c2[1] * ND), abs(N.nx1, yBot - ND), 8));
    absPts.push(abs(mir(N.nx1), yBot - ND));
    absPts.push(...sampleCubic(abs(mir(N.nx1), yBot - ND), abs(mir(N.c2[0]), yBot - N.c2[1] * ND), abs(mir(N.c1[0]), yBot - N.c1[1] * ND), abs(mir(N.nx0), yBot), 8));
    absPts.push(abs(1, yBot), abs(1, yT));
    const mouth = roundRectLoop(x + w / 2, yT + 7.7, 16, 1.5, 0.75); // rx=0.75 like the red SVG slot
    // The mouth only makes sense with a tongue: same condition that draws it.
    const hasTongue = p.showLidTop && p.showTongue;
    MESH_PARTS.push({ id: "bottom-wall", poly: absPts, holes: (hasTongue && p.showSmile) ? [mouth] : [] });
    const d = polyPath(absPts, (v) => v.toFixed(2));
    let dots = ``;
    if (p.showBotPoints) {
      const dot = (fx, y, color, name) =>
        `<circle cx="${X(fx)}" cy="${y}" r="0.5" fill="${color}"><title>${name}</title></circle>`;
      const pts = [
        [N.nx0, YT(1), `blue`, `botX0 start`],
        [N.c1[0], YD(N.c1[1]), `darkorange`, `botC1 control`],
        [N.c2[0], YD(N.c2[1]), `darkorange`, `botC2 control`],
        [N.nx1, YD(1), `blue`, `botX1 flat start`],
        [mir(N.nx1), YD(1), `blue`, `botX1 mirror`],
        [mir(N.c2[0]), YD(N.c2[1]), `darkorange`, `botC2 mirror`],
        [mir(N.c1[0]), YD(N.c1[1]), `darkorange`, `botC1 mirror`],
        [mir(N.nx0), YT(1), `blue`, `botX0 mirror`]
      ];
      for (const [fx, y, color, name] of pts) dots += dot(fx, y, color, name);
    }
    return `<path id="bottom-wall" d="${d}" fill="none" stroke="black" stroke-width="0.1"/>` + dots;
  }
  s += greenFlap("bottom-flap", baseX, D, W, T, T);
  s += outerSquare("bottom-square-left", baseX - T - H, bottomY, H, R, "left");
  s += greenFlap("bottom-flap-left", baseX - T, bottomY, T, H, T);
  s += bottomWallPath(baseX, bottomY, W, H);
  // Mouth slot from the 3MF, absolute mm so width changes can't deform it.
  // 16 wide, 1.5 tall, round caps, center 7.7 below the wall top fold.
  if (p.showLidTop && p.showTongue && p.showSmile) s += `<rect id="mouth" x="${baseX + W / 2 - 8}" y="${bottomY + 7.7 - 0.75}" width="16" height="1.5" rx="0.75" fill="none" stroke="red" stroke-width="0.1"/>`;
  s += greenFlap("bottom-flap-right", baseX + W, bottomY, T, H, T);
  s += outerSquare("bottom-square-right", baseX + W + T, bottomY, H, R, "right");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${viewMaxX - viewMinX}mm" height="${totalH + 2 * M}mm" viewBox="${viewMinX} ${minY - M} ${viewMaxX - viewMinX} ${totalH + 2 * M}" data-width="${W}" data-depth="${D}" data-height="${H}" data-thickness="${T}" data-corner-radius="${R}" data-trapezoid-height="${P}"><g id="netPan">${s}</g></svg>`;
}

function readParams() {
  const p = {
    width: parseFloat(document.getElementById("width").value),
    depth: parseFloat(document.getElementById("depth").value),
    height: parseFloat(document.getElementById("height").value),
    thickness: parseFloat(document.getElementById("thickness").value),
    cornerRadius: parseFloat(document.getElementById("cornerRadius").value),
    trapezoidHeight: parseFloat(document.getElementById("trapezoidHeight").value),
    bottomNotch: document.getElementById("bottomNotch").checked,
    showBotPoints: document.getElementById("showBotPoints").checked,
    showLidPoints: document.getElementById("showLidPoints").checked,
    showLidTop: document.getElementById("showLidTop").checked,
    showTongue: document.getElementById("showTongue").checked,
    bezierTongue: document.getElementById("bezierTongue").checked,
    showSmile: document.getElementById("showSmile").checked
  };
  // Shape fractions have no inputs on the page; the fitted constants apply.
  for (const k of Object.keys(SHAPE_DEFAULTS)) {
    const el = document.getElementById(k);
    p[k] = el ? parseFloat(el.value) : SHAPE_DEFAULTS[k];
  }
  return p;
}

function render() {
  const p = readParams();
  const svg = generateBoxSVG(p);
  document.getElementById("stage").innerHTML = svg;
  applyPan();
  const lidVis = p.showTongue && p.showLidTop && p.showLidPoints && p.bezierTongue;
  const botVis = p.bottomNotch && p.showBotPoints;
  const fsLid = document.getElementById("fsLidTongue");
  if (fsLid) fsLid.style.display = lidVis ? "" : "none";
  const fsBot = document.getElementById("fsBottomNotch");
  if (fsBot) fsBot.style.display = botVis ? "" : "none";
  const shapeTitle = document.getElementById("shapeTitle");
  if (shapeTitle) shapeTitle.style.display = (lidVis || botVis) ? "" : "none";
  const tWrap = document.getElementById("tongueRectWrap");
  if (tWrap) tWrap.style.display = (p.showTongue && p.showLidTop) ? "" : "none";
  const sWrap = document.getElementById("showTongueWrap");
  if (sWrap) sWrap.style.display = p.showLidTop ? "" : "none";
  const smWrap = document.getElementById("showSmileWrap");
  if (smWrap) smWrap.style.display = (p.showTongue && p.showLidTop) ? "" : "none";
  const ldWrap = document.getElementById("showLidPointsWrap");
  if (ldWrap) ldWrap.style.display = (p.showTongue && p.showLidTop && p.bezierTongue) ? "" : "none";
  const bpWrap = document.getElementById("showBotPointsWrap");
  if (bpWrap) bpWrap.style.display = p.bottomNotch ? "" : "none";
  const bdWrap = document.getElementById("botDepthWrap");
  if (bdWrap) bdWrap.style.display = p.bottomNotch ? "" : "none";
}
document.querySelectorAll(".params input").forEach(el => el.addEventListener("input", render));
buildShapeInputs();
// Pan (drag) + zoom (wheel) on the net group; double-click resets.
let panX = 0, panY = 0, panK = 1;
function applyPan() {
  const g = document.getElementById("netPan");
  if (g && g.setAttribute) g.setAttribute("transform", `translate(${panX} ${panY}) scale(${panK})`);
}
function svgUnit(evt) {
  const svg = document.getElementById("stage").querySelector("svg");
  return new DOMPoint(evt.clientX, evt.clientY).matrixTransform(svg.getScreenCTM().inverse());
}
{
  const stage = document.getElementById("stage");
  let drag = null;
  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    const c = svgUnit(e);
    const k2 = Math.min(20, Math.max(0.2, panK * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    panX = c.x - (c.x - panX) * (k2 / panK);
    panY = c.y - (c.y - panY) * (k2 / panK);
    panK = k2;
    applyPan();
  }, { passive: false });
  stage.addEventListener("mousedown", (e) => {
    const s = document.getElementById("stage").querySelector("svg").getScreenCTM().a;
    drag = { x: e.clientX, y: e.clientY, px: panX, py: panY, s };
  });
  stage.addEventListener("mousemove", (e) => {
    if (!drag) return;
    panX = drag.px + (e.clientX - drag.x) / drag.s;
    panY = drag.py + (e.clientY - drag.y) / drag.s;
    applyPan();
  });
  stage.addEventListener("mouseup", () => { drag = null; });
  stage.addEventListener("mouseleave", () => { drag = null; });
  stage.addEventListener("dblclick", () => { panX = 0; panY = 0; panK = 1; applyPan(); });
}
document.getElementById("dl3mf").addEventListener("click", () => {
  const p = readParams();
  const bytes = build3MFBytes(p);
  const blob = new Blob([bytes], { type: "model/3mf" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `folding-box-${p.width}x${p.depth}x${p.height}.3mf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  document.getElementById("dlInfo").textContent = `${(bytes.length / 1024).toFixed(1)} kB, ${buildPlateMesh(p).pieces.length} parts`;
});
render();
