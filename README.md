# Career Compass

**A free, browser-based career guidance tool for Indian Class 10 students**

[![Deploy](https://github.com/akshaynikhare/career-compass/actions/workflows/deploy.yml/badge.svg)](https://github.com/akshaynikhare/career-compass/actions/workflows/deploy.yml)
[![Validate Data](https://github.com/akshaynikhare/career-compass/actions/workflows/validate.yml/badge.svg)](https://github.com/akshaynikhare/career-compass/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live](https://img.shields.io/badge/Live-GitHub%20Pages-brightgreen)](https://akshaynikhare.github.io/career-compass/)

---

## What is Career Compass?

Career Compass is a free career guidance tool built specifically for Indian Class 10 students. No login, no app install, no fees — it works on cheap Android browsers out of the box.

Students take a 45-question test (10 background + 10 quick interests + 25 personality) and the browser maps their answers to 457 Indian professions using the **Holland RIASEC personality framework**. All computation runs entirely in the browser — no answers are ever sent to a server. Only the final RIASEC profile (plus name/email/phone for follow-up) is saved anonymously to Supabase.

**Key facts:**
- Free, no login required
- Works offline-capable on low-end Android devices
- 45 questions: 10 personal/financial background + 10 quick career interests + 25 deep RIASEC personality
- RIASEC framework maps personality to 457 Indian professions
- All scoring runs client-side — privacy-first
- Results saved anonymously to Supabase (RIASEC profile only, not raw answers)

---

## Live Demo

**https://akshaynikhare.github.io/career-compass/**

---

## How It Works

1. Student enters name, email, and phone number
2. Answers 10 personal/financial background questions (constraints like budget, location preference)
3. Answers 10 quick career interest questions (broad domain preferences)
4. Answers 25 deep RIASEC personality questions (the core psychometric test)
5. Browser computes a RIASEC score vector and filters professions by constraints
6. Top 10 career matches are displayed, plus 5 stretch goals
7. Result (RIASEC profile + student info) is saved anonymously to Supabase

---

## Data Files

All data files live in `data/` and are git-tracked. Changes go through PRs with CI validation.

| File | Description | Items |
|---|---|---|
| `data/questions.json` | 45 test questions (schema v2) | 10+10+25 |
| `data/professions.json` | Indian profession database | 457 |
| `data/riasec_edges.json` | RIASEC weight graph | 457 edges |
| `data/categories.json` | Category metadata | — |

---

## Project Structure

```
career-compass/
├── index.html          # Landing page
├── test.html           # 45-question test
├── result.html         # Results + save form
├── styles/main.css     # Mobile-first CSS
├── src/
│   ├── app.js          # Test state machine
│   ├── match.js        # RIASEC scoring + career matching
│   ├── render.js       # Results rendering
│   └── store.js        # Supabase save
├── data/               # Git-tracked JSON data
├── scripts/            # Data generation + validation scripts
│   ├── parse_professions.mjs
│   ├── gen_riasec_edges.mjs
│   └── validate_data.mjs
└── .github/workflows/
    ├── validate.yml    # CI on every PR
    └── deploy.yml      # GitHub Pages deploy on main
```

---

## Local Development

```bash
git clone https://github.com/akshaynikhare/career-compass.git
cd career-compass

# Create local Supabase config (gitignored)
echo "window.__CFG = { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' };" > src/config.js

# Serve locally
npx serve .
# or: python3 -m http.server 8080

# Validate data files
node scripts/validate_data.mjs

# Run matching engine tests
node --test src/match.test.mjs
```

---

## Deployment

See [docs/DEPLOY.md](docs/DEPLOY.md) for the full GitHub Pages + Supabase setup guide.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT — see [LICENSE](LICENSE).
