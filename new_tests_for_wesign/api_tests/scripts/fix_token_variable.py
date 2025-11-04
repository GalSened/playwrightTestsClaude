import json

collection_path = r'C:/Users/gals/Desktop/playwrightTestsClaude/new_tests_for_wesign/api_tests/DocumentCollection_Core_Tests.postman_collection.json'

print("Fixing token variable in comprehensive tests...")

with open(collection_path, 'r', encoding='utf-8') as f:
    collection = json.load(f)

# Fix all requests that use {{token}} to use {{jwtToken}} instead
fixed_count = 0

for folder in collection['item']:
    folder_name = folder['name']

    # Only fix Phase 4-10 (the new comprehensive tests)
    if any(phase in folder_name for phase in ['Phase 4:', 'Phase 5:', 'Phase 6:', 'Phase 7:', 'Phase 8:', 'Phase 9:', 'Phase 10:']):
        for item in folder.get('item', []):
            if 'request' in item and 'header' in item['request']:
                for header in item['request']['header']:
                    if header.get('key') == 'Authorization' and '{{token}}' in header.get('value', ''):
                        old_value = header['value']
                        header['value'] = header['value'].replace('{{token}}', '{{jwtToken}}')
                        print(f"✓ Fixed '{item['name'][:50]}...' authorization header")
                        fixed_count += 1
                        break

# Save the fixed collection
with open(collection_path, 'w', encoding='utf-8') as f:
    json.dump(collection, f, indent=2)

print()
print(f"✅ Fixed {fixed_count} authorization headers")
print("All tests now use {{jwtToken}} consistently")
