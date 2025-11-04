import json

# Read the collection
with open('C:/Users/gals/Desktop/playwrightTestsClaude/new_tests_for_wesign/api_tests/DocumentCollections_Expansion_Tests.postman_collection.json', 'r', encoding='utf-8') as f:
    collection = json.load(f)

print("Applying fixes to DocumentCollections collection...")
print()

# Find and fix the template upload test
for phase in collection['item']:
    if phase['name'] == 'Phase 3: Document Creation':
        for test in phase['item']:
            # Fix 1: Template Upload - Add data URI prefix
            if test['name'] == 'Upload Template for Testing':
                body_str = test['request']['body']['raw']
                body_json = json.loads(body_str)

                old_data = body_json['files'][0]['data']
                if not old_data.startswith('data:'):
                    print("✓ Fix 1: Adding data URI prefix to template upload")
                    body_json['files'][0]['data'] = f"data:application/pdf;base64,{old_data}"
                    test['request']['body']['raw'] = json.dumps(body_json, indent=2)
                    print(f"  Changed PDF data from base64 to data URI format")
                    print()

            # Fix 2: First Document Collection - Add required fields
            elif test['name'] == 'Create Document Collection with Fields':
                body_str = test['request']['body']['raw']
                body_json = json.loads(body_str)

                print("✓ Fix 2: Updating first document collection creation")
                # Change field names and structure
                body_json['documentName'] = body_json.pop('name')
                body_json['documentMode'] = 3  # Online mode

                # Change sourceTemplateId to templates array
                template_id = body_json.pop('sourceTemplateId')
                body_json['templates'] = [{"id": template_id}]

                # Fix signers format
                for signer in body_json['signers']:
                    signer['contactName'] = signer.pop('name')
                    signer['contactMeans'] = signer.pop('email')

                test['request']['body']['raw'] = json.dumps(body_json, indent=2)
                print(f"  - Changed 'name' to 'documentName'")
                print(f"  - Added 'documentMode': 3")
                print(f"  - Changed 'sourceTemplateId' to 'templates' array")
                print(f"  - Fixed signers: contactName + contactMeans")
                print()

            # Fix 3: Second Document Collection - Add required fields
            elif test['name'] == 'Create Second Document Collection':
                body_str = test['request']['body']['raw']
                body_json = json.loads(body_str)

                print("✓ Fix 3: Updating second document collection creation")
                # Change field names and structure
                body_json['documentName'] = body_json.pop('name')
                body_json['documentMode'] = 3  # Online mode

                # Change sourceTemplateId to templates array
                template_id = body_json.pop('sourceTemplateId')
                body_json['templates'] = [{"id": template_id}]

                # Fix signers format
                for signer in body_json['signers']:
                    signer['contactName'] = signer.pop('name')
                    # Use phone as contactMeans for SMS (sendingMethod: 1)
                    if 'phone' in signer:
                        signer['contactMeans'] = signer.pop('phone')
                    elif 'email' in signer:
                        signer['contactMeans'] = signer.pop('email')

                test['request']['body']['raw'] = json.dumps(body_json, indent=2)
                print(f"  - Changed 'name' to 'documentName'")
                print(f"  - Added 'documentMode': 3")
                print(f"  - Changed 'sourceTemplateId' to 'templates' array")
                print(f"  - Fixed signers: contactName + contactMeans (phone)")
                print()

# Save the modified collection
with open('C:/Users/gals/Desktop/playwrightTestsClaude/new_tests_for_wesign/api_tests/DocumentCollections_Expansion_Tests.postman_collection.json', 'w', encoding='utf-8') as f:
    json.dump(collection, f, indent='\t', ensure_ascii=False)

print("="*80)
print("All fixes applied successfully!")
print("="*80)
print()
print("Summary of changes:")
print("1. Template upload: Added data:application/pdf;base64 prefix")
print("2. Document collection #1: Added documentName, documentMode, templates array, fixed signers")
print("3. Document collection #2: Added documentName, documentMode, templates array, fixed signers")
print()
print("Expected impact: 33.3% → 70%+ (12+ test fixes)")
