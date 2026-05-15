(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.CareerMatch = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  var DIMS = ['R', 'I', 'A', 'S', 'E', 'C'];

  function computeRiasec(answers, questions) {
    var raw = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

    questions.personality.forEach(function (q) {
      var score = answers[q.id];
      if (score == null) return;
      raw[q.dimension] += score * q.weight;
    });

    var total = DIMS.reduce(function (s, d) { return s + raw[d]; }, 0);

    var normalized = {};
    if (total === 0) {
      DIMS.forEach(function (d) { normalized[d] = 1 / 6; });
    } else {
      DIMS.forEach(function (d) { normalized[d] = raw[d] / total; });
    }

    return normalized;
  }

  function buildEdgeMap(edges) {
    var map = {};
    edges.edges.forEach(function (e) {
      map[e.profession_id] = e;
    });
    return map;
  }

  function dotProduct(userVec, edgeVec) {
    return DIMS.reduce(function (sum, d) {
      return sum + userVec[d] * (edgeVec[d] || 0);
    }, 0);
  }

  function checkConstraints(profession, constraints) {
    var issues = [];

    if (profession.years_min > constraints.years_available) {
      issues.push('years_min');
    }

    var totalBudget = constraints.annual_budget_inr * constraints.years_available;
    if (profession.annual_fee_range[0] > totalBudget) {
      issues.push('annual_budget_inr');
    }

    if (
      constraints.stream_pref !== 'any' &&
      !profession.streams.includes(constraints.stream_pref) &&
      !profession.streams.includes('any')
    ) {
      issues.push('stream_pref');
    }

    if (profession.exam_intensity > constraints.exam_intensity) {
      issues.push('exam_intensity');
    }

    return issues;
  }

  function match(answers, constraints, questions, professions, edges) {
    var riasec = computeRiasec(answers, questions);
    var edgeMap = buildEdgeMap(edges);

    var matches = professions.items.map(function (profession) {
      var edgeVec = edgeMap[profession.id];
      var score = edgeVec ? dotProduct(riasec, edgeVec) : 0;
      var issues = checkConstraints(profession, constraints);
      return {
        profession: profession,
        score: score,
        passed_constraints: issues.length === 0,
        constraint_issues: issues
      };
    });

    matches.sort(function (a, b) { return b.score - a.score; });

    var top10 = matches.filter(function (m) { return m.passed_constraints; }).slice(0, 10);
    var stretch5 = matches.filter(function (m) { return !m.passed_constraints; }).slice(0, 5);

    return { riasec: riasec, matches: matches, top10: top10, stretch5: stretch5 };
  }

  return { match: match };
});
