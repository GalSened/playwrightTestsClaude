/**
 * Cross-platform file system walker
 * Pure Node.js implementation - no shell dependencies
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Default ignore patterns
 */
const DEFAULT_IGNORE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /coverage/,
  /__pycache__/,
  /\.next/,
  /\.vite/,
  /\.nuxt/,
  /\.cache/,
  /\.pytest_cache/,
  /\.mypy_cache/,
  /\.tox/,
  /\.venv/,
  /venv/,
  /env/,
  /target/,
  /\.idea/,
  /\.vscode/,
  /\.DS_Store/,
  /thumbs\.db/i,
  /\.log$/,
  /\.lock$/
];

/**
 * Walk directory tree and return file metadata
 * @param {string} rootDir - Root directory to scan
 * @param {RegExp[]} ignorePatterns - Patterns to ignore (optional)
 * @returns {Promise<Array<{path: string, fullPath: string, name: string, ext: string}>>}
 */
async function walkFiles(rootDir, ignorePatterns = []) {
  const files = [];
  const patterns = [...DEFAULT_IGNORE_PATTERNS, ...ignorePatterns];

  /**
   * Recursive walker
   */
  async function walk(currentPath) {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/'); // Normalize to forward slashes

        // Check ignore patterns
        if (patterns.some(pattern => pattern.test(relativePath) || pattern.test(entry.name))) {
          continue;
        }

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          files.push({
            path: relativePath,
            fullPath,
            name: entry.name,
            ext: path.extname(entry.name)
          });
        }
      }
    } catch (err) {
      // Skip directories we can't read (permissions, symlink loops, etc.)
      if (err.code !== 'EACCES' && err.code !== 'ELOOP') {
        console.warn(`Warning: Could not read directory ${currentPath}: ${err.message}`);
      }
    }
  }

  await walk(rootDir);
  return files;
}

/**
 * Read file contents safely
 * @param {string} filePath - Full path to file
 * @param {string} encoding - File encoding (default: utf8)
 * @returns {Promise<string|null>} File contents or null if unreadable
 */
async function readFileSafe(filePath, encoding = 'utf8') {
  try {
    return await fs.readFile(filePath, encoding);
  } catch (err) {
    return null;
  }
}

/**
 * Check if path exists
 * @param {string} targetPath - Path to check
 * @returns {Promise<boolean>}
 */
async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  walkFiles,
  readFileSafe,
  pathExists,
  DEFAULT_IGNORE_PATTERNS
};
