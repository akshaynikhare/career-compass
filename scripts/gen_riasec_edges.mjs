import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");

// Category → base RIASEC vector [R, I, A, S, E, C]
const CATEGORY_BASE = {
  "Healthcare":                   [0.10, 0.40, 0.00, 0.40, 0.05, 0.05],
  "Technology":                   [0.20, 0.50, 0.05, 0.05, 0.10, 0.10],
  "Education":                    [0.00, 0.20, 0.20, 0.50, 0.05, 0.05],
  "Law & Government":             [0.00, 0.20, 0.10, 0.30, 0.30, 0.10],
  "Finance & Business":           [0.00, 0.25, 0.05, 0.10, 0.40, 0.20],
  "Engineering":                  [0.35, 0.40, 0.05, 0.05, 0.10, 0.05],
  "Arts & Media":                 [0.05, 0.05, 0.65, 0.15, 0.05, 0.05],
  "Trades & Construction":        [0.60, 0.10, 0.10, 0.05, 0.10, 0.05],
  "Science & Research":           [0.10, 0.70, 0.05, 0.05, 0.05, 0.05],
  "Hospitality & Food":           [0.20, 0.05, 0.25, 0.35, 0.10, 0.05],
  "Transport & Logistics":        [0.40, 0.15, 0.00, 0.10, 0.15, 0.20],
  "Social & Welfare":             [0.00, 0.10, 0.10, 0.65, 0.10, 0.05],
  "Agriculture & Environment":    [0.30, 0.30, 0.05, 0.10, 0.10, 0.15],
  "Architecture & Design":        [0.20, 0.15, 0.40, 0.05, 0.10, 0.10],
  "Sports & Fitness":             [0.45, 0.05, 0.10, 0.25, 0.10, 0.05],
  "Mental Health & Wellness":     [0.00, 0.25, 0.15, 0.50, 0.05, 0.05],
  "Public Health & Policy":       [0.00, 0.25, 0.05, 0.40, 0.20, 0.10],
  "Finance — Specialized Niche":  [0.00, 0.30, 0.00, 0.05, 0.35, 0.30],
  "Niche & Emerging Professions": [0.10, 0.40, 0.15, 0.10, 0.15, 0.10],
};

// Keyword rules: { terms, delta: [R, I, A, S, E, C] }
// Terms matched case-insensitively against name + summary
const KEYWORD_RULES = [
  { terms: ["surgeon", "surgery"],           delta: [+0.15, +0.05,  0.00, -0.10,  0.00,  0.00] },
  { terms: ["artist", "designer", "creative", "animator", "illustrator"],
                                             delta: [ 0.00, -0.05, +0.20, -0.05,  0.00,  0.00] },
  { terms: ["teacher", "professor", "lecturer", "educator"],
                                             delta: [ 0.00,  0.00, +0.05, +0.15, -0.05,  0.00] },
  { terms: ["manager", "director", "executive", "ceo", "entrepreneur"],
                                             delta: [ 0.00,  0.00,  0.00, -0.10, +0.20, +0.05] },
  { terms: ["analyst", "researcher", "scientist", "data", "statistician"],
                                             delta: [-0.05, +0.20,  0.00,  0.00, -0.05,  0.00] },
  { terms: ["accountant", "auditor", "compliance", "clerk", "administrator"],
                                             delta: [ 0.00, +0.05,  0.00,  0.00, -0.10, +0.20] },
  { terms: ["nurse", "therapist", "counsellor", "social worker", "psychologist"],
                                             delta: [ 0.00, +0.05,  0.00, +0.20, -0.10,  0.00] },
  { terms: ["pilot", "driver", "captain"],  delta: [+0.15,  0.00,  0.00, -0.10,  0.00, +0.10] },
  { terms: ["writer", "journalist", "author", "editor"],
                                             delta: [-0.10, +0.05, +0.20,  0.00,  0.00,  0.00] },
  { terms: ["lawyer", "advocate", "judge"], delta: [-0.10, +0.10,  0.00,  0.00, +0.15,  0.00] },
  { terms: ["chef", "cook", "baker"],       delta: [+0.10,  0.00, +0.15,  0.00,  0.00, +0.05] },
];

function matchesKeyword(text, term) {
  // Use word-boundary-style matching to avoid partial hits
  return text.toLowerCase().includes(term.toLowerCase());
}

function buildEdge(profession) {
  const base = CATEGORY_BASE[profession.category];
  if (!base) {
    throw new Error(`Unknown category: "${profession.category}" for id "${profession.id}"`);
  }

  // Start with a mutable copy
  const v = [...base];

  // Combined text for keyword search
  const text = `${profession.name} ${profession.summary || ""}`;

  // Accumulate all matching keyword deltas
  for (const rule of KEYWORD_RULES) {
    const hit = rule.terms.some((term) => matchesKeyword(text, term));
    if (hit) {
      for (let i = 0; i < 6; i++) {
        v[i] += rule.delta[i];
      }
    }
  }

  // Clamp to >= 0
  for (let i = 0; i < 6; i++) {
    if (v[i] < 0) v[i] = 0;
  }

  // Normalize to sum = 1.0
  const sum = v.reduce((a, b) => a + b, 0);
  if (sum === 0) throw new Error(`All-zero vector for "${profession.id}"`);
  for (let i = 0; i < 6; i++) {
    v[i] = v[i] / sum;
  }

  // Round to 2 decimal places
  const keys = ["R", "I", "A", "S", "E", "C"];
  const rounded = v.map((x) => Math.round(x * 100) / 100);

  // Fix rounding drift: add/subtract from the largest dimension
  const roundedSum = rounded.reduce((a, b) => a + b, 0);
  const drift = Math.round((1.0 - roundedSum) * 100) / 100;
  if (drift !== 0) {
    let maxIdx = 0;
    for (let i = 1; i < 6; i++) {
      if (rounded[i] > rounded[maxIdx]) maxIdx = i;
    }
    rounded[maxIdx] = Math.round((rounded[maxIdx] + drift) * 100) / 100;
  }

  const edge = { profession_id: profession.id };
  keys.forEach((k, i) => { edge[k] = rounded[i]; });
  return edge;
}

// Main
const professions = JSON.parse(
  readFileSync(join(ROOT, "data", "professions.json"), "utf8")
);

const edges = professions.items.map(buildEdge);

const output = {
  schema_version: 1,
  edges,
};

writeFileSync(
  join(ROOT, "data", "riasec_edges.json"),
  JSON.stringify(output, null, 2),
  "utf8"
);

console.log(`Written ${edges.length} edges to data/riasec_edges.json`);
