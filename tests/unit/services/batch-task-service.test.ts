import { describe, it, expect, vi, beforeEach } from "vitest";
import { BatchTaskService } from "../../../src/services/batch-task-service";
import type { TaskRepository } from "../../../src/db/repositories/task-repository";
import type { TaskQueue } from "../../../src/queue/task-queue";
import { v4 as uuidv4 } from "uuid";

vi.mock("uuid");

describe("BatchTaskService", () => {
  let batchTaskService: BatchTaskService;
  let mockTaskRepository: TaskRepository;
  let mockTaskQueue: TaskQueue;

  beforeEach(() => {
    // モックの設定
    mockTaskRepository = {
      create: vi.fn().mockImplementation((task) => ({
        ...task,
        status: task.status || "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })),
      findById: vi.fn(),
      findByGroupId: vi.fn(),
      updateStatus: vi.fn(),
    } as any;

    mockTaskQueue = {
      add: vi.fn().mockImplementation(() => uuidv4()),
    } as any;

    batchTaskService = new BatchTaskService(mockTaskRepository, mockTaskQueue);
  });

  describe("createBatchTasks", () => {
    it("should create multiple tasks with same group ID", async () => {
      const mockGroupId = "123";
      const mockTaskIds = ["task_1", "task_2", "task_3"];

      vi.mocked(uuidv4)
        .mockReturnValueOnce(mockGroupId)
        .mockReturnValueOnce(mockTaskIds[0])
        .mockReturnValueOnce(mockTaskIds[1])
        .mockReturnValueOnce(mockTaskIds[2]);

      const params = {
        instruction: "npm test",
        repositories: [
          { name: "app1", path: "/repos/app1" },
          { name: "app2", path: "/repos/app2" },
          { name: "app3", path: "/repos/app3" },
        ],
        options: {
          timeout: 300000,
        },
      };

      const result = await batchTaskService.createBatchTasks(params);

      // グループIDが生成されていることを確認
      expect(result.groupId).toBe(`group_${mockGroupId}`);
      expect(result.tasks).toHaveLength(3);

      // 各タスクがキューに追加されていることを確認
      expect(mockTaskQueue.add).toHaveBeenCalledTimes(3);

      // 各タスクが正しいパラメータでキューに追加されていることを確認
      for (let i = 0; i < 3; i++) {
        const addCall = vi.mocked(mockTaskQueue.add).mock.calls[i];
        const taskRequest = addCall[0];
        const metadata = addCall[2];

        expect(taskRequest.instruction).toBe("npm test");
        expect(taskRequest.context.workingDirectory).toBe(params.repositories[i].path);
        expect(metadata.groupId).toBe(`group_${mockGroupId}`);
        expect(metadata.repositoryName).toBe(params.repositories[i].name);
      }
    });

    it("should use repository-specific timeout if provided", async () => {
      const params = {
        instruction: "npm test",
        repositories: [
          {
            name: "app1",
            path: "/repos/app1",
            timeout: 600000, // カスタムタイムアウト
          },
          {
            name: "app2",
            path: "/repos/app2",
            // デフォルトを使用
          },
        ],
        options: {
          timeout: 300000, // デフォルト
        },
      };

      await batchTaskService.createBatchTasks(params);

      const firstCall = vi.mocked(mockTaskQueue.add).mock.calls[0];
      const secondCall = vi.mocked(mockTaskQueue.add).mock.calls[1];

      expect(firstCall[0].options.timeout).toBe(600000); // カスタム値
      expect(secondCall[0].options.timeout).toBe(300000); // デフォルト値
    });

    it("should throw error if no repositories provided", async () => {
      const params = {
        instruction: "npm test",
        repositories: [],
        options: {},
      };

      await expect(batchTaskService.createBatchTasks(params)).rejects.toThrow(
        "At least one repository is required",
      );
    });
  });

  describe("getBatchTaskStatus", () => {
    it("should aggregate status from all tasks in group", async () => {
      const groupId = "group_123";
      const mockTasks = [
        {
          id: "task_1",
          status: "completed",
          repository_name: "app1",
          groupId,
        },
        {
          id: "task_2",
          status: "running",
          repository_name: "app2",
          groupId,
        },
        {
          id: "task_3",
          status: "pending",
          repository_name: "app3",
          groupId,
        },
      ];

      vi.mocked(mockTaskRepository.findByGroupId).mockResolvedValue(mockTasks);

      const result = await batchTaskService.getBatchTaskStatus(groupId);

      expect(result.groupId).toBe(groupId);
      expect(result.summary).toEqual({
        total: 3,
        pending: 1,
        running: 1,
        completed: 1,
        failed: 0,
      });
      expect(result.tasks).toHaveLength(3);
    });

    it("should return null if no tasks found", async () => {
      vi.mocked(mockTaskRepository.findByGroupId).mockResolvedValue([]);

      const result = await batchTaskService.getBatchTaskStatus("non-existent");
      expect(result).toBeNull();
    });
  });
});
