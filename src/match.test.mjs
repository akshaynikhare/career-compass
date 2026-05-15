import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { match } = require('./match.js');

const __dir = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dir, '..', 'data');

const questions   = JSON.parse(readFileSync(join(dataDir, 'questions.json'),   'utf8'));
const professions = JSON.parse(readFileSync(join(dataDir, 'professions.json'), 'utf8'));
const edges       = JSON.parse(readFileSync(join(dataDir, 'riasec_edges.json'),'utf8'));

// Build answer sets from question metadata
function buildAnswers(scoreFn) {
  const answers = {};
  questions.personality.forEach(q => {
    answers[q.id] = scoreFn(q.dimension);
  });
  return answers;
}

const defaultConstraints = {
  years_available: 9,
  annual_budget_inr: 1500000,
  can_relocate: true,
  exam_intensity: 3,
  stream_pref: 'any',
};

// ── Test 1: All-I profile ────────────────────────────────────────────────────
test('All-I profile: riasec.I >= 0.40 and top10 includes relevant category', () => {
  const answers = buildAnswers(dim => dim === 'I' ? 5 : 1);
  const result = match(answers, defaultConstraints, questions, professions, edges);

  assert.ok(
    result.riasec.I >= 0.40,
    `Expected riasec.I >= 0.40, got ${result.riasec.I}`
  );

  const targetCategories = new Set(['Technology', 'Science & Research', 'Healthcare']);
  const hasTarget = result.top10.some(m => targetCategories.has(m.profession.category));
  assert.ok(
    hasTarget,
    `Expected top10 to contain Technology, Science & Research, or Healthcare. Got: ${result.top10.map(m => m.profession.category).join(', ')}`
  );
});

// ── Test 2: All-A profile ────────────────────────────────────────────────────
test('All-A profile: riasec.A >= 0.40 and top10 includes Arts/Design category', () => {
  const answers = buildAnswers(dim => dim === 'A' ? 5 : 1);
  const result = match(answers, defaultConstraints, questions, professions, edges);

  assert.ok(
    result.riasec.A >= 0.40,
    `Expected riasec.A >= 0.40, got ${result.riasec.A}`
  );

  const targetCategories = new Set(['Arts & Media', 'Architecture & Design']);
  const hasTarget = result.top10.some(m => targetCategories.has(m.profession.category));
  assert.ok(
    hasTarget,
    `Expected top10 to contain Arts & Media or Architecture & Design. Got: ${result.top10.map(m => m.profession.category).join(', ')}`
  );
});

// ── Test 3: Constraint filter ────────────────────────────────────────────────
test('Constraint filter: top10 respects years_min and exam_intensity limits', () => {
  const tightConstraints = {
    years_available: 2,
    annual_budget_inr: 50000,
    can_relocate: false,
    exam_intensity: 1,
    stream_pref: 'any',
  };
  const answers = buildAnswers(() => 3); // balanced
  const result = match(answers, tightConstraints, questions, professions, edges);

  for (const m of result.top10) {
    assert.ok(
      m.profession.years_min <= 2,
      `top10 profession "${m.profession.id}" has years_min=${m.profession.years_min} > 2`
    );
    assert.ok(
      m.profession.exam_intensity <= 1,
      `top10 profession "${m.profession.id}" has exam_intensity=${m.profession.exam_intensity} > 1`
    );
  }
});

// ── Test 4: Score range and matches length ───────────────────────────────────
test('Score range: all scores 0–1 and matches.length === professions.items.length', () => {
  const answers = buildAnswers(() => 3);
  const result = match(answers, defaultConstraints, questions, professions, edges);

  assert.strictEqual(
    result.matches.length,
    professions.items.length,
    `Expected ${professions.items.length} matches, got ${result.matches.length}`
  );

  for (const m of result.matches) {
    assert.ok(
      m.score >= 0 && m.score <= 1,
      `Score out of range for "${m.profession.id}": ${m.score}`
    );
  }
});

// ── Test 5: Normalized RIASEC sums to 1.0 ± 0.01 ───────────────────────────
test('Normalized RIASEC: sum of all dimension values equals 1.0 ± 0.01', () => {
  const answers = buildAnswers(() => 3);
  const result = match(answers, defaultConstraints, questions, professions, edges);

  const sum = Object.values(result.riasec).reduce((s, v) => s + v, 0);
  assert.ok(
    Math.abs(sum - 1.0) <= 0.01,
    `RIASEC values sum to ${sum}, expected 1.0 ± 0.01`
  );
});
