import re

# Sample content from UsersController
sample = """
[HttpPost]
[SwaggerResponse((int)HttpStatusCode.OK, Type = typeof(LinkResponse))]
public async Task<IActionResult> SignUpAsync(CreateUserDTO input)
{

[HttpPut]
[Authorize]
[SwaggerResponse((int)HttpStatusCode.OK)]
public async Task<IActionResult> UpdateUser(UpdateUserDTO input)
{

[HttpPost]
[Route("login")]
[SwaggerResponse((int)HttpStatusCode.OK, Type = typeof(UserTokensResponseDTO))]
public async Task<IActionResult> Login(LoginRequestDTO input)
{
"""

# Test different patterns
patterns = [
    r'\[Http(Get|Post|Put|Delete|Patch)(?:\(["\']([^"\']+)["\']\))?\][^\n]*?public\s+(?:async\s+)?Task<IActionResult>\s+(\w+)\s*\(([^)]*)\)',
    r'\[Http(Get|Post|Put|Delete|Patch)(?:\(["\']([^"\']+)["\']\))?\].*?public\s+(?:async\s+)?Task<IActionResult>\s+(\w+)\s*\(([^)]*)\)',
    r'\[Http(Get|Post|Put|Delete|Patch)(?:\(["\']([^"\']+)["\']\))?\].*?Task<IActionResult>\s+(\w+)\s*\(',
]

print("Testing patterns:\n")

for i, pattern in enumerate(patterns, 1):
    print(f"Pattern {i}:")
    matches = list(re.finditer(pattern, sample, re.DOTALL))
    print(f"  Matches found: {len(matches)}")
    for match in matches:
        print(f"    - Method: {match.group(1)}, Route: {match.group(2)}, Function: {match.group(3) if len(match.groups()) >= 3 else 'N/A'}")
    print()
