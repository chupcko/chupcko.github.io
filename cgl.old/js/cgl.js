// UI glue for the CGL logo page.
'use strict';

(function () {
  const el = id => document.getElementById(id);
  let lastSvg = '';

  function readParams() {
    return {
      unit: parseFloat(el('unit').value),
      stroke: parseFloat(el('stroke').value),
      color: el('color').value,
      frame: el('frame').checked,
      frameColor: el('frameColor').value,
    };
  }

  function refresh() {
    const p = readParams();
    el('frameRow').style.display = p.frame ? '' : 'none';
    const res = generateCgl(p);
    lastSvg = res.svg;
    el('warnings').innerHTML = res.warnings.map(w => '<div>⚠ ' + w + '</div>').join('');
    el('preview').innerHTML = res.svg || '';
  }

  ['unit', 'stroke'].forEach(id => el(id).addEventListener('input', refresh));
  ['color', 'frame', 'frameColor'].forEach(id => el(id).addEventListener('change', refresh));
  el('download').addEventListener('click', () => {
    if (!lastSvg) return;
    const p = readParams();
    downloadSvg(lastSvg, 'cgl_' + p.unit + 'mm.svg');
  });
  refresh();
})();
