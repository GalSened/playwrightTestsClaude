import json

with open('C:/Users/gals/Desktop/playwrightTestsClaude/new_tests_for_wesign/api_tests/newman_debug_documentcollections.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("="*80)
print("DocumentCollections Module - Detailed Error Analysis")
print("="*80)
print()

failing_tests = []
passing_tests = []

# Analyze all test executions
for execution in data.get('run', {}).get('executions', []):
    item_name = execution.get('item', {}).get('name', '')
    request = execution.get('request', {})
    response = execution.get('response', {})
    code = response.get('code', 0)
    method = request.get('method', 'N/A')

    # Check if any assertion failed
    failed_assertions = []
    passed_assertions = []
    for assertion in execution.get('assertions', []):
        if assertion.get('error'):
            failed_assertions.append(assertion.get('assertion', 'Unknown assertion'))
        else:
            passed_assertions.append(assertion.get('assertion', 'Unknown assertion'))

    # Decode response body if present
    error_msg = ""
    stream = response.get('stream', {})
    if stream and isinstance(stream, dict) and 'data' in stream:
        try:
            byte_data = stream['data']
            decoded = ''.join([chr(b) for b in byte_data])
            try:
                error_json = json.loads(decoded)
                if 'errors' in error_json:
                    error_msg = str(error_json['errors'])
                elif 'title' in error_json:
                    error_msg = error_json['title']
                else:
                    error_msg = decoded[:200]
            except json.JSONDecodeError:
                error_msg = decoded[:200]
        except Exception as e:
            error_msg = f"Decode error: {str(e)}"

    test_info = {
        'name': item_name,
        'method': method,
        'code': code,
        'status': response.get('status', 'N/A'),
        'error': error_msg,
        'failed_assertions': failed_assertions,
        'passed_assertions': passed_assertions
    }

    if failed_assertions or code >= 400:
        failing_tests.append(test_info)
    else:
        passing_tests.append(test_info)

print(f"Summary: {len(passing_tests)} passing, {len(failing_tests)} failing")
print()

# Show passing tests first (brief)
if passing_tests:
    print("✅ PASSING TESTS:")
    for test in passing_tests:
        print(f"  ✓ {test['name']} - {test['code']} {test['status']}")
    print()

# Show failing tests in detail
if failing_tests:
    print("❌ FAILING TESTS (Detailed):")
    print()

    for i, test in enumerate(failing_tests, 1):
        print(f"{i}. {test['name']}")
        print(f"   Method: {test['method']}")
        print(f"   Status: {test['code']} {test['status']}")

        if test['error']:
            print(f"   Error: {test['error']}")

        if test['failed_assertions']:
            print(f"   Failed Assertions ({len(test['failed_assertions'])}):")
            for assertion in test['failed_assertions']:
                print(f"     • {assertion}")

        if test['passed_assertions']:
            print(f"   Passed Assertions ({len(test['passed_assertions'])}):")
            for assertion in test['passed_assertions'][:3]:  # Show first 3
                print(f"     ✓ {assertion}")

        print()

# Group by error type
print("="*80)
print("ERROR PATTERN ANALYSIS:")
print("="*80)
print()

error_patterns = {}
for test in failing_tests:
    error_key = test['error'][:100] if test['error'] else f"HTTP {test['code']}"
    if error_key not in error_patterns:
        error_patterns[error_key] = []
    error_patterns[error_key].append(test['name'])

for i, (pattern, tests) in enumerate(error_patterns.items(), 1):
    print(f"{i}. Pattern: {pattern}")
    print(f"   Affected tests ({len(tests)}):")
    for test_name in tests:
        print(f"     - {test_name}")
    print()

# Statistics
print("="*80)
print("STATISTICS:")
print("="*80)
total_assertions = sum(len(t['failed_assertions']) + len(t['passed_assertions']) for t in failing_tests + passing_tests)
failed_assertions = sum(len(t['failed_assertions']) for t in failing_tests)
passed_assertions = sum(len(t['passed_assertions']) for t in passing_tests + failing_tests)

print(f"Total Tests: {len(failing_tests) + len(passing_tests)}")
print(f"Passing: {len(passing_tests)} ({len(passing_tests)/(len(failing_tests)+len(passing_tests))*100:.1f}%)")
print(f"Failing: {len(failing_tests)} ({len(failing_tests)/(len(failing_tests)+len(passing_tests))*100:.1f}%)")
print()
print(f"Total Assertions: {total_assertions}")
print(f"Passed: {passed_assertions} ({passed_assertions/total_assertions*100:.1f}%)" if total_assertions > 0 else "Passed: 0")
print(f"Failed: {failed_assertions} ({failed_assertions/total_assertions*100:.1f}%)" if total_assertions > 0 else "Failed: 0")
