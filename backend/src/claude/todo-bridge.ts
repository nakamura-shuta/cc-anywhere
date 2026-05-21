/**
 * Todo bridge — synthesizes TodoWrite-compatible snapshots from Task tool calls.
 *
 * Background: Claude Agent SDK 0.3.142+ switched headless/SDK sessions from
 * TodoWrite (snapshot-based) to Task tools (TaskCreate/TaskUpdate/TaskGet/TaskList,
 * incremental, per-task ID). Existing cc-anywhere UI listens for a `todo_update`
 * event carrying `{ todos: [{ content, status }, ...] }` — produced by TodoWrite.
 *
 * Until the UI is migrated to Task tools natively (feature phase F3–F5), this
 * bridge watches Task tool_use and the matching tool_result and re-emits a
 * synthesized TodoWrite-shaped snapshot on every change.
 */

import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export type TodoStatus = "pending" | "in_progress" | "completed";

export interface SynthesizedTodo {
  content: string;
  status: TodoStatus;
}

interface TaskCreateInput {
  subject?: string;
  description?: string;
  activeForm?: string;
}

interface TaskUpdateInput {
  taskId?: string;
  subject?: string;
  description?: string;
  activeForm?: string;
  status?: "pending" | "in_progress" | "completed" | "deleted";
}

interface TaskCreateOutput {
  task?: { id: string; subject?: string };
}

/**
 * Observes TaskCreate / TaskUpdate tool calls and produces TodoWrite snapshots.
 */
export class TodoBridge {
  /** Authoritative task state keyed by SDK-assigned taskId. */
  private todos = new Map<string, SynthesizedTodo>();

  /** Buffered TaskCreate inputs keyed by tool_use_id (until tool_result returns the taskId). */
  private pendingCreates = new Map<string, SynthesizedTodo>();

  /**
   * Inspect a single SDK message and update internal state.
   * Returns true if the snapshot changed (caller should re-emit todo_update).
   */
  observe(message: SDKMessage): boolean {
    const m = message as {
      type?: string;
      message?: {
        content?: Array<{
          type?: string;
          name?: string;
          id?: string;
          tool_use_id?: string;
          input?: unknown;
          content?: unknown;
        }>;
      };
    };

    if (m.type === "assistant") {
      return this.observeAssistant(m.message?.content || []);
    }
    if (m.type === "user") {
      return this.observeUser(m.message?.content || []);
    }
    return false;
  }

  /** Current TodoWrite-compatible snapshot. */
  snapshot(): SynthesizedTodo[] {
    return Array.from(this.todos.values());
  }

  /** Reset internal state. Useful between sessions. */
  reset(): void {
    this.todos.clear();
    this.pendingCreates.clear();
  }

  private observeAssistant(
    blocks: Array<{ type?: string; name?: string; id?: string; input?: unknown }>,
  ): boolean {
    let changed = false;
    for (const block of blocks) {
      if (block.type !== "tool_use") continue;
      if (block.name === "TaskCreate" && block.id) {
        const input = (block.input || {}) as TaskCreateInput;
        const content = input.subject || input.description || input.activeForm || "";
        if (content) {
          this.pendingCreates.set(block.id, { content, status: "pending" });
        }
        continue;
      }
      if (block.name === "TaskUpdate") {
        const input = (block.input || {}) as TaskUpdateInput;
        if (!input.taskId) continue;
        let existing = this.todos.get(input.taskId);
        // Recover from unseeded state (e.g. resume where getSessionMessages failed):
        // synthesize a placeholder rather than dropping the update silently.
        if (!existing) {
          if (input.status === "deleted") continue;
          existing = {
            content:
              input.subject || input.description || input.activeForm || `Task ${input.taskId}`,
            status: input.status ?? "pending",
          };
          this.todos.set(input.taskId, existing);
          changed = true;
          continue;
        }
        if (input.status === "deleted") {
          this.todos.delete(input.taskId);
          changed = true;
          continue;
        }
        if (input.status && existing.status !== input.status) {
          existing.status = input.status;
          changed = true;
        }
        if (input.subject && existing.content !== input.subject) {
          existing.content = input.subject;
          changed = true;
        }
      }
    }
    return changed;
  }

  private observeUser(
    blocks: Array<{ type?: string; tool_use_id?: string; content?: unknown }>,
  ): boolean {
    let changed = false;
    for (const block of blocks) {
      if (block.type !== "tool_result" || !block.tool_use_id) continue;
      const pending = this.pendingCreates.get(block.tool_use_id);
      if (!pending) continue;

      const output = this.extractCreateOutput(block.content);
      const taskId = output?.task?.id;
      if (!taskId) {
        // Result arrived but no taskId — drop the buffered create.
        this.pendingCreates.delete(block.tool_use_id);
        continue;
      }
      this.todos.set(taskId, pending);
      this.pendingCreates.delete(block.tool_use_id);
      changed = true;
    }
    return changed;
  }

  /**
   * Tool results in Claude SDK messages come as either an object, a string,
   * or an array of content blocks. We try the common shapes for TaskCreateOutput.
   */
  private extractCreateOutput(raw: unknown): TaskCreateOutput | null {
    if (!raw) return null;
    if (typeof raw === "object" && !Array.isArray(raw)) {
      return raw as TaskCreateOutput;
    }
    if (Array.isArray(raw)) {
      for (const block of raw) {
        const b = block as { type?: string; text?: string; output?: unknown };
        if (b.type === "text" && typeof b.text === "string") {
          try {
            return JSON.parse(b.text) as TaskCreateOutput;
          } catch {
            // not JSON; skip
          }
        }
        if (b.output && typeof b.output === "object") {
          return b.output as TaskCreateOutput;
        }
      }
    }
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as TaskCreateOutput;
      } catch {
        return null;
      }
    }
    return null;
  }
}
