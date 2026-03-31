/**
 * WorkspaceService - ワークスペースのアップロード・管理
 */

import type { Database } from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { logger } from "../utils/logger.js";

export interface Workspace {
  id: string;
  userId: string;
  name: string;
  path: string;
  fileCount: number;
  totalSize: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface FileTreeEntry {
  path: string;
  type: "file" | "directory";
  size?: number;
}

const TTL_DAYS = 7;
const MAX_WORKSPACES_PER_USER = 5;
const MAX_FILE_COUNT = 1000;
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB

// Files/dirs to exclude during extraction
const EXCLUDE_PATTERNS = [
  "node_modules", ".git", "dist", "build", "__pycache__",
  ".next", ".venv", ".DS_Store", "*.pyc",
];

export class WorkspaceService {
  private workspaceRoot: string;

  constructor(
    private db: Database,
    workspaceRoot?: string,
  ) {
    this.workspaceRoot = workspaceRoot
      || process.env.WORKSPACE_ROOT
      || path.resolve(process.cwd(), "../workspaces");
    // Directory created lazily on first upload (not in constructor)
  }

  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  async create(userId: string, zipBuffer: Buffer, name: string): Promise<Workspace> {
    // Check user workspace limit
    const existing = this.listByUser(userId);
    if (existing.length >= MAX_WORKSPACES_PER_USER) {
      throw new Error(`Maximum ${MAX_WORKSPACES_PER_USER} workspaces per user`);
    }

    const id = uuidv4();
    const wsPath = path.join(this.workspaceRoot, userId, id);
    fs.mkdirSync(wsPath, { recursive: true });

    try {
      // Extract zip
      const { extractZip } = await import("../utils/zip-extractor.js");
      const { fileCount, totalSize } = await extractZip(zipBuffer, wsPath, {
        maxFiles: MAX_FILE_COUNT,
        maxSize: MAX_TOTAL_SIZE,
        excludePatterns: EXCLUDE_PATTERNS,
      });

      const now = new Date();
      const expiresAt = new Date(now.getTime() + TTL_DAYS * 24 * 60 * 60 * 1000);

      this.db.prepare(`
        INSERT INTO workspaces (id, user_id, name, path, file_count, total_size, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, userId, name, wsPath, fileCount, totalSize, now.toISOString(), expiresAt.toISOString());

      logger.info("Workspace created", { id, userId, name, fileCount, totalSize });
      return this.get(id)!;
    } catch (error) {
      // Rollback: remove directory on failure
      fs.rmSync(wsPath, { recursive: true, force: true });
      throw error;
    }
  }

  get(id: string): Workspace | null {
    const row = this.db.prepare("SELECT * FROM workspaces WHERE id = ?").get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  getByUserAndId(userId: string, id: string): Workspace | null {
    const row = this.db.prepare(
      "SELECT * FROM workspaces WHERE id = ? AND user_id = ?",
    ).get(id, userId) as any;
    return row ? this.mapRow(row) : null;
  }

  listByUser(userId: string): Workspace[] {
    return this.db.prepare(
      "SELECT * FROM workspaces WHERE user_id = ? ORDER BY created_at DESC",
    ).all(userId).map((row: any) => this.mapRow(row));
  }

  getTree(id: string, maxDepth = 3): FileTreeEntry[] {
    const ws = this.get(id);
    if (!ws) return [];

    const entries: FileTreeEntry[] = [];
    this.walkDir(ws.path, ws.path, entries, 0, maxDepth);
    return entries;
  }

  delete(id: string): boolean {
    const ws = this.get(id);
    if (!ws) return false;

    // Remove files
    fs.rmSync(ws.path, { recursive: true, force: true });

    // Remove parent dir if empty
    const parentDir = path.dirname(ws.path);
    try {
      const remaining = fs.readdirSync(parentDir);
      if (remaining.length === 0) fs.rmdirSync(parentDir);
    } catch { /* ignore */ }

    // Remove DB record
    this.db.prepare("DELETE FROM workspaces WHERE id = ?").run(id);
    logger.info("Workspace deleted", { id });
    return true;
  }

  cleanupExpired(): number {
    const now = new Date().toISOString();
    const expired = this.db.prepare(
      "SELECT * FROM workspaces WHERE expires_at <= ?",
    ).all(now) as any[];

    let count = 0;
    for (const row of expired) {
      const ws = this.mapRow(row);
      fs.rmSync(ws.path, { recursive: true, force: true });
      this.db.prepare("DELETE FROM workspaces WHERE id = ?").run(ws.id);
      count++;
    }

    if (count > 0) logger.info(`Cleaned up ${count} expired workspaces`);
    return count;
  }

  isWorkspacePath(dir: string): boolean {
    const resolved = path.resolve(dir);
    return resolved.startsWith(path.resolve(this.workspaceRoot));
  }

  private walkDir(base: string, dir: string, entries: FileTreeEntry[], depth: number, maxDepth: number): void {
    if (depth > maxDepth) return;
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (this.shouldExclude(item.name)) continue;
        const fullPath = path.join(dir, item.name);
        const relativePath = path.relative(base, fullPath);
        if (item.isDirectory()) {
          entries.push({ path: relativePath + "/", type: "directory" });
          this.walkDir(base, fullPath, entries, depth + 1, maxDepth);
        } else {
          const stat = fs.statSync(fullPath);
          entries.push({ path: relativePath, type: "file", size: stat.size });
        }
      }
    } catch { /* ignore permission errors */ }
  }

  private shouldExclude(name: string): boolean {
    return EXCLUDE_PATTERNS.some((p) =>
      p.startsWith("*") ? name.endsWith(p.slice(1)) : name === p,
    );
  }

  private mapRow(row: any): Workspace {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      path: row.path,
      fileCount: row.file_count,
      totalSize: row.total_size,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
    };
  }
}
