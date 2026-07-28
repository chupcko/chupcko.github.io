// Shared SVG helpers for the laser tools.
'use strict';

// Offered line colors — pure RGB values so laser software can key on them.
const COLORS = {
  red: '#ff0000',
  black: '#000000',
  green: '#00ff00',
  blue: '#0000ff',
};

// Millimeter value formatted for path data.
function fmtMm(v) {
  return (Math.round(v * 1000) / 1000).toString();
}

// SVG document sized in real millimeters (viewBox unit = 1 mm).
function svgDoc(w, h, body) {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + 'mm" height="' + h +
    'mm" viewBox="0 0 ' + w + ' ' + h + '">\n' + body + '</svg>\n';
}

// Parse a dimension string into millimeters. Bare numbers are read in
// defaultUnit ('mm' or 'inch'); every term may carry its own unit (mm, cm,
// in, ") which then applies to the whole term. Accepted forms:
//   150 · 2.5 · 2,5 · 2" · 2in · 15cm · 1/2 · 2 1/2 · 2-1/2 · 2+1/2 ·
//   2 1/2" · 2" + 3mm
// Returns NaN for anything it cannot parse.
function parseDim(str, defaultUnit) {
  const UNITS = { mm: 1, cm: 10, in: 25.4, '"': 25.4 };
  const def = defaultUnit === 'inch' || defaultUnit === 'in' ? 25.4 : 1;
  const s = String(str).toLowerCase().replace(/,/g, '.').replace(/\s+/g, ' ').trim();
  if (!s) return NaN;
  let total = 0;
  for (const term of s.split('+')) {
    // optional decimal, optional fraction (space or dash separated),
    // optional unit — at least one of the number parts must be present
    const m = term.trim().match(
      /^(?:(\d+(?:\.\d+)?)(?![\d/]))?(?:[ -]?(\d+)\s*\/\s*(\d+))?\s*(mm|cm|in|")?$/);
    if (!m || (m[1] === undefined && m[2] === undefined)) return NaN;
    const dec = m[1] !== undefined ? parseFloat(m[1]) : 0;
    let frac = 0;
    if (m[2] !== undefined) {
      const den = parseInt(m[3], 10);
      if (!(den > 0)) return NaN;
      frac = parseInt(m[2], 10) / den;
    }
    total += (dec + frac) * (m[4] ? UNITS[m[4]] : def);
  }
  return total;
}

// Box dimension fitted to a content dimension: 20 mm of padding, rounded up
// to a number ending in 00 or 50.
function fitBoxDim(v) {
  return Math.ceil((v + 20) / 50) * 50;
}

// Offer an SVG string as a file download.
function downloadSvg(svg, name) {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
