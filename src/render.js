/**
 * render.js — Result page rendering
 * Reads cat_result from localStorage, renders RIASEC chart + career cards.
 * Depends on store.js being loaded first (window.Store).
 * No import/export — vanilla globals.
 */
(function () {
  'use strict';

  // ── Category colour map (18 categories → distinct HSL) ───────────────────
  var CATEGORY_COLORS = {
    'Healthcare':                  { bg: '#DCFCE7', text: '#166534' },
    'Technology':                  { bg: '#DBEAFE', text: '#1E40AF' },
    'Engineering':                 { bg: '#E0E7FF', text: '#3730A3' },
    'Education':                   { bg: '#FEF9C3', text: '#854D0E' },
    'Finance & Business':          { bg: '#F3E8FF', text: '#6B21A8' },
    'Finance — Specialized Niche': { bg: '#EDE9FE', text: '#5B21B6' },
    'Arts & Media':                { bg: '#FCE7F3', text: '#9D174D' },
    'Law & Government':            { bg: '#FEF3C7', text: '#92400E' },
    'Science & Research':          { bg: '#CFFAFE', text: '#164E63' },
    'Social & Welfare':            { bg: '#D1FAE5', text: '#065F46' },
    'Mental Health & Wellness':    { bg: '#FDF4FF', text: '#7E22CE' },
    'Architecture & Design':       { bg: '#FFF7ED', text: '#9A3412' },
    'Agriculture & Environment':   { bg: '#ECFDF5', text: '#065F46' },
    'Sports & Fitness':            { bg: '#FFF1F2', text: '#9F1239' },
    'Hospitality & Food':          { bg: '#FFFBEB', text: '#78350F' },
    'Transport & Logistics':       { bg: '#F0FDF4', text: '#14532D' },
    'Trades & Construction':       { bg: '#F7F7F7', text: '#374151' },
    'Public Health & Policy':      { bg: '#E0F2FE', text: '#0C4A6E' },
    'Niche & Emerging Professions':{ bg: '#FDF2F8', text: '#831843' }
  };

  var DEFAULT_COLOR = { bg: '#F3F4F6', text: '#374151' };

  // RIASEC dimension labels
  var DIM_LABELS = {
    R: 'Realistic',
    I: 'Investigative',
    A: 'Artistic',
    S: 'Social',
    E: 'Enterprising',
    C: 'Conventional'
  };

  var DIM_COLORS = {
    R: '#F97316',
    I: '#3B82F6',
    A: '#EC4899',
    S: '#10B981',
    E: '#F59E0B',
    C: '#8B5CF6'
  };

  var DIMS = ['R', 'I', 'A', 'S', 'E', 'C'];

  var CONSTRAINT_LABELS = {
    years_min:         'Study duration too long',
    annual_budget_inr: 'May exceed your budget',
    stream_pref:       'Stream mismatch',
    exam_intensity:    'Competitive exam required'
  };

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  var result = null;
  try {
    var raw = localStorage.getItem('cat_result');
    if (raw) result = JSON.parse(raw);
  } catch (e) { result = null; }

  if (!result || !result.riasec) {
    document.getElementById('no-result').classList.remove('hidden');
    document.getElementById('no-result').style.display = 'block';
    return;
  }

  document.getElementById('results-content').classList.remove('hidden');

  renderRiasec(result.riasec);
  renderCards('top10-cards', result.top10 || [], false);
  renderCards('stretch5-cards', result.stretch5 || [], true);
  setupCollapsible();
  setupSaveForm(result);

  // ── RIASEC bar chart ──────────────────────────────────────────────────────
  function renderRiasec(riasec) {
    var container = document.getElementById('riasec-chart');
    container.innerHTML = '';

    // Find max for scaling
    var max = DIMS.reduce(function (m, d) { return Math.max(m, riasec[d] || 0); }, 0);
    if (max === 0) max = 1;

    DIMS.forEach(function (d) {
      var val  = riasec[d] || 0;
      var pct  = Math.round(val * 100);
      // Scale bar height relative to max (so chart fills nicely)
      var barH = Math.round((val / max) * 100);

      var wrap = document.createElement('div');
      wrap.className = 'riasec-bar-wrap';
      wrap.style.position = 'relative';

      var pctLabel = document.createElement('span');
      pctLabel.className = 'riasec-pct';
      pctLabel.textContent = pct + '%';

      var bar = document.createElement('div');
      bar.className = 'riasec-bar';
      bar.style.background  = DIM_COLORS[d];
      bar.style.height      = barH + '%';
      bar.style.minHeight   = '4px';
      bar.style.width       = '100%';
      bar.setAttribute('title', DIM_LABELS[d] + ': ' + pct + '%');

      var dimLabel = document.createElement('span');
      dimLabel.className   = 'riasec-dim-label';
      dimLabel.textContent = d;
      dimLabel.style.color = DIM_COLORS[d];

      wrap.appendChild(pctLabel);
      wrap.appendChild(bar);
      wrap.appendChild(dimLabel);
      container.appendChild(wrap);
    });
  }

  // ── Career cards ──────────────────────────────────────────────────────────
  function renderCards(containerId, matches, isStretch) {
    var container = document.getElementById(containerId);
    container.innerHTML = '';

    if (matches.length === 0) {
      var empty = document.createElement('p');
      empty.className   = 'text-muted text-center';
      empty.textContent = isStretch ? 'No stretch goals found — great fit!' : 'No matches found.';
      empty.style.padding = '1rem 0';
      container.appendChild(empty);
      return;
    }

    matches.forEach(function (m, i) {
      container.appendChild(buildCard(m, i + 1, isStretch));
    });
  }

  function buildCard(match, rank, isStretch) {
    var p    = match.profession;
    var pct  = Math.round(match.score * 100);
    var col  = CATEGORY_COLORS[p.category] || DEFAULT_COLOR;

    var card = document.createElement('div');
    card.className = 'career-card';

    // Header row: rank + name
    var header = document.createElement('div');
    header.className = 'career-card-header';

    var nameCol = document.createElement('div');
    nameCol.style.flex = '1';

    var badge = document.createElement('span');
    badge.className         = 'badge';
    badge.textContent       = p.category;
    badge.style.background  = col.bg;
    badge.style.color       = col.text;

    var name = document.createElement('div');
    name.className   = 'career-name';
    name.textContent = p.name;

    nameCol.appendChild(badge);
    nameCol.appendChild(name);

    var rankEl = document.createElement('div');
    rankEl.className   = 'career-rank';
    rankEl.textContent = '#' + rank;

    header.appendChild(nameCol);
    header.appendChild(rankEl);
    card.appendChild(header);

    // Score bar
    var scoreRow = document.createElement('div');
    scoreRow.className = 'career-score-row';

    var track = document.createElement('div');
    track.className = 'score-track';

    var fill = document.createElement('div');
    fill.className   = 'score-bar';
    fill.style.width = pct + '%';
    fill.style.background = isStretch ? '#F59E0B' : '#4F46E5';

    track.appendChild(fill);

    var pctLabel = document.createElement('span');
    pctLabel.className   = 'score-pct';
    pctLabel.textContent = pct + '% match';
    pctLabel.style.color = isStretch ? '#92400E' : '#4F46E5';

    scoreRow.appendChild(track);
    scoreRow.appendChild(pctLabel);
    card.appendChild(scoreRow);

    // Path
    if (p.path_india) {
      var path = document.createElement('p');
      path.className   = 'career-path';
      path.textContent = p.path_india;
      card.appendChild(path);
    }

    // Meta: years + stream
    var meta = document.createElement('div');
    meta.className = 'career-meta';

    if (p.years_min) {
      var yearsItem = document.createElement('span');
      yearsItem.className   = 'career-meta-item';
      yearsItem.textContent = '⏱ ' + p.years_min + '+ yrs';
      meta.appendChild(yearsItem);
    }

    if (p.streams && p.streams.length > 0) {
      var streamItem = document.createElement('span');
      streamItem.className   = 'career-meta-item';
      streamItem.textContent = '📚 ' + formatStreams(p.streams);
      meta.appendChild(streamItem);
    }

    if (p.entrance_exam) {
      var examItem = document.createElement('span');
      examItem.className   = 'career-meta-item';
      examItem.textContent = '✍ ' + p.entrance_exam;
      meta.appendChild(examItem);
    }

    card.appendChild(meta);

    // Stretch reason
    if (isStretch && match.constraint_issues && match.constraint_issues.length > 0) {
      var reason = document.createElement('div');
      reason.className = 'stretch-reason';
      reason.textContent = '⚠️ Constraints: ' + match.constraint_issues.map(function (k) {
        return CONSTRAINT_LABELS[k] || k;
      }).join('; ');
      card.appendChild(reason);
    }

    return card;
  }

  function formatStreams(streams) {
    var labels = { pcm: 'PCM', pcb: 'PCB', commerce: 'Commerce', arts: 'Arts', any: 'Any stream' };
    return streams.map(function (s) { return labels[s] || s; }).join(', ');
  }

  // ── Collapsible stretch section ───────────────────────────────────────────
  function setupCollapsible() {
    var toggle = document.getElementById('stretch-toggle');
    var body   = document.getElementById('stretch-body');

    function expand(open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        body.classList.add('open');
      } else {
        body.classList.remove('open');
      }
    }

    toggle.addEventListener('click', function () {
      var isOpen = toggle.getAttribute('aria-expanded') === 'true';
      expand(!isOpen);
    });

    toggle.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle.click();
      }
    });
  }

  // ── Save form ─────────────────────────────────────────────────────────────
  function setupSaveForm(result) {
    var form        = document.getElementById('save-form');
    var statusEl    = document.getElementById('save-status');
    var postActions = document.getElementById('post-save-actions');
    var btnDownload = document.getElementById('btn-download');

    var studentInfo = {};

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      var nameEl  = document.getElementById('student-name');
      var emailEl = document.getElementById('student-email');
      var phoneEl = document.getElementById('student-phone');

      if (!nameEl.value.trim()) {
        statusEl.className   = 'save-status error';
        statusEl.textContent = 'Please enter your name.';
        nameEl.focus();
        return;
      }

      studentInfo = {
        name:  nameEl.value.trim(),
        email: emailEl.value.trim(),
        phone: phoneEl.value.trim()
      };

      var btnSave = document.getElementById('btn-save');
      btnSave.disabled     = true;
      btnSave.textContent  = 'Saving…';
      statusEl.className   = 'save-status';
      statusEl.textContent = '';

      var res = await Store.saveResult(studentInfo, result);

      btnSave.disabled    = false;
      btnSave.textContent = 'Save Result';

      if (res.ok) {
        statusEl.className   = 'save-status success';
        statusEl.textContent = 'Saved! Share your results with a counsellor or parent.';
        form.style.display   = 'none';
        postActions.style.display = 'flex';
        postActions.classList.remove('hidden');
      } else if (res.reason === 'no_config') {
        // No Supabase configured — offer download
        statusEl.className   = 'save-status';
        statusEl.textContent = 'Online save is not configured. Download your result instead.';
        postActions.style.display = 'flex';
        postActions.classList.remove('hidden');
      } else {
        statusEl.className   = 'save-status error';
        statusEl.textContent = 'Could not save online (error ' + (res.status || res.reason) + '). Download your result instead.';
        postActions.style.display = 'flex';
        postActions.classList.remove('hidden');
      }
    });

    btnDownload.addEventListener('click', function () {
      var nameEl = document.getElementById('student-name');
      var info = {
        name:  nameEl ? nameEl.value.trim() : '',
        email: (document.getElementById('student-email') || {}).value || '',
        phone: (document.getElementById('student-phone') || {}).value || ''
      };
      Store.downloadResult(info || studentInfo, result);
    });
  }

})();
