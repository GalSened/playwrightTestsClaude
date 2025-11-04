import re

# Read the full test output
with open('C:/Users/gals/Desktop/playwrightTestsClaude/new_tests_for_wesign/api_tests/newman_all_tests_output.txt', 'r', encoding='utf-8') as f:
    content = f.read()

# Find all module sections
module_pattern = r'Running: (\w+)'
modules = re.findall(module_pattern, content)

# Find assertion results
assertion_pattern = r'│\s+assertions\s+│\s+(\d+)\s+│\s+(\d+)\s+│'
assertions = re.findall(assertion_pattern, content)

# Find request results
request_pattern = r'│\s+requests\s+│\s+(\d+)\s+│\s+(\d+)\s+│'
requests = re.findall(request_pattern, content)

print("=" * 80)
print("WeSign API Tests - Phase 4 Complete - All Modules Summary")
print("=" * 80)
print()

if len(modules) == len(assertions) == len(requests):
    total_assertions_passed = 0
    total_assertions = 0
    total_requests_passed = 0
    total_requests = 0

    results = []

    for i, module in enumerate(modules):
        req_total = int(requests[i][0])
        req_failed = int(requests[i][1])
        req_passed = req_total - req_failed

        ass_total = int(assertions[i][0])
        ass_failed = int(assertions[i][1])
        ass_passed = ass_total - ass_failed

        total_requests += req_total
        total_requests_passed += req_passed
        total_assertions += ass_total
        total_assertions_passed += ass_passed

        req_rate = (req_passed / req_total * 100) if req_total > 0 else 0
        ass_rate = (ass_passed / ass_total * 100) if ass_total > 0 else 0

        status = "✅" if ass_failed == 0 else ("⚠️" if ass_rate >= 80 else "❌")

        results.append({
            'module': module,
            'status': status,
            'req_passed': req_passed,
            'req_total': req_total,
            'req_rate': req_rate,
            'ass_passed': ass_passed,
            'ass_total': ass_total,
            'ass_rate': ass_rate,
            'ass_failed': ass_failed
        })

    # Sort by pass rate (best first)
    results.sort(key=lambda x: x['ass_rate'], reverse=True)

    for r in results:
        print(f"{r['status']} {r['module']}")
        print(f"   Requests:   {r['req_passed']}/{r['req_total']} ({r['req_rate']:.1f}%)")
        print(f"   Assertions: {r['ass_passed']}/{r['ass_total']} ({r['ass_rate']:.1f}%) - {r['ass_failed']} failures")
        print()

    print("=" * 80)
    print("OVERALL SUMMARY - AFTER PHASE 4 FIXES")
    print("=" * 80)
    total_req_rate = (total_requests_passed / total_requests * 100) if total_requests > 0 else 0
    total_ass_rate = (total_assertions_passed / total_assertions * 100) if total_assertions > 0 else 0

    print(f"Total Modules:     {len(modules)}")
    print(f"Total Requests:    {total_requests_passed}/{total_requests} ({total_req_rate:.1f}%)")
    print(f"Total Assertions:  {total_assertions_passed}/{total_assertions} ({total_ass_rate:.1f}%)")
    print()

    # Compare with Phase 3
    phase3_rate = 73.9
    improvement = total_ass_rate - phase3_rate

    print(f"Phase 3 Overall:   73.9% (153/207 assertions)")
    print(f"Phase 4 Overall:   {total_ass_rate:.1f}% ({total_assertions_passed}/{total_assertions} assertions)")
    print(f"Improvement:       {improvement:+.1f} percentage points")
    print()

    # Module breakdown
    excellent = sum(1 for r in results if r['ass_rate'] >= 90)
    good = sum(1 for r in results if 70 <= r['ass_rate'] < 90)
    needs_work = sum(1 for r in results if r['ass_rate'] < 70)

    print("Module Quality Distribution:")
    print(f"  ✅ Excellent (≥90%):  {excellent} modules")
    print(f"  ⚠️  Good (70-89%):     {good} modules")
    print(f"  ❌ Needs Work (<70%):  {needs_work} modules")

else:
    print(f"Warning: Found {len(modules)} modules, {len(assertions)} assertion results, {len(requests)} request results")
    print("Counts don't match - manual review needed")
