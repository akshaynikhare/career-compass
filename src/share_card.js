(function () {
  'use strict';

  var DIM_COLORS = { R:'#F97316', I:'#3B82F6', A:'#EC4899', S:'#10B981', E:'#F59E0B', C:'#8B5CF6' };
  var DIM_FULL   = { R:'Realistic', I:'Investigative', A:'Artistic', S:'Social', E:'Enterprising', C:'Conventional' };
  var DIMS = ['R','I','A','S','E','C'];

  function drawCard(result) {
    var W = 800, H = 440;
    var canvas = document.createElement('canvas');
    canvas.width  = W * 2;
    canvas.height = H * 2;
    canvas.style.display = 'none';
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    // Background gradient
    var grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#4F46E5');
    grad.addColorStop(1, '#7C3AED');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // White overlay panel
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(32, 32, W - 64, H - 64, 16);
    ctx.fill();

    // App name
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('Career Compass', 56, 72);

    // Headline
    var headline = (result.studentInfo && result.studentInfo.name)
      ? window.T('card_profile_name', result.studentInfo.name)
      : window.T('card_profile_you');
    ctx.font = 'bold 28px -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(headline, 56, 112);

    // Top career
    var topCareer = result.top10 && result.top10.length ? window.pickLang(result.top10[0].profession, 'name') : '—';
    ctx.font = '14px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(window.T('card_top_match'), 56, 148);
    ctx.font = 'bold 22px -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(topCareer, 56, 178);

    // RIASEC bars
    if (result.riasec) {
      var max = Math.max.apply(null, DIMS.map(function(d){ return result.riasec[d] || 0; }));
      var barW = 90, barH = 80, gap = 16;
      var startX = 56, barY = 220;
      DIMS.forEach(function(d, i) {
        var x = startX + i * (barW + gap);
        var val = result.riasec[d] || 0;
        var filled = max > 0 ? Math.round((val / max) * barH) : 4;
        // Background bar
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.roundRect(x, barY, barW, barH, 4);
        ctx.fill();
        // Filled bar
        ctx.fillStyle = DIM_COLORS[d];
        ctx.beginPath();
        ctx.roundRect(x, barY + (barH - filled), barW, filled, 4);
        ctx.fill();
        // Label
        ctx.font = 'bold 13px -apple-system, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(d, x + barW / 2, barY + barH + 18);
        ctx.font = '11px -apple-system, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(Math.round(val * 100) + '%', x + barW / 2, barY + barH + 34);
        ctx.textAlign = 'left';
      });
    }

    // Footer
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('Free career test for Class 9-10 students', 56, H - 40);

    var url = canvas.toDataURL('image/png');
    document.body.removeChild(canvas);
    return url;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('btn-download-card');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var result = null;
      try { result = JSON.parse(localStorage.getItem('cat_result')); } catch(e) {}
      if (!result) { alert('Complete the test first to generate your profile card.'); return; }
      var dataUrl = drawCard(result);
      var a = document.createElement('a');
      a.download = 'career-profile.png';
      a.href = dataUrl;
      a.click();
    });
  });
})();
