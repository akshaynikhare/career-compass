(function () {
  'use strict';

  var result = null;
  try {
    var raw = localStorage.getItem('cat_result');
    if (raw) result = JSON.parse(raw);
  } catch (e) { result = null; }

  if (!result || !result.top10 || result.top10.length === 0) {
    var noResult = document.getElementById('no-result');
    noResult.classList.remove('hidden');
    noResult.style.display = 'block';
    return;
  }

  document.getElementById('explore-content').classList.remove('hidden');

  fetch('data/professions.json')
    .then(function (res) { return res.json(); })
    .then(function (data) { buildGraph(result.top10, data.items); })
    .catch(function () { buildGraph(result.top10, []); });

  function streamLabel(s) {
    var map = { pcm: 'PCM', pcb: 'PCB', commerce: 'Commerce', arts: 'Arts', any: 'Any Stream' };
    return map[s] || s;
  }

  function buildGraph(top10, allProfessions) {
    var nodes = [];
    var edges = [];
    var streamsSeen = {};
    var examsSeen = {};
    var catsSeen = {};

    top10.forEach(function (m) {
      var p = m.profession;
      nodes.push({ id: p.id, label: p.name, type: 'career', data: p });

      if (p.streams && p.streams.length) {
        p.streams.forEach(function (s) {
          if (!streamsSeen[s]) {
            streamsSeen[s] = true;
            nodes.push({ id: 'stream_' + s, label: streamLabel(s), type: 'stream' });
          }
          edges.push({ source: p.id, target: 'stream_' + s });
        });
      }

      if (p.entrance_exam && p.entrance_exam !== 'None' && p.entrance_exam !== '') {
        if (!examsSeen[p.entrance_exam]) {
          examsSeen[p.entrance_exam] = true;
          nodes.push({ id: 'exam_' + p.entrance_exam, label: p.entrance_exam, type: 'exam' });
        }
        edges.push({ source: p.id, target: 'exam_' + p.entrance_exam });
      }

      if (p.category) {
        if (!catsSeen[p.category]) {
          catsSeen[p.category] = true;
          nodes.push({ id: 'cat_' + p.category, label: p.category, type: 'category' });
        }
        edges.push({ source: p.id, target: 'cat_' + p.category });
      }
    });

    renderGraph(nodes, edges);
  }

  function renderGraph(nodes, edges) {
    var svg = d3.select('#graph-svg');
    var width = svg.node().clientWidth || window.innerWidth;
    var height = svg.node().clientHeight || (window.innerHeight - 160);

    var g = svg.append('g');

    svg.call(
      d3.zoom().scaleExtent([0.3, 3]).on('zoom', function (event) {
        g.attr('transform', event.transform);
      })
    );

    var simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id(function (d) { return d.id; }).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(40));

    var nodeColor = { career: '#4F46E5', stream: '#10B981', exam: '#F59E0B', category: '#8B5CF6' };
    var nodeRadius = { career: 26, stream: 16, exam: 14, category: 18 };

    var link = g.append('g')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', '#CBD5E1')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.5);

    var tooltip = document.getElementById('node-tooltip');
    var tooltipName = document.getElementById('tooltip-name');
    var tooltipSummary = document.getElementById('tooltip-summary');
    var tooltipLink = document.getElementById('tooltip-timeline-link');

    var node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .style('cursor', function (d) { return d.type === 'career' ? 'pointer' : 'grab'; })
      .call(
        d3.drag()
          .on('start', function (event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', function (event, d) {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', function (event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on('click', function (event, d) {
        if (d.type !== 'career') return;
        event.stopPropagation();

        tooltipName.textContent = d.data.name;
        var summary = d.data.summary || '';
        tooltipSummary.textContent = summary.length > 100 ? summary.slice(0, 100) + '…' : summary;
        tooltipLink.href = 'timeline.html?id=' + d.data.id;

        var tx = event.pageX + 12;
        var ty = event.pageY - 28;
        var tooltipW = 240;
        var tooltipH = 100;
        if (tx + tooltipW > window.innerWidth) tx = window.innerWidth - tooltipW - 16;
        if (ty + tooltipH > window.innerHeight) ty = window.innerHeight - tooltipH - 16;
        if (ty < 8) ty = 8;

        tooltip.style.left = tx + 'px';
        tooltip.style.top = ty + 'px';
        tooltip.style.display = 'block';
      });

    node.append('circle')
      .attr('r', function (d) { return nodeRadius[d.type] || 16; })
      .attr('fill', function (d) { return nodeColor[d.type] || '#6B7280'; })
      .attr('stroke', function (d) { return d.type === 'career' ? '#ffffff' : 'none'; })
      .attr('stroke-width', function (d) { return d.type === 'career' ? 2.5 : 0; });

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#FFFFFF')
      .attr('font-size', function (d) { return d.type === 'career' ? '10px' : '9px'; })
      .attr('pointer-events', 'none')
      .style('text-shadow', '0 1px 3px rgba(0,0,0,0.7), 0 0 6px rgba(0,0,0,0.5)')
      .attr('filter', 'drop-shadow(0px 1px 2px rgba(0,0,0,0.6))')
      .text(function (d) {
        var lbl = d.label || '';
        return lbl.length > 12 ? lbl.slice(0, 12) + '…' : lbl;
      });

    svg.on('click', function () {
      tooltip.style.display = 'none';
    });

    simulation.on('tick', function () {
      link
        .attr('x1', function (d) { return d.source.x; })
        .attr('y1', function (d) { return d.source.y; })
        .attr('x2', function (d) { return d.target.x; })
        .attr('y2', function (d) { return d.target.y; });

      node.attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });
    });
  }

})();
