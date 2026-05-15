(function () {
  'use strict';

  function parsePath(path_india, years_min) {
    var stages = [{ label: 'Class 10', years: 0, cumulative: 0 }];

    if (!path_india || !path_india.trim()) return stages;

    var parts = path_india.split(/→|->/).map(function (s) { return s.trim(); }).filter(Boolean);

    var annotated = [];
    var totalAnnotated = 0;

    parts.forEach(function (part) {
      var match = part.match(/\((\d+(?:\.\d+)?)\s*yrs?\)/i);
      if (match) {
        var yrs = parseFloat(match[1]);
        var label = part.replace(/\s*\(\d+(?:\.\d+)?\s*yrs?\)/i, '').trim();
        annotated.push({ label: label, years: yrs, fixed: true });
        totalAnnotated += yrs;
      } else {
        annotated.push({ label: part, years: null, fixed: false });
      }
    });

    var unannotatedCount = annotated.filter(function (s) { return !s.fixed; }).length;
    var remaining = (years_min || 0) - totalAnnotated;
    var perSlot = unannotatedCount > 0 ? remaining / unannotatedCount : 0;

    var cumulative = 0;
    annotated.forEach(function (s) {
      var yrs = s.fixed ? s.years : Math.max(0, perSlot);
      cumulative = Math.round((cumulative + yrs) * 1000) / 1000;
      stages.push({ label: s.label, years: yrs, cumulative: cumulative });
    });

    return stages;
  }

  window.parsePath = parsePath;
})();
