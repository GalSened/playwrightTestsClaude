import json

with open('C:/Users/gals/Desktop/playwrightTestsClaude/new_tests_for_wesign/api_tests/newman_debug_contacts.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

failing_tests = []

# Find all failing tests
for execution in data.get('run', {}).get('executions', []):
    item_name = execution.get('item', {}).get('name', '')
    response = execution.get('response', {})
    code = response.get('code', 0)
    
    # Check if any assertion failed
    failed = False
    for assertion in execution.get('assertions', []):
        if assertion.get('error'):
            failed = True
            break
    
    if failed or code >= 400:
        # Decode response
        error_msg = ""
        stream = response.get('stream', {})
        if stream and isinstance(stream, dict) and 'data' in stream:
            try:
                byte_data = stream['data']
                decoded = ''.join([chr(b) for b in byte_data])
                error_json = json.loads(decoded)
                if 'errors' in error_json:
                    error_msg = str(error_json['errors'])
                elif 'title' in error_json:
                    error_msg = error_json['title']
            except:
                pass
        
        failing_tests.append({
            'name': item_name,
            'method': execution.get('request', {}).get('method', 'N/A'),
            'code': code,
            'status': response.get('status', 'N/A'),
            'error': error_msg[:200] if error_msg else 'No error message'
        })

print("="*80)
print("Contacts Module - All Failing Tests")
print("="*80)
print()

for i, test in enumerate(failing_tests, 1):
    print(f"{i}. {test['name']}")
    print(f"   {test['method']} - {test['code']} {test['status']}")
    print(f"   Error: {test['error']}")
    print()
