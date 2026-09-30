// Round, kerf-bent vessel (no dividers): a flat wall strip that rolls into a
// cylinder, a bottom disk and a top frame ring that both catch the wall's
// edges with a row of tabs going through matching slots — self-locating,
// no partial-depth engraving needed. All dimensions in millimeters. The
// wall's bend pattern is a set of mostly full-depth cuts left uncut in
// places (a kerf/living-hinge), which also reads as a decorative texture
// once the wall is rolled.
'use strict';

// Rectangle centered at radius R from (cx, cy), at angle `ang` (radians):
// `w` runs tangentially (along the circle), `h` runs radially — this is the
// slot that a wall tab drops through.
function radialSlotD(cx, cy, R, ang, w, h) {
  const rx = Math.cos(ang), ry = Math.sin(ang); // radial unit vector
  const tx = -Math.sin(ang), ty = Math.cos(ang); // tangential unit vector
  const px = cx + R * rx, py = cy + R * ry;
  const pts = [
    [px + (w / 2) * tx + (h / 2) * rx, py + (w / 2) * ty + (h / 2) * ry],
    [px - (w / 2) * tx + (h / 2) * rx, py - (w / 2) * ty + (h / 2) * ry],
    [px - (w / 2) * tx - (h / 2) * rx, py - (w / 2) * ty - (h / 2) * ry],
    [px + (w / 2) * tx - (h / 2) * rx, py + (w / 2) * ty - (h / 2) * ry],
  ];
  return 'M' + pts.map((q, i) => (i ? 'L' : '') + fmtMm(q[0]) + ' ' + fmtMm(q[1])).join('') + 'Z';
}

// A ring of `n` identical slots evenly spaced around radius R — used on both
// the bottom disk and the top frame to receive the wall's tabs. The two
// rings don't need to share a phase: full rotational symmetry means any
// twist of the rolled wall still lines every tab up with a slot.
function slotRing(cx, cy, R, n, w, h) {
  let d = '';
  for (let i = 0; i < n; i++) d += radialSlotD(cx, cy, R, i * 2 * Math.PI / n, w, h);
  return d;
}

// Vertical bend-pattern cuts for the wall strip, [0,L] x [0,H]. Columns are
// centered in each pitch cell so neither strip end (the glued seam) starts
// with a slit right at the edge. Returns { d, warnings }.
function wallSlits(pattern, L, H, o) {
  const warnings = [];
  const pitch = o.pitch;
  if (!(pitch > 0)) return { d: '', warnings: ['Slit pitch must be a positive number.'] };
  const n = Math.max(1, Math.round(L / pitch));
  const p = L / n; // actual pitch, so slits tile evenly around the circumference
  const margin = o.margin;
  const usable = H - 2 * margin;
  if (!(usable > 0)) return { d: '', warnings: ['Top/bottom margin is too large for this height.'] };
  if (margin < 2) warnings.push('Only ' + margin.toFixed(1) + ' mm of uncut band at top/bottom — a fragile hinge.');

  let d = '';
  const line = (x1, y1, x2, y2) => { d += 'M' + fmtMm(x1) + ' ' + fmtMm(y1) + 'L' + fmtMm(x2) + ' ' + fmtMm(y2); };

  if (pattern === 'staggered') {
    const overlap = o.overlap;
    if (!(overlap >= 0 && overlap < usable / 2)) {
      warnings.push('Row overlap should be less than half the usable height.');
    }
    const yMidLo = margin + usable / 2 - overlap / 2;
    const yMidHi = margin + usable / 2 + overlap / 2;
    for (let i = 0; i < n; i++) line((i + 0.5) * p, margin, (i + 0.5) * p, yMidHi);
    for (let i = 0; i < n; i++) line(i * p, yMidLo, i * p, margin + usable);
  } else if (pattern === 'diagonal') {
    // A zigzag (chevron) column: each straight run climbs one pitch's worth
    // of height at the given angle from vertical, then reverses — so the
    // sideways excursion stays bounded by the pitch regardless of height.
    const rad = (o.angle || 0) * Math.PI / 180;
    const step = p;
    const amp = (step / 2) * Math.tan(rad);
    if (2 * Math.abs(amp) > p * 0.8) warnings.push('Slit angle is steep for this pitch — zigzags may nearly touch; reduce the angle or increase the pitch.');
    for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * p;
      let dd = '', y = margin, sign = -1;
      dd += 'M' + fmtMm(cx + sign * amp) + ' ' + fmtMm(y);
      while (y + step < margin + usable) {
        y += step; sign = -sign;
        dd += 'L' + fmtMm(cx + sign * amp) + ' ' + fmtMm(y);
      }
      dd += 'L' + fmtMm(cx - sign * amp) + ' ' + fmtMm(margin + usable);
      d += dd;
    }
  } else if (pattern === 'dashed') {
    const nd = Math.max(1, Math.round(o.dashCount));
    const tie = o.tie;
    const dashLen = (usable - (nd - 1) * tie) / nd;
    if (!(dashLen > 0)) return { d: '', warnings: ['Dash count / tie length leave no room for the dashes — reduce them or increase the height.'] };
    if (tie < 1.5) warnings.push('Only ' + tie.toFixed(1) + ' mm ties between dashes — fragile.');
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * p;
      let y = margin;
      for (let k = 0; k < nd; k++) {
        line(x, y, x, y + dashLen);
        y += dashLen + tie;
      }
    }
  } else if (pattern === 'wave') {
    const amp = o.amplitude, wl = o.wavelength;
    if (!(wl > 0)) return { d: '', warnings: ['Wavelength must be a positive number.'] };
    if (2 * amp > p * 0.8) warnings.push('Wave amplitude is close to the pitch — adjacent slits may touch; reduce the amplitude or increase the pitch.');
    const steps = Math.max(8, Math.round(usable / wl * 12));
    for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * p;
      let dd = '';
      for (let s = 0; s <= steps; s++) {
        const y = margin + usable * s / steps;
        const x = cx + amp * Math.sin(2 * Math.PI * (y - margin) / wl);
        dd += (s === 0 ? 'M' : 'L') + fmtMm(x) + ' ' + fmtMm(y);
      }
      d += dd;
    }
  } else { // 'straight' — classic single-row living hinge
    for (let i = 0; i < n; i++) line((i + 0.5) * p, margin, (i + 0.5) * p, margin + usable);
  }
  return { d, warnings };
}

// Wall outline as a closed path, [0,L] x [0,H], with a comb of tabs on the
// top edge (pointing to y<0) and the bottom edge (pointing to y>H). `xs` are
// the tab centers (shared with the bottom/frame slot rings) and `tw`/`td`
// are tab width and depth.
function wallOutlineD(L, H, xs, tw, td) {
  let d = 'M0 0';
  const teeth = (y, dir, order) => {
    const list = order === 'fwd' ? xs : xs.slice().reverse();
    list.forEach(x => {
      const a = x - tw / 2, b = x + tw / 2;
      const y2 = y + dir * td;
      if (order === 'fwd') { d += 'L' + fmtMm(a) + ' ' + fmtMm(y) + 'L' + fmtMm(a) + ' ' + fmtMm(y2) + 'L' + fmtMm(b) + ' ' + fmtMm(y2) + 'L' + fmtMm(b) + ' ' + fmtMm(y); }
      else { d += 'L' + fmtMm(b) + ' ' + fmtMm(y) + 'L' + fmtMm(b) + ' ' + fmtMm(y2) + 'L' + fmtMm(a) + ' ' + fmtMm(y2) + 'L' + fmtMm(a) + ' ' + fmtMm(y); }
    });
  };
  teeth(0, -1, 'fwd');
  d += 'L' + fmtMm(L) + ' 0L' + fmtMm(L) + ' ' + fmtMm(H);
  teeth(H, 1, 'rev');
  d += 'L0 ' + fmtMm(H) + 'Z'; // back to (0,H), then Z closes the straight left edge to (0,0)
  return d;
}

// Main entry point: returns { svg, warnings }
function generateVessel(p) {
  const warnings = [];
  const t = p.thickness;
  const stroke = p.stroke > 0 ? p.stroke : 0.08;
  const color = p.color || COLORS.black;

  if (!(t > 0)) return { svg: '', warnings: ['Material thickness must be a positive number.'] };
  if (!(p.diameter > 0)) return { svg: '', warnings: ['Diameter must be a positive number.'] };
  if (!(p.height > 0)) return { svg: '', warnings: ['Height must be a positive number.'] };

  const Din = p.dims === 'inner' ? p.diameter : p.diameter - 2 * t;
  const Dout = p.dims === 'outer' ? p.diameter : p.diameter + 2 * t;
  if (!(Din > 0)) return { svg: '', warnings: ['Inner diameter works out to zero or less — increase the diameter or reduce the thickness.'] };
  const Rin = Din / 2, Rout = Dout / 2, Rmid = (Rin + Rout) / 2;
  const H = p.height;
  const L = Math.PI * (Din + t); // circumference at the wall's mid-thickness

  const bottomRim = Math.max(0, p.bottomRim || 0);
  if (bottomRim < 2) warnings.push('Only ' + bottomRim.toFixed(1) + ' mm of bottom disk left past the slot ring — increase the bottom rim so the holes aren\'t at the very edge.');
  const frameWidth = p.frameWidth;
  if (!(frameWidth > 0)) return { svg: '', warnings: ['Top frame width must be a positive number.'] };
  const RbottomOut = Rout + bottomRim;
  const RframeOut = Rout + frameWidth;
  const RframeIn = Rin - frameWidth;
  if (!(RframeIn > 0.5)) return { svg: '', warnings: ['Top frame width is too large for this inner diameter — reduce it.'] };

  const slits = wallSlits(p.pattern, L, H, p);
  warnings.push(...slits.warnings);
  if (!slits.d && slits.warnings.length) return { svg: '', warnings };

  // Tabs: same count top and bottom, evenly spaced and centered in each
  // pitch cell (clear of the strip's two glued ends). The bottom disk's and
  // top frame's slot rings use the same count, at the same radius, so any
  // twist of the rolled wall still lands every tab in a slot.
  const tabWidth = p.tabWidth, tabPitch = p.tabPitch;
  if (!(tabWidth > 0 && tabPitch > 0)) return { svg: '', warnings: warnings.concat('Tab width and pitch must be positive numbers.') };
  const tabsN = Math.max(3, Math.round(L / tabPitch));
  const tp = L / tabsN;
  if (tabWidth >= tp) warnings.push('Tabs are wider than their spacing — reduce the tab width or increase the tab pitch.');
  const tabXs = [];
  for (let i = 0; i < tabsN; i++) tabXs.push((i + 0.5) * tp);

  const m = 5, g = 10;
  const wallX = m, wallY = m + t; // local y spans [-t, H+t]; shift so the top tabs stay on the sheet
  const wallBlockH = H + 2 * t;
  const row2y = m + wallBlockH + g;
  const row2h = 2 * Math.max(RbottomOut, RframeOut);
  const cx1 = m + RbottomOut, cy1 = row2y + RbottomOut;
  const cx2 = m + 2 * RbottomOut + g + RframeOut, cy2 = row2y + RframeOut;

  const totalW = 2 * m + Math.max(L, 2 * RbottomOut + g + 2 * RframeOut);
  const totalH = 2 * m + wallBlockH + g + row2h;

  // Wall geometry is built at local (0,0); shift every M/L coordinate pair
  // into place on the sheet.
  const shift = raw => raw.replace(/([ML])([-\d.]+) ([-\d.]+)/g, (_, c, x, y) =>
    c + fmtMm(parseFloat(x) + wallX) + ' ' + fmtMm(parseFloat(y) + wallY));
  const wallOutline = shift(wallOutlineD(L, H, tabXs, tabWidth, t));
  const wallSlitsD = shift(slits.d);

  let cut = '<g fill="none" stroke="' + color + '" stroke-width="' + stroke + '">\n';
  cut += '<path d="' + wallOutline + '"/>\n';
  cut += '<path d="' + wallSlitsD + '"/>\n';
  // Bottom disk: outline + a ring of slots for the wall's bottom tabs.
  cut += '<circle cx="' + fmtMm(cx1) + '" cy="' + fmtMm(cy1) + '" r="' + fmtMm(RbottomOut) + '"/>\n';
  cut += '<path d="' + slotRing(cx1, cy1, Rmid, tabsN, tabWidth, t) + '"/>\n';
  // Top frame: outer + inner hole, plus its own ring of slots.
  cut += '<circle cx="' + fmtMm(cx2) + '" cy="' + fmtMm(cy2) + '" r="' + fmtMm(RframeOut) + '"/>\n';
  cut += '<circle cx="' + fmtMm(cx2) + '" cy="' + fmtMm(cy2) + '" r="' + fmtMm(RframeIn) + '"/>\n';
  cut += '<path d="' + slotRing(cx2, cy2, Rmid, tabsN, tabWidth, t) + '"/>\n';
  cut += '</g>\n';

  return {
    svg: svgDoc(fmtMm(totalW), fmtMm(totalH), cut),
    warnings,
    info: { Din, Dout, L, tabsN },
  };
}
