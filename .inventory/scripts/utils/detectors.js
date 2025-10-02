/**
 * Comprehensive pattern-based detectors
 * Detects languages, frameworks, IaC, API contracts, testing, security
 */

const { readFileSafe } = require('./fs-walker');

/**
 * Detect languages by file extension
 */
function detectLanguages(files) {
  return {
    typescript: files.filter(f => /\.(ts|tsx)$/.test(f.ext)).length,
    javascript: files.filter(f => /\.(js|jsx)$/.test(f.ext) && !f.path.includes('node_modules')).length,
    python: files.filter(f => f.ext === '.py').length,
    go: files.filter(f => f.ext === '.go').length
  };
}

/**
 * Detect lockfiles and dependency management
 */
function detectLockfiles(files) {
  return files
    .filter(f =>
      /^package\.json$/.test(f.name) ||
      /^package-lock\.json$/.test(f.name) ||
      /^yarn\.lock$/.test(f.name) ||
      /^pnpm-lock\.yaml$/.test(f.name) ||
      /^poetry\.lock$/.test(f.name) ||
      /^Pipfile\.lock$/.test(f.name) ||
      /^requirements.*\.txt$/.test(f.name) ||
      /^go\.mod$/.test(f.name) ||
      /^go\.sum$/.test(f.name) ||
      /^Cargo\.lock$/.test(f.name)
    )
    .map(f => f.path);
}

/**
 * Detect backend and frontend frameworks
 */
async function detectFrameworks(files) {
  const frameworks = {
    backend: [],
    frontend: []
  };

  // Look for package.json files to detect dependencies
  const packageJsonFiles = files.filter(f => f.name === 'package.json');

  for (const pkgFile of packageJsonFiles) {
    const content = await readFileSafe(pkgFile.fullPath);
    if (!content) continue;

    try {
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Backend frameworks
      if (deps['express']) frameworks.backend.push('Express');
      if (deps['fastify']) frameworks.backend.push('Fastify');
      if (deps['@nestjs/core']) frameworks.backend.push('NestJS');
      if (deps['koa']) frameworks.backend.push('Koa');
      if (deps['hapi']) frameworks.backend.push('Hapi');

      // Frontend frameworks
      if (deps['react']) frameworks.frontend.push('React');
      if (deps['next']) frameworks.frontend.push('Next.js');
      if (deps['vue']) frameworks.frontend.push('Vue');
      if (deps['@angular/core']) frameworks.frontend.push('Angular');
      if (deps['svelte']) frameworks.frontend.push('Svelte');
    } catch {
      // Invalid JSON, skip
    }
  }

  // Check for Python frameworks
  const pythonFiles = files.filter(f => f.ext === '.py');
  for (const pyFile of pythonFiles.slice(0, 50)) { // Sample first 50 files
    const content = await readFileSafe(pyFile.fullPath);
    if (!content) continue;

    if (/from fastapi import|import fastapi/.test(content) && !frameworks.backend.includes('FastAPI')) {
      frameworks.backend.push('FastAPI');
    }
    if (/from flask import|import flask/.test(content) && !frameworks.backend.includes('Flask')) {
      frameworks.backend.push('Flask');
    }
    if (/from django import|import django/.test(content) && !frameworks.backend.includes('Django')) {
      frameworks.backend.push('Django');
    }
  }

  // Deduplicate
  frameworks.backend = [...new Set(frameworks.backend)];
  frameworks.frontend = [...new Set(frameworks.frontend)];

  return frameworks;
}

/**
 * Detect testing frameworks and artifacts
 */
function detectTesting(files) {
  return {
    playwright_ts: files.filter(f =>
      /playwright\.config\.(ts|js)/.test(f.name) ||
      (/\.(spec|test)\.(ts|tsx)$/.test(f.name) && f.path.includes('playwright')) ||
      (/e2e.*\.(ts|tsx)$/.test(f.name))
    ).map(f => f.path),

    playwright_py: files.filter(f =>
      /conftest\.py/.test(f.name) ||
      /pytest\.ini/.test(f.name) ||
      (/test_.*\.py$/.test(f.name) && f.path.includes('playwright'))
    ).map(f => f.path),

    postman_collections: files.filter(f =>
      f.name.endsWith('.postman_collection.json')
    ).map(f => f.path),

    postman_environments: files.filter(f =>
      f.name.endsWith('.postman_environment.json')
    ).map(f => f.path),

    k6_scripts: files.filter(f =>
      /k6.*\.js$/.test(f.name) ||
      /load[-_]test.*\.js$/.test(f.name) ||
      f.path.includes('k6/')
    ).map(f => f.path),

    newman_configs: files.filter(f =>
      /newman.*\.(json|js)$/.test(f.name)
    ).map(f => f.path)
  };
}

/**
 * Detect Infrastructure as Code and configurations
 */
async function detectInfra(files) {
  const infra = {
    helm: files.filter(f =>
      /Chart\.yaml$/.test(f.name) ||
      /values.*\.yaml$/.test(f.name) ||
      f.path.includes('templates/') && f.ext === '.yaml'
    ).map(f => f.path),

    terraform: files.filter(f =>
      f.ext === '.tf' ||
      /terraform\.tfvars/.test(f.name) ||
      /\.tfstate/.test(f.name)
    ).map(f => f.path),

    kubernetes: files.filter(f =>
      (f.ext === '.yaml' || f.ext === '.yml') &&
      (f.path.includes('k8s/') || f.path.includes('kubernetes/')) &&
      !/Chart\.yaml/.test(f.name)
    ).map(f => f.path),

    docker: files.filter(f =>
      /Dockerfile/.test(f.name) ||
      /docker-compose.*\.ya?ml$/.test(f.name) ||
      /\.dockerignore/.test(f.name)
    ).map(f => f.path),

    // Infrastructure components (detected from dependencies)
    nats: false,
    postgres: false,
    redis: false,
    qdrant: false,
    neo4j: false,
    opentelemetry: false
  };

  // Check package.json for infrastructure dependencies
  const packageJsonFiles = files.filter(f => f.name === 'package.json');
  for (const pkgFile of packageJsonFiles) {
    const content = await readFileSafe(pkgFile.fullPath);
    if (!content) continue;

    try {
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['nats'] || deps['nats.js']) infra.nats = true;
      if (deps['pg'] || deps['postgres']) infra.postgres = true;
      if (deps['redis'] || deps['ioredis']) infra.redis = true;
      if (deps['@qdrant/js-client-rest'] || deps['qdrant-client']) infra.qdrant = true;
      if (deps['neo4j-driver']) infra.neo4j = true;
      if (deps['@opentelemetry/sdk-node'] || deps['@opentelemetry/api']) infra.opentelemetry = true;
    } catch {
      // Invalid JSON, skip
    }
  }

  // Check Python requirements for infrastructure
  const reqFiles = files.filter(f => /requirements.*\.txt$/.test(f.name));
  for (const reqFile of reqFiles) {
    const content = await readFileSafe(reqFile.fullPath);
    if (!content) continue;

    if (/nats-py/.test(content)) infra.nats = true;
    if (/psycopg|asyncpg/.test(content)) infra.postgres = true;
    if (/redis/.test(content)) infra.redis = true;
    if (/qdrant-client/.test(content)) infra.qdrant = true;
    if (/neo4j/.test(content)) infra.neo4j = true;
    if (/opentelemetry/.test(content)) infra.opentelemetry = true;
  }

  return infra;
}

/**
 * Detect API contract specifications
 */
function detectApiContracts(files) {
  return {
    openapi: files.filter(f =>
      /openapi\.(json|ya?ml)$/.test(f.name) ||
      /openapi-spec\.(json|ya?ml)$/.test(f.name)
    ).map(f => f.path),

    swagger: files.filter(f =>
      /swagger\.(json|ya?ml)$/.test(f.name) ||
      /swagger-spec\.(json|ya?ml)$/.test(f.name)
    ).map(f => f.path)
  };
}

/**
 * Detect security-related files
 */
async function detectSecurity(files) {
  const security = {
    env_files: files.filter(f =>
      /^\.env/.test(f.name) ||
      /\.env\.(example|sample|template)$/.test(f.name)
    ).map(f => f.path),

    license_files: files.filter(f =>
      /^LICENSE/.test(f.name) ||
      /^COPYING/.test(f.name)
    ).map(f => f.path),

    secret_patterns: []
  };

  // Basic secret pattern detection (sample files only to avoid performance issues)
  const textFiles = files.filter(f =>
    ['.js', '.ts', '.py', '.go', '.env', '.yaml', '.yml', '.json'].includes(f.ext)
  ).slice(0, 100); // Sample first 100 files

  const secretPatterns = [
    /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9_-]{20,}['"]/i,
    /secret[_-]?key\s*[:=]\s*['"][a-zA-Z0-9_-]{20,}['"]/i,
    /password\s*[:=]\s*['"][^'"]{8,}['"]/i,
    /token\s*[:=]\s*['"][a-zA-Z0-9_-]{20,}['"]/i
  ];

  for (const file of textFiles) {
    const content = await readFileSafe(file.fullPath);
    if (!content) continue;

    if (secretPatterns.some(pattern => pattern.test(content))) {
      security.secret_patterns.push(file.path);
    }
  }

  return security;
}

/**
 * Run all detectors
 */
async function detectAll(files, rootDir) {
  const languages = detectLanguages(files);
  const lockfiles = detectLockfiles(files);
  const frameworks = await detectFrameworks(files);
  const testing = detectTesting(files);
  const infra = await detectInfra(files);
  const api_contracts = detectApiContracts(files);
  const security = await detectSecurity(files);

  return {
    languages,
    lockfiles,
    frameworks,
    testing,
    infra,
    api_contracts,
    security
  };
}

module.exports = {
  detectLanguages,
  detectLockfiles,
  detectFrameworks,
  detectTesting,
  detectInfra,
  detectApiContracts,
  detectSecurity,
  detectAll
};
