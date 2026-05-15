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

  var SS_ANSWERS     = 'cat_progress_answers';
  var SS_CONSTRAINTS = 'cat_progress_constraints';
  var SS_INDEX       = 'cat_progress_index';

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

  // ── Question selection (stratified random sampling) ───────────────────────
  var DIMS_ORDER   = ['A', 'C', 'E', 'I', 'R', 'S'];
  var QUICK_SELECT = 10;
  var DEEP_SELECT  = 25;

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function selectQuestions(questions) {
    function groupByDim(pool) {
      var buckets = {};
      DIMS_ORDER.forEach(function (d) { buckets[d] = []; });
      pool.forEach(function (q) { if (buckets[q.dimension]) buckets[q.dimension].push(q); });
      return buckets;
    }
    function stratifiedSelect(pool, total) {
      var buckets = groupByDim(pool);
      var base  = Math.floor(total / 6);
      var extra = total - base * 6;
      var selected = [];
      DIMS_ORDER.forEach(function (d, i) {
        var take = base + (i < extra ? 1 : 0);
        selected = selected.concat(shuffle(buckets[d]).slice(0, take));
      });
      return selected;
    }
    var quick = stratifiedSelect(questions.career_quick, QUICK_SELECT);
    var deep  = stratifiedSelect(questions.career_deep, DEEP_SELECT);
    return questions.personal_financial.concat(quick).concat(deep);
  }

  // ── Load data (sessionStorage cache — no re-fetch on retake) ─────────────
  function cachedFetch(url, cacheKey) {
    var cached = sessionStorage.getItem(cacheKey);
    if (cached) return Promise.resolve(JSON.parse(cached));
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(cacheKey);
      return r.json();
    }).then(function (data) {
      try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
      return data;
    });
  }

  try {
    var results = await Promise.all([
      cachedFetch('./data/questions.json',   'cat_data_questions_v2'),
      cachedFetch('./data/professions.json', 'cat_data_professions'),
      cachedFetch('./data/riasec_edges.json','cat_data_edges')
    ]);
    questions   = results[0];
    professions = results[1];
    edges       = results[2];
  } catch (err) {
    showError('Failed to load data. Please refresh the page. (' + err.message + ')');
    return;
  }

  // Restore in-progress answers from sessionStorage if available
  (function() {
    try {
      var sa = sessionStorage.getItem(SS_ANSWERS);
      var sc = sessionStorage.getItem(SS_CONSTRAINTS);
      var si = sessionStorage.getItem(SS_INDEX);
      if (sa) careerAnswers = JSON.parse(sa);
      if (sc) constraints   = JSON.parse(sc);
      if (si) {
        var idx = parseInt(si, 10);
        if (idx > 0 && idx < TOTAL) currentIndex = idx;
      }
    } catch(e) {}
  })();

  // Stratified random selection from pools
  allQuestions = selectQuestions(questions);

  // ── bfcache reset — clears stale radio state on back/retake navigation ────
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      // Page was restored from bfcache: reset all state and go back to phase 0
      careerAnswers  = {};
      constraints    = {};
      currentIndex   = 0;
      try { sessionStorage.removeItem(SS_ANSWERS); sessionStorage.removeItem(SS_CONSTRAINTS); sessionStorage.removeItem(SS_INDEX); } catch(e) {}
      studentInfo    = null;
      elSiName.value  = '';
      elSiEmail.value = '';
      elSiPhone.value = '';
      elSiError.classList.add('hidden');
      elStudentPhase.classList.remove('hidden');
      elProgressWrapper.classList.add('hidden');
      elQuestionCard.classList.add('hidden');
      elNavButtons.classList.add('hidden');
      elContent.classList.add('hidden');
      elLoading.classList.remove('hidden');
      allQuestions = selectQuestions(questions);
    }
  });

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

    if (currentIndex > 0) {
      elBtnNext.textContent = 'Resume from Q' + (currentIndex + 1) + ' →';
      setTimeout(function() { elBtnNext.textContent = currentIndex === TOTAL - 1 ? 'Submit ✓' : 'Next →'; }, 2500);
    }

    // Transition to question phases
    elStudentPhase.classList.add('hidden');
    elProgressWrapper.classList.remove('hidden');
    elQuestionCard.classList.remove('hidden');
    elNavButtons.classList.remove('hidden');

    // Show question content (loading state was only for very slow networks;
    // data is already loaded at this point)
    elLoading.classList.add('hidden');
    elContent.classList.remove('hidden');

    renderQuestion(currentIndex);
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
    var nextIndex = currentIndex + 1;
    if (currentIndex < TOTAL - 1) {
      if (currentIndex === PF_COUNT - 1) {
        currentIndex = nextIndex;
        showInterstitial(
          '<strong>Section 1 complete!</strong><br><br>Section 2 of 3: Career Interests<br><span style="font-size:0.875rem; color:var(--muted);">10 quick questions about what kind of work appeals to you. There are no right or wrong answers.</span>',
          function() { renderQuestion(currentIndex); }
        );
      } else if (currentIndex === PF_COUNT + CQ_COUNT - 1) {
        currentIndex = nextIndex;
        showInterstitial(
          '<strong>Section 2 complete!</strong><br><br>Section 3 of 3: About Your Personality<br><span style="font-size:0.875rem; color:var(--muted);">25 short questions. Answer as you actually are — not how you think you should be.</span>',
          function() { renderQuestion(currentIndex); }
        );
      } else {
        currentIndex = nextIndex;
        renderQuestion(currentIndex);
      }
    } else {
      submitTest();
    }
  });

  // ── Core render ───────────────────────────────────────────────────────────
  function renderQuestion(idx) {
    currentIndex = idx;
    try { sessionStorage.setItem(SS_INDEX, String(idx)); } catch(e) {}
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
          try { sessionStorage.setItem(SS_CONSTRAINTS, JSON.stringify(constraints)); } catch(e) {}
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
          try { sessionStorage.setItem(SS_ANSWERS, JSON.stringify(careerAnswers)); } catch(e) {}
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

  function showInterstitial(message, onContinue) {
    elContent.classList.add('hidden');
    elNavButtons.classList.add('hidden');

    var pct = Math.round(((currentIndex) / TOTAL) * 100);
    elProgressPct.textContent  = pct + '%';
    elProgressFill.style.width = pct + '%';
    elProgressText.textContent = 'Section complete — read and continue';

    var card = document.createElement('div');
    card.style.textAlign = 'center';
    card.style.padding = '1rem 0.5rem';

    var icon = document.createElement('div');
    icon.textContent = '✓';
    icon.style.cssText = 'font-size:2rem; color:#10B981; margin-bottom:0.75rem;';

    var msg = document.createElement('p');
    msg.style.cssText = 'color:var(--text); font-size:0.9375rem; line-height:1.6; margin-bottom:1.25rem;';
    msg.innerHTML = message;

    var btn = document.createElement('button');
    btn.className = 'btn-primary';
    btn.textContent = 'Continue →';
    btn.style.cssText = 'max-width:200px; margin:0 auto; display:block;';
    btn.addEventListener('click', function() {
      card.remove();
      elContent.classList.remove('hidden');
      elNavButtons.classList.remove('hidden');
      onContinue();
    });

    card.appendChild(icon);
    card.appendChild(msg);
    card.appendChild(btn);
    elQuestionCard.appendChild(card);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        personality: allQuestions.slice(PF_COUNT),
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

      try { sessionStorage.removeItem(SS_ANSWERS); sessionStorage.removeItem(SS_CONSTRAINTS); sessionStorage.removeItem(SS_INDEX); } catch(e) {}
      window.location.href = 'result.html';
    } catch (err) {
      elBtnNext.disabled    = false;
      elBtnNext.textContent = 'Submit ✓';
      showError('Something went wrong calculating your results. Please try again. (' + (err.message || err) + ')');
    }
  }

})();
