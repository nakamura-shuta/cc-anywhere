/**
 * Zip extraction utility with safety checks
 */

import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";

interface ExtractOptions {
  maxFiles?: number;
  maxSize?: number;
  excludePatterns?: string[];
}

interface ExtractResult {
  fileCount: number;
  totalSize: number;
}

export async function extractZip(
  zipBuffer: Buffer,
  targetDir: string,
  options: ExtractOptions = {},
): Promise<ExtractResult> {
  const { maxFiles = 1000, maxSize = 50 * 1024 * 1024, excludePatterns = [] } = options;

  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  let fileCount = 0;
  let totalSize = 0;

  for (const entry of entries) {
    const entryName = entry.entryName;

    // Path traversal check
    const resolved = path.resolve(targetDir, entryName);
    if (!resolved.startsWith(path.resolve(targetDir))) {
      throw new Error(`Path traversal detected: ${entryName}`);
    }

    // Exclude check
    if (shouldExclude(entryName, excludePatterns)) continue;

    if (entry.isDirectory) {
      fs.mkdirSync(resolved, { recursive: true });
      continue;
    }

    // File count check
    fileCount++;
    if (fileCount > maxFiles) {
      throw new Error(`Too many files (max ${maxFiles})`);
    }

    // Size check
    totalSize += entry.header.size;
    if (totalSize > maxSize) {
      throw new Error(`Total size exceeds limit (max ${(maxSize / 1024 / 1024).toFixed(0)}MB)`);
    }

    // Extract file
    const dir = path.dirname(resolved);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(resolved, entry.getData());
  }

  return { fileCount, totalSize };
}

function shouldExclude(entryName: string, patterns: string[]): boolean {
  const parts = entryName.split("/");
  return parts.some((part) =>
    patterns.some((p) =>
      p.startsWith("*") ? part.endsWith(p.slice(1)) : part === p,
    ),
  );
}
