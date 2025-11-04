import os
import re
from collections import defaultdict

# Path to controllers
controllers_path = r"C:\Users\gals\source\repos\user-backend\WeSign\Areas\Api\Controllers"

def extract_controller_info(file_path):
    """Extract all API endpoints from a controller file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract route prefix - handles [controller] placeholder
    route_match = re.search(r'\[Route\(["\']([^"\']+)["\']\)\]', content)
    if route_match:
        route_prefix = route_match.group(1)
        # Replace [controller] with actual controller name from class
        class_match = re.search(r'public class (\w+Controller)', content)
        if class_match:
            controller_name = class_match.group(1).replace('Controller', '').lower()
            route_prefix = route_prefix.replace('[controller]', controller_name)
    else:
        route_prefix = ""

    endpoints = []

    # Extract methods with HTTP attributes
    # Pattern to find: [HttpMethod] or [HttpMethod("route")], followed by method definition
    http_pattern = r'\[Http(Get|Post|Put|Delete|Patch)(?:\(["\']([^"\']+)["\']\))?\][^\n]*?public\s+(?:async\s+)?Task<IActionResult>\s+(\w+)\s*\(([^)]*)\)'

    for match in re.finditer(http_pattern, content, re.MULTILINE | re.DOTALL):
        http_method = match.group(1).upper()
        route_suffix = match.group(2) if match.group(2) else ""
        method_name = match.group(3)
        parameters = match.group(4)

        # Build full route
        full_route = route_prefix
        if route_suffix:
            if not route_suffix.startswith('/'):
                route_suffix = '/' + route_suffix
            full_route += route_suffix

        # Extract summary comment if exists
        summary = ""
        try:
            # Look backward from this match to find /// <summary>
            before_match = content[:match.start()]
            summary_match = re.search(r'///\s+<summary>\s*\n\s*///\s+([^\n]+)', before_match[-500:])
            if summary_match:
                summary = summary_match.group(1).strip()
        except:
            pass

        # Extract [Authorize] attribute
        authorized = '[Authorize]' in content[max(0, match.start()-200):match.start()]

        # Clean up parameters
        params_clean = ', '.join([p.strip().split()[-1] if ' ' in p else p for p in parameters.split(',') if p.strip()])

        endpoints.append({
            'method': http_method,
            'route': full_route,
            'controller_method': method_name,
            'parameters': params_clean,
            'summary': summary,
            'authorized': authorized
        })

    return endpoints, route_prefix

print("=" * 120)
print("WESIGN API ENDPOINT MAPPING - COMPREHENSIVE")
print("=" * 120)
print()

all_endpoints = {}
all_routes_by_method = defaultdict(list)

# Process all controllers
for filename in sorted(os.listdir(controllers_path)):
    if filename.endswith('.cs'):
        controller_name = filename.replace('.cs', '')
        file_path = os.path.join(controllers_path, filename)

        try:
            endpoints, route_prefix = extract_controller_info(file_path)
            all_endpoints[controller_name] = {
                'route_prefix': route_prefix,
                'endpoints': endpoints
            }

            # Group by HTTP method
            for ep in endpoints:
                all_routes_by_method[ep['method']].append(ep)

            print(f"\n{'=' * 120}")
            print(f"CONTROLLER: {controller_name}")
            print(f"Route Prefix: {route_prefix}")
            print(f"Total Endpoints: {len(endpoints)}")
            print(f"{'=' * 120}")

            if endpoints:
                for i, ep in enumerate(endpoints, 1):
                    auth_marker = "🔒" if ep['authorized'] else "🔓"
                    print(f"\n{i}. {auth_marker} {ep['method']:6s} {ep['route']}")
                    print(f"   Method: {ep['controller_method']}")
                    if ep['summary']:
                        print(f"   Summary: {ep['summary']}")
                    if ep['parameters']:
                        print(f"   Params: {ep['parameters']}")
            else:
                print("\n   ⚠️  No endpoints extracted (may need manual review)")

        except Exception as e:
            print(f"\n{'=' * 120}")
            print(f"CONTROLLER: {controller_name}")
            print(f"{'=' * 120}")
            print(f"   ❌ Error: {str(e)}")

# Summary Section
print("\n")
print("=" * 120)
print("SUMMARY - ALL WESIGN APIs")
print("=" * 120)

total_endpoints = sum(len(c['endpoints']) for c in all_endpoints.values())
total_controllers = len(all_endpoints)

print(f"\nTotal Controllers: {total_controllers}")
print(f"Total API Endpoints: {total_endpoints}")

print("\n📊 Endpoints by HTTP Method:")
for method in ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']:
    count = len(all_routes_by_method[method])
    if count > 0:
        percentage = (count / total_endpoints * 100) if total_endpoints > 0 else 0
        print(f"   {method:8s}: {count:3d} ({percentage:5.1f}%)")

print("\n📋 Endpoints by Controller:")
for controller_name, controller_data in sorted(all_endpoints.items()):
    count = len(controller_data['endpoints'])
    print(f"   {controller_name:40s}: {count:3d} endpoints")

# Authorization statistics
authorized_count = sum(1 for c in all_endpoints.values() for ep in c['endpoints'] if ep['authorized'])
public_count = total_endpoints - authorized_count

print(f"\n🔐 Authorization Distribution:")
print(f"   Authorized (requires token): {authorized_count} ({authorized_count/total_endpoints*100:.1f}%)")
print(f"   Public (no auth required):   {public_count} ({public_count/total_endpoints*100:.1f}%)")

print("\n" + "=" * 120)

# Create quick reference by module
print("\n📚 QUICK REFERENCE - API ENDPOINTS BY MODULE")
print("=" * 120)

for controller_name, controller_data in sorted(all_endpoints.items()):
    if controller_data['endpoints']:
        print(f"\n### {controller_name} ({controller_data['route_prefix']})")
        for ep in controller_data['endpoints']:
            auth = "🔒" if ep['authorized'] else "🔓"
            print(f"  {auth} {ep['method']:6s} {ep['route']}")

print("\n" + "=" * 120)
print("Legend: 🔒 = Requires Authorization | 🔓 = Public Endpoint")
print("=" * 120)
