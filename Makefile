.PHONY: help validate test gen-edges serve clean

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "  validate   Validate data files (questions, professions, edges)"
	@echo "  test       Run unit tests (src/match.test.mjs)"
	@echo "  gen-edges  Regenerate data/riasec_edges.json"
	@echo "  serve      Serve the app locally on port 8080"
	@echo "  clean      Remove generated data files"

validate:
	node scripts/validate_data.mjs

test:
	node --test src/match.test.mjs

gen-edges:
	node scripts/gen_riasec_edges.mjs

serve:
	npx --yes serve . -p 8080

clean:
	rm -f data/riasec_edges.json
