// Minimal OpenType/CFF parser: cmap (format 4) maps characters to glyph ids,
// hmtx provides advances, and glyph outlines are read from the CFF table by
// interpreting Type2 charstrings (cubic Béziers) into contours:
//   contour = { start: [x, y], segs: [{c: 'L'|'C', p: [coords...]}] }
'use strict';

function parseFont(buf) {
  const dv = new DataView(buf);
  const u8 = o => dv.getUint8(o), u16 = o => dv.getUint16(o);
  const s16 = o => dv.getInt16(o), s32 = o => dv.getInt32(o), u32 = o => dv.getUint32(o);

  const tables = {};
  for (let i = 0; i < u16(4); i++) {
    const p = 12 + i * 16;
    let tag = '';
    for (let j = 0; j < 4; j++) tag += String.fromCharCode(u8(p + j));
    tables[tag.trim()] = u32(p + 8);
  }

  const unitsPerEm = u16(tables.head + 18);
  const numH = u16(tables.hhea + 34);
  const advance = g => u16(tables.hmtx + Math.min(g, numH - 1) * 4);

  // cmap: pick the best format-4 subtable (unicode).
  const cm = tables.cmap;
  let sub = null, best = -1;
  for (let i = 0; i < u16(cm + 2); i++) {
    const p = cm + 4 + i * 8, plat = u16(p), enc = u16(p + 2), off = u32(p + 4);
    const score = plat === 3 && enc === 1 ? 3 : plat === 0 ? 2 : plat === 3 ? 1 : 0;
    if (score > best && u16(cm + off) === 4) { best = score; sub = cm + off; }
  }
  const segX2 = u16(sub + 6), seg = segX2 / 2;
  const endC = sub + 14, startC = endC + segX2 + 2, delta = startC + segX2, rangeO = delta + segX2;
  function glyphId(code) {
    for (let i = 0; i < seg; i++) {
      if (u16(endC + i * 2) >= code) {
        if (u16(startC + i * 2) > code) return 0;
        const ro = u16(rangeO + i * 2);
        if (ro === 0) return (code + s16(delta + i * 2)) & 0xFFFF;
        const g = u16(rangeO + i * 2 + ro + (code - u16(startC + i * 2)) * 2);
        return g === 0 ? 0 : (g + s16(delta + i * 2)) & 0xFFFF;
      }
    }
    return 0;
  }

  // ---- CFF ----
  const cff = tables.CFF;

  function readIndex(pos) {
    const count = u16(pos);
    if (count === 0) return { items: [], next: pos + 2 };
    const offSize = u8(pos + 2);
    const offAt = i => {
      let v = 0;
      for (let j = 0; j < offSize; j++) v = v * 256 + u8(pos + 3 + i * offSize + j);
      return v;
    };
    const base = pos + 3 + (count + 1) * offSize - 1;
    const items = [];
    for (let i = 0; i < count; i++) items.push([base + offAt(i), base + offAt(i + 1)]);
    return { items, next: base + offAt(count) };
  }

  function parseDict(start, end) {
    const d = {};
    let ops = [], p = start;
    while (p < end) {
      const b0 = u8(p);
      if (b0 <= 21) {
        let op = b0;
        p++;
        if (b0 === 12) { op = 1200 + u8(p); p++; }
        d[op] = ops;
        ops = [];
      } else if (b0 === 28) { ops.push(s16(p + 1)); p += 3; }
      else if (b0 === 29) { ops.push(s32(p + 1)); p += 5; }
      else if (b0 === 30) { // real number: nibble-encoded, value unused here
        p++;
        while (p < end) { const b = u8(p++); if ((b & 15) === 15 || (b >> 4) === 15) break; }
        ops.push(0);
      }
      else if (b0 >= 32 && b0 <= 246) { ops.push(b0 - 139); p++; }
      else if (b0 <= 250) { ops.push((b0 - 247) * 256 + u8(p + 1) + 108); p += 2; }
      else { ops.push(-(b0 - 251) * 256 - u8(p + 1) - 108); p += 2; }
    }
    return d;
  }

  const hdrSize = u8(cff + 2);
  const nameIdx = readIndex(cff + hdrSize);
  const topIdx = readIndex(nameIdx.next);
  const stringIdx = readIndex(topIdx.next);
  const gsubrs = readIndex(stringIdx.next).items;
  const top = parseDict(topIdx.items[0][0], topIdx.items[0][1]);
  const charStrings = readIndex(cff + top[17][0]).items;
  let lsubrs = [];
  if (top[18]) {
    const privOff = cff + top[18][1];
    const priv = parseDict(privOff, privOff + top[18][0]);
    if (priv[19]) lsubrs = readIndex(privOff + priv[19][0]).items;
  }
  const bias = n => n < 1240 ? 107 : n < 33900 ? 1131 : 32768;
  const gBias = bias(gsubrs.length), lBias = bias(lsubrs.length);

  // Type2 charstring interpreter.
  function outlineOf(g) {
    if (g >= charStrings.length) return [];
    const contours = [];
    let cur = null, x = 0, y = 0, nStems = 0, haveWidth = false;
    const st = [];

    function moveTo(nx, ny) { x = nx; y = ny; cur = { start: [x, y], segs: [] }; contours.push(cur); }
    function lineTo(nx, ny) { x = nx; y = ny; if (cur) cur.segs.push({ c: 'L', p: [x, y] }); }
    function curveTo(x1, y1, x2, y2, nx, ny) {
      x = nx; y = ny;
      if (cur) cur.segs.push({ c: 'C', p: [x1, y1, x2, y2, x, y] });
    }
    function takeWidth(even) {
      if (!haveWidth && st.length % 2 !== (even ? 0 : 1)) st.shift();
      haveWidth = true;
    }
    function stems() { takeWidth(true); nStems += st.length >> 1; st.length = 0; }

    function run(cs, depth) {
      if (depth > 10) return;
      let p = cs[0];
      const end = cs[1];
      while (p < end) {
        const b0 = u8(p);
        if (b0 >= 32 || b0 === 28) { // operand
          if (b0 === 28) { st.push(s16(p + 1)); p += 3; }
          else if (b0 <= 246) { st.push(b0 - 139); p++; }
          else if (b0 <= 250) { st.push((b0 - 247) * 256 + u8(p + 1) + 108); p += 2; }
          else if (b0 <= 254) { st.push(-(b0 - 251) * 256 - u8(p + 1) - 108); p += 2; }
          else { st.push(s32(p + 1) / 65536); p += 5; }
          continue;
        }
        p++;
        switch (b0) {
          case 1: case 3: case 18: case 23: stems(); break;
          case 19: case 20: stems(); p += (nStems + 7) >> 3; break;
          case 21: takeWidth(true); moveTo(x + st[st.length - 2], y + st[st.length - 1]); st.length = 0; break;
          case 22: takeWidth(false); moveTo(x + st[st.length - 1], y); st.length = 0; break;
          case 4: takeWidth(false); moveTo(x, y + st[st.length - 1]); st.length = 0; break;
          case 5: for (let i = 0; i + 1 < st.length; i += 2) lineTo(x + st[i], y + st[i + 1]); st.length = 0; break;
          case 6: case 7: {
            let horiz = b0 === 6;
            for (let i = 0; i < st.length; i++, horiz = !horiz) {
              if (horiz) lineTo(x + st[i], y); else lineTo(x, y + st[i]);
            }
            st.length = 0;
            break;
          }
          case 8: for (let i = 0; i + 5 < st.length; i += 6)
            curveTo(x + st[i], y + st[i + 1], x + st[i] + st[i + 2], y + st[i + 1] + st[i + 3],
              x + st[i] + st[i + 2] + st[i + 4], y + st[i + 1] + st[i + 3] + st[i + 5]);
            st.length = 0; break;
          case 24: { // rcurveline
            let i = 0;
            for (; i + 5 < st.length - 2; i += 6)
              curveTo(x + st[i], y + st[i + 1], x + st[i] + st[i + 2], y + st[i + 1] + st[i + 3],
                x + st[i] + st[i + 2] + st[i + 4], y + st[i + 1] + st[i + 3] + st[i + 5]);
            lineTo(x + st[i], y + st[i + 1]);
            st.length = 0;
            break;
          }
          case 25: { // rlinecurve
            let i = 0;
            for (; i + 1 < st.length - 6; i += 2) lineTo(x + st[i], y + st[i + 1]);
            curveTo(x + st[i], y + st[i + 1], x + st[i] + st[i + 2], y + st[i + 1] + st[i + 3],
              x + st[i] + st[i + 2] + st[i + 4], y + st[i + 1] + st[i + 3] + st[i + 5]);
            st.length = 0;
            break;
          }
          case 26: { // vvcurveto
            let i = 0, dx1 = 0;
            if (st.length % 4) dx1 = st[i++];
            for (; i + 3 < st.length; i += 4) {
              const x1 = x + dx1, y1 = y + st[i], x2 = x1 + st[i + 1], y2 = y1 + st[i + 2];
              curveTo(x1, y1, x2, y2, x2, y2 + st[i + 3]);
              dx1 = 0;
            }
            st.length = 0;
            break;
          }
          case 27: { // hhcurveto
            let i = 0, dy1 = 0;
            if (st.length % 4) dy1 = st[i++];
            for (; i + 3 < st.length; i += 4) {
              const x1 = x + st[i], y1 = y + dy1, x2 = x1 + st[i + 1], y2 = y1 + st[i + 2];
              curveTo(x1, y1, x2, y2, x2 + st[i + 3], y2);
              dy1 = 0;
            }
            st.length = 0;
            break;
          }
          case 30: case 31: { // vhcurveto / hvcurveto
            let horiz = b0 === 31;
            for (let i = 0; i + 3 < st.length; i += 4, horiz = !horiz) {
              const last = st.length - i === 5 ? st[i + 4] : 0;
              if (horiz) {
                const x1 = x + st[i], y1 = y, x2 = x1 + st[i + 1], y2 = y1 + st[i + 2];
                curveTo(x1, y1, x2, y2, x2 + last, y2 + st[i + 3]);
              } else {
                const x1 = x, y1 = y + st[i], x2 = x1 + st[i + 1], y2 = y1 + st[i + 2];
                curveTo(x1, y1, x2, y2, x2 + st[i + 3], y2 + last);
              }
            }
            st.length = 0;
            break;
          }
          case 10: { const i = st.pop() + lBias; if (lsubrs[i]) run(lsubrs[i], depth + 1); break; }
          case 29: { const i = st.pop() + gBias; if (gsubrs[i]) run(gsubrs[i], depth + 1); break; }
          case 11: return;
          case 14: takeWidth(true); st.length = 0; return; // (seac composites not supported)
          case 12: {
            const b1 = u8(p);
            p++;
            const s = st;
            if (b1 === 35) { // flex
              curveTo(x + s[0], y + s[1], x + s[0] + s[2], y + s[1] + s[3], x + s[0] + s[2] + s[4], y + s[1] + s[3] + s[5]);
              curveTo(x + s[6], y + s[7], x + s[6] + s[8], y + s[7] + s[9], x + s[6] + s[8] + s[10], y + s[7] + s[9] + s[11]);
            } else if (b1 === 34) { // hflex
              const y0 = y;
              curveTo(x + s[0], y, x + s[0] + s[1], y + s[2], x + s[0] + s[1] + s[3], y + s[2]);
              curveTo(x + s[4], y, x + s[4] + s[5], y0, x + s[4] + s[5] + s[6], y0);
            } else if (b1 === 36) { // hflex1
              const y0 = y;
              curveTo(x + s[0], y + s[1], x + s[0] + s[2], y + s[1] + s[3], x + s[0] + s[2] + s[4], y + s[1] + s[3]);
              curveTo(x + s[5], y, x + s[5] + s[6], y + s[7], x + s[5] + s[6] + s[8], y0);
            } else if (b1 === 37) { // flex1
              const x0 = x, y0 = y;
              const dx = s[0] + s[2] + s[4] + s[6] + s[8], dy = s[1] + s[3] + s[5] + s[7] + s[9];
              curveTo(x + s[0], y + s[1], x + s[0] + s[2], y + s[1] + s[3], x + s[0] + s[2] + s[4], y + s[1] + s[3] + s[5]);
              const fx = x + s[6] + s[8] + (Math.abs(dx) > Math.abs(dy) ? s[10] : 0);
              const fy = y + s[7] + s[9] + (Math.abs(dx) > Math.abs(dy) ? 0 : s[10]);
              curveTo(x + s[6], y + s[7], x + s[6] + s[8], y + s[7] + s[9],
                Math.abs(dx) > Math.abs(dy) ? fx : x0 + dx, Math.abs(dx) > Math.abs(dy) ? y0 + dy : fy);
            }
            st.length = 0;
            break;
          }
          default: st.length = 0;
        }
      }
    }
    run(charStrings[g], 0);
    return contours;
  }

  return { unitsPerEm, glyphId, advance, outlineOf };
}
