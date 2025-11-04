import json

collection_path = r'C:/Users/gals/Desktop/playwrightTestsClaude/new_tests_for_wesign/api_tests/DocumentCollection_Core_Tests.postman_collection.json'

print("Removing hardcoded credentials from collection...")

with open(collection_path, 'r', encoding='utf-8') as f:
    collection = json.load(f)

# Remove hardcoded login credentials - they should come from environment
removed = []
for var in list(collection['variable']):
    if var['key'] in ['loginEmail', 'loginPassword']:
        collection['variable'].remove(var)
        removed.append(var['key'])
        print(f"✓ Removed hardcoded: {var['key']}")

# Save
with open(collection_path, 'w', encoding='utf-8') as f:
    json.dump(collection, f, indent=2)

print()
print("✅ Credentials removed - will use environment variables")
print("Removed:", removed)
