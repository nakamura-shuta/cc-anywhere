import { describe, it, expect, beforeEach } from "vitest";
import { TaskTracker } from "../../../src/services/task-tracker";
import type { TodoItem } from "../../../src/types/todo";

describe("TaskTracker - Todo Management", () => {
  let tracker: TaskTracker;

  beforeEach(() => {
    tracker = new TaskTracker();
  });

  describe("updateTodos", () => {
    it("should update todos with current timestamp", () => {
      const todos: TodoItem[] = [
        {
          id: "1",
          content: "Task 1",
          status: "pending",
          priority: "high",
        },
        {
          id: "2",
          content: "Task 2",
          status: "in_progress",
          priority: "medium",
        },
      ];

      tracker.updateTodos(todos);
      const storedTodos = tracker.getTodos();

      expect(storedTodos).toHaveLength(2);
      expect(storedTodos[0].content).toBe("Task 1");
      expect(storedTodos[1].content).toBe("Task 2");
      expect(storedTodos[0].updatedAt).toBeInstanceOf(Date);
      expect(storedTodos[1].updatedAt).toBeInstanceOf(Date);
    });

    it("should replace existing todos when called multiple times", () => {
      const todosV1: TodoItem[] = [
        {
          id: "1",
          content: "Old task",
          status: "pending",
          priority: "low",
        },
      ];

      const todosV2: TodoItem[] = [
        {
          id: "2",
          content: "New task",
          status: "completed",
          priority: "high",
        },
      ];

      tracker.updateTodos(todosV1);
      expect(tracker.getTodos()).toHaveLength(1);
      expect(tracker.getTodos()[0].content).toBe("Old task");

      tracker.updateTodos(todosV2);
      expect(tracker.getTodos()).toHaveLength(1);
      expect(tracker.getTodos()[0].content).toBe("New task");
    });
  });

  describe("getTodos", () => {
    it("should return empty array when no todos are set", () => {
      expect(tracker.getTodos()).toEqual([]);
    });

    it("should return the current todos", () => {
      const todos: TodoItem[] = [
        {
          id: "1",
          content: "Test todo",
          status: "pending",
          priority: "medium",
        },
      ];

      tracker.updateTodos(todos);
      const result = tracker.getTodos();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
      expect(result[0].content).toBe("Test todo");
    });
  });

  describe("extractToolDetails with TodoWrite", () => {
    it("should extract TodoWrite tool usage with todo count", () => {
      const message = {
        type: "text",
        message: {
          content: [
            {
              type: "tool_use",
              tool_use: {
                name: "TodoWrite",
                input: {
                  todos: [
                    { id: "1", content: "Task 1", status: "pending", priority: "high" },
                    { id: "2", content: "Task 2", status: "in_progress", priority: "medium" },
                  ],
                },
              },
            },
          ],
        },
      };

      const detail = tracker.extractToolDetails(message as any);

      expect(detail).toBeTruthy();
      expect(detail?.tool).toBe("TodoWrite");
      expect(detail?.status).toBe("start");
      expect(detail?.todoCount).toBe(2);
    });
  });
});
