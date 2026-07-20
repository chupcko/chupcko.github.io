// UI glue for the box generator page.
'use strict';

(function () {
  const ids = ['width', 'length', 'height', 'thickness', 'finger', 'stroke', 'labelSize'];
  const el = id => document.getElementById(id);

  function readParams() {
    const p = {};
    ids.forEach(id => p[id] = parseFloat(el(id).value));
    p.labels = el('labels').checked;
    p.layout = el('layout').value;
    p.cutColor = el('color').value;
    p.numColor = el('numColor').value;
    return p;
  }

  let lastSvg = '';

  function refresh() {
    const p = readParams();
    el('labelSizeRow').style.display = p.labels ? '' : 'none';
    const res = generateBox(p);
    lastSvg = res.svg;
    el('warnings').innerHTML = res.warnings.map(w => '<div>⚠ ' + w + '</div>').join('');
    el('preview').innerHTML = res.svg || '';
  }

  function download() {
    if (!lastSvg) return;
    const p = readParams();
    downloadSvg(lastSvg, 'box_' + p.width + 'x' + p.length + 'x' + p.height + '.svg');
  }

  ids.forEach(id => el(id).addEventListener('input', refresh));
  el('labels').addEventListener('change', refresh);
  el('layout').addEventListener('change', refresh);
  el('color').addEventListener('change', refresh);
  el('numColor').addEventListener('change', refresh);
  el('download').addEventListener('click', download);
  refresh();
})();
