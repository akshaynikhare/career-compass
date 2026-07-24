(function (root) {
  'use strict';

  // All AI now goes through the Career Compass backend (FastAPI on FastAPI Cloud),
  // which holds the Gemini key server-side. No API key is present in the browser.
  function apiBase() {
    return (window.__CFG && window.__CFG.API_BASE_URL) || '';
  }

  // Current UI language ('en' | 'hi') — so AI responses come back in Hindi too.
  function lang() {
    try { return (window.getLang && window.getLang()) || 'en'; } catch (e) { return 'en'; }
  }

  async function postJSON(path, body) {
    var base = apiBase();
    if (!base) return null;
    var cfg = window.__CFG || {};
    var headers = { 'Content-Type': 'application/json' };
    if (cfg.API_KEY) headers['X-Api-Key'] = cfg.API_KEY;
    try {
      var res = await fetch(base + path, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  // ── Domain ranking ──────────────────────────────────────────────────────────
  // Same signature and return shape as before: resolves to an array of
  // { category, reason } in ranked order, or null on any failure/missing config.
  async function rankDomains(topByDomain, riasec, constraints) {
    var domains = (topByDomain || []).slice(0, 10).map(function (d) {
      var careers = d.matches.map(function (m) {
        return m.profession.name + ' (' + Math.round(m.score * 100) + '% match)';
      }).join(', ');
      return { category: d.category, careers: careers };
    });

    var data = await postJSON('/api/ai/rank-domains', {
      riasec: riasec || {},
      constraints: constraints || {},
      domains: domains,
      lang: lang()
    });

    if (!Array.isArray(data)) return null;
    return data;
  }

  // ── Personalized summary ─────────────────────────────────────────────────────
  // Resolves to a plain-text string, or '' on failure.
  async function summary(riasec, constraints, topMatches) {
    var data = await postJSON('/api/ai/summary', {
      riasec: riasec || {},
      constraints: constraints || {},
      top_matches: (topMatches || []).map(function (m) {
        return { id: m.profession.id, name: m.profession.name, score: m.score };
      }),
      lang: lang()
    });
    return (data && data.text) || '';
  }

  // ── "Ask about this career" Q&A ──────────────────────────────────────────────
  async function chat(profession, question) {
    var context = profession
      ? [profession.summary, profession.path_india, profession.day_in_life]
          .filter(Boolean).join(' ')
      : '';
    var data = await postJSON('/api/ai/chat', {
      profession_id: profession && profession.id,
      profession_name: profession && profession.name,
      profession_context: context,
      question: question,
      lang: lang()
    });
    return (data && data.text) || '';
  }

  // ── On-demand roadmap ────────────────────────────────────────────────────────
  async function roadmap(profession, constraints) {
    var context = profession
      ? [profession.summary, profession.path_india, profession.entrance_exam]
          .filter(Boolean).join(' ')
      : '';
    var data = await postJSON('/api/ai/roadmap', {
      profession_id: profession && profession.id,
      profession_name: profession && profession.name,
      profession_context: context,
      constraints: constraints || {},
      lang: lang()
    });
    return (data && data.text) || '';
  }

  root.CareerAI = {
    rankDomains: rankDomains,
    summary: summary,
    chat: chat,
    roadmap: roadmap
  };

})(typeof window !== 'undefined' ? window : this);
