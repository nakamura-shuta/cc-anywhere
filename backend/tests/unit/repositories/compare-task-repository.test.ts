import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { CompareTaskRepositoryImpl } from "../../../src/repositories/compare-task-repository.js";
import type { CompareTaskEntity, CompareTaskStatus } from "../../../src/repositories/types.js";

describe("CompareTaskRepositoryImpl", () => {
  let db: Database.Database;
  let repository: CompareTaskRepositoryImpl;

  beforeEach(() => {
    // インメモリデータベースを作成
    db = new Database(":memory:");
    repository = new CompareTaskRepositoryImpl(db);
  });

  afterEach(() => {
    db.close();
  });

  const createTestEntity = (overrides?: Partial<CompareTaskEntity>): CompareTaskEntity => ({
    id: "cmp_test123",
    instruction: "Test instruction",
    repositoryId: "test-repo",
    repositoryPath: "/path/to/repo",
    baseCommit: "abc123def",
    claudeTaskId: "task_claude_1",
    codexTaskId: "task_codex_1",
    geminiTaskId: "task_gemini_1",
    status: "pending" as CompareTaskStatus,
    createdAt: new Date(),
    completedAt: null,
    ...overrides,
  });

  describe("create", () => {
    it("should create a new compare task", async () => {
      const entity = createTestEntity();

      const result = await repository.create(entity);

      expect(result.id).toBe(entity.id);
      expect(result.instruction).toBe(entity.instruction);
    });

    it("should retrieve created task by id", async () => {
      const entity = createTestEntity();
      await repository.create(entity);

      const found = await repository.findById(entity.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(entity.id);
      expect(found?.instruction).toBe(entity.instruction);
      expect(found?.status).toBe("pending");
    });
  });

  describe("findByStatus", () => {
    it("should find tasks by status", async () => {
      await repository.create(createTestEntity({ id: "cmp_1", status: "running" }));
      await repository.create(createTestEntity({ id: "cmp_2", status: "running" }));
      await repository.create(createTestEntity({ id: "cmp_3", status: "completed" }));

      const runningTasks = await repository.findByStatus("running");

      expect(runningTasks).toHaveLength(2);
      expect(runningTasks.every((t) => t.status === "running")).toBe(true);
    });
  });

  describe("findRunningTasks", () => {
    it("should find all running, pending, or cancelling tasks", async () => {
      await repository.create(createTestEntity({ id: "cmp_1", status: "pending" }));
      await repository.create(createTestEntity({ id: "cmp_2", status: "running" }));
      await repository.create(createTestEntity({ id: "cmp_3", status: "cancelling" }));
      await repository.create(createTestEntity({ id: "cmp_4", status: "completed" }));

      const runningTasks = await repository.findRunningTasks();

      expect(runningTasks).toHaveLength(3);
    });
  });

  describe("countRunningTasks", () => {
    it("should count running tasks correctly", async () => {
      await repository.create(createTestEntity({ id: "cmp_1", status: "pending" }));
      await repository.create(createTestEntity({ id: "cmp_2", status: "running" }));
      await repository.create(createTestEntity({ id: "cmp_3", status: "completed" }));

      const count = await repository.countRunningTasks();

      expect(count).toBe(2);
    });
  });

  describe("updateStatus", () => {
    it("should update task status", async () => {
      const entity = createTestEntity();
      await repository.create(entity);

      await repository.updateStatus(entity.id, "running");

      const found = await repository.findById(entity.id);
      expect(found?.status).toBe("running");
    });
  });

  describe("markCompleted", () => {
    it("should mark task as completed with timestamp", async () => {
      const entity = createTestEntity();
      await repository.create(entity);

      await repository.markCompleted(entity.id, "completed");

      const found = await repository.findById(entity.id);
      expect(found?.status).toBe("completed");
      expect(found?.completedAt).not.toBeNull();
    });
  });

  describe("delete", () => {
    it("should delete a task", async () => {
      const entity = createTestEntity();
      await repository.create(entity);

      const deleted = await repository.delete(entity.id);

      expect(deleted).toBe(true);
      const found = await repository.findById(entity.id);
      expect(found).toBeNull();
    });
  });

  describe("findMany", () => {
    it("should return paginated results", async () => {
      for (let i = 0; i < 10; i++) {
        await repository.create(createTestEntity({ id: `cmp_${i}` }));
      }

      const result = await repository.findMany([], { page: 1, limit: 5 });

      expect(result.items).toHaveLength(5);
      expect(result.total).toBe(10);
      expect(result.totalPages).toBe(2);
    });
  });
});
