// UI glue for the divider box page.
'use strict';

(function () {
  const ids = ['width', 'length', 'height', 'thickness', 'finger', 'divH', 'cols', 'rows', 'stroke', 'labelSize'];
  const el = id => document.getElementById(id);
  let lastSvg = '';

  function readParams() {
    const p = {};
    ids.forEach(id => p[id] = parseFloat(el(id).value));
    p.dims = el('dims').value;
    p.layout = el('layout').value;
    p.labels = el('labels').checked;
    p.numColor = el('numColor').value;
    p.ratiosW = el('ratiosW').value;
    p.ratiosL = el('ratiosL').value;
    p.color = el('color').value;
    return p;
  }

  // The generator works with outer dimensions; inner ones grow by the
  // plywood thickness — two walls for width/length, one for height (open top).
  function toOuter(p) {
    if (p.dims !== 'inner') return p;
    return Object.assign({}, p, {
      width: p.width + 2 * p.thickness,
      length: p.length + 2 * p.thickness,
      height: p.height + p.thickness,
    });
  }

  function refresh() {
    const p = readParams();
    el('labelSizeRow').style.display = p.labels ? '' : 'none';
    const res = generateDivBox(toOuter(p));
    lastSvg = res.svg;
    el('warnings').innerHTML = res.warnings.map(w => '<div>⚠ ' + w + '</div>').join('');
    el('preview').innerHTML = res.svg || '';
  }

  ids.forEach(id => el(id).addEventListener('input', refresh));
  ['ratiosW', 'ratiosL'].forEach(id => el(id).addEventListener('input', refresh));
  ['dims', 'layout', 'color', 'numColor', 'labels'].forEach(id => el(id).addEventListener('change', refresh));
  el('download').addEventListener('click', () => {
    if (!lastSvg) return;
    const p = readParams();
    downloadSvg(lastSvg, 'divbox_' + p.width + 'x' + p.length + 'x' + p.height + '.svg');
  });
  refresh();
})();
