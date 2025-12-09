import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { CompareService } from "../../../../src/services/compare/compare-service.js";
import type { CompareTaskRepositoryImpl } from "../../../../src/repositories/compare-task-repository.js";
import type { CompareTaskEntity } from "../../../../src/repositories/types.js";
import { CompareErrorCode } from "../../../../src/services/compare/types.js";
import { AppError } from "../../../../src/utils/errors.js";

// モックの設定
vi.mock("../../../../src/services/worktree/git-service.js", () => ({
  GitService: vi.fn().mockImplementation(() => ({
    isGitRepository: vi.fn().mockResolvedValue(true),
    createWorktree: vi.fn().mockResolvedValue({ success: true }),
    removeWorktree: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

vi.mock("fs", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = (await importOriginal()) as typeof import("fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn().mockReturnValue(true),
      mkdirSync: vi.fn(),
      createWriteStream: actual.createWriteStream,
    },
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
  };
});

vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

vi.mock("util", () => ({
  promisify: vi.fn().mockImplementation(() => vi.fn().mockResolvedValue({ stdout: "abc123\n" })),
}));

describe("CompareService", () => {
  let compareService: CompareService;
  let mockRepository: Partial<CompareTaskRepositoryImpl>;
  let mockTaskQueue: { add: Mock; get: Mock; cancel: Mock };
  let mockGetRepositories: Mock;

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn(),
      findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      create: vi.fn().mockResolvedValue({}),
      countRunningTasks: vi.fn().mockResolvedValue(0),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      markCompleted: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(true),
    };

    mockTaskQueue = {
      add: vi.fn().mockReturnValue("task_123"),
      get: vi.fn().mockReturnValue({ status: "pending" }),
      cancel: vi.fn(),
    };

    mockGetRepositories = vi
      .fn()
      .mockReturnValue([{ name: "test-repo", path: "/path/to/test-repo" }]);

    compareService = new CompareService(
      mockRepository as CompareTaskRepositoryImpl,
      mockTaskQueue,
      mockGetRepositories,
    );
  });

  describe("createCompareTask", () => {
    it("should create a compare task successfully", async () => {
      const result = await compareService.createCompareTask({
        instruction: "Test instruction",
        repositoryId: "test-repo",
      });

      expect(result).toHaveProperty("compareId");
      expect(result).toHaveProperty("claudeTaskId");
      expect(result).toHaveProperty("codexTaskId");
      expect(result).toHaveProperty("geminiTaskId");
      expect(result.status).toBe("running");
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockTaskQueue.add).toHaveBeenCalledTimes(3);
    });

    it("should throw error when repository not found", async () => {
      mockGetRepositories.mockReturnValue([]);

      await expect(
        compareService.createCompareTask({
          instruction: "Test instruction",
          repositoryId: "non-existent-repo",
        }),
      ).rejects.toThrow(AppError);

      try {
        await compareService.createCompareTask({
          instruction: "Test instruction",
          repositoryId: "non-existent-repo",
        });
      } catch (error) {
        expect((error as AppError).code).toBe(CompareErrorCode.REPOSITORY_NOT_FOUND);
      }
    });

    it("should throw error when max concurrent tasks reached", async () => {
      (mockRepository.countRunningTasks as Mock).mockResolvedValue(3);

      await expect(
        compareService.createCompareTask({
          instruction: "Test instruction",
          repositoryId: "test-repo",
        }),
      ).rejects.toThrow(AppError);

      try {
        await compareService.createCompareTask({
          instruction: "Test instruction",
          repositoryId: "test-repo",
        });
      } catch (error) {
        expect((error as AppError).code).toBe(CompareErrorCode.TOO_MANY_COMPARE_TASKS);
        expect((error as AppError).statusCode).toBe(429);
      }
    });
  });

  describe("getCompareTask", () => {
    it("should return compare task when found", async () => {
      const mockTask: CompareTaskEntity = {
        id: "cmp_test123",
        instruction: "Test instruction",
        repositoryId: "test-repo",
        repositoryPath: "/path/to/repo",
        baseCommit: "abc123",
        claudeTaskId: "task_1",
        codexTaskId: "task_2",
        geminiTaskId: "task_3",
        status: "running",
        createdAt: new Date(),
        completedAt: null,
      };

      (mockRepository.findById as Mock).mockResolvedValue(mockTask);

      const result = await compareService.getCompareTask("cmp_test123");

      expect(result).not.toBeNull();
      expect(result?.compareId).toBe("cmp_test123");
      expect(result?.status).toBe("running");
    });

    it("should return null when task not found", async () => {
      (mockRepository.findById as Mock).mockResolvedValue(null);

      const result = await compareService.getCompareTask("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("listCompareTasks", () => {
    it("should return list of compare tasks", async () => {
      const mockTasks: CompareTaskEntity[] = [
        {
          id: "cmp_1",
          instruction: "Test 1",
          repositoryId: "repo1",
          repositoryPath: "/path/to/repo1",
          baseCommit: "abc123",
          claudeTaskId: "task_1",
          codexTaskId: "task_2",
          geminiTaskId: "task_3",
          status: "completed",
          createdAt: new Date(),
          completedAt: new Date(),
        },
      ];

      (mockRepository.findMany as Mock).mockResolvedValue({
        items: mockTasks,
        total: 1,
      });

      const result = await compareService.listCompareTasks(20, 0);

      expect(result.tasks).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe("cancelCompareTask", () => {
    it("should cancel a compare task successfully", async () => {
      const mockTask: CompareTaskEntity = {
        id: "cmp_test123",
        instruction: "Test instruction",
        repositoryId: "test-repo",
        repositoryPath: "/path/to/repo",
        baseCommit: "abc123",
        claudeTaskId: "task_1",
        codexTaskId: "task_2",
        geminiTaskId: "task_3",
        status: "running",
        createdAt: new Date(),
        completedAt: null,
      };

      (mockRepository.findById as Mock).mockResolvedValue(mockTask);

      const result = await compareService.cancelCompareTask("cmp_test123");

      expect(result.compareId).toBe("cmp_test123");
      expect(result.status).toBe("cancelled");
      expect(mockRepository.updateStatus).toHaveBeenCalledWith("cmp_test123", "cancelling");
      expect(mockRepository.markCompleted).toHaveBeenCalledWith("cmp_test123", "cancelled");
      expect(mockTaskQueue.cancel).toHaveBeenCalledTimes(3);
    });

    it("should throw error when task not found", async () => {
      (mockRepository.findById as Mock).mockResolvedValue(null);

      await expect(compareService.cancelCompareTask("non-existent")).rejects.toThrow(AppError);
    });
  });
});
