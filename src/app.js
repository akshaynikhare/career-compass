/**
 * app.js — Test page state machine
 * Loaded at bottom of test.html body, after config.js and match.js.
 * No import/export — all globals.
 */
(async function () {
  'use strict';

  // ── DOM refs ──────────────────────────────────────────────────────────────
  var elLoading      = document.getElementById('loading-state');
  var elContent      = document.getElementById('question-content');
  var elNumber       = document.getElementById('question-number');
  var elTypeLabel    = document.getElementById('question-type-label');
  var elText         = document.getElementById('question-text');
  var elOptions      = document.getElementById('options-list');
  var elProgressText = document.getElementById('progress-text');
  var elProgressPct  = document.getElementById('progress-pct');
  var elProgressFill = document.getElementById('progress-fill');
  var elBtnPrev      = document.getElementById('btn-prev');
  var elBtnNext      = document.getElementById('btn-next');
  var elErrorMsg     = document.getElementById('error-msg');

  // ── State ─────────────────────────────────────────────────────────────────
  var questions   = null;
  var professions = null;
  var edges       = null;
  var allQuestions = [];   // flat list: personality[0..19] + constraints[0..4]
  var currentIndex = 0;
  var answers     = {};    // { p01: 3, p02: 5, … }
  var constraints = {};    // { years_available: 4, annual_budget_inr: 200000, … }

  var TOTAL = 25;

  // ── Load data ─────────────────────────────────────────────────────────────
  try {
    var results = await Promise.all([
      fetch('./data/questions.json').then(function (r) { if (!r.ok) throw new Error('questions'); return r.json(); }),
      fetch('./data/professions.json').then(function (r) { if (!r.ok) throw new Error('professions'); return r.json(); }),
      fetch('./data/riasec_edges.json').then(function (r) { if (!r.ok) throw new Error('edges'); return r.json(); })
    ]);
    questions   = results[0];
    professions = results[1];
    edges       = results[2];
  } catch (err) {
    showError('Failed to load data. Please refresh the page. (' + err.message + ')');
    return;
  }

  // Flatten questions: personality first, then constraints
  allQuestions = questions.personality.concat(questions.constraints);

  // ── Restore any saved answers (back-navigation from result page) ───────────
  try {
    var savedAnswers     = localStorage.getItem('cat_answers');
    var savedConstraints = localStorage.getItem('cat_constraints');
    if (savedAnswers)     answers     = JSON.parse(savedAnswers);
    if (savedConstraints) constraints = JSON.parse(savedConstraints);
  } catch (e) { /* ignore */ }

  // ── Initial render ────────────────────────────────────────────────────────
  elLoading.classList.add('hidden');
  elContent.classList.remove('hidden');
  renderQuestion(currentIndex);

  // ── Event listeners ───────────────────────────────────────────────────────
  elBtnPrev.addEventListener('click', function () {
    if (currentIndex > 0) {
      currentIndex--;
      renderQuestion(currentIndex);
    }
  });

  elBtnNext.addEventListener('click', function () {
    if (!getSelectedValue(currentIndex)) {
      highlightRequired();
      return;
    }
    if (currentIndex < TOTAL - 1) {
      currentIndex++;
      renderQuestion(currentIndex);
    } else {
      submitTest();
    }
  });

  // ── Core render ───────────────────────────────────────────────────────────
  function renderQuestion(idx) {
    var q = allQuestions[idx];
    var isPersonality = idx < questions.personality.length;
    var questionNum   = idx + 1;

    // Progress
    var pct = Math.round((questionNum / TOTAL) * 100);
    elProgressText.textContent = 'Question ' + questionNum + ' of ' + TOTAL;
    elProgressPct.textContent  = pct + '%';
    elProgressFill.style.width = pct + '%';

    // Labels
    elTypeLabel.textContent = isPersonality ? 'About You' : 'Practical Constraints';
    elNumber.textContent    = 'Q' + questionNum;
    elText.textContent      = q.text;

    // Options
    elOptions.innerHTML = '';
    elOptions.className = 'options-list' + (isPersonality ? ' options-personality' : '');

    var currentVal = isPersonality ? answers[q.id] : constraints[q.key];

    q.options.forEach(function (opt, i) {
      var item  = document.createElement('div');
      item.className = 'option-item';

      var input = document.createElement('input');
      input.type  = 'radio';
      input.name  = 'q_' + q.id;
      input.id    = 'opt_' + q.id + '_' + i;
      input.value = isPersonality ? opt.score : JSON.stringify(opt.value);

      // Re-check previously selected answer
      if (isPersonality && currentVal !== undefined && opt.score === currentVal) {
        input.checked = true;
      } else if (!isPersonality && currentVal !== undefined) {
        // JSON stringify comparison for objects/booleans
        if (JSON.stringify(opt.value) === JSON.stringify(currentVal)) {
          input.checked = true;
        }
      }

      var label = document.createElement('label');
      label.htmlFor   = input.id;
      label.textContent = opt.label;

      input.addEventListener('change', function () {
        if (isPersonality) {
          answers[q.id] = opt.score;
        } else {
          constraints[q.key] = opt.value;
        }
        elBtnNext.disabled = false;
        clearError();
      });

      item.appendChild(input);
      item.appendChild(label);
      elOptions.appendChild(item);
    });

    // Enable/disable Next based on whether this Q is already answered
    elBtnNext.disabled = (currentVal === undefined);
    elBtnNext.textContent = (idx === TOTAL - 1) ? 'Submit ✓' : 'Next →';

    // Prev button
    elBtnPrev.disabled = (idx === 0);

    clearError();
    // Scroll to top on mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function getSelectedValue(idx) {
    var q = allQuestions[idx];
    var isPersonality = idx < questions.personality.length;
    if (isPersonality) return answers[q.id] !== undefined;
    return constraints[q.key] !== undefined;
  }

  function highlightRequired() {
    showError('Please select an option to continue.');
    // Flash the options list
    elOptions.style.transition = 'opacity 0.1s';
    elOptions.style.opacity = '0.5';
    setTimeout(function () { elOptions.style.opacity = '1'; }, 200);
  }

  function showError(msg) {
    elErrorMsg.textContent = msg;
    elErrorMsg.classList.remove('hidden');
  }

  function clearError() {
    elErrorMsg.textContent = '';
    elErrorMsg.classList.add('hidden');
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  function submitTest() {
    // Validate all answered
    var missing = [];
    questions.personality.forEach(function (q) {
      if (answers[q.id] === undefined) missing.push(q.id);
    });
    questions.constraints.forEach(function (q) {
      if (constraints[q.key] === undefined) missing.push(q.id);
    });

    if (missing.length > 0) {
      showError('Some questions are unanswered. Please go back and answer all questions.');
      return;
    }

    // Disable submit while processing
    elBtnNext.disabled  = true;
    elBtnNext.textContent = 'Calculating…';

    try {
      var result = CareerMatch.match(answers, constraints, questions, professions, edges);

      // Attach constraints to result so Supabase payload can include it
      result.constraints = constraints;

      localStorage.setItem('cat_answers',     JSON.stringify(answers));
      localStorage.setItem('cat_constraints', JSON.stringify(constraints));
      localStorage.setItem('cat_result',      JSON.stringify(result));

      window.location.href = 'result.html';
    } catch (err) {
      elBtnNext.disabled   = false;
      elBtnNext.textContent = 'Submit ✓';
      showError('Something went wrong calculating your results. Please try again. (' + (err.message || err) + ')');
    }
  }

})();
