#!/usr/bin/env node

/**
 * Patch @openai/codex-sdk package.json to add missing "main" field
 * This fixes the error: No "exports" main defined in package.json
 */

const fs = require('fs');
const path = require('path');

// Try both backend/node_modules and root node_modules
const POSSIBLE_PATHS = [
  path.join(__dirname, '..', 'node_modules', '@openai', 'codex-sdk', 'package.json'),
  path.join(__dirname, '..', '..', 'node_modules', '@openai', 'codex-sdk', 'package.json'),
];

let PACKAGE_JSON_PATH = null;
for (const p of POSSIBLE_PATHS) {
  if (fs.existsSync(p)) {
    PACKAGE_JSON_PATH = p;
    break;
  }
}

try {
  // Check if the package exists
  if (!PACKAGE_JSON_PATH) {
    console.log('@openai/codex-sdk not found, skipping patch');
    process.exit(0);
  }

  // Read the package.json
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));

  let patched = false;

  // Check and add "main" field if missing
  if (!packageJson.main) {
    packageJson.main = './dist/index.js';
    patched = true;
    console.log('Added "main" field');
  }

  // Check and add "require" in exports if missing
  if (packageJson.exports && packageJson.exports['.']) {
    if (!packageJson.exports['.'].require) {
      packageJson.exports['.'].require = './dist/index.js';
      patched = true;
      console.log('Added "require" to exports');
    }
  }

  // If nothing was patched, skip
  if (!patched) {
    console.log('@openai/codex-sdk already has "main" field and exports.require, skipping patch');
    process.exit(0);
  }

  // Write back
  fs.writeFileSync(
    PACKAGE_JSON_PATH,
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf-8'
  );

  console.log('✅ Successfully patched @openai/codex-sdk package.json');
} catch (error) {
  console.error('❌ Failed to patch @openai/codex-sdk:', error.message);
  process.exit(1);
}
