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

// ── helpers ──────────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const slug = (id) => String(id).toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]/g, '');
const catSlug = (cat) => String(cat).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };

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

function gtag() {
  return `  <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');</script>`;
}

function head({ title, desc, canonical, jsonld }) {
  const ld = (jsonld || []).map((o) => `  <script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
${gtag()}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#4F46E5">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Career Compass">
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
      <p><a href="../index.html" style="color:var(--primary);">Career Compass</a> — free RIASEC career test for Indian Class 9–10 students.</p>
    </footer>`;

// ── per-profession page ───────────────────────────────────────────────────────
function professionPage(p, byCategory) {
  const canonical = `${BASE}/careers/${slug(p.id)}.html`;
  const salary = salaryText(p);
  const streams = streamsText(p);
  const years = p.years_min ? `${p.years_min}+ years` : null;
  const intensity = INTENSITY[p.exam_intensity] || null;
  const desc = clip(`How to become a ${p.name} in India: ${p.summary}. Path, entrance exams, salary and stream after Class 10.`, 158);

  // FAQ built from the data
  const faqs = [];
  if (p.path_india) faqs.push([`How do I become a ${p.name} in India?`, `The typical path is: ${p.path_india}.${years ? ' It takes about ' + years + '.' : ''}`]);
  if (p.entrance_exam) faqs.push([`Which entrance exam is needed for ${p.name}?`, `The main entrance exam is ${p.entrance_exam}.`]);
  if (salary) faqs.push([`What is the salary of a ${p.name} in India?`, `Salaries typically range around ${salary} (entry to senior level).`]);
  faqs.push([`Which stream should I choose for ${p.name}?`, `Recommended stream(s) after Class 10: ${streams}.`]);

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
        { '@type': 'ListItem', position: 1, name: 'Careers', item: `${BASE}/careers/index.html` },
        { '@type': 'ListItem', position: 2, name: p.category, item: `${BASE}/careers/field-${catSlug(p.category)}.html` },
        { '@type': 'ListItem', position: 3, name: p.name, item: canonical },
      ],
    },
  ];

  const related = (byCategory[p.category] || []).filter((x) => x.id !== p.id).slice(0, 6);
  const relatedHtml = related.length ? `
      <div class="card mb-2" style="margin-bottom:1rem;">
        <h2 class="section-title">Related careers in ${esc(p.category)}</h2>
        <ul style="line-height:1.9; padding-left:1.1rem;">
          ${related.map((r) => `<li><a href="${slug(r.id)}.html" style="color:var(--primary);">${esc(r.name)}</a></li>`).join('\n          ')}
        </ul>
      </div>` : '';

  const facts = [
    ['Field', esc(p.category)],
    years ? ['Time to qualify', years] : null,
    p.entrance_exam ? ['Entrance exam', esc(p.entrance_exam)] : null,
    intensity ? ['Exam intensity', intensity] : null,
    salary ? ['Salary range', salary] : null,
    ['Stream after Class 10', esc(streams)],
  ].filter(Boolean);

  return `${head({ title: `How to Become a ${p.name} in India — Path, Exams & Salary | Career Compass`, desc, canonical, jsonld })}
<body>
  <div class="container" style="max-width:760px;">
    <nav style="font-size:0.8125rem; color:var(--muted); margin:1rem 0;">
      <a href="index.html" style="color:var(--primary);">Careers</a> &rsaquo;
      <a href="field-${catSlug(p.category)}.html" style="color:var(--primary);">${esc(p.category)}</a> &rsaquo;
      <span>${esc(p.name)}</span>
    </nav>

    <article>
      <div class="card mb-2" style="margin-bottom:1rem;">
        <h1>How to Become a ${esc(p.name)} in India</h1>
        <p style="font-size:1rem; color:var(--text); margin-top:0.5rem;">${esc(p.summary)}.</p>
      </div>

      <div class="card mb-2" style="margin-bottom:1rem;">
        <h2 class="section-title">At a glance</h2>
        <table style="width:100%; border-collapse:collapse; font-size:0.9375rem;">
          ${facts.map(([k, v]) => `<tr><td style="padding:0.4rem 0.5rem; color:var(--muted); white-space:nowrap;">${k}</td><td style="padding:0.4rem 0.5rem; font-weight:600;">${v}</td></tr>`).join('\n          ')}
        </table>
      </div>

      ${p.path_india ? `<div class="card mb-2" style="margin-bottom:1rem;">
        <h2 class="section-title">The path (from Class 10)</h2>
        <p style="font-size:0.9375rem; line-height:1.7;">${esc(p.path_india)}</p>
      </div>` : ''}

      ${p.day_in_life ? `<div class="card mb-2" style="margin-bottom:1rem;">
        <h2 class="section-title">A day in the life</h2>
        <p style="font-size:0.9375rem; line-height:1.7;">${esc(p.day_in_life)}</p>
      </div>` : ''}

      <div class="card mb-2" style="margin-bottom:1rem;">
        <h2 class="section-title">Frequently asked questions</h2>
        ${faqs.map(([q, a]) => `<details style="margin-bottom:0.6rem;"><summary style="font-weight:600; cursor:pointer;">${esc(q)}</summary><p style="font-size:0.9rem; line-height:1.7; margin-top:0.4rem; color:var(--text);">${esc(a)}</p></details>`).join('\n        ')}
      </div>

      <div class="card mb-2" style="margin-bottom:1rem; text-align:center;">
        <h2 class="section-title">Is this career right for you?</h2>
        <p class="text-muted" style="font-size:0.9rem; margin-bottom:0.75rem;">Take the free 45-question RIASEC test and see how ${esc(p.name)} matches your personality.</p>
        <a href="../test.html" class="btn-primary" style="text-decoration:none;">Take the free test &rarr;</a>
      </div>
      ${relatedHtml}
    </article>
    ${footer}
  </div>
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
      <a href="index.html" style="color:var(--primary);">Careers</a> &rsaquo; <span>${esc(category)}</span>
    </nav>
    <div class="card mb-2" style="margin-bottom:1rem;">
      <h1>${esc(category)} Careers in India</h1>
      <p class="text-muted" style="margin-top:0.4rem;">${items.length} careers with India-specific paths, entrance exams and salary ranges.</p>
    </div>
    <div class="card mb-2" style="margin-bottom:1rem;">
      <ul style="line-height:2; padding-left:1.1rem;">
        ${items.map((p) => `<li><a href="${slug(p.id)}.html" style="color:var(--primary); font-weight:600;">${esc(p.name)}</a> — <span style="color:var(--muted); font-size:0.875rem;">${esc(clip(p.summary, 90))}</span></li>`).join('\n        ')}
      </ul>
    </div>
    <div class="card mb-2" style="margin-bottom:1rem; text-align:center;">
      <a href="../test.html" class="btn-primary" style="text-decoration:none;">Find your best-fit career &rarr;</a>
    </div>
    ${footer}
  </div>
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
      <a href="../index.html" style="color:var(--primary);">Home</a> &rsaquo; <span>Careers</span>
    </nav>
    <div class="card mb-2" style="margin-bottom:1rem;">
      <h1>Explore ${total} Careers in India</h1>
      <p class="text-muted" style="margin-top:0.4rem;">Browse by field. Each career shows the education path, entrance exams, salary range and recommended Class 11 stream.</p>
    </div>
    <div class="card mb-2" style="margin-bottom:1rem;">
      ${categories.map(([cat, items]) => `<h2 class="section-title" style="margin-top:0.5rem;"><a href="field-${catSlug(cat)}.html" style="color:var(--primary);">${esc(cat)}</a> <span style="font-weight:400; color:var(--muted); font-size:0.85rem;">(${items.length})</span></h2>
      <ul style="line-height:1.9; padding-left:1.1rem; margin-bottom:1rem;">
        ${items.slice(0, 8).map((p) => `<li><a href="${slug(p.id)}.html" style="color:var(--text);">${esc(p.name)}</a></li>`).join('\n        ')}
        ${items.length > 8 ? `<li><a href="field-${catSlug(cat)}.html" style="color:var(--primary);">See all ${items.length} &rarr;</a></li>` : ''}
      </ul>`).join('\n      ')}
    </div>
    <div class="card mb-2" style="margin-bottom:1rem; text-align:center;">
      <a href="../test.html" class="btn-primary" style="text-decoration:none;">Take the free career test &rarr;</a>
    </div>
    ${footer}
  </div>
</body>
</html>`;
}

// ── sitemap ───────────────────────────────────────────────────────────────────
function sitemap(urls) {
  const body = urls.map(({ loc, priority, changefreq }) =>
    `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
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
  ];

  writeFileSync(join(outDir, 'index.html'), indexPage(categories, items.length));

  for (const [cat, catItems] of categories) {
    writeFileSync(join(outDir, `field-${catSlug(cat)}.html`), categoryPage(cat, catItems));
    urls.push({ loc: `${BASE}/careers/field-${catSlug(cat)}.html`, priority: '0.7', changefreq: 'monthly' });
  }

  for (const p of items) {
    writeFileSync(join(outDir, `${slug(p.id)}.html`), professionPage(p, byCategory));
    urls.push({ loc: `${BASE}/careers/${slug(p.id)}.html`, priority: '0.6', changefreq: 'monthly' });
  }

  writeFileSync(join(ROOT, 'sitemap.xml'), sitemap(urls));

  console.log(`Generated ${items.length} profession pages + ${categories.length} category hubs + index.`);
  console.log(`Sitemap: ${urls.length} URLs -> sitemap.xml`);
}

main();
