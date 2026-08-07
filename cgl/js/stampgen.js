// Round stamp generator. Text is converted to font outlines and positioned
// glyph by glyph, including the two curved lines.
'use strict';

function stampGlyphs(font, text, scale, tracking) {
  const glyphs = [], missing = [];
  for (const ch of text) {
    const id = font.glyphId(ch.codePointAt(0));
    if (id === 0 && ch !== ' ') missing.push(ch);
    glyphs.push({ contours: font.outlineOf(id), advance: font.advance(id) * scale + tracking });
  }
  return { glyphs, missing, width: glyphs.reduce((n, g) => n + g.advance, 0) };
}

function stampPath(contours, tx, bounds) {
  if (bounds) {
    const grow = (x, y) => {
      const p = tx(x, y);
      bounds.x0 = Math.min(bounds.x0, p[0]);
      bounds.y0 = Math.min(bounds.y0, p[1]);
      bounds.x1 = Math.max(bounds.x1, p[0]);
      bounds.y1 = Math.max(bounds.y1, p[1]);
    };
    contours.forEach(cont => {
      grow(cont.start[0], cont.start[1]);
      cont.segs.forEach(seg => {
        for (let i = 0; i < seg.p.length; i += 2) grow(seg.p[i], seg.p[i + 1]);
      });
    });
  }
  return contours.map(cont => contourToPath(cont, tx)).join('');
}

function stampLineAttrs(stroke, style, radius) {
  const precise = v => (Math.round(v * 1000000000) / 1000000000).toString();
  const circumference = 2 * Math.PI * radius;
  let dash = '';
  if (style === 'dashed') {
    const count = Math.max(3, Math.round(circumference / (stroke * 8)));
    const unit = circumference / count;
    dash = precise(unit * 5 / 8) + ' ' + precise(unit * 3 / 8);
  }
  if (style === 'dotted') {
    const count = Math.max(3, Math.round(circumference / (stroke * 3)));
    dash = '0 ' + precise(circumference / count);
  }
  if (style === 'dashdot') {
    const count = Math.max(3, Math.round(circumference / (stroke * 10)));
    const unit = circumference / count;
    dash = precise(unit / 2) + ' ' + precise(unit / 4) + ' 0 ' + precise(unit / 4);
  }
  return ' stroke-width="' + fmtMm(stroke) + '"' +
    (dash ? ' stroke-dasharray="' + dash + '" stroke-linecap="round"' : '');
}

function curvedTextPath(font, text, size, radius, cx, cy, bottom, warnings, label, bounds) {
  if (!text.trim()) return '';
  const scale = size / font.unitsPerEm;
  const run = stampGlyphs(font, text, scale, size * 0.06);
  if (run.missing.length) warnings.push(label + ' missing: ' + [...new Set(run.missing)].join(' '));
  const totalAngle = run.width / radius;
  if (totalAngle > Math.PI * 1.45) warnings.push(label + ' is too long for this diameter; reduce the text size.');
  let travelled = 0, d = '';
  run.glyphs.forEach(g => {
    const mid = travelled + g.advance / 2;
    const theta = bottom
      ? 3 * Math.PI / 2 - totalAngle / 2 + mid / radius
      : Math.PI / 2 + totalAngle / 2 - mid / radius;
    const px = cx + radius * Math.cos(theta);
    const py = cy - radius * Math.sin(theta);
    const glyphCenter = (g.advance - size * 0.06) / (2 * scale);
    const tx = bottom
      ? (x, y) => [px + (x - glyphCenter) * scale * -Math.sin(theta) + y * scale * -Math.cos(theta),
        py + (x - glyphCenter) * scale * -Math.cos(theta) + y * scale * Math.sin(theta)]
      : (x, y) => [px + (x - glyphCenter) * scale * Math.sin(theta) + y * scale * Math.cos(theta),
        py + (x - glyphCenter) * scale * Math.cos(theta) - y * scale * Math.sin(theta)];
    d += stampPath(g.contours, tx, bounds);
    travelled += g.advance;
  });
  return d;
}

function straightTextPath(font, text, size, cx, cy, maxWidth, warnings, bounds) {
  if (!text.trim()) return '';
  let scale = size / font.unitsPerEm;
  const lay = layoutText(font, text);
  if (lay.missing.length) warnings.push('Center text missing: ' + [...new Set(lay.missing)].join(' '));
  if (!(lay.bb.x1 > lay.bb.x0)) return '';
  const inkW = (lay.bb.x1 - lay.bb.x0) * scale;
  if (inkW > maxWidth) {
    warnings.push('Center text exceeds the available width and may extend outside the stamp.');
  }
  const inkH = (lay.bb.y1 - lay.bb.y0) * scale;
  const x0 = cx - (lay.bb.x1 - lay.bb.x0) * scale / 2;
  const y0 = cy - inkH / 2;
  const tx = (x, y) => [x0 + (x - lay.bb.x0) * scale, y0 + (lay.bb.y1 - y) * scale];
  let d = '';
  lay.glyphs.forEach(contours => { d += stampPath(contours, tx, bounds); });
  return d;
}

// params: diameter, topText/topFont/topSize, bottomText/bottomFont/bottomSize,
// showTop/showBottom/showCenter toggle the three lettering regions; each arc
// has an explicit baseline-circle diameter. Rings and the cutting outline can
// also be enabled independently.
function generateStamp(fonts, params) {
  const warnings = [];
  const diameter = params.diameter;
  if (!(diameter >= 20 && diameter <= 500)) {
    return { svg: '', warnings: ['Diameter must be between 20 and 500 mm.'] };
  }
  const sizes = [];
  if (params.showTop !== false) sizes.push(params.topSize);
  if (params.showBottom !== false) sizes.push(params.bottomSize);
  if (params.showCenter !== false) sizes.push(params.centerSize);
  if (sizes.some(v => !(v > 0))) return { svg: '', warnings: ['Text sizes must be positive numbers.'] };
  const cutStroke = params.cutStroke > 0 ? params.cutStroke : 0.08;
  const R = diameter / 2, m = 5;
  const cx = R + m, cy = R + m;
  const outerRingDiameter = params.outerRingDiameter;
  const innerRingDiameter = params.innerRingDiameter;
  const additionalRingDiameter = params.additionalRingDiameter;
  const outerRingStroke = params.outerRingStroke > 0 ? params.outerRingStroke : 0.3;
  const innerRingStroke = params.innerRingStroke > 0 ? params.innerRingStroke : 0.2;
  const additionalRingStroke = params.additionalRingStroke > 0 ? params.additionalRingStroke : 0.1;
  if ((params.outerRing !== false && !(outerRingDiameter > outerRingStroke)) ||
      (params.innerRing && !(innerRingDiameter > innerRingStroke)) ||
      (params.additionalRing && !(additionalRingDiameter > additionalRingStroke))) {
    return { svg: '', warnings: ['Ring diameters must be larger than the line width.'] };
  }
  if (params.outerRing !== false && outerRingDiameter > diameter) {
    warnings.push('The outer ring is larger than the stamp diameter.');
  }
  if (params.innerRing && innerRingDiameter > diameter) {
    warnings.push('The inner ring is larger than the stamp diameter.');
  }
  if (params.additionalRing && additionalRingDiameter > diameter) {
    warnings.push('The additional ring is larger than the stamp diameter.');
  }
  if (params.outerRing !== false && params.innerRing && innerRingDiameter >= outerRingDiameter) {
    warnings.push('The inner ring should be smaller than the outer ring.');
  }
  if (params.cutOutline && params.outerRing !== false && outerRingDiameter >= diameter) {
    warnings.push('The cutting outline should be larger than the outer stamp ring.');
  }
  const topDiameter = params.topCircleDiameter;
  const bottomDiameter = params.bottomCircleDiameter;
  const textBounds = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  if ((params.showTop !== false && !(topDiameter > 0)) ||
      (params.showBottom !== false && !(bottomDiameter > 0))) {
    return { svg: '', warnings: ['Text circle diameters must be positive numbers.'] };
  }
  if (params.showTop !== false && topDiameter / 2 + params.topSize > R) {
    warnings.push('Upper text reaches outside the stamp; reduce its circle diameter or text size.');
  }
  if (params.showBottom !== false && bottomDiameter / 2 >= R) {
    warnings.push('Lower text reaches the stamp edge; reduce its circle diameter.');
  }
  const top = params.showTop === false ? '' : curvedTextPath(fonts[params.topFont], params.topText,
    params.topSize, topDiameter / 2, cx, cy, false, warnings, 'Upper text', textBounds);
  const bottom = params.showBottom === false ? '' : curvedTextPath(fonts[params.bottomFont], params.bottomText,
    params.bottomSize, bottomDiameter / 2, cx, cy, true, warnings, 'Lower text', textBounds);
  const center = params.showCenter === false ? '' : straightTextPath(fonts[params.centerFont], params.centerText,
    params.centerSize, cx, cy, diameter * 0.56, warnings, textBounds);
  const color = params.color || COLORS.black;
  const transform = params.mirror ? ' transform="translate(' + fmtMm(2 * cx) + ' 0) scale(-1 1)"' : '';
  const stampArt = artColor => {
    let art = '';
    if (params.outerRing !== false) {
      const ringRadius = (outerRingDiameter - outerRingStroke) / 2;
      art += '<circle cx="' + cx + '" cy="' + cy + '" r="' +
        fmtMm(ringRadius) + '" fill="none" stroke="' + artColor +
        '"' + stampLineAttrs(outerRingStroke, params.outerRingStyle, ringRadius) + '/>\n';
    }
    if (params.innerRing) {
      const ringRadius = (innerRingDiameter - innerRingStroke) / 2;
      art += '<circle cx="' + cx + '" cy="' + cy + '" r="' +
        fmtMm(ringRadius) + '" fill="none" stroke="' + artColor +
        '"' + stampLineAttrs(innerRingStroke, params.innerRingStyle, ringRadius) + '/>\n';
    }
    if (params.additionalRing) {
      const ringRadius = (additionalRingDiameter - additionalRingStroke) / 2;
      art += '<circle cx="' + cx + '" cy="' + cy + '" r="' + fmtMm(ringRadius) +
        '" fill="none" stroke="' + artColor + '"' +
        stampLineAttrs(additionalRingStroke, params.additionalRingStyle, ringRadius) + '/>\n';
    }
    art += '<path d="' + top + bottom + center + '" fill="' + artColor +
      '" fill-rule="nonzero" stroke="none"/>\n';
    return '<g' + transform + '>\n' + art + '</g>\n';
  };
  let body;
  if (params.invert) {
    const outputSize = diameter + 2 * m;
    const fillRadius = params.cutOutline ? R - cutStroke / 2 : R;
    body = '<defs><mask id="stamp-negative" maskUnits="userSpaceOnUse" x="0" y="0" width="' +
      fmtMm(outputSize) + '" height="' + fmtMm(outputSize) + '">\n' +
      '<rect width="100%" height="100%" fill="#000000"/>\n' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + fmtMm(fillRadius) + '" fill="#ffffff"/>\n' +
      stampArt('#000000') + '</mask></defs>\n' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + fmtMm(fillRadius) + '" fill="' + color +
      '" mask="url(#stamp-negative)"/>\n';
  } else {
    body = stampArt(color);
  }
  if (params.cutOutline) {
    body += '<circle cx="' + cx + '" cy="' + cy + '" r="' + fmtMm(R - cutStroke / 2) +
      '" fill="none" stroke="' + (params.cutColor || COLORS.red) + '"' +
      stampLineAttrs(cutStroke, 'solid', R - cutStroke / 2) + '/>\n';
  }
  let minX = cx - R, minY = cy - R, maxX = cx + R, maxY = cy + R;
  if (textBounds.x0 !== Infinity) {
    let bx0 = textBounds.x0, bx1 = textBounds.x1;
    if (params.mirror) {
      bx0 = 2 * cx - textBounds.x1;
      bx1 = 2 * cx - textBounds.x0;
    }
    minX = Math.min(minX, bx0);
    minY = Math.min(minY, textBounds.y0);
    maxX = Math.max(maxX, bx1);
    maxY = Math.max(maxY, textBounds.y1);
  }
  const shiftX = m - minX, shiftY = m - minY;
  const outputW = maxX - minX + 2 * m, outputH = maxY - minY + 2 * m;
  if (Math.abs(shiftX) > 1e-9 || Math.abs(shiftY) > 1e-9) {
    body = '<g transform="translate(' + fmtMm(shiftX) + ' ' + fmtMm(shiftY) + ')">\n' + body + '</g>\n';
  }
  return { svg: svgDoc(fmtMm(outputW), fmtMm(outputH), body), warnings, outputDiameter: diameter };
}
