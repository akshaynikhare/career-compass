(function () {
  'use strict';

  var LANG_KEY = 'cat_lang';
  var translations = null;
  var currentLang = localStorage.getItem(LANG_KEY) || 'en';

  function applyLang(lang, t) {
    currentLang = lang;
    localStorage.setItem(LANG_KEY, lang);

    function setText(id, key) {
      var el = document.getElementById(id);
      if (el && t[key] !== undefined) el.textContent = t[key];
    }
    function setInner(id, key) {
      var el = document.getElementById(id);
      if (el && t[key] !== undefined) el.innerHTML = t[key];
    }
    function queryText(selector, key) {
      var el = document.querySelector(selector);
      if (el && t[key] !== undefined) el.textContent = t[key];
    }

    // Common elements across pages
    document.querySelectorAll('.app-logo, a[href="index.html"].btn-ghost').forEach(function(el) {
      if (el.textContent.includes('Career') || el.textContent.includes('करियर')) {
        el.textContent = '⊙ ' + t.app_name;
      }
    });

    // test.html
    setText('btn-begin',        'btn_begin');
    setText('btn-next',         'btn_next');
    setText('btn-prev',         'btn_prev');

    // result.html
    queryText('.result-header h1',                      'your_profile_title');
    queryText('.section-title',                         'section_riasec');  // first one
    setText('btn-retake',       'btn_retake');
    setText('btn-save',         'btn_save');

    // Phase labels (app.js uses PHASE_LABELS array — we patch via DOM)
    // Update toggle label
    var toggle = document.getElementById('lang-toggle-btn');
    if (toggle) toggle.textContent = t.toggle_lang;
  }

  function injectToggle() {
    var header = document.querySelector('.test-header');
    if (!header || document.getElementById('lang-toggle-btn')) return;

    var btn = document.createElement('button');
    btn.id = 'lang-toggle-btn';
    btn.style.cssText = 'background:var(--bg); border:1px solid var(--border); border-radius:var(--radius-sm); padding:0.25rem 0.625rem; font-size:0.8125rem; font-weight:600; color:var(--text); cursor:pointer; flex-shrink:0;';
    btn.textContent = currentLang === 'en' ? 'हिंदी' : 'English';

    btn.addEventListener('click', function () {
      var newLang = currentLang === 'en' ? 'hi' : 'en';
      if (translations) applyLang(newLang, translations[newLang]);
    });

    // Insert between logo and any existing right-side element
    var firstChild = header.firstElementChild;
    if (firstChild && firstChild.nextElementSibling) {
      header.insertBefore(btn, firstChild.nextElementSibling);
    } else {
      header.appendChild(btn);
    }
  }

  fetch('data/i18n.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      translations = data;
      injectToggle();
      if (currentLang !== 'en') {
        applyLang(currentLang, translations[currentLang]);
      }
    })
    .catch(function () {});

})();
