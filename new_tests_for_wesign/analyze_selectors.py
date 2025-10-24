import json
import re

# Load extracted selectors
with open('../qa_intel/_selectors_raw.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Categorize selectors by stability
stable_selectors = []  # get_by_role, get_by_label, get_by_test_id
brittle_selectors = []  # CSS with classes, complex XPath-like patterns
moderate_selectors = []  # Simple CSS, get_by_text

brittleness_scores = []

for filepath, file_selectors in data['selectors'].items():
    for sel in file_selectors:
        method = sel['method']
        value = sel['value']

        # Score brittleness (0 = stable, 10 = extremely brittle)
        score = 0
        category = 'stable'
        alternatives = []

        if method == 'get_by_role':
            score = 1
            category = 'stable'
        elif method == 'get_by_label':
            score = 1
            category = 'stable'
        elif method == 'get_by_test_id':
            score = 1
            category = 'stable'
        elif method == 'get_by_placeholder':
            score = 2
            category = 'stable'
        elif method == 'get_by_text':
            score = 4
            category = 'moderate'
            alternatives.append(f'get_by_role with name="{value}"')
        elif method in ['locator_css', 'query_selector']:
            # Analyze CSS selector complexity
            if re.search(r'\[class\*=', value) or re.search(r'\[class\^=', value):
                score = 9
                category = 'brittle'
                alternatives.append('Use data-testid attribute')
            elif re.search(r'\.\w+', value):  # Class selectors
                score = 7
                category = 'brittle'
                alternatives.append('get_by_role or data-testid')
            elif '>' in value or '+' in value or '~' in value:  # Combinators
                score = 8
                category = 'brittle'
                alternatives.append('Simpler selector or data-testid')
            elif re.search(r':\w+\(', value):  # Pseudo-classes with functions
                score = 6
                category = 'brittle'
            elif value.startswith('#'):  # ID selector
                score = 3
                category = 'moderate'
            elif re.match(r'^[a-z]+$', value):  # Simple tag selector
                score = 5
                category = 'moderate'
                alternatives.append(f'get_by_role("{value}")')
            else:
                score = 7
                category = 'brittle'

        entry = {
            'file': sel['file'],
            'method': method,
            'value': value,
            'score': score,
            'category': category,
            'alternatives': alternatives
        }

        brittleness_scores.append(entry)

        if category == 'stable':
            stable_selectors.append(entry)
        elif category == 'moderate':
            moderate_selectors.append(entry)
        else:
            brittle_selectors.append(entry)

# Calculate statistics
total = len(brittleness_scores)
stable_pct = (len(stable_selectors) / total * 100) if total else 0
moderate_pct = (len(moderate_selectors) / total * 100) if total else 0
brittle_pct = (len(brittle_selectors) / total * 100) if total else 0

print(f'Selector Stability Analysis:')
print(f'  Total selectors analyzed: {total}')
print(f'  Stable (score 0-2): {len(stable_selectors)} ({stable_pct:.1f}%)')
print(f'  Moderate (score 3-5): {len(moderate_selectors)} ({moderate_pct:.1f}%)')
print(f'  Brittle (score 6-10): {len(brittle_selectors)} ({brittle_pct:.1f}%)')

# Top 20 most brittle selectors
print(f'\nTop 20 most brittle selectors:')
sorted_brittle = sorted(brittleness_scores, key=lambda x: x['score'], reverse=True)[:20]
for i, sel in enumerate(sorted_brittle, 1):
    print(f'{i}. [{sel["score"]}/10] {sel["method"]}: "{sel["value"][:80]}"')
    if sel['alternatives']:
        print(f'    Alternative: {sel["alternatives"][0]}')

# Group brittle selectors by file
brittle_by_file = {}
for sel in brittle_selectors:
    brittle_by_file.setdefault(sel['file'], []).append(sel)

print(f'\nFiles with most brittle selectors:')
for file, sels in sorted(brittle_by_file.items(), key=lambda x: len(x[1]), reverse=True)[:10]:
    print(f'  {file}: {len(sels)} brittle selectors')

# Save analysis
output = {
    'summary': {
        'total': total,
        'stable': len(stable_selectors),
        'moderate': len(moderate_selectors),
        'brittle': len(brittle_selectors),
        'stable_pct': round(stable_pct, 2),
        'moderate_pct': round(moderate_pct, 2),
        'brittle_pct': round(brittle_pct, 2)
    },
    'top_20_brittle': sorted_brittle,
    'brittle_by_file': {k: len(v) for k, v in brittle_by_file.items()},
    'all_scores': brittleness_scores
}

with open('../qa_intel/selector_stability_analysis.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2)

print(f'\nSaved analysis to qa_intel/selector_stability_analysis.json')

# Generate recommendations
recommendations = []
for file, sels in sorted(brittle_by_file.items(), key=lambda x: len(x[1]), reverse=True)[:5]:
    recommendations.append({
        'file': file,
        'brittle_count': len(sels),
        'top_issues': [{'selector': s['value'][:80], 'alternative': s['alternatives'][0] if s['alternatives'] else 'Use web-first locators'} for s in sels[:3]]
    })

print(f'\nTop 5 files needing refactoring:')
for rec in recommendations:
    print(f'\n{rec["file"]} ({rec["brittle_count"]} brittle selectors)')
    for issue in rec['top_issues']:
        print(f'  - "{issue["selector"]}" -> {issue["alternative"]}')
