# Contributing to Career Compass

Thanks for helping improve Career Compass. Here's everything you need to know.

---

## Types of contributions welcome

- **Professions** — adding or correcting entries in `professions.md` (the source of truth)
- **RIASEC weights** — improving edge weights in `data/riasec_edges.json`
- **Questions** — adding or improving test questions in `data/questions.json`
- **Bug fixes** — logic errors in JS files
- **UI/UX improvements** — layout, accessibility, mobile experience
- **Documentation** — clearer explanations, better guides

---

## Ground rules

- All data changes go through a PR — CI runs `validate_data.mjs` on every PR automatically
- Never commit `src/config.js` — it contains local Supabase keys and is gitignored
- No npm packages in the frontend — vanilla JS only
- No build step — the site must deploy as-is from the repo root
- Keep questions in simple English, suitable for a 14–16 year old Indian student

---

## How to update professions

1. Edit `professions.md` (the source of truth — not the JSON directly)
2. Run `node scripts/parse_professions.mjs` to regenerate `data/professions.json`
3. Run `node scripts/gen_riasec_edges.mjs` to regenerate `data/riasec_edges.json`
4. Run `node scripts/validate_data.mjs` — must pass all checks
5. Submit a PR — CI will re-validate automatically

---

## How to update RIASEC weights

Edit `data/riasec_edges.json` directly. Each profession's RIASEC weights must sum to `1.0 ± 0.01`. Run `node scripts/validate_data.mjs` before submitting your PR.

---

## How to update questions

Edit `data/questions.json` directly. Run `node scripts/validate_data.mjs` before submitting. Count constraints are enforced by CI:

- `personal_financial` — must stay at **10** questions
- `career_quick` — must stay at **10** questions
- `career_deep` — must stay at **25** questions

---

## PR checklist

```
- [ ] `node scripts/validate_data.mjs` passes locally
- [ ] `node --test src/match.test.mjs` passes (if match.js was changed)
- [ ] No `src/config.js` included in the PR
- [ ] Data changes are in git-tracked JSON/md files only
```

---

## Reporting bugs

Open a GitHub Issue using the Bug Report template and include:

- What you expected to happen
- What actually happened
- Your browser and device info
