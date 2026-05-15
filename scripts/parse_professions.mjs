import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function deriveYearsMin(path) {
  const p = path;

  // Long super-specialties (DM, MCh, Fellowship) add 2 on top of base — handled below.
  const isPostGrad =
    /\bDM\b/.test(p) || /\bMCh\b/.test(p) || /\bFellowship\b/i.test(p) ||
    /\bM\.Tech\b/i.test(p) || /\bM\.Sc\b/i.test(p) || /\bMBA\b/i.test(p) || /\bMA\b/.test(p);

  let base;

  if (/5\.5\s*yrs?|MBBS|BVSc|BAMS|BHMS|BNYS/.test(p)) base = 6;
  else if (/5\s*yrs?/.test(p)) base = 5;
  else if (/4\.5\s*yrs?|BPT|BOT/.test(p)) base = 5;
  else if (/4\s*yrs?|B\.Tech|BCA|BDS|B\.Arch|B\.Pharm|LLB\s*\(5|B\.Des|B\.Arch/.test(p)) base = 4;
  else if (/3\s*yrs?|GNM|BMLT|B\.Sc|BA\s|B\.Com|BBA|BSW|BHM|B\.E\.|B\.Mus|B\.F\.Sc|B\.P\.Ed|B\.L\.Arch/.test(p)) base = 3;
  else if (/Diploma|ITI|Certificate|Vocational|short-term|workshop|training|no formal/i.test(p)) base = 2;
  else base = 4; // default

  // Only add PG years if the base degree is the clear minimum (i.e. base ≤ 4 and PG is mentioned)
  // Per spec: "use the base degree only (not PG)". So we do NOT add PG years.
  return base;
}

// Annual fee range heuristic
function deriveFeeRange(name, category, type, path) {
  const n = name.toLowerCase();
  const p = path.toLowerCase();
  const c = category.toLowerCase();

  // Government MBBS/BDS
  if (/MBBS|BDS/.test(path) && !/private/i.test(path)) {
    if (/MBBS/.test(path)) return [50000, 150000];   // govt MBBS
    if (/BDS/.test(path))  return [50000, 150000];
  }

  if (/IIT|IISc|IIST|NIT|NLU|NID|NIFT|SPA|CEPT|IIM|AIIMS/.test(path)) {
    if (/B\.Tech|B\.Arch|B\.Des|BHM|B\.Sc|BA|B\.Com/.test(path)) return [50000, 200000];
    if (/MBA|M\.Tech|M\.Sc|MD|MS|MDS/.test(path)) return [100000, 400000];
  }

  if (/B\.Tech/.test(path)) return [100000, 600000];    // private B.Tech default
  if (/MBA/.test(path))     return [200000, 2000000];

  // Healthcare
  if (c === 'healthcare') {
    if (/MBBS/.test(path)) return [500000, 2500000];    // private (already handled above for govt)
    if (/BDS/.test(path))  return [300000, 1500000];
    if (/B\.Pharm|Pharm\.D/.test(path)) return [100000, 500000];
    if (/BPT|BOT/.test(path)) return [80000, 300000];
    if (/GNM|B\.Sc Nurs/.test(path)) return [50000, 200000];
    if (/BAMS|BHMS|BNYS/.test(path)) return [50000, 300000];
    if (/BVSc/.test(path)) return [50000, 200000];
    if (/Diploma|ITI|Certificate/i.test(path)) return [20000, 100000];
    return [100000, 500000];
  }

  // Technology
  if (c === 'technology') {
    if (/BCA|B\.Sc/.test(path)) return [50000, 250000];
    if (/B\.Tech/.test(path))   return [100000, 600000];
    return [50000, 300000];
  }

  // Education
  if (c === 'education') {
    if (/B\.Ed|M\.Ed/.test(path)) return [20000, 150000];
    if (/PhD/.test(path)) return [30000, 200000];
    return [20000, 150000];
  }

  // Law & Government
  if (c === 'law & government') {
    if (/LLB|LLM/.test(path)) return [50000, 400000];
    return [10000, 100000];  // UPSC — no fee for exam itself
  }

  // Finance & Business
  if (c === 'finance & business') {
    if (/CA|CMA|CS/.test(path)) return [50000, 200000];  // ICAI exams
    if (/B\.Com/.test(path)) return [10000, 100000];
    if (/MBA/.test(path)) return [200000, 2000000];
    return [50000, 300000];
  }

  // Engineering
  if (c === 'engineering') {
    if (/B\.Tech/.test(path)) return [100000, 600000];
    if (/Diploma/i.test(path)) return [20000, 100000];
    if (/ITI/.test(path)) return [10000, 50000];
    return [100000, 600000];
  }

  // Arts & Media
  if (c === 'arts & media') {
    if (/NSD|FTII/.test(path)) return [10000, 100000];   // government schools
    if (/B\.Des|BFA/.test(path)) return [100000, 600000];
    if (/BA|BJMC/.test(path)) return [20000, 200000];
    if (/Diploma|Certificate|workshop/i.test(path)) return [20000, 150000];
    return [50000, 300000];
  }

  // Trades & Construction
  if (c === 'trades & construction') {
    if (/ITI/.test(path)) return [10000, 50000];
    if (/Diploma/i.test(path)) return [20000, 100000];
    if (/B\.Tech/.test(path)) return [100000, 600000];
    return [10000, 80000];
  }

  // Science & Research
  if (c === 'science & research') {
    if (/B\.Sc/.test(path)) return [10000, 80000];  // govt colleges common
    if (/M\.Sc|M\.Tech/.test(path)) return [30000, 200000];
    if (/PhD/.test(path)) return [20000, 100000];   // fellowships offset
    return [30000, 200000];
  }

  // Hospitality & Food
  if (c === 'hospitality & food') {
    if (/BHM|IHM/.test(path)) return [100000, 400000];
    if (/Diploma|Certificate/i.test(path)) return [20000, 150000];
    return [80000, 300000];
  }

  // Transport & Logistics
  if (c === 'transport & logistics') {
    if (/CPL|DGCA/.test(path)) return [2000000, 4000000];   // pilot training
    if (/B\.Sc Nautical|IMU/.test(path)) return [500000, 1500000];
    if (/ITI/.test(path)) return [10000, 50000];
    if (/MBA/.test(path)) return [200000, 2000000];
    if (/BBA|B\.Tech/.test(path)) return [50000, 400000];
    return [30000, 200000];
  }

  // Social & Welfare
  if (c === 'social & welfare') {
    if (/MSW|BSW/.test(path)) return [20000, 150000];
    if (/MA/.test(path)) return [20000, 150000];
    return [20000, 150000];
  }

  // Agriculture & Environment
  if (c === 'agriculture & environment') {
    if (/B\.Sc Agriculture|B\.F\.Sc/.test(path)) return [20000, 150000];
    if (/M\.Sc|PhD/.test(path)) return [20000, 150000];
    if (/B\.Tech/.test(path)) return [50000, 300000];
    if (/Diploma/i.test(path)) return [10000, 80000];
    return [20000, 150000];
  }

  // Architecture & Design
  if (c === 'architecture & design') {
    if (/B\.Arch|B\.Des|B\.Tech/.test(path)) return [100000, 800000];
    if (/Diploma/i.test(path)) return [50000, 200000];
    return [100000, 600000];
  }

  // Sports & Fitness
  if (c === 'sports & fitness') {
    if (/B\.P\.Ed/.test(path)) return [30000, 150000];
    if (/certification|diploma/i.test(path)) return [20000, 200000];
    if (/NDA|AFCAT/.test(path)) return [0, 0];   // government
    return [20000, 200000];
  }

  // Mental Health & Wellness / Public Health & Policy
  if (/mental health|public health/i.test(c)) {
    if (/MBBS/.test(path)) return [50000, 500000];
    if (/MA|M\.Sc/.test(path)) return [30000, 200000];
    if (/MPH/.test(path)) return [50000, 300000];
    return [30000, 200000];
  }

  // Finance — Specialized Niche
  if (c === 'finance — specialized niche') {
    if (/B\.Tech|MBA/.test(path)) return [100000, 2000000];
    if (/M\.Sc|PhD/.test(path)) return [30000, 300000];
    return [50000, 300000];
  }

  // Niche & Emerging
  if (c === 'niche & emerging professions') {
    if (/B\.Tech/.test(path)) return [100000, 600000];
    if (/Diploma|Certificate|no formal/i.test(path)) return [10000, 100000];
    if (/PhD|M\.Sc/.test(path)) return [30000, 300000];
    return [30000, 200000];
  }

  // Fallback by type
  if (type === 'Major') return [100000, 600000];
  if (type === 'Minor') return [50000, 300000];
  return [30000, 200000]; // Niche
}

// Streams heuristic
function deriveStreams(name, category) {
  const c = category;
  const n = name.toLowerCase();

  if (c === 'Healthcare' || c === 'Mental Health & Wellness' || c === 'Public Health & Policy') {
    if (/veterinar/i.test(n)) return ['pcb'];
    return ['pcb'];
  }
  if (c === 'Technology' || c === 'Engineering') return ['pcm'];
  if (c === 'Science & Research') return ['pcm', 'pcb'];
  if (c === 'Finance & Business' || c === 'Finance — Specialized Niche') return ['commerce', 'arts'];
  if (c === 'Law & Government') return ['commerce', 'arts'];
  if (c === 'Arts & Media') return ['arts', 'any'];
  if (c === 'Social & Welfare') return ['arts', 'any'];
  if (c === 'Education') return ['any'];
  if (c === 'Agriculture & Environment') return ['pcb', 'pcm'];
  if (c === 'Architecture & Design') {
    if (/fashion|textile|jewelry|accessory/i.test(n)) return ['arts', 'any'];
    return ['pcm', 'arts'];
  }
  if (c === 'Hospitality & Food') return ['any'];
  if (c === 'Transport & Logistics') {
    if (/pilot|aircraft|ship|nautical/i.test(n)) return ['pcm'];
    return ['any'];
  }
  if (c === 'Trades & Construction') return ['any'];
  if (c === 'Sports & Fitness') return ['any'];
  if (c === 'Niche & Emerging Professions') {
    if (/engineer|developer|tech|data|cyber|quantum|satellite|geo/i.test(n)) return ['pcm'];
    if (/medical|nuclear medicine|health/i.test(n)) return ['pcb', 'pcm'];
    return ['any'];
  }
  return ['any'];
}

// Entrance exam heuristic
function deriveEntranceExam(name, category, path) {
  const p = path;
  const c = category;
  const n = name.toLowerCase();

  // Specific overrides first
  if (/NEET/.test(p) || /MBBS|BDS|BVSc|BAMS|BHMS|BNYS/.test(p)) return 'NEET';
  if (/NDA|AFCAT/.test(p)) return 'NDA/CDS';
  if (/UPSC/.test(p)) return 'UPSC';
  if (/JEE|IIT|NIT/.test(p) && /B\.Tech/.test(p)) return 'JEE';
  if (/CLAT|LLB/.test(p)) return 'CLAT';
  if (/NATA|B\.Arch/.test(p)) return 'NATA';
  if (/CA Foundation|ICAI/.test(p)) return 'CA Foundation';
  if (/CMA Foundation|ICMAI/.test(p)) return 'CMA Foundation';
  if (/CS Foundation|ICSI/.test(p)) return 'CS Foundation';
  if (/NIFT|NID/.test(p)) return 'NIFT/NID Entrance';
  if (/CPL|DGCA-approved ATO/.test(p)) return 'DGCA CPL';
  if (/RRB/.test(p)) return 'RRB ALP/JE';
  if (/AAI ATC/.test(p)) return 'AAI ATC Exam';
  if (/IBPS AFO/.test(p)) return 'IBPS AFO';
  if (/CFA/.test(p)) return 'CFA Exam';
  if (/IFS.*UPSC|UPSC.*IFS/.test(p)) return 'UPSC';

  // Category-level fallbacks
  if (c === 'Technology' || c === 'Engineering') {
    if (/B\.Tech/.test(p)) return 'JEE/State CET';
    return 'None/State Board';
  }
  if (c === 'Healthcare') return 'NEET';
  if (c === 'Law & Government') {
    if (/LLB/.test(p)) return 'CLAT';
    if (/UPSC|IAS|IPS|IFS|IRS/.test(p)) return 'UPSC';
    return 'State PSC';
  }
  if (c === 'Finance & Business' || c === 'Finance — Specialized Niche') {
    if (/B\.Com|BBA/.test(p)) return 'None/State Board';
    if (/MBA/.test(p)) return 'CAT/GMAT';
    return 'None/State Board';
  }
  if (c === 'Education') return 'CTET/State TET';
  if (c === 'Arts & Media') {
    if (/FTII/.test(p)) return 'FTII Entrance';
    if (/NSD/.test(p)) return 'NSD Entrance';
    return 'None/State Board';
  }
  if (c === 'Science & Research') {
    if (/IIT|IISc/.test(p)) return 'JEE/JEST/CSIR NET';
    if (/UPSC.*IFS|IFS.*UPSC/.test(p)) return 'UPSC IFS';
    return 'CUET/State Board';
  }
  if (c === 'Agriculture & Environment') return 'ICAR AIEEA';
  if (c === 'Architecture & Design') {
    if (/B\.Arch/.test(p)) return 'NATA';
    if (/NID|NIFT/.test(p)) return 'NIFT/NID Entrance';
    return 'None/State Board';
  }
  if (c === 'Transport & Logistics') {
    if (/IMU|Nautical/.test(p)) return 'IMU CET';
    return 'None/State Board';
  }
  if (c === 'Trades & Construction') {
    if (/ITI/.test(p)) return 'ITI Admission/NCVT';
    return 'None/State Board';
  }
  if (c === 'Sports & Fitness') return 'None/State Board';
  if (c === 'Hospitality & Food') {
    if (/IHM/.test(p)) return 'NCHMCT JEE';
    return 'None/State Board';
  }
  if (c === 'Social & Welfare') return 'TISS NET';
  if (c === 'Mental Health & Wellness') {
    if (/MBBS/.test(p)) return 'NEET';
    return 'None/State Board';
  }
  if (c === 'Public Health & Policy') {
    if (/MBBS/.test(p)) return 'NEET';
    return 'None/State Board';
  }

  return 'None/State Board';
}

// Exam intensity 1–3
function deriveExamIntensity(entranceExam) {
  const e = entranceExam;
  if (/NEET|JEE|CLAT|UPSC|CA Final|CA Foundation|CMA Foundation|CS Foundation|FTII Entrance|NSD Entrance/.test(e)) return 3;
  if (/NDA\/CDS|NATA|State CET|NCHMCT|IMU CET|ICAR|CAT\/GMAT|TISS NET|DGCA CPL|AAI ATC|RRB|IBPS|CUET|JEE\/JEST|NIFT\/NID/.test(e)) return 2;
  return 1;
}

// ── Parser ────────────────────────────────────────────────────────────────────

function parseMarkdown(md) {
  const lines = md.split('\n');
  const items = [];
  let currentCategory = null;
  const seen = new Set();

  for (const raw of lines) {
    const line = raw.trim();

    // H2 heading = new category
    if (line.startsWith('## ')) {
      currentCategory = line.slice(3).trim();
      continue;
    }

    // Skip dividers, blank lines, header rows, separator rows
    if (!currentCategory) continue;
    if (!line.startsWith('|')) continue;
    if (/^\|\s*-+/.test(line)) continue;  // separator row
    if (/\|\s*Profession\s*\|/i.test(line)) continue;  // header row

    // Parse table row
    const cols = line
      .split('|')
      .map(c => c.trim())
      .filter((_, i, arr) => i > 0 && i < arr.length - 1); // strip leading/trailing empty from '|...|'

    if (cols.length < 4) continue;

    const [professionRaw, typeRaw, summaryRaw, pathRaw] = cols;
    const name = professionRaw.trim();
    const type = typeRaw.trim();
    const summary = summaryRaw.trim();
    const path_india = pathRaw.trim();

    if (!name || !type || !summary || !path_india) continue;
    if (!['Major', 'Minor', 'Niche'].includes(type)) continue;

    const baseId = slugify(name);
    const categorySlug = currentCategory.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const id = seen.has(baseId) ? `${baseId}__${categorySlug}` : baseId;
    seen.add(baseId);
    const years_min = deriveYearsMin(path_india);
    const annual_fee_range = deriveFeeRange(name, currentCategory, type, path_india);
    const streams = deriveStreams(name, currentCategory);
    const entrance_exam = deriveEntranceExam(name, currentCategory, path_india);
    const exam_intensity = deriveExamIntensity(entrance_exam);

    items.push({
      id,
      name,
      category: currentCategory,
      type,
      summary,
      path_india,
      years_min,
      annual_fee_range,
      streams,
      entrance_exam,
      exam_intensity,
    });
  }

  return items;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const mdPath = resolve(ROOT, 'professions.md');
const outPath = resolve(ROOT, 'data', 'professions.json');

const md = readFileSync(mdPath, 'utf8');
const items = parseMarkdown(md);

mkdirSync(dirname(outPath), { recursive: true });

const output = {
  schema_version: 1,
  generated_from: 'professions.md',
  items,
};

writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

console.log(`Done. Written ${items.length} professions to ${outPath}`);
