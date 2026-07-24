/**
 * build_profession_pages.mjs
 *
 * Generates crawlable static SEO pages from data/professions.json:
 *   - careers/<slug>.html          one page per profession (507)
 *   - careers/index.html           all-careers hub
 *   - careers/field-<slug>.html    one hub per category (19)
 *   - sitemap.xml                  regenerated with every URL + real lastmod
 *
 * All content is server-rendered HTML (no client JS needed to read it), so
 * Google/Bing index the full 507-profession dataset that is otherwise locked
 * inside client-side rendering.
 *
 * Run: node scripts/build_profession_pages.mjs   (also runs in deploy.yml)
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE = 'https://akshaynikhare.github.io/career-compass';
const GA_ID = 'G-W50KH3VDVE';
const OG_IMAGE = `${BASE}/icons/og-image.png`;
const TODAY = new Date().toISOString().slice(0, 10);

const STREAM_LABELS = {
  pcm: 'Science (PCM)', pcb: 'Science (PCB)', commerce: 'Commerce',
  arts: 'Arts / Humanities', any: 'Any stream',
};
const INTENSITY = ['', 'Low', 'Moderate', 'High'];

// ── Hindi i18n ────────────────────────────────────────────────────────────────
// These generated SEO pages keep English as the visible/canonical content and
// carry inline Hindi via data-i18n-hi* attributes, applied by src/i18n.js when
// ?lang=hi or the toggle selects Hindi (matches the sitemap hreflang alternates).
const STREAM_LABELS_HI = {
  pcm: 'विज्ञान (PCM)', pcb: 'विज्ञान (PCB)', commerce: 'कॉमर्स',
  arts: 'आर्ट्स / मानविकी', any: 'कोई भी स्ट्रीम',
};
const INTENSITY_HI = ['', 'कम', 'मध्यम', 'अधिक'];
const CAT_HI = {
  'Healthcare': 'स्वास्थ्य सेवा', 'Technology': 'प्रौद्योगिकी', 'Engineering': 'इंजीनियरिंग',
  'Education': 'शिक्षा', 'Finance & Business': 'वित्त और व्यवसाय',
  'Finance — Specialized Niche': 'वित्त — विशेषज्ञ क्षेत्र', 'Arts & Media': 'कला और मीडिया',
  'Law & Government': 'कानून और सरकार', 'Science & Research': 'विज्ञान और अनुसंधान',
  'Social & Welfare': 'सामाजिक और कल्याण', 'Mental Health & Wellness': 'मानसिक स्वास्थ्य और कल्याण',
  'Architecture & Design': 'वास्तुकला और डिज़ाइन', 'Agriculture & Environment': 'कृषि और पर्यावरण',
  'Sports & Fitness': 'खेल और फिटनेस', 'Hospitality & Food': 'आतिथ्य और खाद्य',
  'Transport & Logistics': 'परिवहन और लॉजिस्टिक्स', 'Trades & Construction': 'ट्रेड्स और निर्माण',
  'Public Health & Policy': 'सार्वजनिक स्वास्थ्य और नीति', 'Niche & Emerging Professions': 'विशिष्ट और उभरते पेशे',
};
const tcat = (c) => CAT_HI[c] || c;
const nmeHi = (p) => p.name_hi || p.name;

function streamsTextHi(p) {
  const arr = (p.streams || []).map((s) => STREAM_LABELS_HI[s] || s);
  return arr.length ? arr.join(', ') : 'कोई भी स्ट्रीम';
}

// data-i18n attribute builders. esc() double-encodes so that i18n.js's
// getAttribute()->textContent/innerHTML decodes back to the intended text/markup.
const da = (s) => ` data-i18n-hi="${esc(s)}"`;        // plain textContent
const dh = (s) => ` data-i18n-hi-html="${esc(s)}"`;   // innerHTML (markup/entities)

const scripts = `
    <script src="../src/strings.js"></script>
    <script src="../src/i18n.js"></script>`;

// ── helpers ──────────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const slug = (id) => String(id).toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]/g, '');
const catSlug = (cat) => String(cat).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };

// "a" vs "an" — pick by the leading *sound*, not just the letter.
// Vowel letters take "an" (an Accountant, an IAS Officer, an IoT Engineer),
// except "yoo"-sounding U words (a Urologist, a UX Designer) which take "a".
// "uh"-sounding U words (an Urban Planner) stay "an".
const article = (name) => {
  const w = String(name).trim().toLowerCase();
  if (w.startsWith('u')) return /^(urb|umb|und|ung|unp|uns|unt|ugl|utt|ush|udd|ulc|ult|unc|unl|unw|urg|ush)/.test(w) ? 'an' : 'a';
  return /^[aeio]/.test(w) ? 'an' : 'a';
};

function salaryText(p) {
  const s = p.salary_lpa || {};
  const lo = s.entry, hi = s.senior ?? s.mid ?? s.entry;
  if (lo == null && hi == null) return null;
  return lo === hi ? `₹${lo} LPA` : `₹${lo}–${hi} LPA`;
}

function streamsText(p) {
  const arr = (p.streams || []).map((s) => STREAM_LABELS[s] || s);
  return arr.length ? arr.join(', ') : 'Any stream';
}

// Analytics is loaded lazily, DNT-aware, and gated on the consent banner
// (src/consent.js). Career pages live one level down → ../src paths.
function gtag() {
  return `  <script src="../src/analytics.js" defer></script>
  <script src="../src/consent.js" defer></script>`;
}

function head({ title, desc, canonical, jsonld }) {
  const ld = (jsonld || []).map((o) => `  <script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');
  return `<!DOCTYPE html>
<html lang="en-IN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
${gtag()}
  <meta name="theme-color" content="#4F46E5" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#111827" media="(prefers-color-scheme: dark)">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="../icons/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="../icons/favicon-32.png">
  <link rel="icon" type="image/svg+xml" href="../icons/icon-192.svg">
  <link rel="apple-touch-icon" href="../icons/apple-touch-icon.png">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Career Compass">
  <meta property="og:locale" content="en_IN">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${OG_IMAGE}">
  <link rel="stylesheet" href="../styles/main.css">
${ld}
</head>`;
}

const footer = `
    <footer style="margin-top:2rem; padding-top:1rem; border-top:1px solid var(--border); font-size:0.8125rem; color:var(--muted); text-align:center;">
      <p${dh('<a href="../index.html" style="color:var(--primary);">Career Compass</a> — भारतीय Class 9–10 छात्रों के लिए मुफ्त RIASEC करियर टेस्ट।')}><a href="../index.html" style="color:var(--primary);">Career Compass</a> — free RIASEC career test for Indian Class 9–10 students.</p>
    </footer>`;

// ── per-profession page ───────────────────────────────────────────────────────
function professionPage(p, byCategory) {
  const canonical = `${BASE}/careers/${slug(p.id)}.html`;
  const salary = salaryText(p);
  const streams = streamsText(p);
  const years = p.years_min ? `${p.years_min}+ years` : null;
  const intensity = INTENSITY[p.exam_intensity] || null;
  const art = article(p.name);
  const desc = clip(`How to become ${art} ${p.name} in India: ${p.summary}. Path, entrance exams, salary and stream after Class 10.`, 158);

  // Hindi equivalents (visible content stays English; Hindi rides on data-i18n-hi)
  const nameHi = nmeHi(p);
  const streamsHi = streamsTextHi(p);
  const yearsHi = p.years_min ? `${p.years_min}+ वर्ष` : null;
  const intensityHi = INTENSITY_HI[p.exam_intensity] || null;
  const summaryHi = p.summary_hi || p.summary;
  const pathHi = p.path_india_hi || p.path_india;
  const dilHi = p.day_in_life_hi || p.day_in_life;

  // FAQ built from the data — each entry [q, a, qHi, aHi]
  const faqs = [];
  if (p.path_india) faqs.push([
    `How do I become ${art} ${p.name} in India?`, `The typical path is: ${p.path_india}.${years ? ' It takes about ' + years + '.' : ''}`,
    `भारत में ${nameHi} कैसे बनें?`, `सामान्य रास्ता है: ${pathHi}।${yearsHi ? ' इसमें लगभग ' + yearsHi + ' लगते हैं।' : ''}`]);
  if (p.entrance_exam) faqs.push([
    `Which entrance exam is needed for ${p.name}?`, `The main entrance exam is ${p.entrance_exam}.`,
    `${nameHi} के लिए कौन-सी प्रवेश परीक्षा चाहिए?`, `मुख्य प्रवेश परीक्षा ${p.entrance_exam} है।`]);
  if (salary) faqs.push([
    `What is the salary of ${art} ${p.name} in India?`, `Salaries typically range around ${salary} (entry to senior level).`,
    `भारत में ${nameHi} का वेतन कितना है?`, `वेतन आमतौर पर लगभग ${salary} (शुरुआती से वरिष्ठ स्तर तक) होता है।`]);
  faqs.push([
    `Which stream should I choose for ${p.name}?`, `Recommended stream(s) after Class 10: ${streams}.`,
    `${nameHi} के लिए मुझे कौन-सी स्ट्रीम चुननी चाहिए?`, `Class 10 के बाद अनुशंसित स्ट्रीम: ${streamsHi}।`]);

  const jsonld = [
    {
      '@context': 'https://schema.org', '@type': 'Occupation',
      name: p.name, description: p.summary,
      occupationalCategory: p.category, inLanguage: 'en-IN',
      ...(salary ? { estimatedSalary: { '@type': 'MonetaryAmountDistribution', currency: 'INR', name: 'Annual (LPA)' } } : {}),
      ...(p.path_india ? { educationRequirements: p.path_india } : {}),
      occupationLocation: { '@type': 'Country', name: 'India' },
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
        { '@type': 'ListItem', position: 2, name: 'Careers', item: `${BASE}/careers/index.html` },
        { '@type': 'ListItem', position: 3, name: p.category, item: `${BASE}/careers/field-${catSlug(p.category)}.html` },
        { '@type': 'ListItem', position: 4, name: p.name, item: canonical },
      ],
    },
  ];

  const related = (byCategory[p.category] || []).filter((x) => x.id !== p.id).slice(0, 6);
  const relatedHtml = related.length ? `
      <div class="card mb-2" style="margin-bottom:1rem;">
        <h2 class="section-title"${da(`${tcat(p.category)} में संबंधित करियर`)}>Related careers in ${esc(p.category)}</h2>
        <ul style="line-height:1.9; padding-left:1.1rem;">
          ${related.map((r) => `<li><a href="${slug(r.id)}.html" style="color:var(--primary);"${da(nmeHi(r))}>${esc(r.name)}</a></li>`).join('\n          ')}
        </ul>
      </div>` : '';

  const facts = [
    ['Field', esc(p.category), 'क्षेत्र', esc(tcat(p.category))],
    years ? ['Time to qualify', years, 'योग्यता का समय', yearsHi] : null,
    p.entrance_exam ? ['Entrance exam', esc(p.entrance_exam), 'प्रवेश परीक्षा', esc(p.entrance_exam)] : null,
    intensity ? ['Exam intensity', intensity, 'परीक्षा तीव्रता', intensityHi] : null,
    salary ? ['Salary range', salary, 'वेतन सीमा', salary] : null,
    ['Stream after Class 10', esc(streams), 'Class 10 के बाद स्ट्रीम', esc(streamsHi)],
  ].filter(Boolean);

  return `${head({ title: `How to Become ${art.replace(/^a/, 'A')} ${p.name} in India — Path, Exams & Salary | Career Compass`, desc, canonical, jsonld })}
<body>
  <div class="container" style="max-width:760px;">
    <nav aria-label="Breadcrumb" style="font-size:0.8125rem; color:var(--muted); margin:1rem 0;">
      <a href="../index.html" style="color:var(--primary);"${da('होम')}>Home</a> &rsaquo;
      <a href="index.html" style="color:var(--primary);"${da('करियर')}>Careers</a> &rsaquo;
      <a href="field-${catSlug(p.category)}.html" style="color:var(--primary);"${da(tcat(p.category))}>${esc(p.category)}</a> &rsaquo;
      <span${da(nameHi)}>${esc(p.name)}</span>
    </nav>

    <article>
      <div class="card mb-2" style="margin-bottom:1rem;">
        <h1${da(`भारत में ${nameHi} कैसे बनें`)}>How to Become ${art.replace(/^a/, 'A')} ${esc(p.name)} in India</h1>
        <p style="font-size:1rem; color:var(--text); margin-top:0.5rem;"${da(summaryHi + '।')}>${esc(p.summary)}.</p>
      </div>

      <div class="card mb-2" style="margin-bottom:1rem;">
        <h2 class="section-title"${da('एक नज़र में')}>At a glance</h2>
        <table style="width:100%; border-collapse:collapse; font-size:0.9375rem;">
          ${facts.map(([k, v, kHi, vHi]) => `<tr><td style="padding:0.4rem 0.5rem; color:var(--muted); white-space:nowrap;"${da(kHi)}>${k}</td><td style="padding:0.4rem 0.5rem; font-weight:600;"${da(vHi)}>${v}</td></tr>`).join('\n          ')}
        </table>
      </div>

      ${p.path_india ? `<div class="card mb-2" style="margin-bottom:1rem;">
        <h2 class="section-title"${da('रास्ता (Class 10 से)')}>The path (from Class 10)</h2>
        <p style="font-size:0.9375rem; line-height:1.7;"${da(pathHi)}>${esc(p.path_india)}</p>
      </div>` : ''}

      ${p.day_in_life ? `<div class="card mb-2" style="margin-bottom:1rem;">
        <h2 class="section-title"${da('एक दिन की झलक')}>A day in the life</h2>
        <p style="font-size:0.9375rem; line-height:1.7;"${da(dilHi)}>${esc(p.day_in_life)}</p>
      </div>` : ''}

      <div class="card mb-2" style="margin-bottom:1rem;">
        <h2 class="section-title"${da('अक्सर पूछे जाने वाले प्रश्न')}>Frequently asked questions</h2>
        ${faqs.map(([q, a, qHi, aHi]) => `<details style="margin-bottom:0.6rem;"><summary style="font-weight:600; cursor:pointer;"${da(qHi)}>${esc(q)}</summary><p style="font-size:0.9rem; line-height:1.7; margin-top:0.4rem; color:var(--text);"${da(aHi)}>${esc(a)}</p></details>`).join('\n        ')}
      </div>

      <div class="card mb-2" style="margin-bottom:1rem; text-align:center;">
        <h2 class="section-title"${da('क्या यह करियर आपके लिए सही है?')}>Is this career right for you?</h2>
        <p class="text-muted" style="font-size:0.9rem; margin-bottom:0.75rem;"${da(`मुफ्त 45-प्रश्नों वाला RIASEC टेस्ट लें और देखें कि ${nameHi} आपके व्यक्तित्व से कितना मेल खाता है।`)}>Take the free 45-question RIASEC test and see how ${esc(p.name)} matches your personality.</p>
        <a href="../test.html" class="btn-primary" style="text-decoration:none;"${dh('मुफ्त टेस्ट लें →')}>Take the free test &rarr;</a>
      </div>
      ${relatedHtml}
    </article>
    ${footer}
  </div>${scripts}
</body>
</html>`;
}

// ── category hub ──────────────────────────────────────────────────────────────
function categoryPage(category, items) {
  const canonical = `${BASE}/careers/field-${catSlug(category)}.html`;
  const desc = clip(`Explore ${items.length} careers in ${category} for Indian students — paths, entrance exams and salaries after Class 10.`, 158);
  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: `${category} careers in India`, description: desc, url: canonical,
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Careers', item: `${BASE}/careers/index.html` },
      { '@type': 'ListItem', position: 2, name: category, item: canonical },
    ],
  }];
  return `${head({ title: `${category} Careers in India (${items.length}) — Paths, Exams & Salary | Career Compass`, desc, canonical, jsonld })}
<body>
  <div class="container" style="max-width:760px;">
    <nav style="font-size:0.8125rem; color:var(--muted); margin:1rem 0;">
      <a href="index.html" style="color:var(--primary);"${da('करियर')}>Careers</a> &rsaquo; <span${da(tcat(category))}>${esc(category)}</span>
    </nav>
    <div class="card mb-2" style="margin-bottom:1rem;">
      <h1${da(`भारत में ${tcat(category)} करियर`)}>${esc(category)} Careers in India</h1>
      <p class="text-muted" style="margin-top:0.4rem;"${da(`${items.length} करियर, भारत-विशिष्ट रास्तों, प्रवेश परीक्षाओं और वेतन सीमाओं के साथ।`)}>${items.length} careers with India-specific paths, entrance exams and salary ranges.</p>
    </div>
    <div class="card mb-2" style="margin-bottom:1rem;">
      <ul style="line-height:2; padding-left:1.1rem;">
        ${items.map((p) => `<li><a href="${slug(p.id)}.html" style="color:var(--primary); font-weight:600;"${da(nmeHi(p))}>${esc(p.name)}</a> — <span style="color:var(--muted); font-size:0.875rem;"${da(clip(p.summary_hi || p.summary, 90))}>${esc(clip(p.summary, 90))}</span></li>`).join('\n        ')}
      </ul>
    </div>
    <div class="card mb-2" style="margin-bottom:1rem; text-align:center;">
      <a href="../test.html" class="btn-primary" style="text-decoration:none;"${dh('अपना सबसे उपयुक्त करियर खोजें →')}>Find your best-fit career &rarr;</a>
    </div>
    ${footer}
  </div>${scripts}
</body>
</html>`;
}

// ── all-careers index ─────────────────────────────────────────────────────────
function indexPage(categories, total) {
  const canonical = `${BASE}/careers/index.html`;
  const desc = clip(`Browse ${total} Indian careers by field — medicine, engineering, technology, law, design and more. Paths, exams and salaries after Class 10.`, 158);
  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'All careers in India', description: desc, url: canonical,
  }];
  return `${head({ title: `${total} Careers in India by Field — Paths, Exams & Salary | Career Compass`, desc, canonical, jsonld })}
<body>
  <div class="container" style="max-width:760px;">
    <nav style="font-size:0.8125rem; color:var(--muted); margin:1rem 0;">
      <a href="../index.html" style="color:var(--primary);"${da('होम')}>Home</a> &rsaquo; <span${da('करियर')}>Careers</span>
    </nav>
    <div class="card mb-2" style="margin-bottom:1rem;">
      <h1${da(`भारत में ${total} करियर एक्सप्लोर करें`)}>Explore ${total} Careers in India</h1>
      <p class="text-muted" style="margin-top:0.4rem;"${da('क्षेत्र के अनुसार ब्राउज़ करें। हर करियर में शिक्षा का रास्ता, प्रवेश परीक्षाएं, वेतन सीमा और अनुशंसित Class 11 स्ट्रीम दिखाई जाती है।')}>Browse by field. Each career shows the education path, entrance exams, salary range and recommended Class 11 stream.</p>
    </div>
    <div class="card mb-2" style="margin-bottom:1rem;">
      <h2 class="section-title"${da('Class 10 के बाद स्ट्रीम चुन रहे हैं?')}>Choosing a stream after Class 10?</h2>
      <p class="text-muted" style="font-size:0.875rem; margin-bottom:0.625rem;"${da('हर Class 11 स्ट्रीम के लिए सर्वश्रेष्ठ करियर देखें:')}>See the best careers for each Class 11 stream:</p>
      <ul style="line-height:1.9; padding-left:1.1rem;">
        <li><a href="stream-pcm.html" style="color:var(--primary);"${da(`${STREAM_LABELS_HI.pcm} छात्रों के लिए सर्वश्रेष्ठ करियर`)}>Best careers for Science (PCM) students</a></li>
        <li><a href="stream-pcb.html" style="color:var(--primary);"${da(`${STREAM_LABELS_HI.pcb} छात्रों के लिए सर्वश्रेष्ठ करियर`)}>Best careers for Science (PCB) students</a></li>
        <li><a href="stream-commerce.html" style="color:var(--primary);"${da(`${STREAM_LABELS_HI.commerce} छात्रों के लिए सर्वश्रेष्ठ करियर`)}>Best careers for Commerce students</a></li>
        <li><a href="stream-arts.html" style="color:var(--primary);"${da(`${STREAM_LABELS_HI.arts} छात्रों के लिए सर्वश्रेष्ठ करियर`)}>Best careers for Arts / Humanities students</a></li>
        <li><a href="streams.html" style="color:var(--primary); font-weight:600;"${dh('मुझे कौन-सी स्ट्रीम चुननी चाहिए? (PCM बनाम PCB बनाम Commerce बनाम Arts) →')}>Which stream should I choose? (PCM vs PCB vs Commerce vs Arts) &rarr;</a></li>
      </ul>
    </div>
    <div class="card mb-2" style="margin-bottom:1rem;">
      ${categories.map(([cat, items]) => `<h2 class="section-title" style="margin-top:0.5rem;"><a href="field-${catSlug(cat)}.html" style="color:var(--primary);"${da(tcat(cat))}>${esc(cat)}</a> <span style="font-weight:400; color:var(--muted); font-size:0.85rem;">(${items.length})</span></h2>
      <ul style="line-height:1.9; padding-left:1.1rem; margin-bottom:1rem;">
        ${items.slice(0, 8).map((p) => `<li><a href="${slug(p.id)}.html" style="color:var(--text);"${da(nmeHi(p))}>${esc(p.name)}</a></li>`).join('\n        ')}
        ${items.length > 8 ? `<li><a href="field-${catSlug(cat)}.html" style="color:var(--primary);"${dh(`सभी ${items.length} देखें →`)}>See all ${items.length} &rarr;</a></li>` : ''}
      </ul>`).join('\n      ')}
    </div>
    <div class="card mb-2" style="margin-bottom:1rem; text-align:center;">
      <a href="../test.html" class="btn-primary" style="text-decoration:none;"${dh('मुफ्त करियर टेस्ट लें →')}>Take the free career test &rarr;</a>
    </div>
    ${footer}
  </div>${scripts}
</body>
</html>`;
}

// ── stream guides (high-intent SEO landing pages) ─────────────────────────────
// Target real student queries: "best careers for commerce students after 10th",
// "PCM vs PCB", "which stream after Class 10". Content is generated from data so
// the career lists stay in sync with professions.json.
const STREAM_GUIDES = {
  pcm: {
    label: 'Science (PCM)', short: 'PCM', subjects: 'Physics, Chemistry, Mathematics',
    good_if: 'you enjoy solving numerical problems, logical reasoning, and understanding how machines, code and structures work',
    leads_to: 'engineering, technology, architecture, data science, defence and the pure sciences',
    exams: 'JEE Main & Advanced, BITSAT, NDA, NATA (architecture) and CUET',
  },
  pcb: {
    label: 'Science (PCB)', short: 'PCB', subjects: 'Physics, Chemistry, Biology',
    good_if: 'you are curious about the human body, living systems and healthcare, and enjoy biology',
    leads_to: 'medicine, dentistry, pharmacy, biotechnology, nursing and allied health sciences',
    exams: 'NEET, CUET, and institute-specific tests for allied health courses',
  },
  commerce: {
    label: 'Commerce', short: 'Commerce', subjects: 'Accountancy, Business Studies, Economics',
    good_if: 'you like numbers, money, business, and understanding how companies and markets work',
    leads_to: 'chartered accountancy, finance, business management, law, banking and entrepreneurship',
    exams: 'CA/CMA/CS Foundation, CUET, CLAT (law) and IPMAT (management)',
  },
  arts: {
    label: 'Arts / Humanities', short: 'Arts', subjects: 'History, Political Science, Psychology, Sociology, Languages',
    good_if: 'you enjoy reading, writing, people, society, creativity and ideas',
    leads_to: 'law, civil services, design, media, psychology, teaching and the social sciences',
    exams: 'CUET, CLAT (law), NID/NIFT (design), and later UPSC for civil services',
  },
};

// Hindi versions of the stream-guide prose (for data-i18n-hi on the guide pages).
const STREAM_GUIDES_HI = {
  pcm: {
    label: 'विज्ञान (PCM)', short: 'PCM', subjects: 'भौतिकी, रसायन, गणित',
    good_if: 'आपको संख्यात्मक समस्याएं हल करना, तार्किक सोच, और मशीनें, कोड व संरचनाएं कैसे काम करती हैं यह समझना पसंद है',
    leads_to: 'इंजीनियरिंग, प्रौद्योगिकी, वास्तुकला, डेटा साइंस, रक्षा और शुद्ध विज्ञान',
    exams: 'JEE Main और Advanced, BITSAT, NDA, NATA (वास्तुकला) और CUET',
  },
  pcb: {
    label: 'विज्ञान (PCB)', short: 'PCB', subjects: 'भौतिकी, रसायन, जीव विज्ञान',
    good_if: 'आप मानव शरीर, जीवित प्रणालियों और स्वास्थ्य सेवा के बारे में जिज्ञासु हैं, और जीव विज्ञान पसंद करते हैं',
    leads_to: 'चिकित्सा, दंत चिकित्सा, फार्मेसी, बायोटेक्नोलॉजी, नर्सिंग और संबद्ध स्वास्थ्य विज्ञान',
    exams: 'NEET, CUET, और संबद्ध स्वास्थ्य कोर्सों के लिए संस्थान-विशिष्ट परीक्षाएं',
  },
  commerce: {
    label: 'कॉमर्स', short: 'कॉमर्स', subjects: 'अकाउंटेंसी, बिज़नेस स्टडीज़, अर्थशास्त्र',
    good_if: 'आपको संख्याएं, पैसा, व्यवसाय, और कंपनियां व बाज़ार कैसे काम करते हैं यह समझना पसंद है',
    leads_to: 'चार्टर्ड अकाउंटेंसी, वित्त, बिज़नेस मैनेजमेंट, कानून, बैंकिंग और उद्यमिता',
    exams: 'CA/CMA/CS Foundation, CUET, CLAT (कानून) और IPMAT (मैनेजमेंट)',
  },
  arts: {
    label: 'आर्ट्स / मानविकी', short: 'आर्ट्स', subjects: 'इतिहास, राजनीति विज्ञान, मनोविज्ञान, समाजशास्त्र, भाषाएं',
    good_if: 'आपको पढ़ना, लिखना, लोग, समाज, रचनात्मकता और विचार पसंद हैं',
    leads_to: 'कानून, सिविल सेवा, डिज़ाइन, मीडिया, मनोविज्ञान, शिक्षण और सामाजिक विज्ञान',
    exams: 'CUET, CLAT (कानून), NID/NIFT (डिज़ाइन), और बाद में सिविल सेवा के लिए UPSC',
  },
};

function streamCareersByCategory(items, key) {
  const filtered = items.filter((p) => (p.streams || []).includes(key));
  const byCat = {};
  for (const p of filtered) (byCat[p.category] ||= []).push(p);
  return { total: filtered.length, cats: Object.entries(byCat).sort((a, b) => b[1].length - a[1].length) };
}

function streamGuidePage(key, items) {
  const g = STREAM_GUIDES[key];
  const canonical = `${BASE}/careers/stream-${key}.html`;
  const { total, cats } = streamCareersByCategory(items, key);
  const sample = cats.flatMap(([, arr]) => arr).slice(0, 3).map((p) => p.name);
  const desc = clip(`Best careers for ${g.label} students after Class 10 in India — ${total} options across ${cats.length} fields, with paths, entrance exams (${g.exams}) and salaries.`, 158);

  const gHi = STREAM_GUIDES_HI[key];
  const sampleHi = cats.flatMap(([, arr]) => arr).slice(0, 3).map((p) => nmeHi(p));

  const faqs = [
    [`What can I do after ${g.short} in Class 11–12?`, `${g.label} (${g.subjects}) leads to ${g.leads_to}. This guide lists ${total} careers open to ${g.short} students, including ${sample.join(', ')} and more.`,
      `Class 11–12 में ${gHi.short} के बाद मैं क्या कर सकता/सकती हूं?`, `${gHi.label} (${gHi.subjects}) से ${gHi.leads_to} जैसे क्षेत्रों में जाया जा सकता है। इस गाइड में ${gHi.short} छात्रों के लिए खुले ${total} करियर सूचीबद्ध हैं, जिनमें ${sampleHi.join(', ')} और अन्य शामिल हैं।`],
    [`Is ${g.short} a good stream after Class 10?`, `${g.label} is a strong choice if ${g.good_if}. It opens ${total}+ career paths listed on this page.`,
      `क्या Class 10 के बाद ${gHi.short} एक अच्छी स्ट्रीम है?`, `${gHi.label} एक बेहतरीन विकल्प है यदि ${gHi.good_if}। यह इस पेज पर सूचीबद्ध ${total}+ करियर रास्ते खोलता है।`],
    [`Which entrance exams follow the ${g.short} stream?`, `The main entrance exams are ${g.exams}. The exact exam depends on the career you choose.`,
      `${gHi.short} स्ट्रीम के बाद कौन-सी प्रवेश परीक्षाएं होती हैं?`, `मुख्य प्रवेश परीक्षाएं ${gHi.exams} हैं। सटीक परीक्षा आपके चुने गए करियर पर निर्भर करती है।`],
    [`How do I know if ${g.short} is right for me?`, `Take the free Career Compass RIASEC test — it matches your personality and interests to careers and shows which stream your best-fit careers need.`,
      `मुझे कैसे पता चलेगा कि ${gHi.short} मेरे लिए सही है?`, `मुफ्त Career Compass RIASEC टेस्ट लें — यह आपके व्यक्तित्व और रुचियों को करियर से मिलाता है और दिखाता है कि आपके सबसे उपयुक्त करियर के लिए कौन-सी स्ट्रीम चाहिए।`],
  ];

  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `Best careers for ${g.label} students in India`, description: desc, url: canonical, inLanguage: 'en-IN' },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
      { '@type': 'ListItem', position: 2, name: 'Careers', item: `${BASE}/careers/index.html` },
      { '@type': 'ListItem', position: 3, name: 'Streams', item: `${BASE}/careers/streams.html` },
      { '@type': 'ListItem', position: 4, name: `${g.label} careers`, item: canonical },
    ] },
  ];

  const listHtml = cats.map(([cat, arr]) => `<h3 style="margin-top:0.75rem;"><a href="field-${catSlug(cat)}.html" style="color:var(--primary);"${da(tcat(cat))}>${esc(cat)}</a> <span style="font-weight:400; color:var(--muted); font-size:0.85rem;">(${arr.length})</span></h3>
      <ul style="line-height:1.9; padding-left:1.1rem; margin-bottom:0.75rem;">
        ${arr.map((p) => { const s = salaryText(p); return `<li><a href="${slug(p.id)}.html" style="color:var(--text);"${da(nmeHi(p))}>${esc(p.name)}</a>${s ? ` <span style="color:var(--muted); font-size:0.8125rem;">— ${s}</span>` : ''}</li>`; }).join('\n        ')}
      </ul>`).join('\n      ');

  const others = Object.keys(STREAM_GUIDES).filter((k) => k !== key);

  return `${head({ title: `Best Careers for ${g.label} Students After Class 10 in India | Career Compass`, desc, canonical, jsonld })}
<body>
  <div class="container" style="max-width:760px;">
    <nav aria-label="Breadcrumb" style="font-size:0.8125rem; color:var(--muted); margin:1rem 0;">
      <a href="../index.html" style="color:var(--primary);"${da('होम')}>Home</a> &rsaquo;
      <a href="index.html" style="color:var(--primary);"${da('करियर')}>Careers</a> &rsaquo;
      <a href="streams.html" style="color:var(--primary);"${da('स्ट्रीम')}>Streams</a> &rsaquo;
      <span${da(gHi.label)}>${esc(g.label)}</span>
    </nav>

    <article>
      <div class="card mb-2" style="margin-bottom:1rem;">
        <h1${da(`Class 10 के बाद ${gHi.label} छात्रों के लिए सर्वश्रेष्ठ करियर`)}>Best Careers for ${esc(g.label)} Students After Class 10</h1>
        <p style="font-size:1rem; color:var(--text); margin-top:0.5rem;"${da(`${gHi.label} स्ट्रीम (${gHi.subjects}) ${gHi.leads_to} की ओर ले जाती है। यहां भारत में ${gHi.short} छात्रों के लिए खुले ${total} करियर विकल्प दिए गए हैं, क्षेत्र के अनुसार समूहित।`)}>The ${esc(g.label)} stream (${esc(g.subjects)}) leads to ${esc(g.leads_to)}. Here are ${total} career options open to ${esc(g.short)} students in India, grouped by field.</p>
      </div>

      <div class="card mb-2" style="margin-bottom:1rem;">
        <h2 class="section-title"${da(`क्या ${gHi.short} आपके लिए सही है?`)}>Is ${esc(g.short)} right for you?</h2>
        <p style="font-size:0.9375rem; line-height:1.7;"${dh(`${gHi.label} चुनें यदि ${gHi.good_if}। सामान्य प्रवेश परीक्षाएं: <strong>${g.exams}</strong>।`)}>Choose ${esc(g.label)} if ${esc(g.good_if)}. Typical entrance exams: <strong>${esc(g.exams)}</strong>.</p>
      </div>

      <div class="card mb-2" style="margin-bottom:1rem;">
        <h2 class="section-title"${da(`${gHi.short} छात्रों के लिए ${total} करियर`)}>${total} careers for ${esc(g.short)} students</h2>
        ${listHtml}
      </div>

      <div class="card mb-2" style="margin-bottom:1rem;">
        <h2 class="section-title"${da('अक्सर पूछे जाने वाले प्रश्न')}>Frequently asked questions</h2>
        ${faqs.map(([q, a, qHi, aHi]) => `<details style="margin-bottom:0.6rem;"><summary style="font-weight:600; cursor:pointer;"${da(qHi)}>${esc(q)}</summary><p style="font-size:0.9rem; line-height:1.7; margin-top:0.4rem; color:var(--text);"${da(aHi)}>${esc(a)}</p></details>`).join('\n        ')}
      </div>

      <div class="card mb-2" style="margin-bottom:1rem; text-align:center;">
        <h2 class="section-title"${da('निश्चित नहीं कि कौन-सी स्ट्रीम आपके लिए सही है?')}>Not sure which stream fits you?</h2>
        <p class="text-muted" style="font-size:0.9rem; margin-bottom:0.75rem;"${dh('मुफ्त 45-प्रश्नों वाला RIASEC टेस्ट लें — यह करियर <em>और</em> उनके लिए ज़रूरी स्ट्रीम दोनों सुझाता है।')}>Take the free 45-question RIASEC test — it recommends careers <em>and</em> the stream they need.</p>
        <a href="../test.html" class="btn-primary" style="text-decoration:none;"${dh('मुफ्त टेस्ट लें →')}>Take the free test &rarr;</a>
      </div>

      <div class="card mb-2" style="margin-bottom:1rem;">
        <h2 class="section-title"${da('अन्य स्ट्रीम की तुलना करें')}>Compare other streams</h2>
        <ul style="line-height:1.9; padding-left:1.1rem;">
          ${others.map((k) => `<li><a href="stream-${k}.html" style="color:var(--primary);"${da(`${STREAM_GUIDES_HI[k].label} छात्रों के लिए सर्वश्रेष्ठ करियर`)}>Best careers for ${esc(STREAM_GUIDES[k].label)} students</a></li>`).join('\n          ')}
          <li><a href="streams.html" style="color:var(--primary);"${da('Class 10 के बाद कौन-सी स्ट्रीम? (PCM बनाम PCB बनाम Commerce बनाम Arts)')}>Which stream after Class 10? (PCM vs PCB vs Commerce vs Arts)</a></li>
        </ul>
      </div>
    </article>
    ${footer}
  </div>${scripts}
</body>
</html>`;
}

function streamsHubPage(items) {
  const canonical = `${BASE}/careers/streams.html`;
  const desc = clip('Which stream should you choose after Class 10 in India? Compare PCM, PCB, Commerce and Arts — what each leads to, entrance exams, and the best careers for each.', 158);
  const rows = Object.entries(STREAM_GUIDES).map(([key, g]) => {
    const { total } = streamCareersByCategory(items, key);
    return { key, g, total };
  });
  const faqs = [
    ['Which stream is best after Class 10?', 'There is no single best stream — the right one depends on your interests and the careers you want. PCM suits engineering and technology, PCB suits medicine and life sciences, Commerce suits finance and business, and Arts suits law, design, civil services and the social sciences. Take a career aptitude test to see which fits you.',
      'Class 10 के बाद कौन-सी स्ट्रीम सबसे अच्छी है?', 'कोई एक सबसे अच्छी स्ट्रीम नहीं होती — सही स्ट्रीम आपकी रुचियों और आप जिन करियर को चाहते हैं उन पर निर्भर करती है। PCM इंजीनियरिंग और प्रौद्योगिकी के लिए उपयुक्त है, PCB चिकित्सा और जीव विज्ञान के लिए, Commerce वित्त और व्यवसाय के लिए, और Arts कानून, डिज़ाइन, सिविल सेवा और सामाजिक विज्ञान के लिए उपयुक्त है। कौन-सी स्ट्रीम आपके लिए सही है यह जानने के लिए करियर एप्टीट्यूड टेस्ट लें।'],
    ['What is the difference between PCM and PCB?', 'PCM (Physics, Chemistry, Maths) leads to engineering, technology and architecture. PCB (Physics, Chemistry, Biology) leads to medicine, dentistry and life sciences. Students who want to keep both open can take PCMB (all four subjects).',
      'PCM और PCB में क्या अंतर है?', 'PCM (भौतिकी, रसायन, गणित) इंजीनियरिंग, प्रौद्योगिकी और वास्तुकला की ओर ले जाता है। PCB (भौतिकी, रसायन, जीव विज्ञान) चिकित्सा, दंत चिकित्सा और जीव विज्ञान की ओर ले जाता है। जो छात्र दोनों विकल्प खुले रखना चाहते हैं वे PCMB (चारों विषय) ले सकते हैं।'],
    ['Can I change my stream later?', 'Switching streams after Class 11 is difficult but not impossible, and many careers can be reached through more than one route. Choosing a stream that matches your interests from the start makes the journey smoother.',
      'क्या मैं बाद में अपनी स्ट्रीम बदल सकता/सकती हूं?', 'Class 11 के बाद स्ट्रीम बदलना कठिन है लेकिन असंभव नहीं, और कई करियर तक एक से ज़्यादा रास्तों से पहुंचा जा सकता है। शुरुआत से ही अपनी रुचियों से मेल खाती स्ट्रीम चुनना सफर को आसान बनाता है।'],
    ['Is Commerce or Arts better for the future?', 'Both lead to strong careers. Commerce is ideal for CA, finance and business; Arts is ideal for law, civil services, design and media. Pick based on what you enjoy, not on myths about which is "easier".',
      'भविष्य के लिए Commerce या Arts में से कौन बेहतर है?', 'दोनों ही मज़बूत करियर की ओर ले जाते हैं। Commerce, CA, वित्त और व्यवसाय के लिए बेहतरीन है; Arts कानून, सिविल सेवा, डिज़ाइन और मीडिया के लिए बेहतरीन है। यह चुनें कि आपको क्या पसंद है, इस मिथक के आधार पर नहीं कि कौन-सी "आसान" है।'],
  ];
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Which stream after Class 10 in India', description: desc, url: canonical, inLanguage: 'en-IN' },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
      { '@type': 'ListItem', position: 2, name: 'Careers', item: `${BASE}/careers/index.html` },
      { '@type': 'ListItem', position: 3, name: 'Streams', item: canonical },
    ] },
  ];
  return `${head({ title: 'Which Stream After Class 10? PCM vs PCB vs Commerce vs Arts (India Guide) | Career Compass', desc, canonical, jsonld })}
<body>
  <div class="container" style="max-width:760px;">
    <nav aria-label="Breadcrumb" style="font-size:0.8125rem; color:var(--muted); margin:1rem 0;">
      <a href="../index.html" style="color:var(--primary);"${da('होम')}>Home</a> &rsaquo;
      <a href="index.html" style="color:var(--primary);"${da('करियर')}>Careers</a> &rsaquo;
      <span${da('स्ट्रीम')}>Streams</span>
    </nav>
    <article>
      <div class="card mb-2" style="margin-bottom:1rem;">
        <h1${da('Class 10 के बाद आपको कौन-सी स्ट्रीम चुननी चाहिए?')}>Which Stream Should You Choose After Class 10?</h1>
        <p style="font-size:1rem; color:var(--text); margin-top:0.5rem;"${da('भारत में Class 10 के बाद आप Class 11–12 के लिए चार स्ट्रीम में से एक चुनते हैं। हर स्ट्रीम अलग-अलग करियर खोलती है। यहां बताया गया है कि PCM, PCB, Commerce और Arts किस ओर ले जाते हैं — और कैसे चुनें।')}>After Class 10 in India you pick one of four streams for Class 11–12. Each opens different careers. Here is what PCM, PCB, Commerce and Arts lead to — and how to choose.</p>
      </div>
      <div class="card mb-2" style="margin-bottom:1rem;">
        <h2 class="section-title"${da('चारों स्ट्रीम एक नज़र में')}>The four streams at a glance</h2>
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          ${rows.map(({ key, g, total }) => { const gHi = STREAM_GUIDES_HI[key]; return `<a href="stream-${key}.html" style="display:block; text-decoration:none; border:1px solid var(--border); border-radius:var(--radius-sm); padding:0.875rem 1rem;">
            <span style="font-weight:700; color:var(--primary); font-size:1rem;"${da(gHi.label)}>${esc(g.label)}</span>
            <span style="color:var(--muted); font-size:0.8125rem;"${da(` · ${gHi.subjects}`)}> · ${esc(g.subjects)}</span>
            <p style="font-size:0.875rem; color:var(--text); margin-top:0.35rem;"${dh(`${gHi.leads_to} की ओर ले जाता है। <strong>${total} करियर</strong> →`)}>Leads to ${esc(g.leads_to)}. <strong>${total} careers</strong> &rarr;</p>
          </a>`; }).join('\n          ')}
        </div>
      </div>
      <div class="card mb-2" style="margin-bottom:1rem;">
        <h2 class="section-title"${da('अक्सर पूछे जाने वाले प्रश्न')}>Frequently asked questions</h2>
        ${faqs.map(([q, a, qHi, aHi]) => `<details style="margin-bottom:0.6rem;"><summary style="font-weight:600; cursor:pointer;"${da(qHi)}>${esc(q)}</summary><p style="font-size:0.9rem; line-height:1.7; margin-top:0.4rem; color:var(--text);"${da(aHi)}>${esc(a)}</p></details>`).join('\n        ')}
      </div>
      <div class="card mb-2" style="margin-bottom:1rem; text-align:center;">
        <h2 class="section-title"${da('टेस्ट को आपके साथ मिलकर तय करने दें')}>Let the test decide with you</h2>
        <p class="text-muted" style="font-size:0.9rem; margin-bottom:0.75rem;"${da('मुफ्त 45-प्रश्नों वाला RIASEC टेस्ट आपके व्यक्तित्व को करियर से मिलाता है और दिखाता है कि हर करियर के लिए कौन-सी स्ट्रीम चाहिए।')}>The free 45-question RIASEC test matches your personality to careers and shows the stream each one needs.</p>
        <a href="../test.html" class="btn-primary" style="text-decoration:none;"${dh('मुफ्त टेस्ट लें →')}>Take the free test &rarr;</a>
      </div>
    </article>
    ${footer}
  </div>${scripts}
</body>
</html>`;
}

// ── sitemap ───────────────────────────────────────────────────────────────────
// Languages that i18n.js can render via ?lang=. English is the canonical URL
// (also x-default); each other language is the same URL with a ?lang= param.
const LANGS = ['en', 'hi'];
const langHref = (loc, lang) =>
  lang === 'en' ? loc : loc + (loc.includes('?') ? '&' : '?') + 'lang=' + lang;

function urlset(urls) {
  const body = urls.map(({ loc, priority, changefreq }) => {
    const alts = [
      ...LANGS.map((lang) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${langHref(loc, lang)}"/>`),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}"/>`,
    ].join('\n');
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n${alts}\n  </url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
}

// Top-level sitemap index pointing at the child sitemaps. Scales cleanly as the
// profession set grows (a single urlset is capped at 50k URLs / 50MB).
function sitemapIndex(childFiles) {
  const body = childFiles.map((f) =>
    `  <sitemap>\n    <loc>${BASE}/${f}</loc>\n    <lastmod>${TODAY}</lastmod>\n  </sitemap>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

// ── main ──────────────────────────────────────────────────────────────────────
function main() {
  const data = JSON.parse(readFileSync(join(ROOT, 'data', 'professions.json'), 'utf8'));
  const items = data.items;

  const byCategory = {};
  for (const p of items) (byCategory[p.category] ||= []).push(p);
  const categories = Object.entries(byCategory).sort((a, b) => b[1].length - a[1].length);

  const outDir = join(ROOT, 'careers');
  // Clean stale generated pages so removed professions don't linger.
  if (existsSync(outDir)) for (const f of readdirSync(outDir)) if (f.endsWith('.html')) rmSync(join(outDir, f));
  mkdirSync(outDir, { recursive: true });

  const urls = [
    { loc: `${BASE}/`, priority: '1.0', changefreq: 'weekly' },
    { loc: `${BASE}/test.html`, priority: '0.9', changefreq: 'monthly' },
    { loc: `${BASE}/careers/index.html`, priority: '0.8', changefreq: 'weekly' },
    { loc: `${BASE}/careers/streams.html`, priority: '0.8', changefreq: 'monthly' },
  ];

  writeFileSync(join(outDir, 'index.html'), indexPage(categories, items.length));

  // Stream guides (high-intent SEO landing pages) + hub
  writeFileSync(join(outDir, 'streams.html'), streamsHubPage(items));
  for (const key of Object.keys(STREAM_GUIDES)) {
    writeFileSync(join(outDir, `stream-${key}.html`), streamGuidePage(key, items));
    urls.push({ loc: `${BASE}/careers/stream-${key}.html`, priority: '0.75', changefreq: 'monthly' });
  }

  for (const [cat, catItems] of categories) {
    writeFileSync(join(outDir, `field-${catSlug(cat)}.html`), categoryPage(cat, catItems));
    urls.push({ loc: `${BASE}/careers/field-${catSlug(cat)}.html`, priority: '0.7', changefreq: 'monthly' });
  }

  // Individual profession pages go in their own child sitemap.
  const careerUrls = [];
  for (const p of items) {
    writeFileSync(join(outDir, `${slug(p.id)}.html`), professionPage(p, byCategory));
    careerUrls.push({ loc: `${BASE}/careers/${slug(p.id)}.html`, priority: '0.6', changefreq: 'monthly' });
  }

  // Sitemap index → child sitemaps (core pages + profession pages).
  writeFileSync(join(ROOT, 'sitemap-core.xml'), urlset(urls));
  writeFileSync(join(ROOT, 'sitemap-careers.xml'), urlset(careerUrls));
  writeFileSync(join(ROOT, 'sitemap.xml'), sitemapIndex(['sitemap-core.xml', 'sitemap-careers.xml']));

  console.log(`Generated ${items.length} profession pages + ${categories.length} category hubs + ${Object.keys(STREAM_GUIDES).length} stream guides + streams hub + index.`);
  console.log(`Sitemap index -> sitemap.xml (core: ${urls.length} URLs, careers: ${careerUrls.length} URLs)`);
}

main();
