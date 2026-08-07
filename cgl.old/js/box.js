// UI glue for the box page (plain or with a divider grid).
'use strict';

(function () {
  const ids = ['width', 'length', 'height', 'frontH', 'thickness', 'finger', 'divH', 'cols', 'rows', 'stroke', 'labelSize'];
  const el = id => document.getElementById(id);
  let lastSvg = '';

  function readParams() {
    const p = {};
    ids.forEach(id => p[id] = parseFloat(el(id).value));
    p.dims = el('dims').value;
    p.layout = el('layout').value;
    p.labels = el('labels').checked;
    p.view3d = el('view3d').checked;
    p.slope = el('slope').checked;
    p.dividers = el('dividers').checked;
    p.anchor = el('anchor').checked;
    p.numColor = el('numColor').value;
    p.ratiosW = el('ratiosW').value;
    p.ratiosL = el('ratiosL').value;
    p.color = el('color').value;
    if (!p.dividers) {
      // Plain box: ignore whatever the hidden divider fields hold.
      p.cols = 1;
      p.rows = 1;
      p.ratiosW = '';
      p.ratiosL = '';
      p.anchor = false;
    }
    return p;
  }

  // How many compartments a ratio field defines (single entries don't count,
  // matching the generator's parsing).
  function ratioCount(str, count) {
    const parts = (str || '').trim().split(/[,;\s]+/).filter(Boolean);
    return parts.length > 1 ? parts.length : Math.max(1, Math.round(count) || 1);
  }

  // The generator works with outer dimensions; inner ones grow by the
  // plywood thickness — two walls for width/length, one for height (open
  // top). True inner also adds the dividers' thickness, so the given size
  // is pure compartment space (and mm values in the ratio fields are exact).
  function toOuter(p) {
    if (p.dims === 'outer') return p;
    const t = p.thickness;
    let dw = 2 * t, dl = 2 * t;
    if (p.dims === 'trueinner') {
      dw += (ratioCount(p.ratiosW, p.cols) - 1) * t;
      dl += (ratioCount(p.ratiosL, p.rows) - 1) * t;
    }
    return Object.assign({}, p, {
      width: p.width + dw,
      length: p.length + dl,
      height: p.height + t,
      frontH: p.frontH + t,
    });
  }

  function refresh() {
    const p = readParams();
    el('labelSizeRow').style.display = p.labels ? '' : 'none';
    el('dividerRow').style.display = p.dividers ? '' : 'none';
    el('slopeRow').style.display = p.slope ? '' : 'none';
    const res = generateDivBox(toOuter(p));
    lastSvg = res.svg;
    el('warnings').innerHTML = res.warnings.map(w => '<div>⚠ ' + w + '</div>').join('');
    el('preview').innerHTML = res.svg || '';
    // 3D preview: the module (js/box3d.js) picks up window.cglParts3d when
    // it loads; afterwards it's driven through window.CglBox3d.
    window.cglParts3d = res.parts3d;
    el('preview').style.display = p.view3d ? 'none' : '';
    el('preview3d').style.display = p.view3d ? '' : 'none';
    if (p.view3d && window.CglBox3d) window.CglBox3d.update(res.parts3d);
  }

  ids.forEach(id => el(id).addEventListener('input', refresh));
  ['ratiosW', 'ratiosL'].forEach(id => el(id).addEventListener('input', refresh));
  ['dims', 'layout', 'color', 'numColor', 'labels', 'view3d', 'slope', 'dividers', 'anchor'].forEach(id => el(id).addEventListener('change', refresh));
  el('download').addEventListener('click', () => {
    if (!lastSvg) return;
    const p = readParams();
    downloadSvg(lastSvg, 'box_' + p.width + 'x' + p.length + 'x' + p.height + '.svg');
  });
  refresh();
})();
