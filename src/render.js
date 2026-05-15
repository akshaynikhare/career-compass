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

  var compareSelected = [];

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
  renderPeopleSection(result.riasec);
  renderDomains(result.topByDomain || []);
  renderCards('top10-cards', result.top10 || [], false, result.constraints, result.riasec);
  renderCards('stretch5-cards', result.stretch5 || [], true, result.constraints, result.riasec);
  setupCollapsible();
  populatePrintCard(result);
  setupCompare();

  // AI domain ranking — runs async after render, annotates domain headers in-place
  if (window.CareerAI && result.topByDomain && result.topByDomain.length) {
    CareerAI.rankDomains(result.topByDomain, result.riasec, result.constraints || {})
      .then(function (ranked) {
        if (!ranked) return;
        var reasonMap = {};
        ranked.forEach(function (r) { reasonMap[r.category] = r.reason; });
        document.querySelectorAll('.domain-group').forEach(function (group) {
          var titleEl = group.querySelector('.domain-group-header-title');
          if (!titleEl) return;
          var cat = titleEl.textContent;
          var reason = reasonMap[cat];
          if (!reason) return;
          var reasonEl = document.createElement('span');
          reasonEl.className = 'domain-ai-reason';
          reasonEl.textContent = reason;
          titleEl.parentNode.appendChild(reasonEl);
        });
      })
      .catch(function () {});
  }

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
      var SHORT_DIM = { R: 'Realistic', I: 'Investigative', A: 'Artistic', S: 'Social', E: 'Enterprising', C: 'Conventional' };
      dimLabel.textContent = SHORT_DIM[d] || d;
      dimLabel.style.fontSize = '0.6875rem';
      dimLabel.title = DIM_LABELS[d];
      dimLabel.style.color = DIM_COLORS[d];

      wrap.appendChild(pctLabel);
      wrap.appendChild(bar);
      wrap.appendChild(dimLabel);
      container.appendChild(wrap);
    });
  }

  function renderPeopleSection(riasec) {
    if (!riasec) return;

    var sorted = ['R','I','A','S','E','C'].sort(function(a,b){ return (riasec[b]||0)-(riasec[a]||0); });
    var top2 = sorted.slice(0,2);

    fetch('data/riasec_people.json')
      .then(function(r){ return r.json(); })
      .then(function(people) {
        var match = null;
        var bestScore = -1;

        people.forEach(function(p) {
          var score = p.dominant.filter(function(d){ return top2.indexOf(d) !== -1; }).length;
          if (score > bestScore) { bestScore = score; match = p; }
        });

        if (!match) return;

        var DIM_COLORS = { R:'#F97316', I:'#3B82F6', A:'#EC4899', S:'#10B981', E:'#F59E0B', C:'#8B5CF6' };
        var DIM_LABELS = { R:'Realistic', I:'Investigative', A:'Artistic', S:'Social', E:'Enterprising', C:'Conventional' };

        var section = document.createElement('div');
        section.className = 'card mb-2';
        section.style.cssText = 'margin-bottom:1rem; display:flex; align-items:flex-start; gap:1rem;';

        var icon = document.createElement('div');
        icon.style.cssText = 'flex-shrink:0; width:3rem; height:3rem; border-radius:50%; background:linear-gradient(135deg,#4F46E5,#7C3AED); display:flex; align-items:center; justify-content:center; font-size:1.375rem;';
        icon.textContent = '✨';

        var body = document.createElement('div');
        body.style.flex = '1';

        var eyebrow = document.createElement('p');
        eyebrow.style.cssText = 'font-size:0.75rem; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.25rem;';
        eyebrow.textContent = 'A Profile Like Yours';

        var personName = document.createElement('p');
        personName.style.cssText = 'font-size:1rem; font-weight:700; color:var(--text); margin-bottom:0.125rem;';
        personName.textContent = match.name;

        var role = document.createElement('p');
        role.style.cssText = 'font-size:0.8125rem; color:var(--primary); font-weight:500; margin-bottom:0.375rem;';
        role.textContent = match.role;

        var note = document.createElement('p');
        note.style.cssText = 'font-size:0.8125rem; color:var(--muted); line-height:1.5;';
        note.textContent = match.note;

        var dimPills = document.createElement('div');
        dimPills.style.cssText = 'display:flex; gap:0.375rem; margin-top:0.5rem; flex-wrap:wrap;';
        top2.forEach(function(d) {
          var pill = document.createElement('span');
          pill.style.cssText = 'font-size:0.6875rem; font-weight:700; padding:0.125rem 0.5rem; border-radius:999px; background:' + (DIM_COLORS[d]||'#ccc') + '22; color:' + (DIM_COLORS[d]||'#666') + ';';
          pill.textContent = DIM_LABELS[d] || d;
          dimPills.appendChild(pill);
        });

        body.appendChild(eyebrow);
        body.appendChild(personName);
        body.appendChild(role);
        body.appendChild(note);
        body.appendChild(dimPills);
        section.appendChild(icon);
        section.appendChild(body);

        var riasecCard = document.getElementById('riasec-chart');
        if (riasecCard) {
          var parent = riasecCard.closest('.card');
          if (parent && parent.parentNode) {
            parent.parentNode.insertBefore(section, parent.nextSibling);
          }
        }
      })
      .catch(function(){});
  }

  // ── Career cards ──────────────────────────────────────────────────────────
  function renderCards(containerId, matches, isStretch, constraints, riasec) {
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

    var initialCount = isStretch ? matches.length : 3;

    matches.forEach(function (m, i) {
      var card = buildCard(m, i + 1, isStretch, constraints, riasec);
      if (i >= initialCount) card.style.display = 'none';
      container.appendChild(card);
    });

    if (!isStretch && matches.length > initialCount) {
      var remaining = matches.length - initialCount;
      var btn = document.createElement('button');
      btn.className   = 'btn-secondary';
      btn.textContent = 'Show ' + remaining + ' more';
      btn.style.cssText = 'width:100%; justify-content:center; margin-top:0.75rem;';
      btn.addEventListener('click', function () {
        container.querySelectorAll('.career-card').forEach(function (c) { c.style.display = ''; });
        btn.remove();
      });
      container.appendChild(btn);
    }
  }

  function renderDomains(topByDomain) {
    var container = document.getElementById('domain-cards');
    if (!container) return;
    container.innerHTML = '';

    if (!topByDomain || topByDomain.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'text-muted text-center';
      empty.textContent = 'No domain matches found.';
      empty.style.padding = '1rem 0';
      container.appendChild(empty);
      return;
    }

    topByDomain.forEach(function (domain) {
      var col = CATEGORY_COLORS[domain.category] || DEFAULT_COLOR;

      var group = document.createElement('div');
      group.className = 'domain-group';

      var header = document.createElement('div');
      header.className = 'domain-group-header';
      header.style.background = col.bg;
      header.style.color = col.text;
      header.style.borderLeftColor = col.text;

      var title = document.createElement('span');
      title.className = 'domain-group-header-title';
      title.textContent = domain.category;
      header.appendChild(title);
      group.appendChild(header);

      var cardsWrap = document.createElement('div');
      cardsWrap.className = 'domain-group-cards';
      domain.matches.forEach(function (m) {
        cardsWrap.appendChild(buildCard(m, null, false, result.constraints, result.riasec));
      });
      group.appendChild(cardsWrap);
      container.appendChild(group);
    });
  }

  function buildCard(match, rank, isStretch, constraints, riasec) {
    var p    = match.profession;
    var pct  = Math.round(match.score * 100);
    var col  = CATEGORY_COLORS[p.category] || DEFAULT_COLOR;

    var card = document.createElement('div');
    card.className = 'career-card';

    // Header: [#rank name] on one row, [badge] below
    var header = document.createElement('div');
    header.className = 'career-card-header';

    var nameBlock = document.createElement('div');
    nameBlock.className = 'career-name-block';

    var nameRow = document.createElement('div');
    nameRow.className = 'career-name-row';

    var name = document.createElement('div');
    name.className   = 'career-name';
    name.textContent = p.name;

    if (rank !== null && rank !== undefined) {
      var rankEl = document.createElement('span');
      rankEl.className   = 'career-rank';
      rankEl.textContent = '#' + rank;
      nameRow.appendChild(rankEl);
    }
    nameRow.appendChild(name);

    var badge = document.createElement('span');
    badge.className         = 'badge';
    badge.textContent       = p.category;
    badge.style.background  = col.bg;
    badge.style.color       = col.text;

    nameBlock.appendChild(nameRow);
    nameBlock.appendChild(badge);
    header.appendChild(nameBlock);
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

    // Summary
    if (p.summary) {
      var summary = document.createElement('p');
      summary.className   = 'career-summary';
      summary.textContent = p.summary;
      card.appendChild(summary);
    }

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
      var EXAM_DESC = {
        'NEET': 'National entrance for medical colleges',
        'JEE Main': 'National entrance for engineering colleges',
        'JEE Advanced': 'Entrance for IITs (premium engineering)',
        'CLAT': 'National entrance for law colleges (NLUs)',
        'CAT': 'Entrance for IIMs and top MBA colleges',
        'GATE': 'Entrance for M.Tech and PSU jobs',
        'UPSC': 'Civil services — IAS, IPS, IFS'
      };
      if (EXAM_DESC[p.entrance_exam]) {
        examItem.title = EXAM_DESC[p.entrance_exam];
        examItem.style.cursor = 'help';
      }
      meta.appendChild(examItem);
    }

    if (p.salary_lpa && p.salary_lpa.entry !== undefined) {
      var salaryItem = document.createElement('span');
      salaryItem.className   = 'career-meta-item';
      salaryItem.textContent = '₹ ' + p.salary_lpa.entry + '–' + p.salary_lpa.senior + ' LPA';
      meta.appendChild(salaryItem);
    }

    card.appendChild(meta);

    if (p.entrance_exam) {
      var FREE_PREP = {
        'NEET':         [{l:'NCERT Bio 11 & 12',u:'https://ncert.nic.in/textbook.php'},{l:'Khan Academy Biology',u:'https://www.khanacademy.org/science/biology'},{l:'Unacademy NEET',u:'https://unacademy.com/goal/neet-ug/NHNTF'}],
        'JEE Main':     [{l:'NCERT Physics/Maths',u:'https://ncert.nic.in/textbook.php'},{l:'Khan Academy Maths',u:'https://www.khanacademy.org/math'},{l:'Unacademy JEE',u:'https://unacademy.com/goal/jee-main-and-advanced/KVFIN'}],
        'JEE Advanced': [{l:'NCERT Physics/Chem/Maths',u:'https://ncert.nic.in/textbook.php'},{l:'Unacademy JEE Advanced',u:'https://unacademy.com/goal/jee-main-and-advanced/KVFIN'}],
        'CLAT':         [{l:'Legal reasoning basics (YouTube)',u:'https://www.youtube.com/results?search_query=CLAT+legal+reasoning'},{l:'Unacademy CLAT',u:'https://unacademy.com/goal/clat/CLAT'}],
        'CAT':          [{l:'Free CAT prep - Unacademy',u:'https://unacademy.com/goal/cat/CATXM'},{l:'Khan Academy Quant',u:'https://www.khanacademy.org/math/gmat'}],
        'GATE':         [{l:'NPTEL free courses',u:'https://nptel.ac.in/'},{l:'Khan Academy Engineering',u:'https://www.khanacademy.org/science/electrical-engineering'}],
        'UPSC':         [{l:'NCERT books (all subjects)',u:'https://ncert.nic.in/textbook.php'},{l:'Unacademy UPSC',u:'https://unacademy.com/goal/upsc-civil-services-examination/KSCGY'}],
        'NATA':         [{l:'NATA prep guide',u:'https://www.youtube.com/results?search_query=NATA+exam+preparation'}],
        'NDA':          [{l:'Unacademy NDA',u:'https://unacademy.com/goal/nda-na/NDANA'}]
      };

      var prepLinks = FREE_PREP[p.entrance_exam];
      if (prepLinks && prepLinks.length > 0) {
        var prepWrap = document.createElement('div');
        prepWrap.style.cssText = 'margin-top:0.5rem;';

        var prepToggle = document.createElement('button');
        prepToggle.style.cssText = 'background:none; border:none; padding:0; font-size:0.75rem; color:var(--primary); cursor:pointer; font-weight:600; display:flex; align-items:center; gap:0.25rem;';
        prepToggle.innerHTML = '&#9654; Free ' + p.entrance_exam + ' prep resources';

        var prepList = document.createElement('div');
        prepList.style.cssText = 'display:none; margin-top:0.375rem; padding:0.5rem 0.75rem; background:var(--bg); border-radius:var(--radius-sm); flex-direction:column; gap:0.25rem;';

        prepLinks.forEach(function(r) {
          var a = document.createElement('a');
          a.href = r.u;
          a.target = '_blank';
          a.rel = 'noopener';
          a.style.cssText = 'font-size:0.8125rem; color:var(--primary); text-decoration:none;';
          a.textContent = '→ ' + r.l;
          prepList.appendChild(a);
        });

        prepToggle.addEventListener('click', function() {
          var open = prepList.style.display === 'flex';
          prepList.style.display = open ? 'none' : 'flex';
          prepToggle.innerHTML = (open ? '&#9654;' : '&#9660;') + ' Free ' + p.entrance_exam + ' prep resources';
        });

        prepWrap.appendChild(prepToggle);
        prepWrap.appendChild(prepList);
        card.appendChild(prepWrap);
      }
    }

    // Day in the life (collapsible) — only shown when field is populated
    if (p.day_in_life) {
      var dilWrap = document.createElement('div');
      dilWrap.style.cssText = 'margin-top:0.5rem;';

      var dilToggle = document.createElement('button');
      dilToggle.style.cssText = 'background:none; border:none; padding:0; font-size:0.75rem; color:var(--primary); cursor:pointer; font-weight:600; display:flex; align-items:center; gap:0.25rem;';
      dilToggle.innerHTML = '&#9654; A day in the life';

      var dilBody = document.createElement('div');
      dilBody.style.cssText = 'display:none; margin-top:0.375rem; padding:0.5rem 0.75rem; background:var(--bg); border-radius:var(--radius-sm); font-size:0.8125rem; color:var(--muted); line-height:1.6;';
      dilBody.textContent = p.day_in_life;

      dilToggle.addEventListener('click', function () {
        var open = dilBody.style.display === 'block';
        dilBody.style.display = open ? 'none' : 'block';
        dilToggle.innerHTML = (open ? '&#9654;' : '&#9660;') + ' A day in the life';
      });

      dilWrap.appendChild(dilToggle);
      dilWrap.appendChild(dilBody);
      card.appendChild(dilWrap);
    }

    // Why it matched (top10 only)
    if (constraints && riasec && !isStretch) {
      var matchReasons = [];

      var streamLabels = { pcm: 'Science (PCM)', pcb: 'Science (PCB)', commerce: 'Commerce', arts: 'Arts / Humanities', any: 'Any stream' };
      if (constraints.stream_pref && constraints.stream_pref !== 'any') {
        if (p.streams && (p.streams.includes(constraints.stream_pref) || p.streams.includes('any'))) {
          matchReasons.push('Matches your ' + (streamLabels[constraints.stream_pref] || constraints.stream_pref) + ' stream');
        }
      }
      if (constraints.years_available && p.years_min <= constraints.years_available) {
        matchReasons.push(p.years_min + '+ year path fits your ' + constraints.years_available + '-year plan');
      }
      if (constraints.exam_intensity && p.exam_intensity <= constraints.exam_intensity) {
        var intensityLabel = ['', 'Low', 'Moderate', 'High'];
        matchReasons.push((intensityLabel[p.exam_intensity] || p.exam_intensity) + ' exam intensity — matches your preference');
      }
      var DIM_NAMES = { R: 'hands-on / technical', I: 'research / analytical', A: 'creative / expressive', S: 'people-focused', E: 'leadership / business', C: 'structured / detail-oriented' };
      var topUserDim = Object.keys(riasec).reduce(function(a, b) { return riasec[a] > riasec[b] ? a : b; });
      matchReasons.push('Aligns with your ' + (DIM_NAMES[topUserDim] || topUserDim) + ' personality (' + topUserDim + ')');

      if (matchReasons.length > 0) {
        var whyWrap = document.createElement('div');
        whyWrap.style.cssText = 'margin-top:0.625rem; padding-top:0.625rem; border-top:1px solid var(--border);';

        var whyLabel = document.createElement('p');
        whyLabel.style.cssText = 'font-size:0.75rem; font-weight:600; color:var(--muted); margin-bottom:0.375rem; text-transform:uppercase; letter-spacing:0.04em;';
        whyLabel.textContent = 'Why it matched';
        whyWrap.appendChild(whyLabel);

        matchReasons.forEach(function(reason) {
          var row = document.createElement('div');
          row.style.cssText = 'display:flex; align-items:flex-start; gap:0.375rem; margin-bottom:0.2rem;';
          var tick = document.createElement('span');
          tick.style.cssText = 'color:#059669; font-size:0.8125rem; flex-shrink:0; margin-top:1px;';
          tick.textContent = '✓';
          var txt = document.createElement('span');
          txt.style.cssText = 'font-size:0.8125rem; color:var(--muted);';
          txt.textContent = reason;
          row.appendChild(tick);
          row.appendChild(txt);
          whyWrap.appendChild(row);
        });

        card.appendChild(whyWrap);
      }
    }

    // Stretch reason
    if (isStretch && match.constraint_issues && match.constraint_issues.length > 0) {
      var reason = document.createElement('div');
      reason.className = 'stretch-reason';
      reason.textContent = '⚠️ Constraints: ' + match.constraint_issues.map(function (k) {
        return CONSTRAINT_LABELS[k] || k;
      }).join('; ');
      card.appendChild(reason);
    }

    if (!isStretch) {
      var cmpRow = document.createElement('div');
      cmpRow.style.cssText = 'margin-top:0.75rem; padding-top:0.625rem; border-top:1px solid var(--border); display:flex; align-items:center; gap:0.5rem;';
      var cmpCheckbox = document.createElement('input');
      cmpCheckbox.type = 'checkbox';
      cmpCheckbox.id = 'cmp_' + p.id;
      cmpCheckbox.style.cssText = 'width:1rem; height:1rem; accent-color:var(--primary); cursor:pointer;';
      var cmpLabel = document.createElement('label');
      cmpLabel.htmlFor = 'cmp_' + p.id;
      cmpLabel.style.cssText = 'font-size:0.8125rem; color:var(--muted); cursor:pointer;';
      cmpLabel.textContent = 'Add to compare';
      cmpCheckbox.addEventListener('change', function() {
        if (cmpCheckbox.checked) {
          if (compareSelected.length >= 2) {
            cmpCheckbox.checked = false;
            return;
          }
          compareSelected.push(match);
        } else {
          compareSelected = compareSelected.filter(function(m) { return m.profession.id !== p.id; });
        }
        updateCompareBar();
      });
      cmpRow.appendChild(cmpCheckbox);
      cmpRow.appendChild(cmpLabel);
      card.appendChild(cmpRow);
    }

    return card;
  }

  function formatStreams(streams) {
    var labels = { pcm: 'Science (PCM)', pcb: 'Science (PCB)', commerce: 'Commerce', arts: 'Arts / Humanities', any: 'Any stream' };
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


  // ── Print card ────────────────────────────────────────────────────────────
  function populatePrintCard(result) {
    var nameEl   = document.getElementById('print-student-name');
    var top3El   = document.getElementById('print-top3');
    var streamEl = document.getElementById('print-stream');
    var btnPrint = document.getElementById('btn-print');

    if (!nameEl) return;

    if (result.studentInfo && result.studentInfo.name) {
      nameEl.textContent = result.studentInfo.name;
    }

    var streamLabels = { pcm: 'Science — PCM (Physics, Chemistry, Maths)', pcb: 'Science — PCB (Physics, Chemistry, Biology)', commerce: 'Commerce', arts: 'Arts / Humanities', any: 'Any stream' };
    var topStream = result.constraints && result.constraints.stream_pref ? (streamLabels[result.constraints.stream_pref] || result.constraints.stream_pref) : 'Not specified';
    if (streamEl) streamEl.textContent = topStream;

    if (top3El && result.top10) {
      result.top10.slice(0, 3).forEach(function(m, i) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; gap:0.5rem;';
        var num = document.createElement('span');
        num.style.cssText = 'font-weight:700; color:var(--primary); min-width:1.25rem; font-size:0.875rem;';
        num.textContent = '#' + (i + 1);
        var name = document.createElement('span');
        name.style.cssText = 'font-size:0.9375rem; color:var(--text);';
        name.textContent = m.profession.name;
        row.appendChild(num);
        row.appendChild(name);
        top3El.appendChild(row);
      });
    }

    if (btnPrint) {
      btnPrint.addEventListener('click', function() { window.print(); });
    }
  }

  // ── Compare bar + modal ───────────────────────────────────────────────────
  function updateCompareBar() {
    var bar     = document.getElementById('compare-bar');
    var barText = document.getElementById('compare-bar-text');
    if (!bar) return;
    if (compareSelected.length === 0) {
      bar.style.display = 'none';
    } else {
      bar.style.display = 'block';
      barText.textContent = compareSelected.length === 1
        ? '1 career selected — pick one more to compare'
        : compareSelected[0].profession.name + ' vs ' + compareSelected[1].profession.name;
      document.getElementById('btn-compare-open').style.display = compareSelected.length === 2 ? 'inline-block' : 'none';
    }
  }

  function renderCompareTable() {
    var wrap = document.getElementById('compare-table-wrap');
    if (!wrap || compareSelected.length < 2) return;
    var a = compareSelected[0].profession;
    var b = compareSelected[1].profession;
    var streamLabels = { pcm: 'Science (PCM)', pcb: 'Science (PCB)', commerce: 'Commerce', arts: 'Arts / Humanities', any: 'Any stream' };
    var formatStreams2 = function(s) { return s.map(function(x) { return streamLabels[x] || x; }).join(', '); };
    var formatFee = function(range) { return range ? '₹' + Math.round(range[0]/1000) + 'k–' + Math.round(range[1]/1000) + 'k/yr' : '—'; };
    var formatSalary = function(sal) { return sal ? '₹' + sal.entry + 'L entry / ₹' + sal.senior + 'L senior' : '—'; };
    var formatIntensity = function(n) { return ['', '●○○ Low', '●●○ Moderate', '●●● High'][n] || n; };

    var rows = [
      ['Stream', formatStreams2(a.streams), formatStreams2(b.streams)],
      ['Study Duration', a.years_min + '+ years', b.years_min + '+ years'],
      ['Annual Fee', formatFee(a.annual_fee_range), formatFee(b.annual_fee_range)],
      ['Salary Range', formatSalary(a.salary_lpa), formatSalary(b.salary_lpa)],
      ['Entrance Exam', a.entrance_exam || '—', b.entrance_exam || '—'],
      ['Exam Intensity', formatIntensity(a.exam_intensity), formatIntensity(b.exam_intensity)],
      ['Category', a.category, b.category]
    ];

    var table = document.createElement('table');
    table.style.cssText = 'width:100%; border-collapse:collapse; font-size:0.875rem;';

    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    ['', a.name, b.name].forEach(function(h, i) {
      var th = document.createElement('th');
      th.style.cssText = 'padding:0.625rem 0.75rem; text-align:' + (i === 0 ? 'left' : 'center') + '; background:var(--bg); border-bottom:2px solid var(--border); font-size:0.8125rem; color:' + (i === 0 ? 'var(--muted)' : 'var(--primary)') + '; font-weight:700;';
      th.textContent = h;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    rows.forEach(function(row, ri) {
      var tr = document.createElement('tr');
      tr.style.background = ri % 2 === 0 ? 'var(--white)' : 'var(--bg)';
      row.forEach(function(cell, ci) {
        var td = document.createElement('td');
        td.style.cssText = 'padding:0.625rem 0.75rem; border-bottom:1px solid var(--border); text-align:' + (ci === 0 ? 'left' : 'center') + '; color:' + (ci === 0 ? 'var(--muted)' : 'var(--text)') + '; font-size:0.8125rem;';
        td.textContent = cell;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.innerHTML = '';
    wrap.appendChild(table);
  }

  function setupCompare() {
    var btnOpen  = document.getElementById('btn-compare-open');
    var btnClear = document.getElementById('btn-compare-clear');
    var btnClose = document.getElementById('compare-close');
    var modal    = document.getElementById('compare-modal');

    if (!btnOpen) return;

    btnOpen.addEventListener('click', function() {
      renderCompareTable();
      modal.style.display = 'block';
      document.body.style.overflow = 'hidden';
    });

    btnClear.addEventListener('click', function() {
      compareSelected = [];
      document.querySelectorAll('input[id^="cmp_"]').forEach(function(cb) { cb.checked = false; });
      updateCompareBar();
    });

    btnClose.addEventListener('click', function() {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    });

    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
      }
    });
  }

})();
