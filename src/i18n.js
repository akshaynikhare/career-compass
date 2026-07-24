/**
 * i18n.js — Applies Hindi to static HTML + injects the language toggle.
 *
 * Two kinds of page:
 *
 * 1. App pages (index/test/result/…): authored in English with inline Hindi on
 *    data-i18n-hi* attributes. Language comes from ?lang= → localStorage → 'en'.
 *    When Hindi, we swap the attribute values in; the toggle flips the stored
 *    language and reloads so data-driven renderers re-read *_hi fields too.
 *      data-i18n-hi        -> textContent
 *      data-i18n-hi-html   -> innerHTML (markup / entities)
 *      data-i18n-hi-ph     -> placeholder
 *      data-i18n-hi-title  -> title
 *      data-i18n-hi-label  -> aria-label
 *
 * 2. Static bilingual pages (generated careers/ + careers/hi/): each language is
 *    a distinct, fully server-rendered URL cross-linked with hreflang alternates.
 *    Here the toggle simply NAVIGATES to the counterpart URL — no in-place swap.
 */
(function () {
  'use strict';

  var LANG_KEY = 'cat_lang';
  var SUPPORTED = ['en', 'hi'];

  // Language the server rendered this page in (set on <html lang>), captured
  // before we override it below.
  var serverLang = (document.documentElement.getAttribute('lang') || '').slice(0, 2) === 'hi' ? 'hi' : 'en';

  // Detect a static bilingual page via its hreflang alternates.
  var altEnEl = document.querySelector('link[rel="alternate"][hreflang="en"]');
  var altHiEl = document.querySelector('link[rel="alternate"][hreflang="hi"]');
  var isBilingualStatic = !!(altEnEl && altHiEl && altEnEl.href !== altHiEl.href);

  var INLINE_STYLE = 'background:var(--bg); border:1px solid var(--border); border-radius:var(--radius-sm); padding:0.25rem 0.625rem; font-size:0.8125rem; font-weight:600; color:var(--text); cursor:pointer; flex-shrink:0; margin-left:auto;';
  var FLOAT_STYLE = 'position:fixed; top:0.75rem; right:0.75rem; z-index:9999; background:var(--white,#fff); border:1px solid var(--border,#e5e7eb); border-radius:999px; padding:0.35rem 0.85rem; font-size:0.8125rem; font-weight:600; color:var(--primary,#4F46E5); cursor:pointer; box-shadow:0 1px 4px rgba(0,0,0,0.12);';

  function makeButton(label, onClick) {
    if (document.getElementById('lang-toggle-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'lang-toggle-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Change language / भाषा बदलें');
    btn.textContent = label;
    var header = document.querySelector('.test-header');
    if (header) { btn.style.cssText = INLINE_STYLE; header.appendChild(btn); }
    else { btn.style.cssText = FLOAT_STYLE; document.body.appendChild(btn); }
    btn.addEventListener('click', onClick);
  }

  // ── Static bilingual page: toggle navigates to the counterpart URL ──────────
  if (isBilingualStatic) {
    function initNav() {
      makeButton(serverLang === 'en' ? 'हिंदी' : 'English', function () {
        var target = serverLang === 'en' ? altHiEl.href : altEnEl.href;
        try { localStorage.setItem(LANG_KEY, serverLang === 'en' ? 'hi' : 'en'); } catch (e) {}
        window.location.href = target;
      });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNav);
    else initNav();
    return;
  }

  // ── App page: ?lang= → localStorage → default, with in-place Hindi swap ─────
  var urlLang = null;
  try {
    urlLang = new URLSearchParams(window.location.search).get('lang');
  } catch (e) { /* older browsers */ }
  if (urlLang) urlLang = urlLang.toLowerCase();

  var currentLang =
    (urlLang && SUPPORTED.indexOf(urlLang) !== -1 && urlLang) ||
    (function () { try { return localStorage.getItem(LANG_KEY); } catch (e) { return null; } })() ||
    'en';

  if (urlLang && SUPPORTED.indexOf(urlLang) !== -1) {
    try { localStorage.setItem(LANG_KEY, urlLang); } catch (e) {}
  }

  document.documentElement.lang = currentLang === 'hi' ? 'hi-IN' : 'en-IN';

  function applyStaticHindi() {
    if (currentLang !== 'hi') return;
    document.querySelectorAll('[data-i18n-hi]').forEach(function (el) {
      el.textContent = el.getAttribute('data-i18n-hi');
    });
    document.querySelectorAll('[data-i18n-hi-html]').forEach(function (el) {
      el.innerHTML = el.getAttribute('data-i18n-hi-html');
    });
    document.querySelectorAll('[data-i18n-hi-ph]').forEach(function (el) {
      el.setAttribute('placeholder', el.getAttribute('data-i18n-hi-ph'));
    });
    document.querySelectorAll('[data-i18n-hi-title]').forEach(function (el) {
      el.setAttribute('title', el.getAttribute('data-i18n-hi-title'));
    });
    document.querySelectorAll('[data-i18n-hi-label]').forEach(function (el) {
      el.setAttribute('aria-label', el.getAttribute('data-i18n-hi-label'));
    });
  }

  function init() {
    applyStaticHindi();
    makeButton(currentLang === 'en' ? 'हिंदी' : 'English', function () {
      var next = currentLang === 'en' ? 'hi' : 'en';
      try { localStorage.setItem(LANG_KEY, next); } catch (e) {}
      try {
        var url = new URL(window.location.href);
        url.searchParams.delete('lang');
        window.location.replace(url.toString());
      } catch (e) {
        window.location.reload();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
