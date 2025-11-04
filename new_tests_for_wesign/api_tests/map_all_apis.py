import os
import re
from collections import defaultdict

controllers_path = r"C:\Users\gals\source\repos\user-backend\WeSign\Areas\Api\Controllers"

def extract_api_endpoints(file_path):
    """Extract all API endpoints from a controller"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Get route prefix
    route_match = re.search(r'class\s+(\w+Controller).*?\[Route\(["\']([^"\']+)["\']\)\]', content, re.DOTALL)
    if route_match:
        controller_name = route_match.group(1).replace('Controller', '').lower()
        route_prefix = route_match.group(2).replace('[controller]', controller_name)
    else:
        route_prefix = ""

    endpoints = []

    # Split content into method blocks
    # Find all public Task<IActionResult> methods
    method_pattern = r'(\[[^\]]+\]\s*)+\s*public\s+(?:async\s+)?Task<IActionResult>\s+(\w+)\s*\(([^)]*)\)'

    for method_match in re.finditer(method_pattern, content, re.MULTILINE | re.DOTALL):
        attributes_block = method_match.group(1)
        method_name = method_match.group(2)
        parameters = method_match.group(3)

        # Extract HTTP method
        http_match = re.search(r'\[Http(Get|Post|Put|Delete|Patch)(?:\(["\']([^"\']+)["\']\))?\]', attributes_block)
        if not http_match:
            continue

        http_method = http_match.group(1).upper()
        http_route = http_match.group(2) if http_match.group(2) else ""

        # Extract additional Route attribute
        route_match = re.search(r'\[Route\(["\']([^"\']+)["\']\)\]', attributes_block)
        if route_match:
            http_route = route_match.group(1)

        # Build full route
        full_route = route_prefix
        if http_route:
            if not http_route.startswith('/'):
                http_route = '/' + http_route
            full_route += http_route

        # Check for [Authorize]
        authorized = '[Authorize]' in attributes_block

        # Extract summary
        summary = ""
        before_block = content[:method_match.start()]
        summary_match = re.search(r'///\s+<summary>\s*\n\s*///\s+([^\n]+)', before_block[-500:])
        if summary_match:
            summary = summary_match.group(1).strip()

        # Clean parameters
        params_list = [p.strip() for p in parameters.split(',') if p.strip()]
        params_clean = []
        for p in params_list:
            parts = p.split()
            if len(parts) >= 2:
                params_clean.append(f"{parts[-2]} {parts[-1]}")
            elif len(parts) == 1:
                params_clean.append(parts[0])

        endpoints.append({
            'method': http_method,
            'route': full_route,
            'controller_method': method_name,
            'parameters': ', '.join(params_clean),
            'summary': summary,
            'authorized': authorized
        })

    return endpoints, route_prefix

print("=" * 120)
print(" WESIGN API MAPPING - COMPLETE")
print("=" * 120)

all_endpoints = {}
all_routes_by_method = defaultdict(list)

for filename in sorted(os.listdir(controllers_path)):
    if filename.endswith('.cs'):
        controller_name = filename.replace('.cs', '')
        file_path = os.path.join(controllers_path, filename)

        try:
            endpoints, route_prefix = extract_api_endpoints(file_path)
            all_endpoints[controller_name] = {
                'route_prefix': route_prefix,
                'endpoints': endpoints
            }

            for ep in endpoints:
                all_routes_by_method[ep['method']].append(ep)

            print(f"\n{'─' * 120}")
            print(f"📁 {controller_name}")
            print(f"   Base Route: {route_prefix}")
            print(f"   Endpoints: {len(endpoints)}")
            print(f"{'─' * 120}")

            for i, ep in enumerate(endpoints, 1):
                auth = "🔒" if ep['authorized'] else "🔓"
                print(f"{i:2d}. {auth} {ep['method']:6s} {ep['route']}")
                print(f"    └─ Method: {ep['controller_method']}({ep['parameters'][:60]})")
                if ep['summary']:
                    print(f"    └─ {ep['summary']}")

        except Exception as e:
            print(f"\n{'─' * 120}")
            print(f"📁 {controller_name}")
            print(f"   ❌ Error: {str(e)}")

# Summary
print("\n" + "=" * 120)
print(" SUMMARY")
print("=" * 120)

total_endpoints = sum(len(c['endpoints']) for c in all_endpoints.values())
total_controllers = len([c for c in all_endpoints.values() if c['endpoints']])

print(f"\n📊 Statistics:")
print(f"   Total Controllers: {total_controllers}")
print(f"   Total Endpoints: {total_endpoints}")

if total_endpoints > 0:
    print(f"\n📈 Endpoints by HTTP Method:")
    for method in ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']:
        count = len(all_routes_by_method[method])
        if count > 0:
            pct = count / total_endpoints * 100
            bar = '█' * int(pct / 2)
            print(f"   {method:8s}: {count:3d} ({pct:5.1f}%) {bar}")

    print(f"\n📂 Endpoints by Controller:")
    for name, data in sorted(all_endpoints.items(), key=lambda x: len(x[1]['endpoints']), reverse=True):
        count = len(data['endpoints'])
        if count > 0:
            print(f"   {name:35s}: {count:3d}")

    authorized_count = sum(1 for c in all_endpoints.values() for ep in c['endpoints'] if ep['authorized'])
    public_count = total_endpoints - authorized_count

    print(f"\n🔐 Authorization:")
    print(f"   Requires Auth: {authorized_count:3d} ({authorized_count/total_endpoints*100:5.1f}%)")
    print(f"   Public:        {public_count:3d} ({public_count/total_endpoints*100:5.1f}%)")

print("\n" + "=" * 120)
