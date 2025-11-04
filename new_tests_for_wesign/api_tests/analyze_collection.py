import json
import sys

# Read the Postman collection
with open(r'C:\Users\gals\Desktop\playwrightTestsClaude\new_tests_for_wesign\api_tests\WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json', 'r', encoding='utf-8') as f:
    collection = json.load(f)

print("=" * 80)
print("WESIGN API TEST COLLECTION ANALYSIS")
print("=" * 80)
print(f"\nCollection Name: {collection['info']['name']}")
print(f"Description: {collection['info']['description']}")
print(f"\nTotal Top-Level Folders: {len(collection['item'])}")

# Variables
print(f"\nVariables Defined: {len(collection.get('variable', []))}")
for var in collection.get('variable', [])[:10]:  # Show first 10
    print(f"  - {var['key']}: {var.get('description', 'No description')}")

# Module analysis
print("\n" + "=" * 80)
print("MODULE BREAKDOWN")
print("=" * 80)

total_tests = 0
modules = {}

for i, folder in enumerate(collection['item'], 1):
    folder_name = folder['name']
    tests_in_folder = len(folder.get('item', []))
    total_tests += tests_in_folder

    # Extract module name (before " - Phase")
    module_name = folder_name.split(' - Phase')[0] if ' - Phase' in folder_name else folder_name.split(' - ')[0]

    if module_name not in modules:
        modules[module_name] = {'phases': [], 'total_tests': 0}

    modules[module_name]['phases'].append({
        'name': folder_name,
        'test_count': tests_in_folder
    })
    modules[module_name]['total_tests'] += tests_in_folder

print(f"\nTotal Unique Modules: {len(modules)}")
print(f"Total Tests Across All Modules: {total_tests}")

for module_name, module_data in modules.items():
    print(f"\n{module_name.upper()}")
    print(f"  Phases: {len(module_data['phases'])}")
    print(f"  Total Tests: {module_data['total_tests']}")
    for phase in module_data['phases'][:3]:  # Show first 3 phases
        print(f"    - {phase['name']}: {phase['test_count']} tests")
    if len(module_data['phases']) > 3:
        print(f"    ... and {len(module_data['phases']) - 3} more phases")

# Sample test analysis
print("\n" + "=" * 80)
print("SAMPLE TEST STRUCTURE ANALYSIS")
print("=" * 80)

# Get first test from first folder
if collection['item'] and collection['item'][0].get('item'):
    first_test = collection['item'][0]['item'][0]
    print(f"\nSample Test: {first_test['name']}")
    print(f"HTTP Method: {first_test['request']['method']}")
    print(f"URL: {first_test['request']['url'].get('raw', 'N/A')}")

    # Check for test scripts
    if first_test.get('event'):
        for event in first_test['event']:
            if event['listen'] == 'test':
                script_lines = event['script'].get('exec', [])
                print(f"\nTest Assertions Found: {len([line for line in script_lines if 'pm.test' in line])}")
                print("Sample Assertions:")
                for line in script_lines[:5]:
                    if 'pm.test' in line:
                        print(f"  {line.strip()}")

print("\n" + "=" * 80)
