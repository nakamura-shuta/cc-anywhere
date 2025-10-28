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

  // Check if "main" field already exists
  if (packageJson.main) {
    console.log('@openai/codex-sdk already has "main" field, skipping patch');
    process.exit(0);
  }

  // Add the "main" field
  packageJson.main = './dist/index.js';

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
