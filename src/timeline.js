(function () {
  'use strict';

  var result = null;
  try {
    var raw = localStorage.getItem('cat_result');
    if (raw) result = JSON.parse(raw);
  } catch (e) { result = null; }

  if (!result || !result.top10 || !result.top10.length) {
    document.getElementById('no-result').classList.remove('hidden');
    document.getElementById('no-result').style.display = 'block';
    return;
  }

  document.getElementById('timeline-content').classList.remove('hidden');

  var top10 = result.top10;
  var select = document.getElementById('career-select');

  top10.forEach(function (m, i) {
    var opt = document.createElement('option');
    opt.value = i;
    opt.textContent = '#' + (i + 1) + ' — ' + m.profession.name;
    select.appendChild(opt);
  });

  var params = new URLSearchParams(window.location.search);
  var idParam = params.get('id');
  var initialIndex = 0;

  if (idParam) {
    var found = top10.findIndex(function (m) { return String(m.profession.id) === idParam; });
    if (found !== -1) {
      initialIndex = found;
      select.value = found;
    }
  }

  renderTimeline(initialIndex);

  select.addEventListener('change', function () {
    renderTimeline(parseInt(select.value, 10));
  });

  function renderTimeline(idx) {
    var profession = top10[idx].profession;
    var stages = window.parsePath(profession.path_india, profession.years_min);

    var wrap = document.getElementById('timeline-wrap');
    wrap.innerHTML = '';

    var n = stages.length;
    var svgW = Math.max(600, n * 160);
    var svgH = 160;
    var trackY = 80;
    var trackX1 = 60;
    var trackX2 = svgW - 40;

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', svgW);
    svg.setAttribute('height', svgH);
    svg.setAttribute('viewBox', '0 0 ' + svgW + ' ' + svgH);

    var trackLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    trackLine.setAttribute('x1', trackX1);
    trackLine.setAttribute('y1', trackY);
    trackLine.setAttribute('x2', trackX2);
    trackLine.setAttribute('y2', trackY);
    trackLine.setAttribute('stroke', '#4F46E5');
    trackLine.setAttribute('stroke-width', '2');
    trackLine.setAttribute('opacity', '0.35');
    svg.appendChild(trackLine);

    stages.forEach(function (stage, i) {
      var x = n === 1
        ? trackX1
        : Math.round(trackX1 + i * (trackX2 - trackX1) / (n - 1));

      var fill;
      if (i === 0) {
        fill = '#4F46E5';
      } else if (i === n - 1) {
        fill = '#10B981';
      } else {
        fill = 'rgba(79,70,229,0.8)';
      }

      var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', trackY);
      circle.setAttribute('r', '18');
      circle.setAttribute('fill', fill);
      svg.appendChild(circle);

      var labelText = stage.label.length > 20 ? stage.label.slice(0, 19) + '…' : stage.label;

      var labelEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      labelEl.setAttribute('x', x);
      labelEl.setAttribute('y', trackY - 34);
      labelEl.setAttribute('text-anchor', 'middle');
      labelEl.setAttribute('font-size', '12');
      labelEl.setAttribute('fill', '#1F2937');
      labelEl.textContent = labelText;
      svg.appendChild(labelEl);

      var yearLabel = stage.cumulative === 0 ? 'Year 0 (Now)' : 'Year ' + stage.cumulative;

      var yearEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      yearEl.setAttribute('x', x);
      yearEl.setAttribute('y', trackY + 36);
      yearEl.setAttribute('text-anchor', 'middle');
      yearEl.setAttribute('font-size', '11');
      yearEl.setAttribute('fill', '#6B7280');
      yearEl.textContent = yearLabel;
      svg.appendChild(yearEl);
    });

    var scrollDiv = document.createElement('div');
    scrollDiv.style.overflowX = 'auto';
    scrollDiv.appendChild(svg);
    wrap.appendChild(scrollDiv);
  }

})();
