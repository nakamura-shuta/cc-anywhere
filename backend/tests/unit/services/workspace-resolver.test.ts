import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";
import { WorkspaceService } from "../../../src/services/workspace-service";
import {
  setSharedWorkspaceService,
  resolveWorkspace,
} from "../../../src/services/workspace-resolver";

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

describe("workspace-resolver", () => {
  let db: Database.Database;
  let service: WorkspaceService;
  let tmpDir: string;

  beforeEach(() => {
    db = createTestDb();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ws-resolver-test-"));
    service = new WorkspaceService(db, tmpDir);
    setSharedWorkspaceService(service);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should resolve workspaceId to path for correct user", async () => {
    const zip = new AdmZip();
    zip.addFile("test.txt", Buffer.from("hello"));
    const ws = await service.create("user-1", zip.toBuffer(), "test");

    const resolved = resolveWorkspace(ws.id, "user-1");
    expect(resolved).toBe(ws.path);
  });

  it("should throw for wrong user", async () => {
    const zip = new AdmZip();
    zip.addFile("test.txt", Buffer.from("hello"));
    const ws = await service.create("user-1", zip.toBuffer(), "test");

    expect(() => resolveWorkspace(ws.id, "user-2")).toThrow("not found or not owned");
  });

  it("should return null when workspaceId is undefined", () => {
    expect(resolveWorkspace(undefined, "user-1")).toBeNull();
  });

  it("should throw for non-existent workspaceId", () => {
    expect(() => resolveWorkspace("nonexistent", "user-1")).toThrow("not found");
  });
});
