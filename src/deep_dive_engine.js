(function() {
  'use strict';

  function init(top10, profTags, allQuestions) {
    var candidates = top10.map(function(m) {
      return {
        profession: m.profession,
        tags: profTags[m.profession.id] || [],
        weight: 1.0
      };
    });

    var uniqueCategories = (function() {
      var seen = {};
      candidates.forEach(function(c) { seen[c.profession.category] = true; });
      return Object.keys(seen).length;
    })();

    var maxQuestions = Math.min(15, 5 + uniqueCategories * 2);
    var askedIds = {};
    var questionsAsked = 0;
    var reasons = [];
    var stopped = false;

    function getTotalWeight() {
      return candidates.reduce(function(sum, c) { return sum + c.weight; }, 0);
    }

    function checkStopped() {
      var total = getTotalWeight();
      var sorted = candidates.slice().sort(function(a, b) { return b.weight - a.weight; });
      var top = sorted[0];
      var second = sorted.length > 1 ? sorted[1] : null;

      if (top.weight / total > 0.40) return true;
      if (second && (top.weight + second.weight) / total > 0.65 && (top.weight - second.weight) / total > 0.15) return true;
      if (questionsAsked >= maxQuestions) return true;
      var meaningful = candidates.filter(function(c) { return c.weight / total > 0.05; });
      if (meaningful.length <= 1) return true;

      return false;
    }

    function selectNextQuestion() {
      var total = getTotalWeight();
      var bestQuestion = null;
      var bestScore = -Infinity;

      for (var i = 0; i < allQuestions.length; i++) {
        var q = allQuestions[i];
        if (askedIds[q.id]) continue;

        var maxBoostedWeight = 0;
        for (var j = 0; j < q.options.length; j++) {
          var opt = q.options[j];
          var boostedWeight = candidates.reduce(function(sum, c) {
            var hit = (opt.boosts || []).some(function(tag) { return c.tags.indexOf(tag) !== -1; });
            return sum + (hit ? c.weight : 0);
          }, 0);
          if (boostedWeight > maxBoostedWeight) {
            maxBoostedWeight = boostedWeight;
          }
        }

        var split = total > 0 ? maxBoostedWeight / total : 0;
        var differentiationScore = 1 - 2 * Math.abs(split - 0.5);

        if (differentiationScore > bestScore) {
          bestScore = differentiationScore;
          bestQuestion = q;
        }
      }

      if (bestQuestion === null || bestScore < 0.05) return null;
      return bestQuestion;
    }

    function nextQuestion() {
      if (stopped) return null;
      var q = selectNextQuestion();
      if (!q) {
        stopped = true;
        return null;
      }
      return q;
    }

    function answer(questionId, optionIndex) {
      var q = null;
      for (var i = 0; i < allQuestions.length; i++) {
        if (allQuestions[i].id === questionId) {
          q = allQuestions[i];
          break;
        }
      }
      var opt = q.options[optionIndex];

      askedIds[questionId] = true;
      questionsAsked++;

      candidates.forEach(function(c) {
        var tagHits = (opt.boosts || []).filter(function(t) { return c.tags.indexOf(t) !== -1; }).length;
        var tagMisses = (opt.suppresses || []).filter(function(t) { return c.tags.indexOf(t) !== -1; }).length;
        c.weight *= (1 + 0.4 * tagHits) * Math.max(0.2, 1 - 0.3 * tagMisses);
      });

      var sorted = candidates.slice().sort(function(a, b) { return b.weight - a.weight; });
      var total = getTotalWeight();
      if (sorted.length >= 2 && reasons.length < 4) {
        var topShare = sorted[0].weight / total;
        var secondShare = sorted[1].weight / total;
        if (topShare > 0.35 && (topShare - secondShare) > 0.10 && opt.label) {
          var topName = window.pickLang(sorted[0].profession, 'name');
          var secondName = window.pickLang(sorted[1].profession, 'name');
          reasons.push(window.T('reason_prefer', window.pickLang(opt, 'label'), topName, secondName));
        }
      }

      stopped = checkStopped();
    }

    function getResult() {
      var sorted = candidates.slice().sort(function(a, b) { return b.weight - a.weight; });
      var total = getTotalWeight();
      var winner = sorted[0];
      var runnerUp = sorted.length > 1 ? sorted[1] : null;

      if (reasons.length === 0) {
        if (runnerUp) {
          reasons.push(window.T('reason_points', window.pickLang(winner.profession, 'name'), window.pickLang(runnerUp.profession, 'name')));
        } else {
          reasons.push(window.T('reason_aligned', window.pickLang(winner.profession, 'name')));
        }
      }

      return {
        winner: winner.profession,
        winner_confidence: Math.round((winner.weight / total) * 100) / 100,
        runner_up: runnerUp ? runnerUp.profession : null,
        runner_up_confidence: runnerUp ? Math.round((runnerUp.weight / total) * 100) / 100 : 0,
        reasons: reasons.slice(0, 4),
        questions_asked: questionsAsked,
        candidates_final: sorted.slice(0, 5).map(function(c) {
          return { profession: c.profession, weight: c.weight, confidence: Math.round((c.weight / total) * 100) / 100 };
        })
      };
    }

    function isStopped() {
      return stopped;
    }

    function progress() {
      var sorted = candidates.slice().sort(function(a, b) { return b.weight - a.weight; });
      var total = getTotalWeight();
      var meaningful = candidates.filter(function(c) { return c.weight / total > 0.05; });
      return {
        asked: questionsAsked,
        max: maxQuestions,
        topCareerName: sorted[0].profession.name,
        topConfidence: Math.round((sorted[0].weight / total) * 100),
        remainingCount: meaningful.length
      };
    }

    return { nextQuestion: nextQuestion, answer: answer, getResult: getResult, isStopped: isStopped, progress: progress };
  }

  window.DeepDiveEngine = { init: init };
})();
