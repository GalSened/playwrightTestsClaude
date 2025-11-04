import json

# Read the collection
with open('C:/Users/gals/Desktop/playwrightTestsClaude/new_tests_for_wesign/api_tests/DocumentCollections_Expansion_Tests.postman_collection.json', 'r', encoding='utf-8') as f:
    collection = json.load(f)

print("Applying fix v2 to DocumentCollections collection...")
print()

# Find and fix the document creation tests
for phase in collection['item']:
    if phase['name'] == 'Phase 3: Document Creation':
        for test in phase['item']:
            # Fix: Change templates from array of objects to array of strings
            if test['name'] in ['Create Document Collection with Fields', 'Create Second Document Collection']:
                body_str = test['request']['body']['raw']
                body_json = json.loads(body_str)

                print(f"✓ Fixing: {test['name']}")
                # Change templates array format
                if 'templates' in body_json:
                    # Extract the ID from the object and make it just a string in array
                    template_id = body_json['templates'][0]['id']
                    body_json['templates'] = [template_id]  # Array of strings, not objects

                    test['request']['body']['raw'] = json.dumps(body_json, indent=2)
                    print(f"  Changed templates from [{{id:'...'}}] to ['...']")
                    print()

# Save the modified collection
with open('C:/Users/gals/Desktop/playwrightTestsClaude/new_tests_for_wesign/api_tests/DocumentCollections_Expansion_Tests.postman_collection.json', 'w', encoding='utf-8') as f:
    json.dump(collection, f, indent='\t', ensure_ascii=False)

print("="*80)
print("Fix v2 applied successfully!")
print("="*80)
print()
print("Changed templates array from:")
print('  [{"id": "{{testTemplateId}}"}]')
print("To:")
print('  ["{{testTemplateId}}"]')
