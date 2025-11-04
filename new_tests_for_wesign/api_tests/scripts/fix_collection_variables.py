import json

collection_path = r'C:/Users/gals/Desktop/playwrightTestsClaude/new_tests_for_wesign/api_tests/DocumentCollection_Core_Tests.postman_collection.json'

print("Fixing collection variables...")

with open(collection_path, 'r', encoding='utf-8') as f:
    collection = json.load(f)

# Ensure baseUrl variable exists
has_base_url = any(v['key'] == 'baseUrl' for v in collection['variable'])
if not has_base_url:
    collection['variable'].insert(0, {"key": "baseUrl", "value": "https://devtest.comda.co.il/userapi"})
    print("✓ Added baseUrl variable")

# Ensure token variable exists
has_token = any(v['key'] == 'token' for v in collection['variable'])
if not has_token:
    collection['variable'].insert(1, {"key": "token", "value": ""})
    print("✓ Added token variable")

# Save
with open(collection_path, 'w', encoding='utf-8') as f:
    json.dump(collection, f, indent=2)

print()
print("Variables fixed! Collection ready for Newman.")
