// UI glue for the Hilbert curve page.
'use strict';

(function () {
  const ids = ['size', 'order', 'stroke', 'boxW', 'boxH'];
  const el = id => document.getElementById(id);
  let lastSvg = '';

  function readParams() {
    return {
      size: parseFloat(el('size').value),
      order: parseFloat(el('order').value),
      stroke: parseFloat(el('stroke').value),
      color: el('color').value,
      withBox: el('withBox').checked,
      boxW: parseFloat(el('boxW').value),
      boxH: parseFloat(el('boxH').value),
      boxColor: el('boxColor').value,
    };
  }

  function refresh() {
    const p = readParams();
    el('boxRow').style.display = p.withBox ? '' : 'none';
    const res = generateHilbert(p);
    lastSvg = res.svg;
    el('warnings').innerHTML = res.warnings.map(w => '<div>⚠ ' + w + '</div>').join('');
    el('preview').innerHTML = res.svg || '';
  }

  // Fill the box inputs with dimensions fitted to the curve square.
  function fitBox() {
    const size = parseFloat(el('size').value);
    if (!(size > 0)) return;
    el('boxW').value = fitBoxDim(size);
    el('boxH').value = fitBoxDim(size);
  }

  ids.forEach(id => el(id).addEventListener('input', refresh));
  el('color').addEventListener('change', refresh);
  el('boxColor').addEventListener('change', refresh);
  el('withBox').addEventListener('change', () => {
    if (el('withBox').checked) fitBox();
    refresh();
  });
  el('fitBox').addEventListener('click', () => { fitBox(); refresh(); });
  el('download').addEventListener('click', () => {
    if (!lastSvg) return;
    const p = readParams();
    downloadSvg(lastSvg, 'hilbert_' + p.size + 'mm_o' + Math.round(p.order) + '.svg');
  });
  refresh();
})();
