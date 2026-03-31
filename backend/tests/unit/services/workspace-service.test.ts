import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";
import { WorkspaceService } from "../../../src/services/workspace-service";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE workspaces (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      file_count INTEGER DEFAULT 0,
      total_size INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME
    )
  `);
  return db;
}

function createTestZip(files: Record<string, string>): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.from(content));
  }
  return zip.toBuffer();
}

describe("WorkspaceService", () => {
  let db: Database.Database;
  let service: WorkspaceService;
  let tmpDir: string;

  beforeEach(() => {
    db = createTestDb();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ws-test-"));
    service = new WorkspaceService(db, tmpDir);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("create", () => {
    it("should create workspace from zip", async () => {
      const zip = createTestZip({
        "src/index.ts": "console.log('hello');",
        "package.json": '{"name":"test"}',
      });

      const ws = await service.create("user-1", zip, "my-project");

      expect(ws.id).toBeDefined();
      expect(ws.userId).toBe("user-1");
      expect(ws.name).toBe("my-project");
      expect(ws.fileCount).toBe(2);
      expect(ws.totalSize).toBeGreaterThan(0);
      expect(ws.expiresAt).toBeDefined();

      // Files should exist on disk
      expect(fs.existsSync(path.join(ws.path, "src/index.ts"))).toBe(true);
      expect(fs.existsSync(path.join(ws.path, "package.json"))).toBe(true);
    });

    it("should exclude node_modules", async () => {
      const zip = createTestZip({
        "src/app.ts": "export {}",
        "node_modules/lib/index.js": "module.exports = {}",
      });

      const ws = await service.create("user-1", zip, "test");

      expect(ws.fileCount).toBe(1); // only src/app.ts
      expect(fs.existsSync(path.join(ws.path, "node_modules"))).toBe(false);
    });

    it("should exclude .git", async () => {
      const zip = createTestZip({
        "README.md": "# Test",
        ".git/config": "[core]",
      });

      const ws = await service.create("user-1", zip, "test");

      expect(ws.fileCount).toBe(1);
      expect(fs.existsSync(path.join(ws.path, ".git"))).toBe(false);
    });

    it("should enforce max workspaces per user", async () => {
      for (let i = 0; i < 5; i++) {
        const zip = createTestZip({ [`file${i}.txt`]: `content${i}` });
        await service.create("user-1", zip, `ws-${i}`);
      }

      const zip = createTestZip({ "extra.txt": "too many" });
      await expect(service.create("user-1", zip, "ws-6")).rejects.toThrow("Maximum");
    });

    it("should handle zip with only excluded files", async () => {
      const zip = createTestZip({
        "node_modules/lib.js": "module.exports = {}",
        ".git/config": "[core]",
      });

      const ws = await service.create("user-1", zip, "empty-after-filter");
      expect(ws.fileCount).toBe(0);
    });
  });

  describe("get / getByUserAndId", () => {
    it("should get workspace by id", async () => {
      const zip = createTestZip({ "a.txt": "hello" });
      const created = await service.create("user-1", zip, "test");

      const found = service.get(created.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe("test");
    });

    it("should enforce ownership in getByUserAndId", async () => {
      const zip = createTestZip({ "a.txt": "hello" });
      const created = await service.create("user-1", zip, "test");

      expect(service.getByUserAndId("user-1", created.id)).not.toBeNull();
      expect(service.getByUserAndId("user-2", created.id)).toBeNull();
    });
  });

  describe("listByUser", () => {
    it("should list workspaces for user", async () => {
      await service.create("user-1", createTestZip({ "a.txt": "a" }), "ws-a");
      await service.create("user-1", createTestZip({ "b.txt": "b" }), "ws-b");
      await service.create("user-2", createTestZip({ "c.txt": "c" }), "ws-c");

      expect(service.listByUser("user-1")).toHaveLength(2);
      expect(service.listByUser("user-2")).toHaveLength(1);
    });
  });

  describe("getTree", () => {
    it("should return file tree", async () => {
      const zip = createTestZip({
        "src/index.ts": "export {}",
        "src/utils/helper.ts": "export {}",
        "README.md": "# Test",
      });
      const ws = await service.create("user-1", zip, "test");

      const tree = service.getTree(ws.id);
      expect(tree.length).toBeGreaterThan(0);

      const files = tree.filter((e) => e.type === "file");
      expect(files.some((f) => f.path === "README.md")).toBe(true);
      expect(files.some((f) => f.path === "src/index.ts")).toBe(true);
    });
  });

  describe("delete", () => {
    it("should delete workspace and files", async () => {
      const zip = createTestZip({ "a.txt": "hello" });
      const ws = await service.create("user-1", zip, "test");
      const wsPath = ws.path;

      expect(fs.existsSync(wsPath)).toBe(true);

      service.delete(ws.id);

      expect(fs.existsSync(wsPath)).toBe(false);
      expect(service.get(ws.id)).toBeNull();
    });
  });

  describe("cleanupExpired", () => {
    it("should delete expired workspaces", async () => {
      const zip = createTestZip({ "a.txt": "hello" });
      const ws = await service.create("user-1", zip, "test");

      // Manually set expires_at to past
      db.prepare("UPDATE workspaces SET expires_at = ? WHERE id = ?").run(
        new Date(Date.now() - 1000).toISOString(),
        ws.id,
      );

      const count = service.cleanupExpired();
      expect(count).toBe(1);
      expect(service.get(ws.id)).toBeNull();
    });
  });

  describe("isWorkspacePath", () => {
    it("should return true for workspace paths", () => {
      expect(service.isWorkspacePath(path.join(tmpDir, "user-1", "ws-1"))).toBe(true);
    });

    it("should return false for non-workspace paths", () => {
      expect(service.isWorkspacePath("/tmp/other")).toBe(false);
    });
  });
});
