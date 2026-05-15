# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [1.0.0] - 2026-05-15

### Added
- Initial release
- 45-question RIASEC career test (10 personal/financial + 10 quick + 25 deep)
- 457 Indian professions parsed from reference database
- RIASEC edge graph for career-personality matching
- Browser-side matching engine with constraint filtering
- 3-page vanilla JS UI: landing, test, results
- Student info collection (name/email/phone) before test
- sessionStorage data caching (no re-fetch on retake)
- Retake test with full state reset
- Anonymous result storage in Supabase (profile only, no raw answers)
- GitHub Actions: CI validation (21 checks) + GitHub Pages deploy
- Deployment guide in docs/DEPLOY.md
