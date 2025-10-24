import os
import re
import json
from collections import Counter

# Patterns to extract Playwright locators
patterns = {
    'get_by_role': r'get_by_role\(["\']([^"\']+)["\']',
    'get_by_label': r'get_by_label\(["\']([^"\']+)["\']',
    'get_by_placeholder': r'get_by_placeholder\(["\']([^"\']+)["\']',
    'get_by_text': r'get_by_text\(["\']([^"\']+)["\']',
    'get_by_title': r'get_by_title\(["\']([^"\']+)["\']',
    'get_by_test_id': r'get_by_test_id\(["\']([^"\']+)["\']',
    'get_by_alt_text': r'get_by_alt_text\(["\']([^"\']+)["\']',
    'locator_css': r'locator\(["\']([^"\']+)["\']',
    'query_selector': r'query_selector\(["\']([^"\']+)["\']',
}

selectors = {}
file_stats = {}
total_count = 0
method_counts = Counter()

# Walk through all Python test files
for root, dirs, files in os.walk('.'):
    for file in files:
        if file.endswith('.py') and (file.startswith('test_') or 'test' in file):
            filepath = os.path.join(root, file)

            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                    file_selectors = []
                    for method, pattern in patterns.items():
                        matches = re.findall(pattern, content)
                        for match in matches:
                            file_selectors.append({
                                'method': method,
                                'value': match,
                                'file': filepath.replace('.\\', '').replace('\\', '/')
                            })
                            total_count += 1
                            method_counts[method] += 1

                    if file_selectors:
                        file_stats[filepath] = len(file_selectors)
                        selectors.setdefault(filepath, []).extend(file_selectors)
            except Exception as e:
                print(f'Error reading {filepath}: {e}')

print(f'Extracted {total_count} selectors from {len(file_stats)} files')
print(f'\nSelector method distribution:')
for method, count in method_counts.most_common():
    print(f'  {method}: {count}')

print(f'\nTop 10 files by selector count:')
for file, count in sorted(file_stats.items(), key=lambda x: x[1], reverse=True)[:10]:
    print(f'  {file}: {count} selectors')

# Create unique selectors list
unique_selectors = set()
for file_sels in selectors.values():
    for sel in file_sels:
        unique_selectors.add((sel['method'], sel['value']))

print(f'\nUnique selectors: {len(unique_selectors)}')

# Save raw selectors
output = {
    'total_occurrences': total_count,
    'unique_selectors': len(unique_selectors),
    'files_scanned': len(file_stats),
    'by_method': dict(method_counts),
    'by_file': file_stats,
    'selectors': selectors
}

with open('../qa_intel/_selectors_raw.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2)

print('\nSaved to qa_intel/_selectors_raw.json')
