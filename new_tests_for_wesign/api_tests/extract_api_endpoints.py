import os
import re
from pathlib import Path

# Path to the WeSign API controllers
controllers_path = r"C:\Users\gals\source\repos\user-backend\WeSign\Areas\Api\Controllers"

# Store all endpoints
endpoints = {}

def extract_route_prefix(content):
    """Extract the route prefix from [Route] attribute"""
    match = re.search(r'\[Route\(["\']([^"\']+)["\']\)\]', content)
    return match.group(1) if match else ""

def extract_endpoints_from_controller(file_path, controller_name):
    """Extract all endpoints from a controller file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Get route prefix
    route_prefix = extract_route_prefix(content)

    # Extract all HTTP method attributes and their routes
    # Pattern matches: [HttpGet], [HttpPost("route")], etc.
    patterns = [
        (r'\[HttpGet(?:\(["\']([^"\']+)["\']\))?\]\s+public\s+\w+\s+(\w+)\s*\(([^)]*)\)', 'GET'),
        (r'\[HttpPost(?:\(["\']([^"\']+)["\']\))?\]\s+public\s+\w+\s+(\w+)\s*\(([^)]*)\)', 'POST'),
        (r'\[HttpPut(?:\(["\']([^"\']+)["\']\))?\]\s+public\s+\w+\s+(\w+)\s*\(([^)]*)\)', 'PUT'),
        (r'\[HttpDelete(?:\(["\']([^"\']+)["\']\))?\]\s+public\s+\w+\s+(\w+)\s*\(([^)]*)\)', 'DELETE'),
        (r'\[HttpPatch(?:\(["\']([^"\']+)["\']\))?\]\s+public\s+\w+\s+(\w+)\s*\(([^)]*)\)', 'PATCH'),
    ]

    controller_endpoints = []

    for pattern, method in patterns:
        matches = re.finditer(pattern, content, re.MULTILINE | re.DOTALL)
        for match in matches:
            route = match.group(1) if match.group(1) else ""
            method_name = match.group(2)
            parameters = match.group(3)

            # Build full route
            full_route = route_prefix
            if route:
                full_route = f"{route_prefix}/{route}" if route_prefix else route

            # Clean up route
            full_route = full_route.replace("//", "/")
            if not full_route.startswith("/"):
                full_route = "/" + full_route

            controller_endpoints.append({
                'method': method,
                'route': full_route,
                'controller_method': method_name,
                'parameters': parameters.strip()
            })

    return controller_endpoints

print("=" * 100)
print("WESIGN API ENDPOINT EXTRACTION")
print("=" * 100)
print()

# Process all controller files
for filename in sorted(os.listdir(controllers_path)):
    if filename.endswith('.cs'):
        controller_name = filename.replace('.cs', '')
        file_path = os.path.join(controllers_path, filename)

        print(f"\n{'=' * 100}")
        print(f"CONTROLLER: {controller_name}")
        print(f"{'=' * 100}")

        try:
            controller_endpoints = extract_endpoints_from_controller(file_path, controller_name)
            endpoints[controller_name] = controller_endpoints

            if controller_endpoints:
                for endpoint in controller_endpoints:
                    print(f"\n{endpoint['method']:8s} {endpoint['route']}")
                    print(f"         Method: {endpoint['controller_method']}")
                    if endpoint['parameters']:
                        print(f"         Params: {endpoint['parameters'][:80]}")
            else:
                print("\n  No endpoints found (may need manual review)")

        except Exception as e:
            print(f"\n  Error processing: {e}")

# Summary
print("\n")
print("=" * 100)
print("SUMMARY")
print("=" * 100)

total_endpoints = sum(len(eps) for eps in endpoints.values())
print(f"\nTotal Controllers: {len(endpoints)}")
print(f"Total Endpoints: {total_endpoints}")

print("\nEndpoints by HTTP Method:")
method_counts = {}
for controller_eps in endpoints.values():
    for ep in controller_eps:
        method_counts[ep['method']] = method_counts.get(ep['method'], 0) + 1

for method, count in sorted(method_counts.items()):
    print(f"  {method:8s}: {count}")

print("\n" + "=" * 100)
