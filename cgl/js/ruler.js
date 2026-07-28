// UI glue for the ruler page: shared body settings plus one independent
// block of controls per edge (top / bot prefixes).
'use strict';

(function () {
  const globals = ['length', 'marginL', 'marginR', 'height', 'stroke'];
  const edgeNums = ['Tick05', 'Tick1', 'Tick5', 'Tick10', 'LabelSize'];
  const edgeChks = ['Flip', 'Fine', 'Labels'];
  const el = id => document.getElementById(id);
  let lastSvg = '';

  const FINE_TEXT = {
    mm: 'Half-millimeter ticks',
    inchbin: '1/32 inch ticks',
    inchdec: '1/20 inch ticks',
  };

  // One edge's params, or null when its scale is set to None.
  function readEdge(pre) {
    const scale = el(pre + 'Scale').value;
    if (scale === 'none') return null;
    const e = {
      scale,
      rtl: el(pre + 'Dir').value === 'rtl',
      fine: el(pre + 'Fine').checked,
      labels: el(pre + 'Labels').checked,
    };
    // upside-down digits only mean something when there are digits
    e.flip = e.labels && el(pre + 'Flip').checked;
    edgeNums.forEach(n => e[n[0].toLowerCase() + n.slice(1)] = parseDim(el(pre + n).value, 'mm'));
    return e;
  }

  // Body dimensions go through the parser: a bare number is millimeters,
  // any term may name its own unit (mm, cm, in, ").
  const dims = ['length', 'marginL', 'marginR', 'height'];

  function readParams() {
    const p = {};
    dims.forEach(id => p[id] = parseDim(el(id).value, 'mm'));
    p.stroke = parseFloat(el('stroke').value);
    p.markColor = el('markColor').value;
    p.boxColor = el('boxColor').value;
    p.top = readEdge('top');
    p.bottom = readEdge('bot');
    return p;
  }

  // A parsed dimension in all three units, one decimal, the binary-inch
  // form rounded to the nearest 1/32 (≈ marks a rounded value).
  function dimEcho(v) {
    if (Number.isNaN(v)) return '⚠ cannot read this';
    const mm = Math.round(v * 10) / 10;
    const inch = v / 25.4;
    const dec = Math.round(inch * 10) / 10;
    const k = Math.round(inch * 32);
    let num = k % 32, den = 32;
    const whole = (k - num) / 32;
    while (num > 0 && num % 2 === 0) { num /= 2; den /= 2; }
    const bin = (whole || !num ? whole : '') + (num ? (whole ? ' ' : '') + num + '/' + den : '');
    return (Math.abs(v - mm) > 1e-9 ? '≈ ' : '= ') + mm + ' mm' +
      (Math.abs(inch - dec) > 1e-9 ? ' ≈ ' : ' = ') + dec + ' in' +
      (Math.abs(inch * 32 - k) > 1e-9 ? ' ≈ ' : ' = ') + bin + ' in';
  }

  // Echo what each dimension parsed to, so exotic input is verifiable.
  function refreshEchoes() {
    const echo = id => el(id + 'Echo').textContent = dimEcho(parseDim(el(id).value, 'mm'));
    dims.forEach(echo);
    ['top', 'bot'].forEach(pre => edgeNums.forEach(n => echo(pre + n)));
  }

  function refreshEdgeUi(pre) {
    const scale = el(pre + 'Scale').value;
    el(pre + 'Opts').style.display = scale === 'none' ? 'none' : '';
    if (scale !== 'none') el(pre + 'FineLabel').textContent = FINE_TEXT[scale];
    el(pre + 'Tick05Row').style.display = el(pre + 'Fine').checked ? '' : 'none';
    const labels = el(pre + 'Labels').checked;
    el(pre + 'LabelSizeRow').style.display = labels ? '' : 'none';
    el(pre + 'FlipRow').style.display = labels ? '' : 'none';
  }

  function refresh() {
    refreshEdgeUi('top');
    refreshEdgeUi('bot');
    refreshEchoes();
    const res = generateRuler(readParams());
    lastSvg = res.svg;
    el('warnings').innerHTML = res.warnings.map(w => '<div>⚠ ' + w + '</div>').join('');
    el('preview').innerHTML = res.svg || '';
  }

  globals.forEach(id => el(id).addEventListener('input', refresh));
  ['markColor', 'boxColor'].forEach(id => el(id).addEventListener('change', refresh));
  ['top', 'bot'].forEach(pre => {
    ['Scale', 'Dir'].forEach(n => el(pre + n).addEventListener('change', refresh));
    edgeChks.forEach(n => el(pre + n).addEventListener('change', refresh));
    edgeNums.forEach(n => el(pre + n).addEventListener('input', refresh));
  });
  el('download').addEventListener('click', () => {
    if (!lastSvg) return;
    const lenMm = parseDim(el('length').value, 'mm');
    downloadSvg(lastSvg, 'ruler_' + (Math.round(lenMm * 10) / 10) + 'mm.svg');
  });
  refresh();
})();
