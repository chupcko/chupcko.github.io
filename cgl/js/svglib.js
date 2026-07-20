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
