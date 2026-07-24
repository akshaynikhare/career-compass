/**
 * i18n.js — Applies Hindi to static HTML + injects the language toggle.
 *
 * Language source precedence:
 *   ?lang= query param (so hreflang URLs in the sitemap resolve correctly)
 *   → saved preference (localStorage 'cat_lang')
 *   → English default.
 *
 * Static-HTML translation model: each translatable element carries its own
 * Hindi inline. When the language is Hindi we swap in the attribute value; when
 * English we leave the markup as-is (it is authored in English). Supported:
 *   data-i18n-hi         -> element.textContent
 *   data-i18n-hi-html    -> element.innerHTML  (markup / entities)
 *   data-i18n-hi-ph      -> placeholder attribute
 *   data-i18n-hi-title   -> title attribute
 *   data-i18n-hi-label   -> aria-label attribute
 *
 * The toggle flips the stored language and reloads the page so every script
 * (including data-driven renderers that read *_hi fields) re-renders in the
 * chosen language — avoids fragile live-swapping of dynamic content.
 */
(function () {
  'use strict';

  var LANG_KEY = 'cat_lang';
  var SUPPORTED = ['en', 'hi'];

  var urlLang = null;
  try {
    urlLang = new URLSearchParams(window.location.search).get('lang');
  } catch (e) { /* older browsers */ }
  if (urlLang) urlLang = urlLang.toLowerCase();

  var currentLang =
    (urlLang && SUPPORTED.indexOf(urlLang) !== -1 && urlLang) ||
    (function () { try { return localStorage.getItem(LANG_KEY); } catch (e) { return null; } })() ||
    'en';

  // Persist an explicit ?lang= choice so it survives navigation.
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

  function injectToggle() {
    if (document.getElementById('lang-toggle-btn')) return;

    var btn = document.createElement('button');
    btn.id = 'lang-toggle-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Change language / भाषा बदलें');
    btn.textContent = currentLang === 'en' ? 'हिंदी' : 'English';

    var header = document.querySelector('.test-header');
    if (header) {
      btn.style.cssText = 'background:var(--bg); border:1px solid var(--border); border-radius:var(--radius-sm); padding:0.25rem 0.625rem; font-size:0.8125rem; font-weight:600; color:var(--text); cursor:pointer; flex-shrink:0; margin-left:auto;';
      header.appendChild(btn);
    } else {
      btn.style.cssText = 'position:fixed; top:0.75rem; right:0.75rem; z-index:9999; background:var(--white,#fff); border:1px solid var(--border,#e5e7eb); border-radius:999px; padding:0.35rem 0.85rem; font-size:0.8125rem; font-weight:600; color:var(--primary,#4F46E5); cursor:pointer; box-shadow:0 1px 4px rgba(0,0,0,0.12);';
      document.body.appendChild(btn);
    }

    btn.addEventListener('click', function () {
      var next = currentLang === 'en' ? 'hi' : 'en';
      try { localStorage.setItem(LANG_KEY, next); } catch (e) {}
      // Drop any ?lang= param so it doesn't override the new choice on reload.
      try {
        var url = new URL(window.location.href);
        url.searchParams.delete('lang');
        window.location.replace(url.toString());
      } catch (e) {
        window.location.reload();
      }
    });
  }

  function init() {
    applyStaticHindi();
    injectToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
