#!/usr/bin/env python3
"""
fix_riasec_vectors.py — Regenerates data/riasec_edges.json with unique,
profession-specific RIASEC vectors.

Three additive layers:
  1. Category base vector
  2. Keyword adjustments (profession name + summary, substring match)
  3. Deterministic noise from profession ID hash (guarantees uniqueness)

Usage: python3 scripts/fix_riasec_vectors.py
"""
import json
import hashlib
from pathlib import Path

ROOT = Path(__file__).parent.parent
DIMS = ['R', 'I', 'A', 'S', 'E', 'C']

# ── Layer 1: Category base vectors ────────────────────────────────────────────
# Values sourced from RIASEC literature and existing hand-tuned data.
# Each list is [R, I, A, S, E, C]; will be normalised later.
CATEGORY_BASE = {
    'Healthcare':                   [0.10, 0.40, 0.00, 0.40, 0.05, 0.05],
    'Technology':                   [0.20, 0.45, 0.10, 0.05, 0.10, 0.10],
    'Engineering':                  [0.35, 0.40, 0.05, 0.05, 0.10, 0.05],
    'Arts & Media':                 [0.05, 0.10, 0.55, 0.15, 0.10, 0.05],
    'Science & Research':           [0.10, 0.65, 0.05, 0.10, 0.05, 0.05],
    'Finance & Business':           [0.05, 0.20, 0.05, 0.10, 0.35, 0.25],
    'Finance — Specialized Niche':  [0.05, 0.30, 0.05, 0.05, 0.25, 0.30],
    'Education':                    [0.05, 0.20, 0.15, 0.45, 0.10, 0.05],
    'Law & Government':             [0.05, 0.25, 0.05, 0.20, 0.35, 0.10],
    'Agriculture & Environment':    [0.30, 0.30, 0.05, 0.20, 0.10, 0.05],
    'Social & Welfare':             [0.05, 0.15, 0.10, 0.55, 0.10, 0.05],
    'Sports & Fitness':             [0.45, 0.10, 0.10, 0.20, 0.10, 0.05],
    'Hospitality & Food':           [0.20, 0.05, 0.25, 0.35, 0.10, 0.05],
    'Transport & Logistics':        [0.35, 0.10, 0.05, 0.10, 0.15, 0.25],
    'Trades & Construction':        [0.55, 0.10, 0.10, 0.05, 0.10, 0.10],
    'Architecture & Design':        [0.15, 0.25, 0.40, 0.05, 0.10, 0.05],
    'Mental Health & Wellness':     [0.05, 0.25, 0.10, 0.50, 0.05, 0.05],
    'Public Health & Policy':       [0.05, 0.30, 0.05, 0.35, 0.15, 0.10],
    'Niche & Emerging Professions': [0.10, 0.30, 0.20, 0.15, 0.15, 0.10],
}

# ── Layer 2: Keyword adjustment rules ────────────────────────────────────────
# Matched via substring on lowercased (profession.name + " " + profession.summary).
# Multiple rules can fire and stack additively before normalisation.
# R=Realistic, I=Investigative, A=Artistic, S=Social, E=Enterprising, C=Conventional
KEYWORD_RULES = [
    # ── Engineering sub-types ────────────────────────────────────────────────
    {'terms': ['civil engineer', 'structural engineer', 'geotechnical'],
     'delta': {'R':+0.08, 'I':-0.05, 'A':-0.02, 'S':-0.03, 'E':-0.03, 'C':+0.05}},
    {'terms': ['electrical engineer', 'electronics engineer', 'power system', 'vlsi', 'rf microwave'],
     'delta': {'R':-0.03, 'I':+0.05, 'A':-0.03, 'S':-0.04, 'E':-0.03, 'C':+0.08}},
    {'terms': ['mechanical engineer', 'automotive engineer'],
     'delta': {'R':+0.08, 'I':-0.03, 'A':-0.02, 'S':-0.03, 'E': 0.00, 'C': 0.00}},
    {'terms': ['aerospace', 'aeronautical'],
     'delta': {'R':+0.03, 'I':+0.05, 'A':-0.03, 'S':-0.05, 'E': 0.00, 'C': 0.00}},
    {'terms': ['biomedical', 'bioprocess'],
     'delta': {'R':-0.07, 'I':+0.05, 'A':-0.03, 'S':+0.10, 'E':-0.02, 'C':-0.03}},
    {'terms': ['chemical engineer', 'polymer', 'petroleum engineer'],
     'delta': {'R':-0.03, 'I':+0.08, 'A':-0.03, 'S':-0.02, 'E': 0.00, 'C': 0.00}},
    {'terms': ['mining engineer', 'nuclear engineer'],
     'delta': {'R':+0.10, 'I':-0.03, 'A':-0.03, 'S':-0.02, 'E':-0.02, 'C': 0.00}},
    {'terms': ['marine engineer', 'naval architect'],
     'delta': {'R':+0.05, 'I':-0.03, 'A':+0.05, 'S':-0.04, 'E':-0.03, 'C': 0.00}},
    {'terms': ['mechatronics', 'robotic'],
     'delta': {'R':+0.03, 'I':-0.03, 'A':+0.08, 'S':-0.04, 'E':-0.04, 'C': 0.00}},
    {'terms': ['industrial engineer'],
     'delta': {'R':-0.05, 'I':-0.03, 'A':-0.02, 'S':-0.03, 'E':+0.08, 'C':+0.05}},
    {'terms': ['materials science engineer', 'metallurgist'],
     'delta': {'R':-0.02, 'I':+0.08, 'A':-0.02, 'S':-0.02, 'E': 0.00, 'C':-0.02}},
    {'terms': ['surveyor', 'geomatics'],
     'delta': {'R':+0.02, 'I':-0.03, 'A':-0.04, 'S':-0.02, 'E':-0.01, 'C':+0.08}},

    # ── Science & Research sub-types ─────────────────────────────────────────
    {'terms': ['biologist', 'molecular biolog', 'microbiologist', 'virologist', 'immunologist'],
     'delta': {'R':-0.02, 'I':+0.05, 'A': 0.00, 'S':+0.05, 'E':-0.04, 'C':-0.04}},
    {'terms': ['biochemist', 'pharmacognosist'],
     'delta': {'R':-0.02, 'I':+0.08, 'A': 0.00, 'S': 0.00, 'E':-0.04, 'C':-0.02}},
    {'terms': ['bioinformatician', 'biostatistician'],
     'delta': {'R':-0.02, 'I':+0.10, 'A': 0.00, 'S':-0.03, 'E':-0.02, 'C':-0.03}},
    {'terms': ['physicist', 'astrophysicist'],
     'delta': {'R':-0.02, 'I':+0.10, 'A':-0.02, 'S':-0.03, 'E':-0.02, 'C':-0.01}},
    {'terms': ['geologist', 'geophysicist', 'hydrogeologist', 'seismologist'],
     'delta': {'R':+0.10, 'I':+0.02, 'A':-0.03, 'S':-0.03, 'E':-0.03, 'C':-0.03}},
    {'terms': ['meteorologist', 'oceanographer', 'climate scientist'],
     'delta': {'R':-0.02, 'I':+0.03, 'A': 0.00, 'S':+0.05, 'E':-0.03, 'C':-0.03}},
    {'terms': ['ecologist', 'soil scientist'],
     'delta': {'R':+0.05, 'I': 0.00, 'A': 0.00, 'S':+0.08, 'E':-0.05, 'C':-0.08}},
    {'terms': ['epidemiologist'],
     'delta': {'R':-0.02, 'I':+0.05, 'A':-0.02, 'S':+0.05, 'E':-0.02, 'C':-0.04}},
    {'terms': ['archaeologist', 'anthropologist'],
     'delta': {'R':+0.05, 'I':-0.05, 'A':+0.05, 'S':+0.05, 'E':-0.05, 'C':-0.05}},
    {'terms': ['neuroscientist', 'geneticist', 'nanotechnologist', 'toxicologist'],
     'delta': {'R':-0.02, 'I':+0.08, 'A': 0.00, 'S': 0.00, 'E':-0.03, 'C':-0.03}},
    {'terms': ['astronomer', 'cosmologist'],
     'delta': {'R':-0.02, 'I':+0.12, 'A':-0.02, 'S':-0.04, 'E':-0.02, 'C':-0.02}},
    {'terms': ['materials scientist'],
     'delta': {'R':-0.02, 'I':+0.06, 'A':-0.02, 'S':-0.02, 'E': 0.00, 'C': 0.00}},

    # ── Healthcare sub-types ──────────────────────────────────────────────────
    {'terms': ['surgeon', 'surgery'],
     'delta': {'R':+0.15, 'I':+0.05, 'A': 0.00, 'S':-0.10, 'E': 0.00, 'C': 0.00}},
    {'terms': ['pathologist', 'radiologist', 'radiographer', 'laboratory technician'],
     'delta': {'R':-0.02, 'I':+0.10, 'A': 0.00, 'S':-0.08, 'E':-0.03, 'C':+0.03}},
    {'terms': ['physiotherapist', 'occupational therapist'],
     'delta': {'R':+0.05, 'I':-0.05, 'A': 0.00, 'S':+0.10, 'E':-0.05, 'C':-0.05}},
    {'terms': ['dentist', 'orthodontist', 'periodontist', 'endodontist'],
     'delta': {'R':+0.10, 'I':+0.02, 'A':-0.02, 'S':-0.05, 'E': 0.00, 'C':-0.05}},
    {'terms': ['pharmacist'],
     'delta': {'R':-0.02, 'I':+0.08, 'A':-0.02, 'S': 0.00, 'E':-0.02, 'C':+0.08}},
    {'terms': ['hospital administrator'],
     'delta': {'R':-0.03, 'I':-0.05, 'A': 0.00, 'S': 0.00, 'E':+0.15, 'C':+0.08}},
    {'terms': ['ayurvedic', 'homeopathic', 'naturopath'],
     'delta': {'R':-0.02, 'I':-0.02, 'A':+0.08, 'S':+0.05, 'E':-0.05, 'C':-0.04}},
    {'terms': ['audiologist', 'optometrist', 'dietitian'],
     'delta': {'R':-0.02, 'I':+0.05, 'A': 0.00, 'S':+0.08, 'E':-0.05, 'C':-0.06}},

    # ── Trades & Construction sub-types ───────────────────────────────────────
    {'terms': ['electrician', 'plumber', 'carpenter', 'welder', 'mason', 'pipefitter'],
     'delta': {'R':+0.05, 'I':-0.02, 'A':-0.02, 'S':-0.02, 'E': 0.00, 'C':+0.01}},
    {'terms': ['quantity surveyor', 'site supervisor', 'foreman'],
     'delta': {'R':-0.10, 'I':+0.02, 'A':-0.03, 'S': 0.00, 'E':+0.05, 'C':+0.06}},
    {'terms': ['fire protection'],
     'delta': {'R':-0.08, 'I':+0.05, 'A':-0.03, 'S': 0.00, 'E': 0.00, 'C':+0.06}},
    {'terms': ['painter'],
     'delta': {'R': 0.00, 'I':-0.02, 'A':+0.10, 'S':-0.02, 'E': 0.00, 'C':-0.06}},

    # ── General career type rules ─────────────────────────────────────────────
    {'terms': ['artist', 'designer', 'creative', 'animator', 'illustrator'],
     'delta': {'R': 0.00, 'I':-0.05, 'A':+0.20, 'S':-0.05, 'E': 0.00, 'C': 0.00}},
    {'terms': ['teacher', 'professor', 'lecturer', 'educator'],
     'delta': {'R': 0.00, 'I': 0.00, 'A':+0.05, 'S':+0.15, 'E':-0.05, 'C': 0.00}},
    {'terms': ['manager', 'director', 'executive', 'ceo', 'entrepreneur'],
     'delta': {'R': 0.00, 'I': 0.00, 'A': 0.00, 'S':-0.10, 'E':+0.20, 'C':+0.05}},
    {'terms': ['analyst', 'researcher', 'scientist', 'statistician'],
     'delta': {'R':-0.05, 'I':+0.20, 'A': 0.00, 'S': 0.00, 'E':-0.05, 'C': 0.00}},
    {'terms': ['data scientist', 'data analyst', 'data engineer'],
     'delta': {'R':-0.05, 'I':+0.15, 'A': 0.00, 'S':-0.05, 'E':-0.02, 'C':+0.07}},
    {'terms': ['accountant', 'auditor', 'compliance', 'clerk', 'administrator'],
     'delta': {'R': 0.00, 'I':+0.05, 'A': 0.00, 'S': 0.00, 'E':-0.10, 'C':+0.20}},
    {'terms': ['nurse', 'counsellor', 'social worker', 'psychologist'],
     'delta': {'R': 0.00, 'I':+0.05, 'A': 0.00, 'S':+0.20, 'E':-0.10, 'C': 0.00}},
    {'terms': ['pilot', 'driver', 'captain'],
     'delta': {'R':+0.15, 'I': 0.00, 'A': 0.00, 'S':-0.10, 'E': 0.00, 'C':+0.10}},
    {'terms': ['writer', 'journalist', 'author', 'editor'],
     'delta': {'R':-0.10, 'I':+0.05, 'A':+0.20, 'S': 0.00, 'E': 0.00, 'C': 0.00}},
    {'terms': ['lawyer', 'advocate', 'judge'],
     'delta': {'R':-0.10, 'I':+0.10, 'A': 0.00, 'S': 0.00, 'E':+0.15, 'C': 0.00}},
    {'terms': ['chef', 'cook', 'baker'],
     'delta': {'R':+0.10, 'I': 0.00, 'A':+0.15, 'S': 0.00, 'E': 0.00, 'C':+0.05}},
    {'terms': ['therapist'],
     'delta': {'R': 0.00, 'I':+0.05, 'A': 0.00, 'S':+0.20, 'E':-0.10, 'C': 0.00}},
]

NOISE_SCALE = 0.025


def id_noise(profession_id: str, dim_index: int) -> float:
    key = f'{profession_id}_{dim_index}'.encode()
    return (hashlib.md5(key).digest()[0] / 255.0) * NOISE_SCALE


def build_edge(profession: dict) -> dict:
    cat = profession['category']
    base = CATEGORY_BASE.get(cat)
    if base is None:
        raise ValueError(f'Unknown category "{cat}" for profession {profession["id"]}')

    v = dict(zip(DIMS, base[:]))  # copy

    # Layer 2: keyword adjustments
    text = (profession['name'] + ' ' + (profession.get('summary') or '')).lower()
    for rule in KEYWORD_RULES:
        if any(term in text for term in rule['terms']):
            for dim in DIMS:
                v[dim] += rule['delta'].get(dim, 0.0)

    # Layer 3: deterministic noise
    for i, dim in enumerate(DIMS):
        v[dim] += id_noise(profession['id'], i)

    # Clamp negatives
    for dim in DIMS:
        v[dim] = max(0.0, v[dim])

    # Normalise to sum = 1.0
    total = sum(v[d] for d in DIMS)
    if total == 0:
        raise ValueError(f'All-zero vector for {profession["id"]}')
    for dim in DIMS:
        v[dim] /= total

    # Round to 4dp and fix drift on largest dimension
    rounded = {d: round(v[d], 4) for d in DIMS}
    drift = round(1.0 - sum(rounded.values()), 4)
    if drift != 0:
        max_dim = max(rounded, key=rounded.get)
        rounded[max_dim] = round(rounded[max_dim] + drift, 4)

    return {'profession_id': profession['id'], **rounded}


def main():
    profs = json.loads((ROOT / 'data' / 'professions.json').read_text())
    edges = [build_edge(p) for p in profs['items']]

    output = {'schema_version': 1, 'edges': edges}
    (ROOT / 'data' / 'riasec_edges.json').write_text(
        json.dumps(output, indent=2), encoding='utf-8'
    )
    print(f'Written {len(edges)} edges to data/riasec_edges.json')

    # Validate uniqueness
    vecs = [tuple(e[d] for d in DIMS) for e in edges]
    unique = len(set(vecs))
    print(f'Unique vectors: {unique}/{len(edges)}')
    assert unique == len(edges), f'Duplicate vectors found! ({len(edges) - unique} duplicates)'

    # Validate sums
    for e in edges:
        s = sum(e[d] for d in DIMS)
        assert abs(s - 1.0) < 0.001, f'Vector sum {s:.6f} != 1.0 for {e["profession_id"]}'

    print('All assertions passed.')

    # Print sample comparison (Engineering — was all identical)
    print('\nEngineering sample (first 5):')
    pid_map = {p['id']: p for p in profs['items']}
    eng = [e for e in edges if pid_map[e['profession_id']]['category'] == 'Engineering'][:5]
    for e in eng:
        print(f'  {pid_map[e["profession_id"]]["name"][:35]:<35}  '
              f'R={e["R"]:.3f} I={e["I"]:.3f} A={e["A"]:.3f} '
              f'S={e["S"]:.3f} E={e["E"]:.3f} C={e["C"]:.3f}')


if __name__ == '__main__':
    main()
