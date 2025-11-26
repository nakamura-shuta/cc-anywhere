/**
 * Gemini File Tools
 *
 * Function Calling用のファイル操作ツール定義と実行ロジック
 */

import * as fs from "fs";
import * as path from "path";
import { logger } from "../utils/logger.js";

/**
 * Type enum for Gemini function declarations
 */
export const GeminiType = {
  OBJECT: "OBJECT" as const,
  STRING: "STRING" as const,
  NUMBER: "NUMBER" as const,
  BOOLEAN: "BOOLEAN" as const,
  ARRAY: "ARRAY" as const,
};

/**
 * File operation tool declarations for Gemini Function Calling
 */
export const FILE_TOOL_DECLARATIONS = [
  {
    name: "createFile",
    description: "Create a new file with the specified content",
    parameters: {
      type: GeminiType.OBJECT,
      properties: {
        path: {
          type: GeminiType.STRING,
          description: "The absolute file path to create",
        },
        content: {
          type: GeminiType.STRING,
          description: "The content to write to the file",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "readFile",
    description: "Read the contents of a file",
    parameters: {
      type: GeminiType.OBJECT,
      properties: {
        path: {
          type: GeminiType.STRING,
          description: "The absolute file path to read",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "updateFile",
    description: "Update an existing file with new content",
    parameters: {
      type: GeminiType.OBJECT,
      properties: {
        path: {
          type: GeminiType.STRING,
          description: "The absolute file path to update",
        },
        content: {
          type: GeminiType.STRING,
          description: "The new content to write",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "deleteFile",
    description: "Delete a file at the specified path",
    parameters: {
      type: GeminiType.OBJECT,
      properties: {
        path: {
          type: GeminiType.STRING,
          description: "The absolute file path to delete",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "listDir",
    description: "List files and directories in the specified path",
    parameters: {
      type: GeminiType.OBJECT,
      properties: {
        path: {
          type: GeminiType.STRING,
          description: "The absolute directory path to list",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "createDir",
    description: "Create a new directory (including parent directories if needed)",
    parameters: {
      type: GeminiType.OBJECT,
      properties: {
        path: {
          type: GeminiType.STRING,
          description: "The absolute directory path to create",
        },
      },
      required: ["path"],
    },
  },
];

/**
 * File tool names for type checking
 */
export const FILE_TOOL_NAMES = FILE_TOOL_DECLARATIONS.map((t) => t.name);

/**
 * Check if a function name is a file tool
 */
export function isFileTool(name: string): boolean {
  return FILE_TOOL_NAMES.includes(name);
}

/**
 * Result type for file operations
 */
export interface FileOperationResult {
  success: boolean;
  message?: string;
  content?: string;
  items?: Array<{ name: string; type: "file" | "directory" }>;
  error?: string;
}

/**
 * Validate that a path is within allowed directories
 * @param filePath Path to validate
 * @param workingDirectory Optional working directory constraint
 * @returns true if path is allowed
 */
function validatePath(filePath: string, workingDirectory?: string): boolean {
  // Resolve to absolute path
  const resolvedPath = path.resolve(filePath);

  // If working directory is specified, ensure path is within it
  if (workingDirectory) {
    const resolvedWorkDir = path.resolve(workingDirectory);
    if (!resolvedPath.startsWith(resolvedWorkDir)) {
      return false;
    }
  }

  // Prevent path traversal attacks
  if (filePath.includes("..")) {
    return false;
  }

  // Block sensitive system paths
  const blockedPaths = ["/etc", "/usr", "/bin", "/sbin", "/var", "/root", "/home"];
  for (const blocked of blockedPaths) {
    if (resolvedPath.startsWith(blocked)) {
      return false;
    }
  }

  return true;
}

/**
 * Execute a file operation function
 *
 * @param name Function name
 * @param args Function arguments
 * @param workingDirectory Optional working directory constraint
 * @returns Operation result
 */
export function executeFileFunction(
  name: string,
  args: Record<string, unknown>,
  workingDirectory?: string,
): FileOperationResult {
  const filePath = args.path as string;

  // Validate path
  if (!validatePath(filePath, workingDirectory)) {
    return {
      success: false,
      error: `Path not allowed: ${filePath}`,
    };
  }

  logger.debug(`Executing file tool: ${name}`, { path: filePath, workingDirectory });

  try {
    switch (name) {
      case "createFile": {
        const content = args.content as string;
        const dir = path.dirname(filePath);

        // Create parent directories if needed
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, content, "utf-8");
        logger.info(`File created: ${filePath}`);

        return {
          success: true,
          message: `File created: ${filePath}`,
        };
      }

      case "readFile": {
        if (!fs.existsSync(filePath)) {
          return {
            success: false,
            error: `File not found: ${filePath}`,
          };
        }

        const content = fs.readFileSync(filePath, "utf-8");
        logger.debug(`File read: ${filePath} (${content.length} chars)`);

        return {
          success: true,
          content,
        };
      }

      case "updateFile": {
        const content = args.content as string;

        if (!fs.existsSync(filePath)) {
          return {
            success: false,
            error: `File not found: ${filePath}`,
          };
        }

        fs.writeFileSync(filePath, content, "utf-8");
        logger.info(`File updated: ${filePath}`);

        return {
          success: true,
          message: `File updated: ${filePath}`,
        };
      }

      case "deleteFile": {
        if (!fs.existsSync(filePath)) {
          return {
            success: false,
            error: `File not found: ${filePath}`,
          };
        }

        fs.unlinkSync(filePath);
        logger.info(`File deleted: ${filePath}`);

        return {
          success: true,
          message: `File deleted: ${filePath}`,
        };
      }

      case "listDir": {
        if (!fs.existsSync(filePath)) {
          return {
            success: false,
            error: `Directory not found: ${filePath}`,
          };
        }

        const entries = fs.readdirSync(filePath, { withFileTypes: true });
        const items = entries.map((e) => ({
          name: e.name,
          type: (e.isDirectory() ? "directory" : "file") as "file" | "directory",
        }));

        logger.debug(`Directory listed: ${filePath} (${items.length} items)`);

        return {
          success: true,
          items,
        };
      }

      case "createDir": {
        fs.mkdirSync(filePath, { recursive: true });
        logger.info(`Directory created: ${filePath}`);

        return {
          success: true,
          message: `Directory created: ${filePath}`,
        };
      }

      default:
        return {
          success: false,
          error: `Unknown function: ${name}`,
        };
    }
  } catch (error) {
    logger.error(`File operation failed: ${name}`, { error, path: filePath });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
