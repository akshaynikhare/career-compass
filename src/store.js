/**
 * store.js — backend save + download fallback + resumable test sessions
 * Exported as window.Store = { saveResult, downloadResult, createSession, updateSession, getSession }
 * No import/export — vanilla globals.
 *
 * Results are POSTed to the Career Compass backend (FastAPI + Neon Postgres) at
 * window.__CFG.API_BASE_URL. No database keys are present in the browser.
 */
(function () {
  'use strict';

  function apiHeaders(cfg) {
    var h = { 'Content-Type': 'application/json' };
    if (cfg.API_KEY) h['X-Api-Key'] = cfg.API_KEY;
    return h;
  }

  function buildPayload(studentInfo, result) {
    studentInfo = studentInfo || {};
    return {
      student_name:  studentInfo.name  || null,
      student_email: studentInfo.email || null,
      student_phone: studentInfo.phone || null,
      riasec_vector: result.riasec,
      constraints:   result.constraints || {},
      top_matches: (result.top10 || []).map(function (m) {
        return { id: m.profession.id, name: m.profession.name, score: m.score };
      }),
      user_agent: navigator.userAgent
    };
  }

  async function saveResult(studentInfo, result) {
    var cfg = window.__CFG || {};

    if (!cfg.API_BASE_URL) {
      return { ok: false, reason: 'no_config' };
    }

    try {
      var res = await fetch(cfg.API_BASE_URL + '/api/results', {
        method: 'POST',
        headers: apiHeaders(cfg),
        body: JSON.stringify(buildPayload(studentInfo, result))
      });
      return { ok: res.ok, status: res.status };
    } catch (err) {
      return { ok: false, reason: 'network_error', error: err.message };
    }
  }

  function downloadResult(studentInfo, result) {
    var lines = [];
    lines.push('CAREER COMPASS — YOUR RESULTS');
    lines.push('Generated: ' + new Date().toLocaleString('en-IN'));
    lines.push('');

    if (studentInfo && studentInfo.name) {
      lines.push('Student: ' + studentInfo.name);
      if (studentInfo.email) lines.push('Email: ' + studentInfo.email);
      if (studentInfo.phone) lines.push('Phone: ' + studentInfo.phone);
      lines.push('');
    }

    lines.push('RIASEC PROFILE');
    lines.push('--------------');
    var dims = ['R', 'I', 'A', 'S', 'E', 'C'];
    var dimNames = { R: 'Realistic', I: 'Investigative', A: 'Artistic', S: 'Social', E: 'Enterprising', C: 'Conventional' };
    if (result.riasec) {
      dims.forEach(function (d) {
        var pct = Math.round((result.riasec[d] || 0) * 100);
        lines.push(dimNames[d] + ' (' + d + '): ' + pct + '%');
      });
    }
    lines.push('');

    lines.push('TOP CAREER MATCHES');
    lines.push('------------------');
    (result.top10 || []).forEach(function (m, i) {
      var pct = Math.round(m.score * 100);
      lines.push((i + 1) + '. ' + m.profession.name + ' [' + m.profession.category + '] — ' + pct + '% match');
      lines.push('   Path: ' + (m.profession.path_india || 'N/A'));
      lines.push('   Duration: ' + (m.profession.years_min || '?') + '+ years');
      lines.push('');
    });

    if (result.stretch5 && result.stretch5.length > 0) {
      lines.push('STRETCH GOALS');
      lines.push('-------------');
      result.stretch5.forEach(function (m, i) {
        var pct = Math.round(m.score * 100);
        lines.push((i + 1) + '. ' + m.profession.name + ' — ' + pct + '% match');
        lines.push('   Constraints: ' + (m.constraint_issues || []).join(', '));
        lines.push('');
      });
    }

    var blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = 'career-compass-result.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // ── In-flight test sessions (resume on any device) ────────────────────────
  // Create a session on Begin; checkpoint at section boundaries; fetch to resume.
  async function createSession(studentInfo, questionIds) {
    var cfg = window.__CFG || {};
    if (!cfg.API_BASE_URL) return null;
    studentInfo = studentInfo || {};
    try {
      var res = await fetch(cfg.API_BASE_URL + '/api/sessions', {
        method: 'POST',
        headers: apiHeaders(cfg),
        body: JSON.stringify({
          student_name:  studentInfo.name  || null,
          student_email: studentInfo.email || null,
          student_phone: studentInfo.phone || null,
          question_ids:  questionIds || [],
          user_agent:    navigator.userAgent
        })
      });
      if (!res.ok) return null;
      var data = await res.json();
      return data && data.id ? data.id : null;
    } catch (err) {
      return null;
    }
  }

  // Fire-and-forget progress checkpoint; never blocks the UI.
  function updateSession(id, payload) {
    var cfg = window.__CFG || {};
    if (!cfg.API_BASE_URL || !id) return;
    var si = payload.studentInfo || {};
    fetch(cfg.API_BASE_URL + '/api/sessions/' + encodeURIComponent(id), {
      method: 'POST',
      headers: apiHeaders(cfg),
      body: JSON.stringify({
        student_name:  si.name  || null,
        student_email: si.email || null,
        student_phone: si.phone || null,
        answers:       payload.answers || {},
        constraints:   payload.constraints || {},
        current_index: payload.current_index || 0,
        status:        payload.status || 'in_progress'
      })
    }).catch(function () {});
  }

  async function getSession(id) {
    var cfg = window.__CFG || {};
    if (!cfg.API_BASE_URL || !id) return null;
    try {
      var res = await fetch(cfg.API_BASE_URL + '/api/sessions/' + encodeURIComponent(id), {
        headers: apiHeaders(cfg)
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      return null;
    }
  }

  window.Store = {
    saveResult: saveResult,
    downloadResult: downloadResult,
    createSession: createSession,
    updateSession: updateSession,
    getSession: getSession
  };
})();
