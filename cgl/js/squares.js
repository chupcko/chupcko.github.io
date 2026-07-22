// UI glue for the square mask page.
'use strict';

(function () {
  const ids = ['width', 'height', 'nx', 'ny', 'spacingX', 'spacingY', 'side', 'angle', 'stroke', 'boxW', 'boxH'];
  const el = id => document.getElementById(id);
  let lastSvg = '';
  let lastExt = null;

  function readParams() {
    const p = {};
    ids.forEach(id => p[id] = parseFloat(el(id).value));
    p.mode = el('mode').value;
    p.grid = el('grid').value;
    p.style = el('style').value;
    p.color = el('color').value;
    p.withBox = el('withBox').checked;
    p.boxColor = el('boxColor').value;
    return p;
  }

  function refresh() {
    const p = readParams();
    el('areaRow').style.display = p.mode === 'area' ? '' : 'none';
    el('countRow').style.display = p.mode === 'count' ? '' : 'none';
    el('boxRow').style.display = p.withBox ? '' : 'none';
    const res = generateSquares(p);
    lastSvg = res.svg;
    lastExt = res.ext || lastExt;
    el('warnings').innerHTML = res.warnings.map(w => '<div>⚠ ' + w + '</div>').join('');
    el('preview').innerHTML = res.svg || '';
  }

  // Fill the box inputs with dimensions fitted to the pattern extent.
  function fitBox() {
    if (!lastExt) return;
    el('boxW').value = fitBoxDim(lastExt.w);
    el('boxH').value = fitBoxDim(lastExt.h);
  }

  ids.forEach(id => el(id).addEventListener('input', refresh));
  ['mode', 'grid', 'style', 'color', 'boxColor'].forEach(id =>
    el(id).addEventListener('change', refresh));
  el('withBox').addEventListener('change', () => {
    if (el('withBox').checked) fitBox();
    refresh();
  });
  el('fitBox').addEventListener('click', () => { fitBox(); refresh(); });
  el('download').addEventListener('click', () => {
    if (!lastSvg) return;
    const p = readParams();
    const size = p.mode === 'count'
      ? p.nx + 'x' + p.ny
      : p.width + 'x' + p.height + 'mm';
    downloadSvg(lastSvg, 'squares_' + size + '_a' + p.angle + '.svg');
  });
  refresh();
})();
