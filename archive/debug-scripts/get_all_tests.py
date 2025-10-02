#!/usr/bin/env python3
"""
Script to extract all WeSign test information and generate TypeScript test definitions
"""
import os
import re
import ast
import json

def extract_test_functions(file_path):
    """Extract all test functions from a Python test file"""
    tests = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Parse the file to find test functions
        tree = ast.parse(content)
        
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name.startswith('test_'):
                # Extract test name and basic info
                test_name = node.name
                
                # Get docstring if available
                docstring = ""
                if node.body and isinstance(node.body[0], ast.Expr) and isinstance(node.body[0].value, ast.Str):
                    docstring = node.body[0].value.s
                elif node.body and isinstance(node.body[0], ast.Expr) and isinstance(node.body[0].value, ast.Constant):
                    docstring = node.body[0].value.value if isinstance(node.body[0].value.value, str) else ""
                
                tests.append({
                    'name': test_name,
                    'docstring': docstring,
                    'file': file_path
                })
                
    except Exception as e:
        print(f"Error parsing {file_path}: {e}")
        # If parsing fails, try regex fallback
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            test_pattern = r'def (test_[a-zA-Z0-9_]+)\s*\('
            matches = re.findall(test_pattern, content)
            
            for match in matches:
                tests.append({
                    'name': match,
                    'docstring': "",
                    'file': file_path
                })
        except Exception as e2:
            print(f"Fallback regex also failed for {file_path}: {e2}")
    
    return tests

def get_module_from_path(file_path):
    """Determine module from file path"""
    if 'auth' in file_path:
        return 'auth'
    elif 'admin' in file_path:
        return 'admin'
    elif 'contacts' in file_path:
        return 'contacts'
    elif 'dashboard' in file_path:
        return 'dashboard'
    elif 'document_workflows' in file_path:
        return 'documents'
    elif 'integrations' in file_path:
        return 'integrations'
    elif 'templates' in file_path:
        return 'templates'
    else:
        return 'misc'

def get_tags_from_path_and_name(file_path, test_name):
    """Generate tags based on file path and test name"""
    tags = []
    
    # Module tags
    if 'auth' in file_path:
        tags.extend(['authentication', 'critical'])
    elif 'admin' in file_path:
        tags.extend(['admin', 'critical'])
    elif 'contacts' in file_path:
        tags.extend(['contacts', 'business-critical'])
    elif 'dashboard' in file_path:
        tags.extend(['dashboard', 'ui'])
    elif 'document_workflows' in file_path:
        tags.extend(['documents', 'wesign', 'business-critical'])
    elif 'integrations' in file_path:
        tags.extend(['integrations', 'critical'])
    elif 'templates' in file_path:
        tags.extend(['templates', 'ui'])
    
    # Language tags
    if 'english' in file_path or 'english' in test_name:
        tags.append('english')
    if 'hebrew' in file_path or 'hebrew' in test_name:
        tags.append('hebrew')
    
    # Test type tags
    if 'performance' in file_path or 'performance' in test_name:
        tags.extend(['performance', 'non-functional'])
    if 'accessibility' in file_path or 'accessibility' in test_name:
        tags.extend(['accessibility', 'a11y'])
    if 'cross_browser' in file_path or 'cross_browser' in test_name:
        tags.extend(['cross-browser', 'compatibility'])
    if 'edge_cases' in file_path or 'edge_cases' in test_name:
        tags.extend(['edge-cases', 'negative'])
    if 'advanced' in file_path or 'advanced' in test_name:
        tags.extend(['advanced', 'regression'])
    
    # Common test suite tags
    if any(word in test_name.lower() for word in ['login', 'auth', 'assign', 'upload', 'merge']):
        tags.extend(['regression', 'sanity'])
    if 'negative' in file_path or 'invalid' in test_name or 'fail' in test_name:
        tags.append('negative')
    if 'ui' in file_path or 'ui' in test_name:
        tags.append('ui')
    
    # Add default tags
    tags.extend(['regression', 'wesign'])
    
    return list(set(tags))  # Remove duplicates

def get_risk_level(tags):
    """Determine risk level based on tags"""
    if any(tag in tags for tag in ['critical', 'business-critical', 'wesign']):
        return 'HIGH'
    elif any(tag in tags for tag in ['regression', 'ui', 'advanced']):
        return 'MED'
    else:
        return 'LOW'

def estimate_duration(tags, test_name):
    """Estimate test duration based on tags and test name"""
    base_duration = 30000  # 30 seconds
    
    if 'performance' in tags:
        base_duration += 60000
    if 'cross-browser' in tags:
        base_duration += 30000
    if 'advanced' in tags:
        base_duration += 20000
    if 'accessibility' in tags:
        base_duration += 15000
    if any(word in test_name for word in ['import', 'upload', 'merge', 'assign']):
        base_duration += 25000
    if 'hebrew' in tags:
        base_duration += 10000  # RTL rendering takes more time
    
    return base_duration

def main():
    tests_dir = r"C:\Users\gals\Desktop\playwrightTestsClaude\tests"
    all_tests = []
    
    # Walk through all test files
    for root, dirs, files in os.walk(tests_dir):
        for file in files:
            if file.startswith('test_') and file.endswith('.py'):
                file_path = os.path.join(root, file).replace('\\', '/')
                print(f"Processing: {file_path}")
                
                tests_in_file = extract_test_functions(file_path)
                
                for test_info in tests_in_file:
                    module = get_module_from_path(file_path)
                    tags = get_tags_from_path_and_name(file_path, test_info['name'])
                    risk = get_risk_level(tags)
                    duration = estimate_duration(tags, test_info['name'])
                    
                    # Create formatted test name
                    formatted_name = test_info['name'].replace('test_', '').replace('_', ' ').title()
                    
                    test_def = {
                        'id': f"{module}-{test_info['name']}-{hash(file_path + test_info['name']) % 10000:04d}",
                        'name': formatted_name,
                        'module': module,
                        'tags': tags,
                        'risk': risk,
                        'description': test_info['docstring'] or f"WeSign test for {formatted_name.lower()} functionality",
                        'estimatedDuration': duration,
                        'filePath': file_path.replace(tests_dir, 'tests'),
                        'testFunction': test_info['name']
                    }
                    
                    all_tests.append(test_def)
    
    # Sort tests by module and name
    all_tests.sort(key=lambda x: (x['module'], x['name']))
    
    print(f"\nTotal tests found: {len(all_tests)}")
    
    # Group by module for summary
    modules = {}
    for test in all_tests:
        if test['module'] not in modules:
            modules[test['module']] = 0
        modules[test['module']] += 1
    
    print("\nTests by module:")
    for module, count in sorted(modules.items()):
        print(f"  {module}: {count} tests")
    
    # Save to JSON file
    output_file = r"C:\Users\gals\Desktop\playwrightTestsClaude\wesign_tests.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_tests, f, indent=2, ensure_ascii=False)
    
    print(f"\nTest definitions saved to: {output_file}")

if __name__ == "__main__":
    main()