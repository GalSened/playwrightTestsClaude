/**
 * Confidence-based scoring algorithm
 * Formula: score = w1*files + w2*frameworks + w3*tooling + w4*ecosystem
 */

/**
 * Scoring weights
 */
const WEIGHTS = {
  files: 0.5,         // 50% - Primary language by file count
  frameworks: 0.3,    // 30% - Framework ecosystem alignment
  tooling: 0.15,      // 15% - Testing and dev tooling
  ecosystem: 0.05     // 5% - Infrastructure library availability
};

/**
 * Library recommendations by language
 */
const LIBRARY_MAP = {
  TypeScript: {
    messaging: 'nats.js',
    state_store: 'pg',
    object_storage: '@aws-sdk/client-s3',
    vector_db: '@qdrant/js-client-rest',
    graph_db: 'neo4j-driver',
    policy_engine: '@open-policy-agent/opa-wasm',
    observability: '@opentelemetry/sdk-node',
    schema_validation: 'ajv'
  },
  Python: {
    messaging: 'nats-py',
    state_store: 'psycopg (or asyncpg)',
    object_storage: 'boto3',
    vector_db: 'qdrant-client',
    graph_db: 'neo4j',
    policy_engine: 'py-opa (OPA REST API)',
    observability: 'opentelemetry-sdk',
    schema_validation: 'jsonschema (or pydantic)'
  },
  Go: {
    messaging: 'nats.go',
    state_store: 'pgx',
    object_storage: 'minio-go (S3-compatible)',
    vector_db: 'qdrant/go-client',
    graph_db: 'neo4j-go-driver',
    policy_engine: 'github.com/open-policy-agent/opa',
    observability: 'go.opentelemetry.io/otel',
    schema_validation: 'gojsonschema'
  }
};

/**
 * Calculate file-based scores (normalized to 0-1)
 */
function calculateFileScores(languages) {
  const total = languages.typescript + languages.python + languages.go;

  if (total === 0) {
    return { typescript: 0, python: 0, go: 0 };
  }

  return {
    typescript: languages.typescript / total,
    python: languages.python / total,
    go: languages.go / total
  };
}

/**
 * Calculate framework alignment scores
 */
function calculateFrameworkScores(frameworks) {
  const scores = { typescript: 0, python: 0, go: 0 };

  // Backend frameworks
  if (frameworks.backend.includes('Express')) scores.typescript += 0.5;
  if (frameworks.backend.includes('NestJS')) scores.typescript += 0.5;
  if (frameworks.backend.includes('Fastify')) scores.typescript += 0.5;

  if (frameworks.backend.includes('FastAPI')) scores.python += 0.5;
  if (frameworks.backend.includes('Flask')) scores.python += 0.3;
  if (frameworks.backend.includes('Django')) scores.python += 0.3;

  // Frontend frameworks (TS-aligned)
  if (frameworks.frontend.includes('React')) scores.typescript += 0.3;
  if (frameworks.frontend.includes('Next.js')) scores.typescript += 0.5;
  if (frameworks.frontend.includes('Vue')) scores.typescript += 0.3;
  if (frameworks.frontend.includes('Angular')) scores.typescript += 0.5;

  // Normalize to 0-1
  const maxScore = Math.max(scores.typescript, scores.python, scores.go, 1);
  return {
    typescript: scores.typescript / maxScore,
    python: scores.python / maxScore,
    go: scores.go / maxScore
  };
}

/**
 * Calculate tooling alignment scores
 */
function calculateToolingScores(testing) {
  const scores = { typescript: 0, python: 0, go: 0 };

  // Playwright TypeScript
  if (testing.playwright_ts.length > 0) {
    scores.typescript += 1.0;
  }

  // Playwright Python
  if (testing.playwright_py.length > 0) {
    scores.python += 1.0;
  }

  // Postman/Newman (language-agnostic, slight TS preference)
  if (testing.postman_collections.length > 0) {
    scores.typescript += 0.5;
    scores.python += 0.3;
  }

  // k6 (JavaScript-based, TS integration exists)
  if (testing.k6_scripts.length > 0) {
    scores.typescript += 0.3;
  }

  // Normalize to 0-1
  const maxScore = Math.max(scores.typescript, scores.python, scores.go, 1);
  return {
    typescript: scores.typescript / maxScore,
    python: scores.python / maxScore,
    go: scores.go / maxScore
  };
}

/**
 * Calculate infrastructure ecosystem scores
 */
function calculateEcosystemScores(infra) {
  const scores = { typescript: 0, python: 0, go: 0 };

  // All infrastructure components have good support across languages
  // Award points based on maturity and community size
  const components = ['nats', 'postgres', 'redis', 'qdrant', 'neo4j', 'opentelemetry'];
  const activeComponents = components.filter(comp => infra[comp]).length;

  if (activeComponents > 0) {
    // TS: mature ecosystem, good async support
    scores.typescript = 1.0;

    // Python: mature ecosystem, excellent data science integration
    scores.python = 0.95;

    // Go: excellent performance, native NATS support
    scores.go = 0.9;
  }

  return scores;
}

/**
 * Calculate confidence score
 * Confidence = winner_score / (runner_up_score + epsilon)
 */
function calculateConfidence(scores) {
  const sortedScores = Object.values(scores).sort((a, b) => b - a);
  const winnerScore = sortedScores[0];
  const runnerUpScore = sortedScores[1] || 0;

  // Avoid division by zero, add small epsilon
  return Math.min(1.0, winnerScore / (runnerUpScore + 0.01));
}

/**
 * Generate rationale based on scores
 */
function generateRationale(detections, scores, language) {
  const rationale = [];
  const { languages, frameworks, testing, infra } = detections;

  // File count rationale
  const totalFiles = languages.typescript + languages.python + languages.go;
  if (language === 'TypeScript') {
    const pct = ((languages.typescript / totalFiles) * 100).toFixed(1);
    rationale.push(`${pct}% of codebase is TypeScript (${languages.typescript}/${totalFiles} files)`);
  } else if (language === 'Python') {
    const pct = ((languages.python / totalFiles) * 100).toFixed(1);
    rationale.push(`${pct}% of codebase is Python (${languages.python}/${totalFiles} files)`);
  } else if (language === 'Go') {
    const pct = ((languages.go / totalFiles) * 100).toFixed(1);
    rationale.push(`${pct}% of codebase is Go (${languages.go}/${totalFiles} files)`);
  }

  // Framework rationale
  if (frameworks.backend.length > 0) {
    rationale.push(`Backend frameworks: ${frameworks.backend.join(', ')}`);
  }
  if (frameworks.frontend.length > 0) {
    rationale.push(`Frontend frameworks: ${frameworks.frontend.join(', ')}`);
  }

  // Testing tooling rationale
  if (testing.playwright_ts.length > 0) {
    rationale.push(`${testing.playwright_ts.length} Playwright TypeScript test files`);
  }
  if (testing.playwright_py.length > 0) {
    rationale.push(`${testing.playwright_py.length} Playwright Python test files`);
  }
  if (testing.postman_collections.length > 0) {
    rationale.push(`${testing.postman_collections.length} Postman collections (API testing)`);
  }
  if (testing.k6_scripts.length > 0) {
    rationale.push(`${testing.k6_scripts.length} k6 load test scripts`);
  }

  // Infrastructure rationale
  const activeInfra = Object.entries(infra)
    .filter(([key, value]) => typeof value === 'boolean' && value)
    .map(([key]) => key);

  if (activeInfra.length > 0) {
    rationale.push(`Infrastructure: ${activeInfra.join(', ')}`);
  }

  // Library ecosystem rationale
  rationale.push(`Complete library ecosystem available for ${language}`);

  return rationale;
}

/**
 * Determine fallback language
 */
function determineFallback(scores, winner) {
  const sortedEntries = Object.entries(scores)
    .filter(([lang]) => lang !== winner.toLowerCase())
    .sort((a, b) => b[1] - a[1]);

  if (sortedEntries.length > 0) {
    const fallbackLang = sortedEntries[0][0];
    return fallbackLang.charAt(0).toUpperCase() + fallbackLang.slice(1);
  }

  return 'Python'; // Default fallback
}

/**
 * Main scoring function
 */
function calculateScores(detections) {
  const { languages, frameworks, testing, infra } = detections;

  // Calculate component scores
  const fileScores = calculateFileScores(languages);
  const frameworkScores = calculateFrameworkScores(frameworks);
  const toolingScores = calculateToolingScores(testing);
  const ecosystemScores = calculateEcosystemScores(infra);

  // Calculate weighted final scores
  const finalScores = {
    typescript: (
      WEIGHTS.files * fileScores.typescript +
      WEIGHTS.frameworks * frameworkScores.typescript +
      WEIGHTS.tooling * toolingScores.typescript +
      WEIGHTS.ecosystem * ecosystemScores.typescript
    ),
    python: (
      WEIGHTS.files * fileScores.python +
      WEIGHTS.frameworks * frameworkScores.python +
      WEIGHTS.tooling * toolingScores.python +
      WEIGHTS.ecosystem * ecosystemScores.python
    ),
    go: (
      WEIGHTS.files * fileScores.go +
      WEIGHTS.frameworks * frameworkScores.go +
      WEIGHTS.tooling * toolingScores.go +
      WEIGHTS.ecosystem * ecosystemScores.go
    )
  };

  // Determine winner
  const winner = Object.entries(finalScores).reduce((max, [lang, score]) =>
    score > max.score ? { lang, score } : max,
    { lang: 'typescript', score: finalScores.typescript }
  );

  // Map to proper casing for library lookup
  const languageMap = {
    'typescript': 'TypeScript',
    'python': 'Python',
    'go': 'Go'
  };
  const language = languageMap[winner.lang] || 'TypeScript';

  // Calculate confidence
  const confidence = calculateConfidence(finalScores);

  // Generate rationale
  const rationale = generateRationale(detections, finalScores, language);

  // Determine fallback
  const fallback = determineFallback(finalScores, language);

  // Get library recommendations
  const libraries = LIBRARY_MAP[language];

  return {
    language,
    confidence: parseFloat(confidence.toFixed(4)),
    scores: {
      typescript: parseFloat(finalScores.typescript.toFixed(4)),
      python: parseFloat(finalScores.python.toFixed(4)),
      go: parseFloat(finalScores.go.toFixed(4))
    },
    rationale,
    fallback,
    libraries
  };
}

module.exports = {
  calculateScores,
  WEIGHTS,
  LIBRARY_MAP
};
