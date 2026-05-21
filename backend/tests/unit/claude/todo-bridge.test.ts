import { describe, it, expect, beforeEach } from "vitest";
import { TodoBridge } from "../../../src/claude/todo-bridge";

const taskCreate = (toolUseId: string, subject: string) =>
  ({
    type: "assistant",
    message: {
      content: [{ type: "tool_use", id: toolUseId, name: "TaskCreate", input: { subject } }],
    },
  }) as any;

const taskCreateResult = (toolUseId: string, taskId: string) =>
  ({
    type: "user",
    message: {
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUseId,
          content: { task: { id: taskId, subject: "ignored" } },
        },
      ],
    },
  }) as any;

const taskUpdate = (taskId: string, patch: { status?: string; subject?: string }) =>
  ({
    type: "assistant",
    message: {
      content: [
        { type: "tool_use", id: "irrelevant", name: "TaskUpdate", input: { taskId, ...patch } },
      ],
    },
  }) as any;

describe("TodoBridge", () => {
  let bridge: TodoBridge;

  beforeEach(() => {
    bridge = new TodoBridge();
  });

  it("buffers TaskCreate input without producing a snapshot before tool_result", () => {
    const changed = bridge.observe(taskCreate("tu-1", "Refactor module"));
    expect(changed).toBe(false);
    expect(bridge.snapshot()).toEqual([]);
  });

  it("emits a pending todo when TaskCreate's tool_result resolves with a taskId", () => {
    bridge.observe(taskCreate("tu-1", "Refactor module"));
    const changed = bridge.observe(taskCreateResult("tu-1", "task-1"));
    expect(changed).toBe(true);
    expect(bridge.snapshot()).toEqual([{ content: "Refactor module", status: "pending" }]);
  });

  it("updates status on TaskUpdate", () => {
    bridge.observe(taskCreate("tu-1", "Refactor module"));
    bridge.observe(taskCreateResult("tu-1", "task-1"));
    const changed = bridge.observe(taskUpdate("task-1", { status: "in_progress" }));
    expect(changed).toBe(true);
    expect(bridge.snapshot()).toEqual([{ content: "Refactor module", status: "in_progress" }]);
  });

  it("removes a todo when TaskUpdate marks it deleted", () => {
    bridge.observe(taskCreate("tu-1", "Refactor module"));
    bridge.observe(taskCreateResult("tu-1", "task-1"));
    const changed = bridge.observe(taskUpdate("task-1", { status: "deleted" }));
    expect(changed).toBe(true);
    expect(bridge.snapshot()).toEqual([]);
  });

  it("rewrites content on subject change", () => {
    bridge.observe(taskCreate("tu-1", "Old subject"));
    bridge.observe(taskCreateResult("tu-1", "task-1"));
    bridge.observe(taskUpdate("task-1", { subject: "New subject" }));
    expect(bridge.snapshot()).toEqual([{ content: "New subject", status: "pending" }]);
  });

  it("synthesizes a placeholder when TaskUpdate references an unknown taskId", () => {
    const changed = bridge.observe(taskUpdate("task-1", { status: "in_progress" }));
    expect(changed).toBe(true);
    expect(bridge.snapshot()).toEqual([{ content: "Task task-1", status: "in_progress" }]);
  });

  it("uses TaskUpdate.subject for the placeholder content when provided", () => {
    bridge.observe(taskUpdate("task-1", { status: "completed", subject: "Resumed task" }));
    expect(bridge.snapshot()).toEqual([{ content: "Resumed task", status: "completed" }]);
  });

  it("ignores TaskUpdate with status=deleted for an unknown taskId", () => {
    const changed = bridge.observe(taskUpdate("task-x", { status: "deleted" }));
    expect(changed).toBe(false);
    expect(bridge.snapshot()).toEqual([]);
  });

  it("parses tool_result content delivered as a content-blocks array", () => {
    bridge.observe(taskCreate("tu-1", "Refactor module"));
    const message = {
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "tu-1",
            content: [
              { type: "text", text: JSON.stringify({ task: { id: "task-1", subject: "" } }) },
            ],
          },
        ],
      },
    } as any;
    expect(bridge.observe(message)).toBe(true);
    expect(bridge.snapshot()).toEqual([{ content: "Refactor module", status: "pending" }]);
  });

  it("handles multiple concurrent TaskCreate calls", () => {
    bridge.observe(taskCreate("tu-1", "First"));
    bridge.observe(taskCreate("tu-2", "Second"));
    bridge.observe(taskCreateResult("tu-1", "task-1"));
    bridge.observe(taskCreateResult("tu-2", "task-2"));
    bridge.observe(taskUpdate("task-1", { status: "in_progress" }));
    expect(bridge.snapshot()).toEqual([
      { content: "First", status: "in_progress" },
      { content: "Second", status: "pending" },
    ]);
  });

  it("ignores non-Task tool calls", () => {
    const msg = {
      type: "assistant",
      message: {
        content: [{ type: "tool_use", id: "tu-1", name: "Bash", input: { command: "ls" } }],
      },
    } as any;
    expect(bridge.observe(msg)).toBe(false);
    expect(bridge.snapshot()).toEqual([]);
  });

  it("reset() clears all state", () => {
    bridge.observe(taskCreate("tu-1", "First"));
    bridge.observe(taskCreateResult("tu-1", "task-1"));
    bridge.reset();
    expect(bridge.snapshot()).toEqual([]);
  });
});
