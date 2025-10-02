# QA Intelligence Tech Stack Inventory

Automated, cross-platform technology stack analysis with confidence-based language recommendations.

## Overview

This inventory system scans the QA Intelligence codebase to detect:

- **Languages**: TypeScript, JavaScript, Python, Go
- **Frameworks**: Backend (Express, FastAPI, etc.) and Frontend (React, Next.js, etc.)
- **Testing**: Playwright (TS/Python), Postman/Newman, k6
- **Infrastructure as Code**: Helm charts, Terraform, Kubernetes manifests
- **API Contracts**: OpenAPI/Swagger specifications
- **Security**: Environment files, licenses, secret patterns
- **Infrastructure Components**: NATS, PostgreSQL, Redis, Qdrant, Neo4j, OpenTelemetry

The scanner generates a confidence-based language recommendation for implementing the CMO/ELG (Context-Memory-Operations / Event Loop Graph) orchestration layer.

## Architecture

```
.inventory/
├── report.schema.json       # JSON Schema definition
├── report.json              # Generated inventory report (gitignored)
├── README.md                # This file
└── scripts/
    ├── scan.js              # Main scanner entrypoint
    ├── validate.js          # JSON Schema validator
    └── utils/
        ├── fs-walker.js     # Cross-platform file walker
        ├── detectors.js     # Pattern-based detection logic
        └── scoring.js       # Confidence scoring algorithm
```

## Usage

### Quick Start

```bash
# Install dependencies (if not already installed)
npm install

# Run scan
npm run scan

# Validate output
npm run validate

# Or run both in sequence
npm run scan:validate
```

### Scripts

- **`npm run scan`**: Scan codebase and generate `report.json`
- **`npm run validate`**: Validate `report.json` against JSON schema
- **`npm run scan:validate`**: Run scan + validation in sequence

## Scoring Algorithm

The recommendation engine uses a weighted scoring formula:

```
score = w1*files + w2*frameworks + w3*tooling + w4*ecosystem
```

**Weights:**
- `w1 = 0.5` (50%) - Primary language by file count
- `w2 = 0.3` (30%) - Framework ecosystem alignment
- `w3 = 0.15` (15%) - Testing and dev tooling
- `w4 = 0.05` (5%) - Infrastructure library availability

**Confidence Calculation:**

```
confidence = winner_score / (runner_up_score + epsilon)
```

Higher confidence indicates a clear winner. Lower confidence suggests hybrid approach.

## Output Format

The scanner generates a JSON report with:

1. **Metadata**: version, timestamp
2. **Languages**: file counts by extension
3. **Lockfiles**: dependency management files
4. **Frameworks**: detected backend/frontend frameworks
5. **Testing**: test files and configurations
6. **Infrastructure**: IaC files and component detection
7. **API Contracts**: OpenAPI/Swagger specs
8. **Security**: env files, licenses, secret patterns
9. **Recommendation**: language choice with confidence, scores, rationale, fallback, and library map

### Example Output

```json
{
  "version": "1.0.0",
  "timestamp": "2025-10-02T10:30:00.000Z",
  "languages": {
    "typescript": 450,
    "javascript": 120,
    "python": 85,
    "go": 0
  },
  "recommendation": {
    "language": "TypeScript",
    "confidence": 0.92,
    "scores": {
      "typescript": 0.87,
      "python": 0.42,
      "go": 0.05
    },
    "rationale": [
      "68.7% of codebase is TypeScript (450/655 files)",
      "Backend frameworks: Express",
      "Frontend frameworks: React",
      "15 Playwright TypeScript test files",
      "8 Postman collections (API testing)",
      "Infrastructure: nats, postgres, redis, opentelemetry",
      "Complete library ecosystem available for TypeScript"
    ],
    "fallback": "Python",
    "libraries": {
      "messaging": "nats.js",
      "state_store": "pg",
      "object_storage": "@aws-sdk/client-s3",
      "vector_db": "@qdrant/js-client-rest",
      "graph_db": "neo4j-driver",
      "policy_engine": "@open-policy-agent/opa-wasm",
      "observability": "@opentelemetry/sdk-node",
      "schema_validation": "ajv"
    }
  }
}
```

## Schema Validation

The report is validated against `report.schema.json` using [ajv](https://ajv.js.org/).

To add validation to CI/CD:

```yaml
- name: Tech Stack Scan
  run: npm run scan:validate

- name: Upload Inventory
  uses: actions/upload-artifact@v4
  with:
    name: tech-inventory
    path: .inventory/report.json
```

## Cross-Platform Compatibility

This scanner is **100% Node.js** with no shell dependencies:

- ✅ Works on Windows, macOS, Linux
- ✅ Works in Docker containers
- ✅ Works in CI/CD pipelines (Jenkins, GitHub Actions, GitLab CI)
- ✅ Deterministic and reproducible

## Customization

### Adding New Detectors

Edit `.inventory/scripts/utils/detectors.js`:

```javascript
function detectMyFramework(files) {
  return files.filter(f =>
    /my-framework\.config\.js/.test(f.name)
  ).map(f => f.path);
}

// Add to detectAll()
```

### Adjusting Weights

Edit `.inventory/scripts/utils/scoring.js`:

```javascript
const WEIGHTS = {
  files: 0.5,
  frameworks: 0.3,
  tooling: 0.15,
  ecosystem: 0.05
};
```

### Ignore Patterns

Edit `.inventory/scripts/utils/fs-walker.js`:

```javascript
const DEFAULT_IGNORE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /my-custom-dir/
];
```

## Troubleshooting

### Error: `ajv` not found

```bash
npm install --save-dev ajv ajv-formats
```

### Report not generated

Check scan output for errors. Common issues:
- Permission errors (run with appropriate privileges)
- Disk space (ensure enough space for report.json)
- Invalid JSON in package.json files (fix syntax errors)

### Unexpected language recommendation

Review:
1. File counts (are there hidden files skewing results?)
2. Framework detection (check package.json files)
3. Testing artifacts (ensure correct naming patterns)
4. Adjust weights if necessary

## License

MIT

## Related Documentation

- [JSON Schema Specification](http://json-schema.org/)
- [ajv Documentation](https://ajv.js.org/)
- [CMO/ELG Architecture](../docs/architecture/CMO-ELG.md) *(if available)*
