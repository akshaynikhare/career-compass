/**
 * app.js — Test page state machine
 * Loaded at bottom of test.html body, after config.js, match.js, store.js.
 * No import/export — all globals.
 */
(async function () {
  'use strict';

  // ── DOM refs ──────────────────────────────────────────────────────────────
  var elStudentPhase  = document.getElementById('student-info-phase');
  var elBtnBegin      = document.getElementById('btn-begin');
  var elSiName        = document.getElementById('si-name');
  var elSiEmail       = document.getElementById('si-email');
  var elSiPhone       = document.getElementById('si-phone');
  var elSiError       = document.getElementById('si-error');
  var elResumeNote    = document.getElementById('resume-note');
  var elResumeLink    = document.getElementById('resume-link');
  var elResumeCopy    = document.getElementById('resume-copy');

  var elProgressWrapper = document.getElementById('progress-wrapper');
  var elProgressText  = document.getElementById('progress-text');
  var elProgressPct   = document.getElementById('progress-pct');
  var elProgressFill  = document.getElementById('progress-fill');
  var elProgressTrack = document.getElementById('progress-track');

  // Respect reduced-motion for programmatic scrolling.
  var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }

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

  var studentInfo   = null;  // { name, email, phone } — optional, entered on the intro

  var sessionId     = null;  // server session id → the resume link (?s=<id>)
  var hasBackend    = !!(window.__CFG && window.__CFG.API_BASE_URL);

  var SS_ANSWERS     = 'cat_progress_answers';
  var SS_CONSTRAINTS = 'cat_progress_constraints';
  var SS_INDEX       = 'cat_progress_index';
  var LS_SESSION     = 'cc_session';   // localStorage mirror keyed under this + id

  var TOTAL = 45;
  var PF_COUNT = 10;   // personal_financial
  var CQ_COUNT = 10;   // career_quick
  // career_deep = 25

  // Phase label helpers (section resolved via window.T at render time)
  var PHASE_LABELS = [
    { end: 9,  sectionKey: 'phase_personal',    total: 10 },
    { end: 19, sectionKey: 'phase_quick',       total: 10 },
    { end: 44, sectionKey: 'phase_personality', total: 25 }
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

  // ── Session persistence (resume on any device) ────────────────────────────
  // Identifier for each selected question, in order. The first PF_COUNT are
  // personal_financial (keyed by .key); the rest are career questions (by .id).
  // PF questions carry BOTH id and key, so index decides which to use — this
  // must mirror rebuildFromIds() exactly or resume can't reconstruct the order.
  function questionIds() {
    return allQuestions.map(function (q, i) { return i < PF_COUNT ? q.key : q.id; });
  }

  // Rebuild the exact question order a session was answering, so resume shows
  // the same questions. Returns null if any id no longer exists (data changed).
  function rebuildFromIds(ids) {
    if (!ids || !ids.length) return null;
    var pfByKey = {}; questions.personal_financial.forEach(function (q) { pfByKey[q.key] = q; });
    var byId = {};
    questions.career_quick.concat(questions.career_deep).forEach(function (q) { byId[q.id] = q; });
    var out = [];
    for (var i = 0; i < ids.length; i++) {
      var q = (i < PF_COUNT) ? pfByKey[ids[i]] : byId[ids[i]];
      if (!q) return null;
      out.push(q);
    }
    return out;
  }

  // Offline mirror so a resume link still works with no connection.
  function mirrorLocally() {
    if (!sessionId) return;
    try {
      localStorage.setItem(LS_SESSION + '_' + sessionId, JSON.stringify({
        answers: careerAnswers, constraints: constraints,
        current_index: currentIndex, question_ids: questionIds(),
        studentInfo: studentInfo
      }));
    } catch (e) {}
  }

  // Checkpoint progress to the server (fire-and-forget) + local mirror.
  function saveSession(status) {
    mirrorLocally();
    if (!hasBackend || !sessionId || !window.Store || !window.Store.updateSession) return;
    window.Store.updateSession(sessionId, {
      answers: careerAnswers, constraints: constraints,
      current_index: currentIndex, status: status || 'in_progress',
      studentInfo: studentInfo
    });
  }

  function resumeUrl(id) {
    return window.location.origin + window.location.pathname + '?s=' + id;
  }

  function showResumeNote(id) {
    if (!elResumeNote || !elResumeLink) return;
    elResumeLink.value = resumeUrl(id);
    elResumeNote.classList.remove('hidden');
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
    showError(window.T('err_load', err.message));
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

  // Stratified random selection from pools (a fresh test; overridden on resume)
  allQuestions = selectQuestions(questions);

  // ── Shared transition: intro card → question phase ────────────────────────
  function enterQuestions() {
    if (currentIndex > 0) {
      elBtnNext.textContent = window.T('resume_from', currentIndex + 1);
      setTimeout(function () { elBtnNext.textContent = currentIndex === TOTAL - 1 ? window.T('btn_submit') : window.T('btn_next'); }, 2500);
    }
    elStudentPhase.classList.add('hidden');
    elProgressWrapper.classList.remove('hidden');
    elQuestionCard.classList.remove('hidden');
    elNavButtons.classList.remove('hidden');
    elLoading.classList.add('hidden');
    elContent.classList.remove('hidden');
    renderQuestion(currentIndex);
  }

  // ── Resume from a ?s=<id> link (server first, offline mirror fallback) ─────
  function sessionIdFromUrl() {
    try { return new URLSearchParams(window.location.search).get('s'); } catch (e) { return null; }
  }

  function applyResume(data) {
    var order = rebuildFromIds(data.question_ids);
    if (!order) return false;                 // question set changed → can't resume cleanly
    allQuestions   = order;
    careerAnswers  = data.answers || {};
    constraints    = data.constraints || {};
    currentIndex   = Math.min(Math.max(parseInt(data.current_index, 10) || 0, 0), TOTAL - 1);
    if (data.studentInfo) studentInfo = data.studentInfo;   // offline mirror carries it
    else if (data.student_name) studentInfo = { name: data.student_name };
    try {
      sessionStorage.setItem(SS_ANSWERS, JSON.stringify(careerAnswers));
      sessionStorage.setItem(SS_CONSTRAINTS, JSON.stringify(constraints));
      sessionStorage.setItem(SS_INDEX, String(currentIndex));
    } catch (e) {}
    return true;
  }

  async function tryResume() {
    var id = sessionIdFromUrl();
    if (!id) return false;
    sessionId = id;
    // Hide the intro up front so there's no flash while we fetch.
    elStudentPhase.classList.add('hidden');
    elQuestionCard.classList.remove('hidden');
    elLoading.classList.remove('hidden');

    var data = (hasBackend && window.Store && window.Store.getSession)
      ? await window.Store.getSession(id) : null;
    if (!data) {                              // offline / unreachable → local mirror
      try { data = JSON.parse(localStorage.getItem(LS_SESSION + '_' + id)); } catch (e) { data = null; }
    }
    if (!data || !applyResume(data)) {        // couldn't resume → fall back to a fresh start
      sessionId = null;
      elQuestionCard.classList.add('hidden');
      elLoading.classList.add('hidden');
      elStudentPhase.classList.remove('hidden');
      return false;
    }
    showResumeNote(id);
    enterQuestions();
    return true;
  }

  // ── bfcache reset — clears stale radio state on back/retake navigation ────
  window.addEventListener('pageshow', function (e) {
    if (e.persisted && !sessionIdFromUrl()) {
      // Restored from bfcache on a fresh (non-resume) test: reset to phase 0.
      careerAnswers  = {};
      constraints    = {};
      currentIndex   = 0;
      try { sessionStorage.removeItem(SS_ANSWERS); sessionStorage.removeItem(SS_CONSTRAINTS); sessionStorage.removeItem(SS_INDEX); } catch(e) {}
      studentInfo    = null;
      sessionId      = null;
      elStudentPhase.classList.remove('hidden');
      elProgressWrapper.classList.add('hidden');
      elQuestionCard.classList.add('hidden');
      elNavButtons.classList.add('hidden');
      elContent.classList.add('hidden');
      elLoading.classList.remove('hidden');
      allQuestions = selectQuestions(questions);
    }
  });

  // Resume-link copy button
  if (elResumeCopy && elResumeLink) {
    elResumeCopy.addEventListener('click', function () {
      elResumeLink.select();
      navigator.clipboard && navigator.clipboard.writeText(elResumeLink.value);
      elResumeCopy.textContent = '✓';
      setTimeout(function () { elResumeCopy.textContent = window.T ? window.T('copy') : 'Copy'; }, 1500);
    });
  }

  // Kick off a resume attempt if the URL carries a session id.
  tryResume();

  // ── Phase 0: Intro → optionally capture details, create session, start ────
  elBtnBegin.addEventListener('click', function () {
    var name  = elSiName  ? elSiName.value.trim()  : '';
    var email = elSiEmail ? elSiEmail.value.trim() : '';
    var phone = elSiPhone ? elSiPhone.value.trim() : '';

    // All fields optional — but if provided, validate format.
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (elSiError) elSiError.textContent = 'Please enter a valid email, or leave it blank.';
      elSiEmail.focus();
      return;
    }
    if (phone && !/^[0-9]{10}$/.test(phone)) {
      if (elSiError) elSiError.textContent = 'Enter a valid 10-digit mobile, or leave it blank.';
      elSiPhone.focus();
      return;
    }
    if (elSiError) elSiError.textContent = '';

    studentInfo = (name || email || phone) ? { name: name || null, email: email || null, phone: phone || null } : null;

    // Create a server session (for the resume link). Non-blocking: the test
    // starts immediately; the id + link appear when the request returns.
    if (hasBackend && window.Store && window.Store.createSession) {
      window.Store.createSession(studentInfo, questionIds()).then(function (id) {
        if (!id) return;
        sessionId = id;
        try { history.replaceState(null, '', resumeUrl(id)); } catch (e) {}
        showResumeNote(id);
        mirrorLocally();
      });
    }

    enterQuestions();
  });

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
        saveSession();            // section 1 complete → checkpoint
        showInterstitial(
          window.T('interstitial_1'),
          function() { renderQuestion(currentIndex); }
        );
      } else if (currentIndex === PF_COUNT + CQ_COUNT - 1) {
        currentIndex = nextIndex;
        saveSession();            // section 2 complete → checkpoint
        showInterstitial(
          window.T('interstitial_2'),
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
    elProgressText.textContent = window.T('progress_q_of', window.T(phaseInfo.sectionKey), withinNum, phaseInfo.total);
    elProgressPct.textContent  = pct + '%';
    elProgressFill.style.width = pct + '%';
    if (elProgressTrack) {
      elProgressTrack.setAttribute('aria-valuenow', pct);
      elProgressTrack.setAttribute('aria-valuetext', pct + '% — ' + window.T(phaseInfo.sectionKey) + ', question ' + withinNum + ' of ' + phaseInfo.total);
    }

    // Labels
    elTypeLabel.textContent = window.T(phaseInfo.sectionKey);
    elNumber.textContent    = 'Q' + withinNum;
    elText.textContent      = window.pickLang(q, 'text');

    // Determine if this is a personal_financial question
    var isPF = idx < PF_COUNT;

    // Build options — label the radiogroup with the current question for SR users.
    elOptions.innerHTML = '';
    elOptions.className = 'options-list' + (isPF ? '' : ' options-personality');
    elOptions.setAttribute('aria-label', window.pickLang(q, 'text'));

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
      label.textContent = window.pickLang(opt, 'label');

      if (isPF) {
        input.value = JSON.stringify(opt.value);
        if (currentVal !== undefined && JSON.stringify(opt.value) === JSON.stringify(currentVal)) {
          input.checked = true;
        }
        input.addEventListener('change', function () {
          constraints[q.key] = opt.value;
          try { sessionStorage.setItem(SS_CONSTRAINTS, JSON.stringify(constraints)); } catch(e) {}
          mirrorLocally();
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
          mirrorLocally();
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
    elBtnNext.textContent = (idx === TOTAL - 1) ? window.T('btn_submit') : window.T('btn_next');

    elBtnPrev.disabled = (idx === 0);

    clearError();
    scrollToTop();
  }

  function isAnswered(idx) {
    var q = allQuestions[idx];
    if (idx < PF_COUNT) return constraints[q.key] !== undefined;
    return careerAnswers[q.id] !== undefined;
  }

  function highlightRequired() {
    showError(window.T('err_select_option'));
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
    elProgressText.textContent = window.T('section_complete_read');

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
    btn.textContent = window.T('btn_continue');
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
    scrollToTop();
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  function submitTest() {
    // Validate all 45 answered
    var missing = [];
    allQuestions.forEach(function (q, idx) {
      if (!isAnswered(idx)) missing.push(q.id || q.key);
    });

    if (missing.length > 0) {
      showError(window.T('err_unanswered'));
      return;
    }

    elBtnNext.disabled    = true;
    elBtnNext.textContent = window.T('btn_calculating');

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

      // Section 3 complete → mark the session finished.
      saveSession('completed');

      // If the student gave an email upfront, capture the final lead now;
      // otherwise the result page still offers an explicit opt-in save.
      if (studentInfo && studentInfo.email && window.Store && window.Store.saveResult) {
        window.Store.saveResult(studentInfo, result);
      }

      // Clear in-tab progress + the offline mirror for this finished session.
      try {
        sessionStorage.removeItem(SS_ANSWERS); sessionStorage.removeItem(SS_CONSTRAINTS); sessionStorage.removeItem(SS_INDEX);
        if (sessionId) localStorage.removeItem(LS_SESSION + '_' + sessionId);
      } catch(e) {}
      window.location.href = 'result.html';
    } catch (err) {
      elBtnNext.disabled    = false;
      elBtnNext.textContent = window.T('btn_submit');
      showError(window.T('err_calc', (err.message || err)));
    }
  }

})();
