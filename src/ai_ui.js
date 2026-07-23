/**
 * ai_ui.js — wires the new AI features on result.html to window.CareerAI.
 *   1. Personalised summary block (#ai-summary-card)
 *   2. "Ask about a career" Q&A + on-demand roadmap (#ai-ask-card)
 *
 * All features degrade silently: if the backend/API is unavailable, CareerAI
 * returns '' / null and the relevant card simply stays hidden. Vanilla globals,
 * no imports.
 */
(function () {
  'use strict';

  if (!window.CareerAI) return;

  var result = null;
  try { result = JSON.parse(localStorage.getItem('cat_result')); } catch (e) {}
  if (!result || !result.top10 || !result.top10.length) return;

  var matches = result.top10;
  var constraints = result.constraints || {};
  var riasec = result.riasec || {};

  // ── 1. Personalised summary ──────────────────────────────────────────────
  (function () {
    var card = document.getElementById('ai-summary-card');
    var textEl = document.getElementById('ai-summary-text');
    if (!card || !textEl) return;
    CareerAI.summary(riasec, constraints, matches).then(function (text) {
      if (!text) return;
      textEl.textContent = text;
      card.classList.remove('hidden');
    });
  })();

  // ── 2. Ask about a career + roadmap ──────────────────────────────────────
  (function () {
    var card = document.getElementById('ai-ask-card');
    var select = document.getElementById('ai-ask-profession');
    var input = document.getElementById('ai-ask-input');
    var askBtn = document.getElementById('ai-ask-btn');
    var roadmapBtn = document.getElementById('ai-roadmap-btn');
    var thread = document.getElementById('ai-ask-thread');
    if (!card || !select || !askBtn) return;

    // Only show if we actually have a configured backend.
    if (!(window.__CFG && window.__CFG.API_BASE_URL)) return;

    matches.slice(0, 10).forEach(function (m, i) {
      var opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = m.profession.name;
      select.appendChild(opt);
    });
    card.classList.remove('hidden');

    function currentProfession() {
      var idx = parseInt(select.value, 10) || 0;
      return matches[idx] && matches[idx].profession;
    }

    function addBubble(role, text) {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'padding:0.7rem 0.9rem; border-radius:var(--radius-sm); font-size:0.9rem; line-height:1.6; white-space:pre-wrap;' +
        (role === 'user'
          ? 'background:var(--primary); color:#fff; align-self:flex-end; max-width:85%;'
          : 'background:var(--bg); color:var(--text); border:1px solid var(--border);');
      wrap.textContent = text;
      thread.appendChild(wrap);
      return wrap;
    }

    function setBusy(busy) {
      askBtn.disabled = busy;
      roadmapBtn.disabled = busy;
      askBtn.textContent = busy ? '…' : 'Ask';
    }

    function ask() {
      var q = (input.value || '').trim();
      var prof = currentProfession();
      if (!q || !prof) return;
      addBubble('user', q);
      input.value = '';
      setBusy(true);
      var pending = addBubble('ai', 'Thinking…');
      CareerAI.chat(prof, q).then(function (answer) {
        pending.textContent = answer || 'Sorry, I could not answer that right now. Please try again.';
        setBusy(false);
      });
    }

    function roadmap() {
      var prof = currentProfession();
      if (!prof) return;
      addBubble('user', 'Roadmap to become a ' + prof.name);
      setBusy(true);
      var pending = addBubble('ai', 'Building your roadmap…');
      CareerAI.roadmap(prof, constraints).then(function (text) {
        pending.textContent = text || 'Roadmap unavailable right now. Please try again.';
        setBusy(false);
      });
    }

    askBtn.addEventListener('click', ask);
    roadmapBtn.addEventListener('click', roadmap);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); ask(); }
    });
  })();
})();
