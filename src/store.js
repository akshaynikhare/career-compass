/**
 * store.js — backend save + download fallback
 * Exported as window.Store = { saveResult, downloadResult, saveProfile }
 * No import/export — vanilla globals.
 *
 * Results are POSTed to the Career Compass backend (FastAPI + Neon Postgres) at
 * window.__CFG.API_BASE_URL. No database keys are present in the browser.
 */
(function () {
  'use strict';

  function buildPayload(studentInfo, result) {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(studentInfo, result))
      });
      return { ok: res.ok, status: res.status };
    } catch (err) {
      return { ok: false, reason: 'network_error', error: err.message };
    }
  }

  function downloadResult(studentInfo, result) {
    var lines = [];
    lines.push('CAREER ADVISOR — YOUR RESULTS');
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
    a.download = 'career-advisor-result.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // Fire-and-forget save used on the test page; never blocks navigation.
  function saveProfile(studentInfo, result) {
    var cfg = window.__CFG || {};

    if (!cfg.API_BASE_URL) return;

    fetch(cfg.API_BASE_URL + '/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(studentInfo, result))
    }).catch(function () {});
  }

  window.Store = { saveResult: saveResult, downloadResult: downloadResult, saveProfile: saveProfile };
})();
