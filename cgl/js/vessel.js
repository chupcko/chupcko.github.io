// UI glue for the round vessel page.
'use strict';

(function () {
  const ids = ['diameter', 'height', 'thickness', 'bottomRim', 'frameWidth',
    'tabWidth', 'tabPitch', 'pitch', 'margin', 'angle', 'amplitude',
    'wavelength', 'dashCount', 'tie', 'overlap', 'stroke'];
  const el = id => document.getElementById(id);
  let lastSvg = '';

  function readParams() {
    const p = {};
    ids.forEach(id => p[id] = parseFloat(el(id).value));
    p.dims = el('dims').value;
    p.pattern = el('pattern').value;
    p.color = el('color').value;
    return p;
  }

  function refresh() {
    const p = readParams();
    ['diagonalRow', 'waveRow', 'dashedRow', 'staggeredRow'].forEach(id => el(id).style.display = 'none');
    if (p.pattern === 'diagonal') el('diagonalRow').style.display = '';
    else if (p.pattern === 'wave') el('waveRow').style.display = '';
    else if (p.pattern === 'dashed') el('dashedRow').style.display = '';
    else if (p.pattern === 'staggered') el('staggeredRow').style.display = '';

    const res = generateVessel(p);
    lastSvg = res.svg;
    el('warnings').innerHTML = res.warnings.map(w => '<div>⚠ ' + w + '</div>').join('');
    el('preview').innerHTML = res.svg || '';
  }

  ids.forEach(id => el(id).addEventListener('input', refresh));
  ['dims', 'pattern', 'color'].forEach(id => el(id).addEventListener('change', refresh));
  el('download').addEventListener('click', () => {
    if (!lastSvg) return;
    const p = readParams();
    downloadSvg(lastSvg, 'vessel_d' + p.diameter + 'x' + p.height + '.svg');
  });
  refresh();
})();
