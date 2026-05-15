(function (root) {
  'use strict';

  var GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  function getKey() {
    return (window.__CFG && window.__CFG.GEMINI_KEY) || '';
  }

  // ── Domain ranking ──────────────────────────────────────────────────────────
  // Sends topByDomain + student RIASEC + constraints to Gemini.
  // Returns an array of { category, reason } objects in ranked order,
  // or null if the key is missing / the call fails.
  async function rankDomains(topByDomain, riasec, constraints) {
    var key = getKey();
    if (!key) return null;

    // Build a compact summary of each domain for the prompt
    var domainSummaries = topByDomain.slice(0, 10).map(function (d) {
      var careers = d.matches.map(function (m) {
        return m.profession.name + ' (' + Math.round(m.score * 100) + '% match)';
      }).join(', ');
      return d.category + ': ' + careers;
    }).join('\n');

    // Top RIASEC dimensions
    var sortedDims = Object.entries(riasec)
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 3)
      .map(function (e) {
        var labels = { R: 'Realistic (hands-on)', I: 'Investigative (analytical)', A: 'Artistic (creative)', S: 'Social (people-focused)', E: 'Enterprising (leadership)', C: 'Conventional (structured)' };
        return labels[e[0]] || e[0];
      });

    var streamLabel = { pcm: 'Science PCM', pcb: 'Science PCB', commerce: 'Commerce', arts: 'Arts/Humanities', any: 'Not decided' };

    var prompt = [
      'You are a career counsellor helping an Indian Class 10 student (age 14-16) understand their career options.',
      '',
      'Student profile:',
      '- Top personality traits: ' + sortedDims.join(', '),
      '- Preferred stream: ' + (streamLabel[constraints.stream_pref] || constraints.stream_pref || 'Not decided'),
      '- Years available for study: ' + (constraints.years_available || 'Not specified'),
      '- Exam intensity preference: ' + (['', 'Low', 'Moderate', 'High'][constraints.exam_intensity] || 'Not specified'),
      '',
      'Their top matching career domains (from a RIASEC assessment):',
      domainSummaries,
      '',
      'Task: Pick the TOP 4 domains that best fit this student. For each, write ONE short sentence (max 15 words) explaining WHY it fits — be specific to their traits, not generic.',
      '',
      'Respond in this exact JSON format (no markdown, no extra text):',
      '[',
      '  {"category": "Domain Name", "reason": "One sentence why it fits."},',
      '  ...',
      ']'
    ].join('\n');

    try {
      var res = await fetch(GEMINI_ENDPOINT + '?key=' + key, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 300 }
        })
      });

      if (!res.ok) return null;

      var data = await res.json();
      var text = data.candidates &&
                 data.candidates[0] &&
                 data.candidates[0].content &&
                 data.candidates[0].content.parts &&
                 data.candidates[0].content.parts[0].text;

      if (!text) return null;

      // Strip markdown code fences if Gemini wraps the JSON
      text = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

      var parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  root.CareerAI = { rankDomains: rankDomains };

})(typeof window !== 'undefined' ? window : this);
