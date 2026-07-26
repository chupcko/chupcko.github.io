// UI glue for the ruler page.
'use strict';

(function () {
  const ids = ['length', 'marginL', 'marginR', 'height', 'tick05', 'tick1', 'tick5', 'tick10', 'stroke', 'labelSize'];
  const el = id => document.getElementById(id);
  let lastSvg = '';

  function readParams() {
    const p = {};
    ids.forEach(id => p[id] = parseFloat(el(id).value));
    const u = el('units').value;
    p.units = u === 'mm' ? 'mm' : 'inch';
    p.divisions = u === 'inchbin' ? 'binary' : 'decimal';
    p.fine = el('fine').checked;
    p.labels = el('labels').checked;
    // an inverse scale only makes sense with numbers on it
    p.inverse = p.labels && el('inverse').checked;
    p.markColor = el('markColor').value;
    p.boxColor = el('boxColor').value;
    return p;
  }

  function refresh() {
    const p = readParams();
    const u = el('units').value;
    el('fineLabel').textContent = u === 'mm' ? 'Half-millimeter ticks'
      : u === 'inchbin' ? '1/32 inch ticks' : '1/20 inch ticks';
    el('tick05Row').style.display = p.fine ? '' : 'none';
    el('labelSizeRow').style.display = p.labels ? '' : 'none';
    el('inverseRow').style.display = p.labels ? '' : 'none';
    el('lengthLabel').textContent = p.units === 'inch' ? 'Length (inches)' : 'Length (mm)';
    const res = generateRuler(p);
    lastSvg = res.svg;
    el('warnings').innerHTML = res.warnings.map(w => '<div>⚠ ' + w + '</div>').join('');
    el('preview').innerHTML = res.svg || '';
  }

  ids.forEach(id => el(id).addEventListener('input', refresh));
  ['fine', 'inverse', 'markColor', 'boxColor', 'labels'].forEach(id =>
    el(id).addEventListener('change', refresh));
  // switching mm ↔ inches converts the length so the ruler keeps its size
  let wasInch = el('units').value !== 'mm';
  el('units').addEventListener('change', () => {
    const isInch = el('units').value !== 'mm';
    if (isInch !== wasInch) {
      const v = parseFloat(el('length').value);
      if (v > 0) el('length').value = isInch ? Math.max(1, Math.round(v / 25.4)) : Math.round(v * 25.4);
      wasInch = isInch;
    }
    refresh();
  });
  el('download').addEventListener('click', () => {
    if (!lastSvg) return;
    const p = readParams();
    downloadSvg(lastSvg, 'ruler_' + p.length + (p.units === 'inch' ? 'in' : 'mm') + '.svg');
  });
  refresh();
})();
