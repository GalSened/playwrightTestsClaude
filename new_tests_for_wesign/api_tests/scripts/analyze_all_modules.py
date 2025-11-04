import re

# Read the full test output
with open('C:/Users/gals/Desktop/playwrightTestsClaude/new_tests_for_wesign/api_tests/newman_phase3_all_modules.txt', 'r', encoding='utf-8') as f:
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

print("="*80)
print("WeSign API Tests - All Modules Summary")
print("="*80)
print()

# Combine results
if len(modules) == len(assertions) == len(requests):
    total_assertions_passed = 0
    total_assertions = 0
    total_requests_passed = 0
    total_requests = 0
    
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
        
        status = "✅" if ass_failed == 0 else "⚠️"
        
        print(f"{status} {module}")
        print(f"   Requests: {req_passed}/{req_total} ({req_rate:.1f}%)")
        print(f"   Assertions: {ass_passed}/{ass_total} ({ass_rate:.1f}%)")
        print()
    
    print("="*80)
    print("OVERALL SUMMARY")
    print("="*80)
    total_req_rate = (total_requests_passed / total_requests * 100) if total_requests > 0 else 0
    total_ass_rate = (total_assertions_passed / total_assertions * 100) if total_assertions > 0 else 0
    
    print(f"Total Modules: {len(modules)}")
    print(f"Total Requests: {total_requests_passed}/{total_requests} ({total_req_rate:.1f}%)")
    print(f"Total Assertions: {total_assertions_passed}/{total_assertions} ({total_ass_rate:.1f}%)")
    print()
    print(f"Overall Success Rate: {total_ass_rate:.1f}%")
else:
    print(f"Found {len(modules)} modules, {len(assertions)} assertion results, {len(requests)} request results")
    print("Counts don't match - may need manual review")
