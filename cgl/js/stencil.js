// UI glue for the stencil text page.
'use strict';

(function () {
  const ids = ['text', 'sizeMode', 'sizeValue', 'boxW', 'boxH', 'stroke'];
  const el = id => document.getElementById(id);
  let FONT = null, lastSvg = '';

  function readParams() {
    return {
      text: el('text').value,
      sizeMode: el('sizeMode').value,
      sizeValue: parseFloat(el('sizeValue').value),
      withBox: el('withBox').checked,
      boxW: parseFloat(el('boxW').value),
      boxH: parseFloat(el('boxH').value),
      stroke: parseFloat(el('stroke').value),
      textColor: el('color').value,
      boxColor: el('boxColor').value,
    };
  }

  function refresh() {
    const p = readParams();
    el('boxRow').style.display = p.withBox ? '' : 'none';
    if (!FONT) return;
    const res = generateStencil(FONT, p);
    lastSvg = res.svg;
    el('warnings').innerHTML = res.warnings.map(w => '<div>⚠ ' + w + '</div>').join('');
    el('computed').textContent = res.textW ?
      'Text: ' + res.textW.toFixed(1) + ' × ' + res.textH.toFixed(1) + ' mm' : '';
    el('preview').innerHTML = res.svg || '';
  }

  function download() {
    if (!lastSvg) return;
    const name = readParams().text.replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'text';
    downloadSvg(lastSvg, 'stencil_' + name + '.svg');
  }

  // Fill the box inputs with dimensions fitted to the current text.
  function fitBox() {
    if (!FONT) return;
    const res = generateStencil(FONT, { ...readParams(), withBox: false });
    if (!res.textW) return;
    el('boxW').value = fitBoxDim(res.textW);
    el('boxH').value = fitBoxDim(res.textH);
  }

  ids.forEach(id => el(id).addEventListener('input', refresh));
  el('withBox').addEventListener('change', () => {
    if (el('withBox').checked) fitBox();
    refresh();
  });
  el('fitBox').addEventListener('click', () => { fitBox(); refresh(); });
  el('color').addEventListener('change', refresh);
  el('boxColor').addEventListener('change', refresh);
  el('download').addEventListener('click', download);

  fetch('font/stencil.otf')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(buf => { FONT = parseFont(buf); refresh(); })
    .catch(e => { el('warnings').innerHTML = '<div>⚠ Cannot load font/stencil.otf (' + e.message + ')</div>'; });
  refresh();
})();
