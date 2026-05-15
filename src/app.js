/**
 * app.js — Test page state machine
 * Loaded at bottom of test.html body, after config.js, match.js, store.js.
 * No import/export — all globals.
 */
(async function () {
  'use strict';

  // ── DOM refs ──────────────────────────────────────────────────────────────
  var elStudentPhase  = document.getElementById('student-info-phase');
  var elSiName        = document.getElementById('si-name');
  var elSiEmail       = document.getElementById('si-email');
  var elSiPhone       = document.getElementById('si-phone');
  var elSiError       = document.getElementById('si-error');
  var elBtnBegin      = document.getElementById('btn-begin');

  var elProgressWrapper = document.getElementById('progress-wrapper');
  var elProgressText  = document.getElementById('progress-text');
  var elProgressPct   = document.getElementById('progress-pct');
  var elProgressFill  = document.getElementById('progress-fill');

  var elQuestionCard  = document.getElementById('question-card');
  var elLoading       = document.getElementById('loading-state');
  var elContent       = document.getElementById('question-content');
  var elTypeLabel     = document.getElementById('question-type-label');
  var elNumber        = document.getElementById('question-number');
  var elText          = document.getElementById('question-text');
  var elOptions       = document.getElementById('options-list');

  var elNavButtons    = document.getElementById('nav-buttons');
  var elBtnPrev       = document.getElementById('btn-prev');
  var elBtnNext       = document.getElementById('btn-next');
  var elErrorMsg      = document.getElementById('error-msg');

  // ── State ─────────────────────────────────────────────────────────────────
  var questions    = null;   // raw data from questions.json
  var professions  = null;
  var edges        = null;
  var allQuestions = [];     // flat: personal_financial(10) + career_quick(10) + career_deep(25)
  var currentIndex = 0;
  var careerAnswers = {};    // { id: score } for career_quick + career_deep
  var constraints   = {};    // { key: value } for personal_financial

  var studentInfo   = null;  // { name, email, phone }

  var TOTAL = 45;
  var PF_COUNT = 10;   // personal_financial
  var CQ_COUNT = 10;   // career_quick
  // career_deep = 25

  // Phase label helpers
  var PHASE_LABELS = [
    { end: 9,  section: 'Personal Background', total: 10 },
    { end: 19, section: 'Quick Interests',      total: 10 },
    { end: 44, section: 'Personality Profile',  total: 25 }
  ];

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

  // Flatten: personal_financial → career_quick → career_deep
  allQuestions = questions.personal_financial
    .concat(questions.career_quick)
    .concat(questions.career_deep);

  // ── Phase 0: Student info ─────────────────────────────────────────────────
  elBtnBegin.addEventListener('click', function () {
    var name  = elSiName.value.trim();
    var email = elSiEmail.value.trim();
    var phone = elSiPhone.value.trim();

    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!name) {
      showSiError('Please enter your full name.');
      return;
    }
    if (!emailRe.test(email)) {
      showSiError('Please enter a valid email address.');
      return;
    }
    if (!/^[0-9]{10}$/.test(phone)) {
      showSiError('Please enter a valid 10-digit mobile number.');
      return;
    }

    studentInfo = { name: name, email: email, phone: phone };

    // Transition to question phases
    elStudentPhase.classList.add('hidden');
    elProgressWrapper.classList.remove('hidden');
    elQuestionCard.classList.remove('hidden');
    elNavButtons.classList.remove('hidden');

    // Show question content (loading state was only for very slow networks;
    // data is already loaded at this point)
    elLoading.classList.add('hidden');
    elContent.classList.remove('hidden');

    renderQuestion(0);
  });

  function showSiError(msg) {
    elSiError.textContent = msg;
    elSiError.classList.remove('hidden');
  }

  // ── Event listeners ───────────────────────────────────────────────────────
  elBtnPrev.addEventListener('click', function () {
    if (currentIndex > 0) {
      currentIndex--;
      renderQuestion(currentIndex);
    }
  });

  elBtnNext.addEventListener('click', function () {
    if (!isAnswered(currentIndex)) {
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
    currentIndex = idx;
    var q = allQuestions[idx];

    // Determine section
    var phaseInfo;
    var withinPhaseStart;
    if (idx < PF_COUNT) {
      phaseInfo = PHASE_LABELS[0];
      withinPhaseStart = 0;
    } else if (idx < PF_COUNT + CQ_COUNT) {
      phaseInfo = PHASE_LABELS[1];
      withinPhaseStart = PF_COUNT;
    } else {
      phaseInfo = PHASE_LABELS[2];
      withinPhaseStart = PF_COUNT + CQ_COUNT;
    }

    var withinNum = idx - withinPhaseStart + 1;

    // Overall progress
    var pct = Math.round(((idx + 1) / TOTAL) * 100);
    elProgressText.textContent = phaseInfo.section + ' — Q' + withinNum + ' of ' + phaseInfo.total;
    elProgressPct.textContent  = pct + '%';
    elProgressFill.style.width = pct + '%';

    // Labels
    elTypeLabel.textContent = phaseInfo.section;
    elNumber.textContent    = 'Q' + withinNum;
    elText.textContent      = q.text;

    // Determine if this is a personal_financial question
    var isPF = idx < PF_COUNT;

    // Build options
    elOptions.innerHTML = '';
    elOptions.className = 'options-list' + (isPF ? '' : ' options-personality');

    var currentVal = isPF ? constraints[q.key] : careerAnswers[q.id];

    q.options.forEach(function (opt, i) {
      var item  = document.createElement('div');
      item.className = 'option-item';

      var input = document.createElement('input');
      input.type  = 'radio';
      input.name  = 'q_' + (q.id || q.key);
      input.id    = 'opt_' + (q.id || q.key) + '_' + i;

      var label = document.createElement('label');
      label.htmlFor     = input.id;
      label.textContent = opt.label;

      if (isPF) {
        input.value = JSON.stringify(opt.value);
        if (currentVal !== undefined && JSON.stringify(opt.value) === JSON.stringify(currentVal)) {
          input.checked = true;
        }
        input.addEventListener('change', function () {
          constraints[q.key] = opt.value;
          elBtnNext.disabled = false;
          clearError();
        });
      } else {
        input.value = opt.score;
        if (currentVal !== undefined && opt.score === currentVal) {
          input.checked = true;
        }
        input.addEventListener('change', function () {
          careerAnswers[q.id] = opt.score;
          elBtnNext.disabled = false;
          clearError();
        });
      }

      item.appendChild(input);
      item.appendChild(label);
      elOptions.appendChild(item);
    });

    // Enable Next if already answered
    elBtnNext.disabled  = !isAnswered(idx);
    elBtnNext.textContent = (idx === TOTAL - 1) ? 'Submit ✓' : 'Next →';

    elBtnPrev.disabled = (idx === 0);

    clearError();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function isAnswered(idx) {
    var q = allQuestions[idx];
    if (idx < PF_COUNT) return constraints[q.key] !== undefined;
    return careerAnswers[q.id] !== undefined;
  }

  function highlightRequired() {
    showError('Please select an option to continue.');
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
    // Validate all 45 answered
    var missing = [];
    allQuestions.forEach(function (q, idx) {
      if (!isAnswered(idx)) missing.push(q.id || q.key);
    });

    if (missing.length > 0) {
      showError('Some questions are unanswered. Please go back and answer all questions.');
      return;
    }

    elBtnNext.disabled    = true;
    elBtnNext.textContent = 'Calculating…';

    try {
      // Combine career_quick and career_deep answers together
      var syntheticQuestions = {
        personality: questions.career_quick.concat(questions.career_deep),
        constraints: questions.personal_financial
      };

      var result = CareerMatch.match(careerAnswers, constraints, syntheticQuestions, professions, edges);

      result.studentInfo  = studentInfo;
      result.constraints  = constraints;

      localStorage.setItem('cat_result', JSON.stringify(result));

      // Fire-and-forget Supabase save
      if (window.Store && window.Store.saveProfile) {
        window.Store.saveProfile(studentInfo, result);
      } else if (window.Store && window.Store.saveResult) {
        window.Store.saveResult(studentInfo, result);
      }

      window.location.href = 'result.html';
    } catch (err) {
      elBtnNext.disabled    = false;
      elBtnNext.textContent = 'Submit ✓';
      showError('Something went wrong calculating your results. Please try again. (' + (err.message || err) + ')');
    }
  }

})();
