import os
import re
from collections import defaultdict

controllers_path = r"C:\Users\gals\source\repos\user-backend\WeSign\Areas\Api\Controllers"

def extract_endpoints_from_controller(file_path):
    """Extract all endpoints from a controller file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find class definition and its route
    class_match = re.search(r'\[Route\(["\']([^"\']+)["\']\)\].*?public\s+class\s+(\w+Controller)', content, re.DOTALL)
    if not class_match:
        return [], ""

    route_template = class_match.group(1)
    controller_name = class_match.group(2).replace('Controller', '').lower()
    route_prefix = route_template.replace('[controller]', controller_name)

    endpoints = []

    # Find all HTTP method definitions
    # Pattern: [HttpXxx] or [HttpXxx("route")] followed by public Task<IActionResult> MethodName
    method_blocks = re.finditer(
        r'(\s+\[HttpGet|Post|Put|Delete|Patch)(?:\(["\']([^"\']+)["\']\))?\]'
        r'(.*?)'
        r'public\s+(?:async\s+)?Task<IActionResult>\s+(\w+)\s*\(([^)]*)\)',
        content,
        re.DOTALL
    )

    for match in method_blocks:
        http_attr = match.group(1).strip()
        route_param = match.group(2)
        attributes = match.group(3)
        method_name = match.group(4)
        parameters = match.group(5)

        # Extract HTTP method
        http_method = re.search(r'\[Http(Get|Post|Put|Delete|Patch)', http_attr).group(1).upper()

        # Check for separate [Route] attribute
        route_attr_match = re.search(r'\[Route\(["\']([^"\']+)["\']\)\]', attributes)
        if route_attr_match:
            route_suffix = route_attr_match.group(1)
        elif route_param:
            route_suffix = route_param
        else:
            route_suffix = ""

        # Build full route
        if route_suffix:
            if not route_suffix.startswith('/'):
                route_suffix = '/' + route_suffix
            full_route = route_prefix + route_suffix
        else:
            full_route = route_prefix

        # Check authorization
        authorized = '[Authorize]' in attributes or '[Authorize]' in http_attr

        # Extract summary
        summary = ""
        before_match = content[:match.start()]
        summary_match = re.search(r'///\s+<summary>\s*\n\s*///\s+([^\n]+)', before_match[-600:])
        if summary_match:
            summary = summary_match.group(1).strip()

        # Extract parameter names
        params_list = []
        for p in parameters.split(','):
            p = p.strip()
            if p:
                parts = p.split()
                if len(parts) >= 2:
                    params_list.append(parts[-1])
                else:
                    params_list.append(p)

        endpoints.append({
            'method': http_method,
            'route': full_route,
            'function': method_name,
            'params': ', '.join(params_list),
            'summary': summary,
            'authorized': authorized
        })

    return endpoints, route_prefix


print("=" * 130)
print("WESIGN API COMPLETE MAPPING")
print("=" * 130)

all_data = {}
all_by_method = defaultdict(list)

for filename in sorted(os.listdir(controllers_path)):
    if not filename.endswith('.cs'):
        continue

    controller_name = filename.replace('.cs', '')
    file_path = os.path.join(controllers_path, filename)

    try:
        endpoints, prefix = extract_endpoints_from_controller(file_path)
        all_data[controller_name] = {'prefix': prefix, 'endpoints': endpoints}

        for ep in endpoints:
            all_by_method[ep['method']].append(ep)

        print(f"\n{'─' * 130}")
        print(f"📦 {controller_name:<40} │ Base: {prefix:<30} │ Endpoints: {len(endpoints)}")
        print(f"{'─' * 130}")

        for i, ep in enumerate(endpoints, 1):
            auth = "🔒" if ep['authorized'] else "🔓"
            print(f" {i:2}. {auth} {ep['method']:6} {ep['route']}")
            print(f"     ├─ Function: {ep['function']}({ep['params'][:70]})")
            if ep['summary']:
                print(f"     └─ {ep['summary'][:100]}")

    except Exception as e:
        print(f"\n{'─' * 130}")
        print(f"📦 {controller_name:<40} │ ❌ Error: {str(e)}")

# Summary
total_eps = sum(len(d['endpoints']) for d in all_data.values())
total_ctrl = len([d for d in all_data.values() if d['endpoints']])

print(f"\n{'═' * 130}")
print("SUMMARY")
print(f"{'═' * 130}")

print(f"\n📊 Overview:")
print(f"   Controllers with APIs: {total_ctrl}")
print(f"   Total Endpoints: {total_eps}")

if total_eps > 0:
    print(f"\n📈 By HTTP Method:")
    for method in ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']:
        count = len(all_by_method[method])
        if count > 0:
            pct = count / total_eps * 100
            bar = '█' * max(1, int(pct / 2))
            print(f"   {method:8} │ {count:3} ({pct:5.1f}%) │ {bar}")

    print(f"\n📂 By Controller:")
    sorted_ctrl = sorted(all_data.items(), key=lambda x: len(x[1]['endpoints']), reverse=True)
    for name, data in sorted_ctrl:
        if data['endpoints']:
            print(f"   {name:<40} │ {len(data['endpoints']):3} endpoints")

    auth_count = sum(1 for d in all_data.values() for e in d['endpoints'] if e['authorized'])
    pub_count = total_eps - auth_count

    print(f"\n🔐 Authorization:")
    print(f"   Requires Token │ {auth_count:3} ({auth_count/total_eps*100:5.1f}%)")
    print(f"   Public         │ {pub_count:3} ({pub_count/total_eps*100:5.1f}%)")

print(f"\n{'═' * 130}")
