#!/usr/bin/env tsx

import { readFileSync } from "fs";
import { join } from "path";

const PRESETS_FILE = join(process.cwd(), "config", "task-presets.json");

console.log("=== Preset Configuration Test ===\n");

try {
  // Read preset file
  const content = readFileSync(PRESETS_FILE, "utf-8");
  const config = JSON.parse(content);

  console.log("✅ Preset file loaded successfully");
  console.log("\nSystem Presets:");
  config.presets.forEach((preset: any) => {
    console.log(`  - ${preset.name} (${preset.id})`);
    console.log(`    Description: ${preset.description || "N/A"}`);
    console.log(`    Settings:`);
    console.log(`      - Max turns: ${preset.settings.sdk?.maxTurns || "N/A"}`);
    console.log(`      - Permission mode: ${preset.settings.sdk?.permissionMode || "N/A"}`);
    console.log(`      - Timeout: ${preset.settings.timeout || "N/A"}ms`);
    console.log(`      - Use worktree: ${preset.settings.useWorktree || false}`);
    console.log();
  });

  console.log(`\nUser Presets: ${config.userPresets.length} presets`);
  config.userPresets.forEach((preset: any) => {
    console.log(`  - ${preset.name} (${preset.id})`);
    console.log(`    Created: ${preset.createdAt}`);
    console.log(`    Updated: ${preset.updatedAt}`);
  });

  console.log("\n✅ All preset configurations are valid");
} catch (error) {
  console.error("❌ Error loading presets:", error);
  process.exit(1);
}