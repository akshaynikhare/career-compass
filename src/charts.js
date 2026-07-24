/**
 * charts.js — Reusable, dependency-free SVG charts (window.Charts).
 *
 * House style: vanilla IIFE global, no build step, no external library.
 * Each builder returns a DOM node the caller appends. Callers pass already-
 * localized labels (window.T / window.pickLang) and palette hexes.
 *
 * Dark-mode aware: chart "chrome" (grid, axes, labels, tracks, tooltips) is
 * styled with CSS variables via .chart-* classes / inline var() styles, so it
 * follows the app's prefers-color-scheme theme. Saturated *series* colors
 * (RIASEC + category palettes) are passed in as explicit hex by design.
 *
 * API:
 *   Charts.radar({ axes:[{label,value(0-1),color}], size })          -> node
 *   Charts.multiLine({ series:[{label,color,values[]}], categories,
 *                      yUnit, yLabel })                               -> node
 *   Charts.donut({ segments:[{label,value,color}], centerValue,
 *                  centerLabel })                                     -> node
 *   Charts.hbars({ rows:[{label,value(0-1),color}] })                -> node
 */
(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs) {
    var node = document.createElementNS(SVGNS, tag);
    if (attrs) {
      for (var k in attrs) {
        if (attrs.hasOwnProperty(k) && attrs[k] != null) node.setAttribute(k, attrs[k]);
      }
    }
    return node;
  }

  function div(cls) {
    var d = document.createElement('div');
    if (cls) d.className = cls;
    return d;
  }

  // A chart wrapper is position:relative and owns one shared tooltip element.
  function makeWrap(extraCls) {
    var wrap = div('chart-wrap' + (extraCls ? ' ' + extraCls : ''));
    var tip = div('chart-tooltip');
    wrap.appendChild(tip);
    wrap._tip = tip;
    return wrap;
  }

  function showTip(wrap, html, clientX, clientY) {
    var tip = wrap._tip;
    tip.innerHTML = html;
    var wr = wrap.getBoundingClientRect();
    var x = clientX - wr.left;
    var y = clientY - wr.top;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
    tip.classList.add('visible');
  }

  function hideTip(wrap) {
    wrap._tip.classList.remove('visible');
  }

  // "nice" upper bound for an axis (1/2/2.5/5 × 10^n).
  function niceMax(v) {
    if (v <= 0) return 1;
    var exp = Math.floor(Math.log(v) / Math.LN10);
    var base = Math.pow(10, exp);
    var f = v / base;
    var nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nice * base;
  }

  // ── Radar / spider (RIASEC) ────────────────────────────────────────────────
  function radar(opts) {
    var axes = opts.axes || [];
    var n = axes.length;
    var wrap = makeWrap('chart-radar');
    if (n < 3) return wrap;

    var size = opts.size || 280;
    var cx = size / 2, cy = size / 2;
    var R = size * 0.34;              // outer radius (leave room for labels)
    var rings = [0.25, 0.5, 0.75, 1];

    var svg = el('svg', {
      viewBox: '0 0 ' + size + ' ' + size,
      width: '100%', height: 'auto',
      role: 'img', 'class': 'chart-svg'
    });

    function pt(i, frac) {
      var ang = (-90 + i * 360 / n) * Math.PI / 180;
      return { x: cx + Math.cos(ang) * R * frac, y: cy + Math.sin(ang) * R * frac };
    }

    // grid rings
    rings.forEach(function (frac) {
      var pts = [];
      for (var i = 0; i < n; i++) { var p = pt(i, frac); pts.push(p.x + ',' + p.y); }
      svg.appendChild(el('polygon', {
        points: pts.join(' '), fill: 'none',
        style: 'stroke:var(--border);stroke-width:1'
      }));
    });

    // spokes
    for (var i = 0; i < n; i++) {
      var o = pt(i, 1);
      svg.appendChild(el('line', {
        x1: cx, y1: cy, x2: o.x, y2: o.y,
        style: 'stroke:var(--border);stroke-width:1'
      }));
    }

    // data polygon (animated: scales up from centre)
    var dataPts = [];
    axes.forEach(function (a, idx) {
      var v = Math.max(0, Math.min(1, a.value || 0));
      var p = pt(idx, v);
      dataPts.push(p.x + ',' + p.y);
    });
    var gData = el('g', { 'class': 'chart-radar-data' });
    // transform-box:fill-box makes transform-origin resolve to the group's own
    // bounding box centre — consistent when the SVG is scaled to 100% width.
    gData.style.transformBox = 'fill-box';
    gData.style.transformOrigin = 'center';
    gData.style.transform = 'scale(0.2)';
    gData.style.opacity = '0';

    var poly = el('polygon', {
      points: dataPts.join(' '),
      style: 'fill:var(--primary);fill-opacity:0.16;stroke:var(--primary);stroke-width:2;stroke-linejoin:round'
    });
    gData.appendChild(poly);
    svg.appendChild(gData);

    // vertex dots (interactive) + axis labels
    axes.forEach(function (a, idx) {
      var v = Math.max(0, Math.min(1, a.value || 0));
      var p = pt(idx, v);
      var dot = el('circle', {
        cx: p.x, cy: p.y, r: 5,
        fill: a.color || 'var(--primary)',
        style: 'stroke:var(--white);stroke-width:2;cursor:pointer'
      });
      var disp = a.display != null ? a.display : (Math.round(v * 100) + '%');
      dot.addEventListener('mouseenter', function (e) {
        showTip(wrap, '<strong>' + a.label + '</strong><br>' + disp, e.clientX, e.clientY);
      });
      dot.addEventListener('mousemove', function (e) {
        showTip(wrap, '<strong>' + a.label + '</strong><br>' + disp, e.clientX, e.clientY);
      });
      dot.addEventListener('mouseleave', function () { hideTip(wrap); });
      gData.appendChild(dot);

      // label just outside the outer ring
      var lp = pt(idx, 1.16);
      var anchor = Math.abs(lp.x - cx) < 4 ? 'middle' : (lp.x > cx ? 'start' : 'end');
      var label = el('text', {
        x: lp.x, y: lp.y + 4, 'text-anchor': anchor,
        'class': 'chart-axis-label',
        style: 'fill:' + (a.color || 'var(--text)') + ';font-weight:700'
      });
      label.textContent = a.label;
      svg.appendChild(label);
    });

    wrap.appendChild(svg);

    // kick off entrance animation
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        gData.style.transition = 'transform 0.6s cubic-bezier(0.22,1,0.36,1), opacity 0.4s ease';
        gData.style.transform = 'scale(1)';
        gData.style.opacity = '1';
      });
    });

    return wrap;
  }

  // ── Multi-line progression (salary Entry→Mid→Senior) ───────────────────────
  function multiLine(opts) {
    var series = (opts.series || []).filter(function (s) { return s.values && s.values.length; });
    var categories = opts.categories || [];
    var wrap = makeWrap('chart-line');
    if (!series.length || categories.length < 2) return wrap;

    var W = 520, H = 260;
    var padL = 44, padR = 14, padT = 16, padB = 34;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;

    var maxVal = 0;
    series.forEach(function (s) {
      s.values.forEach(function (v) { if (v > maxVal) maxVal = v; });
    });
    var yMax = niceMax(maxVal);
    var m = categories.length;

    function xAt(i) { return padL + (m === 1 ? 0 : i * plotW / (m - 1)); }
    function yAt(v) { return padT + plotH - (v / yMax) * plotH; }

    var svg = el('svg', {
      viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: 'auto',
      preserveAspectRatio: 'xMidYMid meet', 'class': 'chart-svg'
    });

    // horizontal gridlines + y labels (recessive)
    var ticks = 4;
    for (var t = 0; t <= ticks; t++) {
      var val = yMax * t / ticks;
      var y = yAt(val);
      svg.appendChild(el('line', {
        x1: padL, y1: y, x2: W - padR, y2: y,
        style: 'stroke:var(--border);stroke-width:1;stroke-opacity:' + (t === 0 ? '1' : '0.6')
      }));
      var yl = el('text', {
        x: padL - 8, y: y + 3.5, 'text-anchor': 'end', 'class': 'chart-tick',
        style: 'fill:var(--muted)'
      });
      yl.textContent = (opts.yUnit || '') + Math.round(val);
      svg.appendChild(yl);
    }

    // x category labels
    categories.forEach(function (c, i) {
      var xl = el('text', {
        x: xAt(i), y: H - padB + 20, 'text-anchor': 'middle', 'class': 'chart-tick',
        style: 'fill:var(--muted);font-weight:600'
      });
      xl.textContent = c;
      svg.appendChild(xl);
    });

    // y axis caption
    if (opts.yLabel) {
      var cap = el('text', {
        x: padL - 34, y: padT + plotH / 2, 'text-anchor': 'middle', 'class': 'chart-tick',
        transform: 'rotate(-90 ' + (padL - 34) + ' ' + (padT + plotH / 2) + ')',
        style: 'fill:var(--muted)'
      });
      cap.textContent = opts.yLabel;
      svg.appendChild(cap);
    }

    // one polyline + dots per series
    series.forEach(function (s) {
      var pts = s.values.map(function (v, i) { return xAt(i) + ',' + yAt(v); });
      var line = el('polyline', {
        points: pts.join(' '), fill: 'none',
        style: 'stroke:' + s.color + ';stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round'
      });
      // draw-on animation
      svg.appendChild(line);
      try {
        var len = line.getTotalLength ? line.getTotalLength() : 0;
        if (len) {
          line.style.strokeDasharray = len;
          line.style.strokeDashoffset = len;
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              line.style.transition = 'stroke-dashoffset 0.7s ease';
              line.style.strokeDashoffset = '0';
            });
          });
        }
      } catch (e) {}

      s.values.forEach(function (v, i) {
        var dot = el('circle', {
          cx: xAt(i), cy: yAt(v), r: 4.5,
          fill: s.color, style: 'stroke:var(--white);stroke-width:2;cursor:pointer'
        });
        var cat = categories[i] || '';
        dot.addEventListener('mouseenter', function (e) {
          showTip(wrap, '<strong>' + s.label + '</strong><br>' + cat + ': ' + (opts.yUnit || '') + v + (opts.valueSuffix || ''), e.clientX, e.clientY);
        });
        dot.addEventListener('mousemove', function (e) {
          showTip(wrap, '<strong>' + s.label + '</strong><br>' + cat + ': ' + (opts.yUnit || '') + v + (opts.valueSuffix || ''), e.clientX, e.clientY);
        });
        dot.addEventListener('mouseleave', function () { hideTip(wrap); });
        svg.appendChild(dot);
      });
    });

    wrap.appendChild(svg);

    // legend (identity is never colour-alone → always present for ≥1 series here)
    var legend = div('chart-legend');
    series.forEach(function (s) {
      var item = div('chart-legend-item');
      var dot = div('chart-legend-dot');
      dot.style.background = s.color;
      var label = document.createElement('span');
      label.textContent = s.label;
      item.appendChild(dot);
      item.appendChild(label);
      legend.appendChild(item);
    });
    wrap.appendChild(legend);

    return wrap;
  }

  // ── Donut (category distribution) ──────────────────────────────────────────
  function donut(opts) {
    var segments = (opts.segments || []).filter(function (s) { return s.value > 0; });
    var wrap = makeWrap('chart-donut');
    if (!segments.length) return wrap;

    var size = 200, cx = size / 2, cy = size / 2;
    var stroke = 26, r = (size - stroke) / 2 - 4;
    var C = 2 * Math.PI * r;
    var total = segments.reduce(function (a, s) { return a + s.value; }, 0);
    var gapDeg = segments.length > 1 ? 3 : 0;   // small surface gap between arcs

    var svg = el('svg', {
      viewBox: '0 0 ' + size + ' ' + size, width: '100%', height: 'auto',
      'class': 'chart-svg', style: 'max-width:220px;margin:0 auto;display:block'
    });

    // track
    svg.appendChild(el('circle', {
      cx: cx, cy: cy, r: r, fill: 'none',
      style: 'stroke:var(--border);stroke-width:' + stroke + ';stroke-opacity:0.4'
    }));

    var acc = 0;
    segments.forEach(function (s) {
      var frac = s.value / total;
      var sweep = frac * 360 - gapDeg;
      if (sweep < 0) sweep = frac * 360;
      var arcLen = (sweep / 360) * C;
      var rot = -90 + (acc / total) * 360 + gapDeg / 2;

      var arc = el('circle', {
        cx: cx, cy: cy, r: r, fill: 'none',
        stroke: s.color, 'stroke-width': stroke, 'stroke-linecap': 'butt',
        'stroke-dasharray': arcLen + ' ' + (C - arcLen),
        'stroke-dashoffset': 0,
        transform: 'rotate(' + rot + ' ' + cx + ' ' + cy + ')',
        style: 'cursor:pointer;transition:stroke-width 0.15s ease'
      });
      var pct = Math.round(frac * 100);
      arc.addEventListener('mouseenter', function (e) {
        arc.setAttribute('stroke-width', stroke + 5);
        showTip(wrap, '<strong>' + s.label + '</strong><br>' + s.value + ' · ' + pct + '%', e.clientX, e.clientY);
      });
      arc.addEventListener('mousemove', function (e) {
        showTip(wrap, '<strong>' + s.label + '</strong><br>' + s.value + ' · ' + pct + '%', e.clientX, e.clientY);
      });
      arc.addEventListener('mouseleave', function () {
        arc.setAttribute('stroke-width', stroke);
        hideTip(wrap);
      });
      svg.appendChild(arc);
      acc += s.value;
    });

    // centre label
    var cv = el('text', {
      x: cx, y: cy - 2, 'text-anchor': 'middle', 'class': 'chart-donut-value',
      style: 'fill:var(--text);font-weight:800'
    });
    cv.textContent = opts.centerValue != null ? opts.centerValue : total;
    svg.appendChild(cv);
    if (opts.centerLabel) {
      var cl = el('text', {
        x: cx, y: cy + 16, 'text-anchor': 'middle', 'class': 'chart-donut-caption',
        style: 'fill:var(--muted)'
      });
      cl.textContent = opts.centerLabel;
      svg.appendChild(cl);
    }

    wrap.appendChild(svg);

    // legend
    var legend = div('chart-legend chart-legend-donut');
    segments.forEach(function (s) {
      var item = div('chart-legend-item');
      var dot = div('chart-legend-dot');
      dot.style.background = s.color;
      var label = document.createElement('span');
      label.textContent = s.label + ' (' + s.value + ')';
      item.appendChild(dot);
      item.appendChild(label);
      legend.appendChild(item);
    });
    wrap.appendChild(legend);

    return wrap;
  }

  // ── Horizontal bars (deep-dive confidence) ─────────────────────────────────
  function hbars(opts) {
    var rows = (opts.rows || []);
    var wrap = makeWrap('chart-hbars');
    if (!rows.length) return wrap;

    rows.forEach(function (row) {
      var v = Math.max(0, Math.min(1, row.value || 0));
      var pct = Math.round(v * 100);

      var r = div('chart-hbar-row');

      var label = div('chart-hbar-label');
      label.textContent = row.label;

      var track = div('chart-hbar-track');
      var fill = div('chart-hbar-fill');
      fill.style.background = row.color || 'var(--primary)';
      fill.style.width = '0%';
      track.appendChild(fill);

      var pctEl = div('chart-hbar-pct');
      pctEl.textContent = pct + '%';

      r.appendChild(label);
      r.appendChild(track);
      r.appendChild(pctEl);
      wrap.appendChild(r);

      r.addEventListener('mouseenter', function (e) {
        showTip(wrap, '<strong>' + row.label + '</strong><br>' + pct + '%', e.clientX, e.clientY);
      });
      r.addEventListener('mousemove', function (e) {
        showTip(wrap, '<strong>' + row.label + '</strong><br>' + pct + '%', e.clientX, e.clientY);
      });
      r.addEventListener('mouseleave', function () { hideTip(wrap); });

      requestAnimationFrame(function () {
        requestAnimationFrame(function () { fill.style.width = pct + '%'; });
      });
    });

    return wrap;
  }

  window.Charts = { radar: radar, multiLine: multiLine, donut: donut, hbars: hbars };
})();
