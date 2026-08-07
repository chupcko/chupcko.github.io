// UI glue for the round stamp page.
'use strict';

(function () {
  const el = id => document.getElementById(id);
  const FONT_GROUPS = [
    ['Sans serif', [
      ['sans', 'Source Sans', 'font/source-sans.otf'],
      ['sansBold', 'Source Sans Bold', 'font/source-sans-bold.otf'],
      ['cooper', 'Cooper Hewitt Bold', 'font/cooper-hewitt-bold.otf'],
    ]],
    ['Condensed', [
      ['bebas', 'Bebas Neue', 'font/bebas-neue.otf'],
      ['league', 'League Gothic', 'font/league-gothic.otf'],
    ]],
    ['Serif', [
      ['serif', 'Source Serif', 'font/source-serif.otf'],
      ['serifSemibold', 'Source Serif Semibold', 'font/source-serif-semibold.otf'],
      ['cormorant', 'Cormorant Garamond Semibold', 'font/cormorant-garamond-semibold.otf'],
    ]],
    ['Monospace', [
      ['code', 'Source Code', 'font/source-code.otf'],
      ['codeBold', 'Source Code Bold', 'font/source-code-bold.otf'],
    ]],
    ['Special', [
      ['stencil', 'Stencil', 'font/stencil.otf'],
    ]],
  ];
  const FONT_FILES = Object.fromEntries(
    FONT_GROUPS.flatMap(group => group[1].map(item => [item[0], [item[1], item[2]]]))
  );
  const fonts = {};
  let lastSvg = '';

  document.querySelectorAll('.font-select').forEach(select => {
    FONT_GROUPS.forEach(([label, items]) => {
      const group = document.createElement('optgroup');
      group.label = label;
      items.forEach(item => group.appendChild(new Option(item[1], item[0])));
      select.appendChild(group);
    });
  });
  el('centerFont').value = 'stencil';

  function params() {
    return {
      diameter: parseFloat(el('diameter').value),
      showTop: el('showTop').checked,
      topText: el('topText').value,
      topFont: el('topFont').value,
      topSize: parseFloat(el('topSize').value),
      topCircleDiameter: parseFloat(el('topCircleDiameter').value),
      showBottom: el('showBottom').checked,
      bottomText: el('bottomText').value,
      bottomFont: el('bottomFont').value,
      bottomSize: parseFloat(el('bottomSize').value),
      bottomCircleDiameter: parseFloat(el('bottomCircleDiameter').value),
      showCenter: el('showCenter').checked,
      centerText: el('centerText').value,
      centerFont: el('centerFont').value,
      centerSize: parseFloat(el('centerSize').value),
      outerRing: el('outerRing').checked,
      outerRingDiameter: parseFloat(el('outerRingDiameter').value),
      outerRingStroke: parseFloat(el('outerRingStroke').value),
      outerRingStyle: el('outerRingStyle').value,
      innerRing: el('innerRing').checked,
      innerRingDiameter: parseFloat(el('innerRingDiameter').value),
      innerRingStroke: parseFloat(el('innerRingStroke').value),
      innerRingStyle: el('innerRingStyle').value,
      additionalRing: el('additionalRing').checked,
      additionalRingDiameter: parseFloat(el('additionalRingDiameter').value),
      additionalRingStroke: parseFloat(el('additionalRingStroke').value),
      additionalRingStyle: el('additionalRingStyle').value,
      color: el('color').value,
      mirror: el('mirror').checked,
      invert: el('invert').checked,
      cutOutline: el('cutOutline').checked,
      cutStroke: parseFloat(el('cutStroke').value),
      cutColor: el('cutColor').value,
    };
  }

  function refresh() {
    el('topOpts').style.display = el('showTop').checked ? '' : 'none';
    el('bottomOpts').style.display = el('showBottom').checked ? '' : 'none';
    el('centerOpts').style.display = el('showCenter').checked ? '' : 'none';
    el('outerRingOpts').style.display = el('outerRing').checked ? '' : 'none';
    el('innerRingOpts').style.display = el('innerRing').checked ? '' : 'none';
    el('additionalRingOpts').style.display = el('additionalRing').checked ? '' : 'none';
    el('cutOutlineOpts').style.display = el('cutOutline').checked ? '' : 'none';
    const circleEcho = id => {
      const value = parseFloat(el(id + 'CircleDiameter').value);
      el(id + 'CircleEcho').textContent = value > 0 ? '= ' + (value / 2) + ' mm from center' : '';
    };
    circleEcho('top');
    circleEcho('bottom');
    if (Object.keys(fonts).length !== Object.keys(FONT_FILES).length) return;
    const p = params();
    const result = generateStamp(fonts, p);
    lastSvg = result.svg;
    el('preview').innerHTML = result.svg || '';
    if (result.svg) {
      el('computed').textContent = p.cutOutline
        ? 'Stamp and cutting outline: Ø' + p.diameter + ' mm'
        : 'Stamp: Ø' + p.diameter + ' mm';
    } else {
      el('computed').textContent = '';
    }
    el('warnings').innerHTML = result.warnings.map(w => '<div>⚠ ' + w + '</div>').join('');
  }

  document.querySelectorAll('input, select').forEach(input => {
    input.addEventListener(input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'input', refresh);
  });
  el('download').addEventListener('click', () => {
    if (lastSvg) downloadSvg(lastSvg, 'stamp_' + params().diameter + 'mm.svg');
  });

  Promise.all(Object.entries(FONT_FILES).map(([key, item]) =>
    fetch(item[1]).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(buf => { fonts[key] = parseFont(buf); })
  )).then(refresh).catch(error => {
    el('warnings').innerHTML = '<div>⚠ Cannot load fonts (' + error.message + ')</div>';
  });
})();
