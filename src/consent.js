/**
 * consent.js — lightweight analytics-consent banner.
 *
 * Career Compass is used by minors (Class 9–10), so analytics only runs after an
 * explicit opt-in. This shows a one-time banner and records the choice in
 * localStorage under 'cc_consent' ('granted' | 'denied'). analytics.js listens
 * for the 'cc:consent-granted' event and only then loads Google Analytics.
 *
 * A Do-Not-Track / Global-Privacy-Control signal is treated as a standing "no":
 * no banner is shown and nothing is tracked.
 */
(function () {
  'use strict';
  var KEY = 'cc_consent';

  var dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
  if (dnt === '1' || dnt === 'yes' || navigator.globalPrivacyControl === true) return;

  var stored = null;
  try { stored = localStorage.getItem(KEY); } catch (e) {}
  if (stored === 'granted' || stored === 'denied') return; // already decided

  var banner = null;

  function decide(value) {
    try { localStorage.setItem(KEY, value); } catch (e) {}
    window.dispatchEvent(new Event('cc:consent-' + value));
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
  }

  function show() {
    banner = document.createElement('div');
    banner.className = 'consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Analytics consent');
    banner.innerHTML =
      '<p class="consent-text">We use privacy-friendly analytics (no ads, IP anonymised) to improve this free tool. Is that OK?</p>' +
      '<div class="consent-actions">' +
        '<button type="button" class="btn-primary" id="cc-accept">Yes, that’s fine</button>' +
        '<button type="button" class="btn-secondary" id="cc-decline">No thanks</button>' +
      '</div>';
    document.body.appendChild(banner);
    document.getElementById('cc-accept').addEventListener('click', function () { decide('granted'); });
    document.getElementById('cc-decline').addEventListener('click', function () { decide('denied'); });
  }

  if (document.body) show();
  else window.addEventListener('DOMContentLoaded', show);
})();
