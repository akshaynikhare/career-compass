/**
 * analytics.js — privacy-respecting, deferred Google Analytics loader.
 *
 * Why: gtag.js was loaded eagerly in the <head> of every page (including all
 * 500+ career pages). This version:
 *   1. Honours a Do-Not-Track / Global-Privacy-Control signal — if the visitor
 *      has opted out of tracking, GA is never loaded at all.
 *   2. Loads gtag.js lazily (first interaction, or when the browser is idle),
 *      so analytics never competes with first paint on cheap Android devices.
 *   3. Anonymises IPs.
 *
 * Include once per page:  <script src="src/analytics.js" defer></script>
 * (career pages use ../src/analytics.js)
 */
(function () {
  'use strict';
  var GA_ID = 'G-W50KH3VDVE';

  var CONSENT_KEY = 'cc_consent';

  // 1. Respect an explicit opt-out signal — never load, whatever the banner says.
  var dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
  if (dnt === '1' || dnt === 'yes' || navigator.globalPrivacyControl === true) return;

  // Queue any early events so nothing is lost before gtag.js arrives.
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  var loaded = false;
  function loadGA() {
    if (loaded) return;
    loaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });
  }

  var EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
  function onFirstInteraction() {
    loadGA();
    EVENTS.forEach(function (ev) { window.removeEventListener(ev, onFirstInteraction); });
  }

  function schedule() {
    EVENTS.forEach(function (ev) {
      window.addEventListener(ev, onFirstInteraction, { passive: true });
    });
    if ('requestIdleCallback' in window) {
      requestIdleCallback(loadGA, { timeout: 4000 });
    } else {
      setTimeout(loadGA, 2500);
    }
  }

  // Load lazily once we have consent (defer until the page is idle/interacted).
  function start() {
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule);
  }

  // 2. Gate on explicit consent recorded by consent.js.
  var consent = null;
  try { consent = localStorage.getItem(CONSENT_KEY); } catch (e) {}

  if (consent === 'granted') start();
  else if (consent === 'denied') { /* stay off */ }
  else window.addEventListener('cc:consent-granted', start, { once: true });
})();
