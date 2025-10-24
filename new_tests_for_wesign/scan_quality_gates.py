import os
import re
import json

violations = {
    'time_sleep': [],
    'missing_expect': []
}

total_files = 0

for root, dirs, files in os.walk('.'):
    for file in files:
        if file.endswith('.py') and file.startswith('test_'):
            filepath = os.path.join(root, file).replace('\\', '/')
            total_files += 1

            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    lines = content.split('\n')

                    # Check for time.sleep (anti-pattern)
                    for i, line in enumerate(lines, 1):
                        if 'time.sleep' in line and not line.strip().startswith('#'):
                            violations['time_sleep'].append({
                                'file': filepath.replace('./', ''),
                                'line': i,
                                'code': line.strip()[:80]
                            })

                    # Check for missing expect() calls (weak assertions)
                    if 'def test_' in content:
                        # Count expect() calls
                        expect_count = len(re.findall(r'expect\(', content))
                        test_count = len(re.findall(r'def test_', content))

                        # If less than 0.5 expect per test on average, flag it
                        if test_count > 0 and (expect_count / test_count) < 0.5:
                            violations['missing_expect'].append({
                                'file': filepath.replace('./', ''),
                                'tests': test_count,
                                'expects': expect_count,
                                'ratio': round(expect_count / test_count, 2)
                            })
            except Exception as e:
                print(f'Error reading {filepath}: {e}')

print(f'Quality Gates Scan Results ({total_files} files scanned):')
print(f'\nViolation: time.sleep() usage (should use expect with timeout)')
print(f'  Found {len(violations["time_sleep"])} instances')
for v in violations['time_sleep'][:10]:
    print(f'    {v["file"]}:{v["line"]} - {v["code"]}')
if len(violations['time_sleep']) > 10:
    print(f'    ... and {len(violations["time_sleep"]) - 10} more')

print(f'\nViolation: Low expect() usage (weak assertions)')
print(f'  Found {len(violations["missing_expect"])} files with <0.5 expect/test ratio')
for v in violations['missing_expect'][:5]:
    print(f'    {v["file"]}: {v["expects"]}/{v["tests"]} tests = {v["ratio"]} expects/test')

output = {
    'total_files_scanned': total_files,
    'violations': violations,
    'summary': {
        'time_sleep_count': len(violations['time_sleep']),
        'low_expect_files': len(violations['missing_expect'])
    }
}

with open('../qa_intel/quality_gates_violations.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2)

print(f'\nSaved to qa_intel/quality_gates_violations.json')
