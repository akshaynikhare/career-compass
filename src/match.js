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

    var personalityQs = questions.personality || questions.career_deep || [];
    personalityQs.forEach(function (q) {
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

    // Type weighting: slight penalty for Minor/Niche so Major careers aren't crowded out.
    // weighted_score is only used for selection — .score stays untouched for display.
    var TYPE_WEIGHT = { 'Major': 1.0, 'Minor': 0.97, 'Niche': 0.93 };
    matches.forEach(function (m) {
      m.weighted_score = m.score * (TYPE_WEIGHT[m.profession.type] || 1.0);
    });

    // Re-sort passing matches by weighted_score for diversity-aware top10 selection.
    var passed = matches.filter(function (m) { return m.passed_constraints; });
    passed.sort(function (a, b) { return b.weighted_score - a.weighted_score; });

    // Diversity cap: max 2 careers per category in top10.
    var catCount = {};
    var top10 = [];
    for (var i = 0; i < passed.length && top10.length < 10; i++) {
      var cat = passed[i].profession.category;
      catCount[cat] = catCount[cat] || 0;
      if (catCount[cat] < 2) {
        top10.push(passed[i]);
        catCount[cat]++;
      }
    }

    // stretch5: constraint-failing careers, top 5 by raw score (no type weighting).
    var stretch5 = matches.filter(function (m) { return !m.passed_constraints; }).slice(0, 5);

    // topByDomain: top 2 per category across all passing matches,
    // sorted by each domain's best weighted_score descending.
    var domainMap = {};
    passed.forEach(function (m) {
      var c = m.profession.category;
      if (!domainMap[c]) domainMap[c] = [];
      if (domainMap[c].length < 2) domainMap[c].push(m);
    });
    var topByDomain = Object.keys(domainMap)
      .map(function (c) { return { category: c, matches: domainMap[c] }; })
      .sort(function (a, b) {
        return b.matches[0].weighted_score - a.matches[0].weighted_score;
      });

    return { riasec: riasec, matches: matches, top10: top10, stretch5: stretch5, topByDomain: topByDomain };
  }

  return { match: match };
});
