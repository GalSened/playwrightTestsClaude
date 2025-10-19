# Code Runner MCP Server - Installation & Usage Guide

**Date**: 2025-10-17
**Version**: Latest
**Status**: ✅ Installed and Connected

---

## Overview

The Code Runner MCP server enables Claude Code to execute code snippets in over 30 programming languages directly within your development environment. This is particularly useful for:

- Quick code verification and testing
- Running small scripts and snippets
- Learning and experimenting with different languages
- Validating code logic without manual execution

---

## Installation Summary

### Package Information
- **Package Name**: `mcp-server-code-runner`
- **Repository**: [github.com/formulahendry/mcp-server-code-runner](https://github.com/formulahendry/mcp-server-code-runner)
- **NPM**: [npmjs.com/package/mcp-server-code-runner](https://www.npmjs.com/package/mcp-server-code-runner)

### Installation Command
```bash
claude mcp add code-runner -- npx -y mcp-server-code-runner@latest
```

### Current Status
```
✓ Code Runner MCP Server: Connected
```

---

## Supported Languages (30+)

The Code Runner MCP server supports execution of code in the following languages:

### Scripting Languages
- **JavaScript** (Node.js)
- **TypeScript** (via ts-node)
- **Python** (2 & 3)
- **Ruby**
- **Perl** (5 & 6/Raku)
- **PHP**
- **Lua**
- **R**
- **Elixir**
- **Clojure**

### Compiled Languages
- **Go**
- **Rust**
- **C** (via gcc)
- **C++** (via g++)
- **Java**
- **Kotlin**
- **Swift**
- **Scala**
- **Haskell**
- **OCaml**
- **Crystal**

### Shell & System
- **Bash/SH**
- **PowerShell**
- **BAT/CMD** (Windows)
- **VBScript**
- **AppleScript** (macOS)
- **AutoHotkey** (Windows)
- **AutoIt** (Windows)

### Functional & Other
- **F# Script**
- **C# Script** (via scriptcs)
- **Lisp**
- **Scheme**
- **Racket**
- **Julia**
- **Dart**
- **Groovy**
- **CoffeeScript**
- **V**
- **Nim** (Ni)
- **Kit**

### Web & Styling
- **SCSS**
- **Sass**

---

## Prerequisites

⚠️ **Important**: Before using Code Runner, ensure that the interpreter or compiler for your target language is installed and available in your system's `PATH` environment variable.

### Check Language Availability

**Windows**:
```powershell
# Check if a language is available
where python
where node
where java
where gcc
```

**macOS/Linux**:
```bash
# Check if a language is available
which python3
which node
which java
which gcc
```

### Common Language Setup

#### Python
```bash
# Verify Python installation
python --version
# or
python3 --version
```

#### Node.js (JavaScript/TypeScript)
```bash
# Verify Node.js installation
node --version
npm --version
```

#### Java
```bash
# Verify Java installation
java -version
javac -version
```

#### Go
```bash
# Verify Go installation
go version
```

---

## How It Works

The Code Runner MCP server operates by:

1. **Receiving code snippets** from Claude Code
2. **Creating temporary files** with appropriate extensions
3. **Executing the code** using the language's interpreter/compiler
4. **Capturing output** (stdout, stderr, exit codes)
5. **Returning results** to Claude Code
6. **Cleaning up** temporary files

### Execution Flow

```
Claude Code
    ↓
Code Runner MCP Server
    ↓
Create temp file (.js, .py, .java, etc.)
    ↓
Execute with interpreter/compiler
    ↓
Capture output
    ↓
Return to Claude Code
    ↓
Display results to user
```

---

## Usage Examples

### Example 1: Run Python Code

**Request**:
```
Claude, run this Python code:
print("Hello from Code Runner!")
for i in range(5):
    print(f"Count: {i}")
```

**Result**:
```
Hello from Code Runner!
Count: 0
Count: 1
Count: 2
Count: 3
Count: 4
```

### Example 2: Run JavaScript Code

**Request**:
```
Claude, execute this JavaScript:
const numbers = [1, 2, 3, 4, 5];
const sum = numbers.reduce((a, b) => a + b, 0);
console.log(`Sum: ${sum}`);
console.log(`Average: ${sum / numbers.length}`);
```

**Result**:
```
Sum: 15
Average: 3
```

### Example 3: Test Java Code

**Request**:
```
Claude, run this Java code:
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello from Java!");
        System.out.println("Java version: " + System.getProperty("java.version"));
    }
}
```

**Result**:
```
Hello from Java!
Java version: 17.0.2
```

### Example 4: Execute Go Code

**Request**:
```
Claude, run this Go code:
package main
import "fmt"

func main() {
    fmt.Println("Hello from Go!")
    for i := 0; i < 3; i++ {
        fmt.Printf("Iteration %d\n", i)
    }
}
```

**Result**:
```
Hello from Go!
Iteration 0
Iteration 1
Iteration 2
```

---

## Use Cases for QA Intelligence Platform

### 1. Test Data Generation
```python
# Generate test user data
import random
import json

users = []
for i in range(5):
    users.append({
        "id": i + 1,
        "email": f"test{i+1}@example.com",
        "name": f"Test User {i+1}",
        "phone": f"+97255260{3210+i}"
    })

print(json.dumps(users, indent=2))
```

### 2. Quick API Endpoint Testing
```javascript
// Test WeSign API endpoint structure
const endpoint = "https://devtest.comda.co.il/api/";
const testData = {
  email: "test@company.com",
  password: "Test123!"
};

console.log("Testing endpoint:", endpoint);
console.log("Payload:", JSON.stringify(testData, null, 2));
```

### 3. Data Transformation Scripts
```python
# Transform CSV test data
import csv
import json

# Simulate CSV to JSON conversion
csv_data = """name,email,role
Alice,alice@test.com,admin
Bob,bob@test.com,user
Charlie,charlie@test.com,editor"""

lines = csv_data.strip().split('\n')
reader = csv.DictReader(lines)
json_output = [row for row in reader]

print(json.dumps(json_output, indent=2))
```

### 4. Performance Calculations
```javascript
// Calculate test execution metrics
const testResults = [
  { name: "Login", duration: 2.3 },
  { name: "Upload", duration: 5.1 },
  { name: "Sign", duration: 3.8 },
  { name: "Send", duration: 2.9 }
];

const total = testResults.reduce((sum, t) => sum + t.duration, 0);
const avg = total / testResults.length;

console.log(`Total execution time: ${total.toFixed(2)}s`);
console.log(`Average per test: ${avg.toFixed(2)}s`);
console.log(`Fastest: ${Math.min(...testResults.map(t => t.duration))}s`);
console.log(`Slowest: ${Math.max(...testResults.map(t => t.duration))}s`);
```

### 5. Test Selector Validation
```javascript
// Validate CSS selectors
const selectors = [
  '#login-button',
  '.document-upload',
  '[data-testid="signature-field"]',
  'button[type="submit"]'
];

selectors.forEach(selector => {
  const isValid = /^[#.\[\]="'\-\w\s:>+~*]+$/.test(selector);
  console.log(`${selector}: ${isValid ? '✓ Valid' : '✗ Invalid'}`);
});
```

---

## Configuration

### Current MCP Configuration

The Code Runner is configured in `~/.claude.json`:

```json
{
  "mcpServers": {
    "code-runner": {
      "command": "npx",
      "args": ["-y", "mcp-server-code-runner@latest"]
    }
  }
}
```

### Alternative: Docker Configuration

For isolated execution with better security:

```json
{
  "mcpServers": {
    "code-runner": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "formulahendry/mcp-server-code-runner"
      ]
    }
  }
}
```

### Windows-Specific Configuration

If npx fails on Windows, use cmd wrapper:

```json
{
  "mcpServers": {
    "code-runner": {
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y",
        "mcp-server-code-runner@latest"
      ]
    }
  }
}
```

---

## Security Considerations

### ⚠️ Important Security Notes

1. **Code Execution Risk**: The Code Runner executes arbitrary code on your system
2. **No Sandboxing**: Code runs with your user permissions
3. **File System Access**: Executed code can read/write files
4. **Network Access**: Code can make network requests
5. **Trust Required**: Only run code you understand and trust

### Best Practices

✅ **DO**:
- Review code before asking Claude to execute it
- Use for testing and development only
- Keep interpreters up to date
- Run in development environments only

❌ **DON'T**:
- Execute code from untrusted sources
- Run in production environments
- Execute code that requires elevated privileges
- Process sensitive data without review

### Alternative: Sandboxed Execution

For production use or sensitive environments, consider:
- **axliupore/code-runner**: Docker-based with resource limits
- **mcp_code_executor**: Conda environment isolation for Python
- **Custom Docker containers**: Build your own sandboxed environment

---

## Troubleshooting

### Issue: "Command not found" or "Interpreter not available"

**Solution**: Ensure the language interpreter is installed and in PATH
```bash
# Windows
echo %PATH%

# macOS/Linux
echo $PATH

# Add to PATH (example for Python)
# Windows: System Properties → Environment Variables → PATH → Add C:\Python312\
# macOS/Linux: Add to ~/.bashrc or ~/.zshrc: export PATH="/usr/local/bin:$PATH"
```

### Issue: Code Runner MCP not connecting

**Solution**: Verify the package is installed
```bash
npx -y mcp-server-code-runner@latest --version
```

### Issue: Timeout errors

**Solution**: The code might be running too long. Check for:
- Infinite loops
- Long-running operations
- Blocking I/O operations

### Issue: Permission denied errors

**Solution**:
- On Windows: Run as administrator (if needed)
- On macOS/Linux: Check file permissions with `ls -la`

---

## Integration with Existing MCP Servers

The Code Runner works alongside other installed MCP servers:

| MCP Server | Purpose | Status |
|------------|---------|--------|
| **code-runner** | Execute code snippets | ✓ Connected |
| serena | Code analysis & navigation | ✓ Connected |
| zen | AI reasoning & code review | ✓ Connected |
| playwright | Browser automation | ✓ Connected |
| github | GitHub integration | ✓ Connected |
| context7 | Documentation lookup | ✓ Connected |
| tavily | Web search | ✓ Connected |
| memory | Knowledge graph | ✓ Connected |
| devtools | Browser DevTools | ✓ Connected |
| wesign | WeSign API integration | ✓ Connected |

### Workflow Example: Full Development Cycle

1. **Code with Serena**: Navigate and understand codebase
2. **Execute with Code Runner**: Test snippets and logic
3. **Review with Zen**: Get AI-powered code review
4. **Test with Playwright**: Run E2E browser tests
5. **Document with Context7**: Look up API documentation
6. **Commit with GitHub**: Push changes to repository

---

## Advanced Usage

### Multi-Language Testing

Test the same algorithm in multiple languages:

**Python**:
```python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(10))
```

**JavaScript**:
```javascript
function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n-1) + fibonacci(n-2);
}

console.log(fibonacci(10));
```

**Java**:
```java
public class Fibonacci {
    static int fibonacci(int n) {
        if (n <= 1) return n;
        return fibonacci(n-1) + fibonacci(n-2);
    }

    public static void main(String[] args) {
        System.out.println(fibonacci(10));
    }
}
```

### Performance Comparison

```python
import time

start = time.time()
# Your code here
result = sum(range(1000000))
end = time.time()

print(f"Result: {result}")
print(f"Execution time: {(end - start) * 1000:.2f}ms")
```

---

## Quick Reference

### Common Commands

| Language | Command | Example |
|----------|---------|---------|
| Python | `python script.py` | `python -c "print('Hello')"` |
| Node.js | `node script.js` | `node -e "console.log('Hello')"` |
| Java | `javac + java` | `java HelloWorld` |
| Go | `go run script.go` | `go run main.go` |
| Ruby | `ruby script.rb` | `ruby -e "puts 'Hello'"` |
| PHP | `php script.php` | `php -r "echo 'Hello';"` |

### Verification Commands

```bash
# Check all language availability
python --version
node --version
java -version
go version
ruby --version
php --version
gcc --version
rustc --version
```

---

## Documentation Links

- **GitHub Repository**: [formulahendry/mcp-server-code-runner](https://github.com/formulahendry/mcp-server-code-runner)
- **NPM Package**: [mcp-server-code-runner](https://www.npmjs.com/package/mcp-server-code-runner)
- **MCP Specification**: [Model Context Protocol](https://modelcontextprotocol.io/)
- **Claude Code Docs**: [Claude Code Documentation](https://docs.claude.com/claude-code)

---

## Summary

✅ **Code Runner MCP Server is installed and ready to use**

**What You Can Do Now**:
- Execute code in 30+ languages directly from Claude Code
- Test algorithms and snippets quickly
- Generate test data dynamically
- Validate code logic without manual execution
- Learn new programming languages interactively

**Next Steps**:
1. Verify your language interpreters are in PATH
2. Try executing simple code snippets
3. Integrate with your development workflow
4. Explore multi-language testing capabilities

**Remember**: Always review code before execution for security!

---

**Installed**: 2025-10-17
**Status**: ✅ Active and Connected
**Package Version**: Latest (@mcp-server-code-runner)
