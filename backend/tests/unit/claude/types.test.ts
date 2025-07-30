import { describe, it, expect } from "vitest";
import type {
  ClaudeCodeSDKOptions,
  TaskRequest,
  MCPServerConfig,
} from "../../../src/claude/types.js";

describe("ClaudeCodeSDKOptions", () => {
  describe("Priority: High Options", () => {
    it("should accept valid maxTurns", () => {
      const options: ClaudeCodeSDKOptions = {
        maxTurns: 5,
      };
      expect(options.maxTurns).toBe(5);
    });

    it("should accept allowedTools array", () => {
      const options: ClaudeCodeSDKOptions = {
        allowedTools: ["Read", "Write", "Edit"],
      };
      expect(options.allowedTools).toEqual(["Read", "Write", "Edit"]);
    });

    it("should accept disallowedTools array", () => {
      const options: ClaudeCodeSDKOptions = {
        disallowedTools: ["Bash", "Write"],
      };
      expect(options.disallowedTools).toEqual(["Bash", "Write"]);
    });

    it("should accept systemPrompt string", () => {
      const options: ClaudeCodeSDKOptions = {
        systemPrompt: "You are a TypeScript expert",
      };
      expect(options.systemPrompt).toBe("You are a TypeScript expert");
    });

    it("should accept all permissionMode values", () => {
      const modes = ["ask", "allow", "deny", "acceptEdits", "bypassPermissions", "plan"] as const;
      modes.forEach((mode) => {
        const options: ClaudeCodeSDKOptions = {
          permissionMode: mode,
        };
        expect(options.permissionMode).toBe(mode);
      });
    });
  });

  describe("Priority: Medium Options", () => {
    it("should accept executable options", () => {
      const executables = ["node", "bun", "deno"] as const;
      executables.forEach((exe) => {
        const options: ClaudeCodeSDKOptions = {
          executable: exe,
        };
        expect(options.executable).toBe(exe);
      });
    });

    it("should accept executableArgs array", () => {
      const options: ClaudeCodeSDKOptions = {
        executableArgs: ["--experimental", "--max-old-space-size=4096"],
      };
      expect(options.executableArgs).toEqual(["--experimental", "--max-old-space-size=4096"]);
    });

    it("should accept mcpConfig with proper structure", () => {
      const mcpConfig: Record<string, MCPServerConfig> = {
        filesystem: {
          command: "node",
          args: ["/path/to/mcp-server.js"],
          env: { API_KEY: "xxx" },
          cwd: "/working/dir",
        },
      };
      const options: ClaudeCodeSDKOptions = {
        mcpConfig,
      };
      expect(options.mcpConfig).toEqual(mcpConfig);
    });

    it("should accept continueSession boolean", () => {
      const options: ClaudeCodeSDKOptions = {
        continueSession: true,
      };
      expect(options.continueSession).toBe(true);
    });

    it("should accept resumeSession string", () => {
      const options: ClaudeCodeSDKOptions = {
        resumeSession: "session_abc123",
      };
      expect(options.resumeSession).toBe("session_abc123");
    });

    it("should accept outputFormat options", () => {
      const formats = ["text", "json", "stream-json"] as const;
      formats.forEach((format) => {
        const options: ClaudeCodeSDKOptions = {
          outputFormat: format,
        };
        expect(options.outputFormat).toBe(format);
      });
    });
  });

  describe("Priority: Low Options", () => {
    it("should accept verbose boolean", () => {
      const options: ClaudeCodeSDKOptions = {
        verbose: true,
      };
      expect(options.verbose).toBe(true);
    });

    it("should accept permissionPromptTool string", () => {
      const options: ClaudeCodeSDKOptions = {
        permissionPromptTool: "custom-tool",
      };
      expect(options.permissionPromptTool).toBe("custom-tool");
    });

    it("should accept pathToClaudeCodeExecutable string", () => {
      const options: ClaudeCodeSDKOptions = {
        pathToClaudeCodeExecutable: "/usr/local/bin/claude-code",
      };
      expect(options.pathToClaudeCodeExecutable).toBe("/usr/local/bin/claude-code");
    });
  });
});

describe("MCPServerConfig", () => {
  it("should require command property", () => {
    const config: MCPServerConfig = {
      command: "node",
    };
    expect(config.command).toBe("node");
  });

  it("should accept optional args array", () => {
    const config: MCPServerConfig = {
      command: "node",
      args: ["server.js", "--port", "3000"],
    };
    expect(config.args).toEqual(["server.js", "--port", "3000"]);
  });

  it("should accept optional env object", () => {
    const config: MCPServerConfig = {
      command: "node",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    };
    expect(config.env).toEqual({
      NODE_ENV: "production",
      PORT: "3000",
    });
  });

  it("should accept optional cwd string", () => {
    const config: MCPServerConfig = {
      command: "node",
      cwd: "/app/server",
    };
    expect(config.cwd).toBe("/app/server");
  });
});

describe("TaskRequest with SDK options", () => {
  it("should accept sdk options in TaskRequest", () => {
    const request: TaskRequest = {
      instruction: "Test task",
      options: {
        sdk: {
          maxTurns: 5,
          allowedTools: ["Read", "Write"],
          systemPrompt: "Be concise",
          permissionMode: "acceptEdits",
        },
      },
    };
    expect(request.options?.sdk?.maxTurns).toBe(5);
    expect(request.options?.sdk?.allowedTools).toEqual(["Read", "Write"]);
  });

  it("should support legacy allowedTools alongside SDK options", () => {
    const request: TaskRequest = {
      instruction: "Test task",
      options: {
        allowedTools: ["Read"], // Legacy
        sdk: {
          allowedTools: ["Read", "Write"], // New
        },
      },
    };
    expect(request.options?.allowedTools).toEqual(["Read"]);
    expect(request.options?.sdk?.allowedTools).toEqual(["Read", "Write"]);
  });
});

describe("Type Validation Tests", () => {
  it("should allow all documented SDK options", () => {
    const fullOptions: ClaudeCodeSDKOptions = {
      // Priority: High
      maxTurns: 10,
      allowedTools: ["Read", "Write"],
      disallowedTools: ["Bash"],
      systemPrompt: "Custom prompt",
      permissionMode: "acceptEdits",

      // Priority: Medium
      executable: "bun",
      executableArgs: ["--experimental"],
      mcpConfig: {
        test: { command: "test" },
      },
      continueSession: true,
      resumeSession: "session_123",
      outputFormat: "json",

      // Priority: Low
      verbose: true,
      permissionPromptTool: "custom",
      pathToClaudeCodeExecutable: "/path/to/claude",
    };

    // This should compile without errors
    expect(fullOptions).toBeDefined();
  });
});
