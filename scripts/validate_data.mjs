import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');

let passed = 0;
let failed = 0;

function pass(msg) {
  console.log(`✓ ${msg}`);
  passed++;
}

function fail(msg, reason) {
  console.log(`✗ ${msg}: ${reason}`);
  failed++;
}

// ── 1. Parse JSON files ────────────────────────────────────────────────────

function loadJSON(relPath) {
  const fullPath = resolve(ROOT, relPath);
  if (!existsSync(fullPath)) return { missing: true };
  try {
    const data = JSON.parse(readFileSync(fullPath, 'utf8'));
    return { data };
  } catch (e) {
    return { error: e.message };
  }
}

const questionsResult  = loadJSON('data/questions.json');
const professionsResult = loadJSON('data/professions.json');
const edgesResult      = loadJSON('data/riasec_edges.json');

// questions.json
if (questionsResult.missing) {
  fail('data/questions.json parsed', 'file not found');
} else if (questionsResult.error) {
  fail('data/questions.json parsed', questionsResult.error);
} else {
  pass('data/questions.json parsed');
}

// professions.json
let professions = [];
if (professionsResult.missing) {
  fail('data/professions.json parsed', 'file not found');
} else if (professionsResult.error) {
  fail('data/professions.json parsed', professionsResult.error);
} else {
  professions = professionsResult.data?.items ?? professionsResult.data;
  if (!Array.isArray(professions)) {
    fail('data/professions.json parsed', 'expected an array or object with .items array');
    professions = [];
  } else {
    pass(`data/professions.json parsed (${professions.length} items)`);
  }
}

// riasec_edges.json — optional
let edges = null;
let edgesSkipped = false;
if (edgesResult.missing) {
  console.log('⚠ data/riasec_edges.json not found — skipping edge checks');
  edgesSkipped = true;
} else if (edgesResult.error) {
  fail('data/riasec_edges.json parsed', edgesResult.error);
} else {
  edges = edgesResult.data?.items ?? edgesResult.data?.edges ?? edgesResult.data;
  if (!Array.isArray(edges)) {
    fail('data/riasec_edges.json parsed', 'expected an array or object with .items/.edges array');
    edges = null;
  } else {
    pass(`data/riasec_edges.json parsed (${edges.length} edges)`);
  }
}

// ── 2. Question counts ─────────────────────────────────────────────────────

const VALID_DIMENSIONS = new Set(['R', 'I', 'A', 'S', 'E', 'C']);
const CONSTRAINT_KEYS  = new Set([
  'years_available', 'annual_budget_inr', 'exam_intensity', 'can_relocate',
  'stream_pref', 'need_early_income', 'work_setting', 'college_type',
  'learning_style', 'family_background'
]);

if (questionsResult.data) {
  const {
    personal_financial = [],
    career_quick       = [],
    career_deep        = []
  } = questionsResult.data;

  // Section counts
  if (personal_financial.length === 10) {
    pass('personal_financial question count: 10');
  } else {
    fail('personal_financial question count: 10', `got ${personal_financial.length}`);
  }

  if (career_quick.length >= 10 && career_quick.length % 6 === 0) {
    pass(`career_quick pool size valid (${career_quick.length})`);
  } else {
    fail('career_quick pool size', `expected multiple of 6 >= 10, got ${career_quick.length}`);
  }

  if (career_deep.length >= 25 && career_deep.length % 6 === 0) {
    pass(`career_deep pool size valid (${career_deep.length})`);
  } else {
    fail('career_deep pool size', `expected multiple of 6 >= 25, got ${career_deep.length}`);
  }

  // career_quick dimension validity
  const badQuickDims = career_quick.filter(q => !VALID_DIMENSIONS.has(q.dimension));
  if (badQuickDims.length === 0) {
    pass('All career_quick dimensions valid');
  } else {
    fail('All career_quick dimensions valid',
      `invalid dimension(s) on: ${badQuickDims.map(q => q.id).join(', ')}`);
  }

  // career_deep dimension validity
  const badDeepDims = career_deep.filter(q => !VALID_DIMENSIONS.has(q.dimension));
  if (badDeepDims.length === 0) {
    pass('All career_deep dimensions valid');
  } else {
    fail('All career_deep dimensions valid',
      `invalid dimension(s) on: ${badDeepDims.map(q => q.id).join(', ')}`);
  }

  // RIASEC balance — each dimension must appear equally in each pool
  function checkDimBalance(pool, poolName) {
    const counts = {};
    pool.forEach(q => { counts[q.dimension] = (counts[q.dimension] || 0) + 1; });
    const vals = Object.values(counts);
    const allEqual = vals.every(v => v === vals[0]);
    if (allEqual) {
      pass(`${poolName} RIASEC dimension balance valid`);
    } else {
      fail(`${poolName} RIASEC dimension balance`, `unequal counts: ${JSON.stringify(counts)}`);
    }
  }
  checkDimBalance(career_quick, 'career_quick');
  checkDimBalance(career_deep, 'career_deep');

  // personal_financial key field presence
  const missingKeyField = personal_financial.filter(q => !('key' in q));
  if (missingKeyField.length === 0) {
    pass('All personal_financial items have a key field');
  } else {
    fail('All personal_financial items have a key field',
      `${missingKeyField.length} item(s) missing key field`);
  }

  // Constraint keys
  const actualKeys  = new Set(personal_financial.map(c => c.key));
  const missingKeys = [...CONSTRAINT_KEYS].filter(k => !actualKeys.has(k));
  const extraKeys   = [...actualKeys].filter(k => !CONSTRAINT_KEYS.has(k));
  if (missingKeys.length === 0 && extraKeys.length === 0) {
    pass('personal_financial constraint keys valid');
  } else {
    const reasons = [];
    if (missingKeys.length) reasons.push(`missing: ${missingKeys.join(', ')}`);
    if (extraKeys.length)   reasons.push(`unexpected: ${extraKeys.join(', ')}`);
    fail('personal_financial constraint keys valid', reasons.join('; '));
  }
}

// ── 3. Profession integrity ────────────────────────────────────────────────

const REQUIRED_FIELDS  = ['id', 'name', 'category', 'type', 'summary', 'path_india',
                           'years_min', 'annual_fee_range', 'salary_lpa', 'streams', 'entrance_exam', 'exam_intensity'];
const VALID_TYPES      = new Set(['Major', 'Minor', 'Niche']);
const VALID_STREAMS    = new Set(['pcm', 'pcb', 'commerce', 'arts', 'any']);
const VALID_INTENSITIES = new Set([1, 2, 3]);

if (professions.length > 0) {
  // Required fields
  const missingFields = professions.filter(p =>
    REQUIRED_FIELDS.some(f => !(f in p))
  );
  if (missingFields.length === 0) {
    pass('All profession fields present');
  } else {
    fail('All profession fields present',
      `${missingFields.length} profession(s) missing fields, e.g. id="${missingFields[0].id}"`);
  }

  // type
  const badType = professions.filter(p => !VALID_TYPES.has(p.type));
  if (badType.length === 0) {
    pass('All profession types valid');
  } else {
    fail('All profession types valid',
      `invalid type(s): ${badType.map(p => `${p.id}:${p.type}`).join(', ')}`);
  }

  // years_min positive integer
  const badYears = professions.filter(p =>
    !Number.isInteger(p.years_min) || p.years_min <= 0
  );
  if (badYears.length === 0) {
    pass('All profession years_min valid');
  } else {
    fail('All profession years_min valid',
      `${badYears.length} invalid, e.g. id="${badYears[0].id}" years_min=${badYears[0].years_min}`);
  }

  // annual_fee_range [min, max] both positive, min <= max
  const badFee = professions.filter(p => {
    const r = p.annual_fee_range;
    return !Array.isArray(r) || r.length !== 2 ||
           typeof r[0] !== 'number' || typeof r[1] !== 'number' ||
           r[0] <= 0 || r[1] <= 0 || r[0] > r[1];
  });
  if (badFee.length === 0) {
    pass('All profession annual_fee_range valid');
  } else {
    fail('All profession annual_fee_range valid',
      `${badFee.length} invalid, e.g. id="${badFee[0].id}"`);
  }

  // salary_lpa: { entry, mid, senior } — positive integers, entry <= mid <= senior
  const badSalary = professions.filter(p => {
    const s = p.salary_lpa;
    if (!s || typeof s !== 'object') return true;
    if (!Number.isInteger(s.entry) || !Number.isInteger(s.mid) || !Number.isInteger(s.senior)) return true;
    if (s.entry < 1 || s.mid < 1 || s.senior < 1) return true;
    if (s.entry > s.mid || s.mid > s.senior) return true;
    return false;
  });
  if (badSalary.length === 0) {
    pass('All profession salary_lpa valid');
  } else {
    fail('All profession salary_lpa valid',
      `${badSalary.length} invalid, e.g. id="${badSalary[0].id}"`);
  }

  // streams — array with at least one valid value
  const badStreams = professions.filter(p =>
    !Array.isArray(p.streams) || p.streams.length === 0 ||
    !p.streams.every(s => VALID_STREAMS.has(s))
  );
  if (badStreams.length === 0) {
    pass('All profession streams valid');
  } else {
    fail('All profession streams valid',
      `${badStreams.length} invalid, e.g. id="${badStreams[0].id}" streams=${JSON.stringify(badStreams[0].streams)}`);
  }

  // exam_intensity
  const badIntensity = professions.filter(p => !VALID_INTENSITIES.has(p.exam_intensity));
  if (badIntensity.length === 0) {
    pass('All profession exam_intensity valid');
  } else {
    fail('All profession exam_intensity valid',
      `${badIntensity.length} invalid, e.g. id="${badIntensity[0].id}" intensity=${badIntensity[0].exam_intensity}`);
  }

  // Unique IDs
  const ids = professions.map(p => p.id);
  const seen = new Set();
  const dupes = ids.filter(id => {
    if (seen.has(id)) return true;
    seen.add(id);
    return false;
  });
  if (dupes.length === 0) {
    pass('All profession IDs unique');
  } else {
    fail('All profession IDs unique', `duplicate id(s): ${[...new Set(dupes)].join(', ')}`);
  }
}

// ── 4. RIASEC edge integrity ───────────────────────────────────────────────

if (!edgesSkipped && edges !== null && professions.length > 0) {
  const RIASEC_KEYS = ['R', 'I', 'A', 'S', 'E', 'C'];

  // All 6 keys present and weights in [0, 1]
  const badKeys = edges.filter(e =>
    RIASEC_KEYS.some(k => !(k in e) || typeof e[k] !== 'number' || e[k] < 0 || e[k] > 1)
  );
  if (badKeys.length === 0) {
    pass('All RIASEC edge keys and weights valid');
  } else {
    fail('All RIASEC edge keys and weights valid',
      `${badKeys.length} edge(s) have missing/invalid keys`);
  }

  // Each edge sums to 1.0 ± 0.01
  const badSum = edges.filter(e => {
    const sum = RIASEC_KEYS.reduce((acc, k) => acc + (e[k] ?? 0), 0);
    return Math.abs(sum - 1.0) > 0.01;
  });
  if (badSum.length === 0) {
    pass('All RIASEC edge sums valid');
  } else {
    fail('All RIASEC edge sums valid',
      `${badSum.length} edge(s) don't sum to 1.0 ± 0.01, e.g. profession_id="${badSum[0].profession_id}"`);
  }

  // Every edge profession_id exists in professions
  const professionIds = new Set(professions.map(p => p.id));
  const orphanEdges = edges.filter(e => !professionIds.has(e.profession_id));
  if (orphanEdges.length === 0) {
    pass('All edge profession_ids found in professions');
  } else {
    fail('All edge profession_ids found in professions',
      `${orphanEdges.length} unknown id(s), e.g. "${orphanEdges[0].profession_id}"`);
  }

  // Every profession has a corresponding edge
  const edgeProfIds = new Set(edges.map(e => e.profession_id));
  const missingEdges = professions.filter(p => !edgeProfIds.has(p.id));
  if (missingEdges.length === 0) {
    pass('All professions have edges');
  } else {
    fail('All professions have edges',
      `${missingEdges.length} profession(s) missing edges, e.g. "${missingEdges[0].id}"`);
  }
}

// ── Summary ────────────────────────────────────────────────────────────────

console.log('');
const total = passed + failed;
if (failed === 0) {
  console.log(`All ${total} checks passed ✓`);
  process.exit(0);
} else {
  console.log(`${failed} check(s) failed ✗  (${passed}/${total} passed)`);
  process.exit(1);
}
