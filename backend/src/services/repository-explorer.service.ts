import { readdir, stat, readFile } from "fs/promises";
import { join, relative, extname } from "path";
import { existsSync } from "fs";
import { logger } from "../utils/logger.js";
import mime from "mime-types";
import { isText } from "istextorbinary";

export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modifiedAt?: string;
  children?: TreeNode[];
}

export interface FileContent {
  path: string;
  content: string;
  encoding: "utf8" | "base64" | "binary";
  size: number;
  mimeType: string;
  language?: string;
  modifiedAt: string;
}

export class RepositoryExplorerService {
  private static instance: RepositoryExplorerService;

  private constructor() {}

  static getInstance(): RepositoryExplorerService {
    if (!RepositoryExplorerService.instance) {
      RepositoryExplorerService.instance = new RepositoryExplorerService();
    }
    return RepositoryExplorerService.instance;
  }

  /**
   * リポジトリ設定を取得
   */
  async getRepositoryConfig(): Promise<{ repositories: Array<{ name: string; path: string }> }> {
    try {
      const configPath = join(process.cwd(), "backend", "config", "repositories.json");
      if (!existsSync(configPath)) {
        // デフォルト値を返す
        return {
          repositories: [
            {
              name: "cc-anywhere",
              path: process.cwd(),
            },
          ],
        };
      }

      const configContent = await readFile(configPath, "utf-8");
      return JSON.parse(configContent);
    } catch (error) {
      logger.error("Failed to load repository config", { error });
      throw new Error("Failed to load repository configuration");
    }
  }

  /**
   * リポジトリのパスを取得
   */
  async getRepositoryPath(repositoryName: string): Promise<string> {
    logger.debug("Getting repository path", { repositoryName });

    // repositoryNameが絶対パスの場合は直接使用
    if (repositoryName.startsWith("/") || repositoryName.startsWith("~")) {
      const repoPath = repositoryName.startsWith("~")
        ? repositoryName.replace("~", process.env.HOME || "")
        : repositoryName;

      logger.debug("Absolute path detected", { repositoryName, repoPath });

      if (!existsSync(repoPath)) {
        logger.error("Repository path does not exist", { repositoryName, repoPath });
        throw new Error(`Path "${repoPath}" does not exist`);
      }

      logger.debug("Repository path validated", { repositoryName, repoPath });
      return repoPath;
    }

    // それ以外の場合は設定ファイルから探す
    const config = await this.getRepositoryConfig();
    const repository = config.repositories.find((r) => r.name === repositoryName);

    if (!repository) {
      throw new Error(`Repository "${repositoryName}" not found`);
    }

    // パスが絶対パスでない場合は、現在のディレクトリからの相対パスとして扱う
    const repoPath = repository.path.startsWith("/")
      ? repository.path
      : join(process.cwd(), repository.path);

    if (!existsSync(repoPath)) {
      throw new Error(`Repository path "${repoPath}" does not exist`);
    }

    return repoPath;
  }

  /**
   * ディレクトリツリーを取得
   */
  async getDirectoryTree(repositoryName: string, subPath: string = ""): Promise<TreeNode> {
    const repoPath = await this.getRepositoryPath(repositoryName);
    const targetPath = join(repoPath, subPath);

    // パストラバーサル攻撃の防止
    const normalizedPath = relative(repoPath, targetPath);
    if (normalizedPath.startsWith("..")) {
      throw new Error("Invalid path: Access denied");
    }

    return this.buildTree(targetPath, repoPath, repositoryName);
  }

  /**
   * ツリー構造を再帰的に構築
   */
  private async buildTree(
    currentPath: string,
    basePath: string,
    repositoryName: string,
  ): Promise<TreeNode> {
    const stats = await stat(currentPath);
    const relativePath = relative(basePath, currentPath);
    const name = relativePath === "" ? repositoryName : relativePath.split("/").pop() || "";

    const node: TreeNode = {
      name,
      path: relativePath === "" ? "" : relativePath,
      type: stats.isDirectory() ? "directory" : "file",
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
    };

    if (stats.isDirectory()) {
      try {
        const items = await readdir(currentPath);
        // .gitignoreされたファイルも含めて全て表示
        const children = await Promise.all(
          items.map(async (item) => {
            const itemPath = join(currentPath, item);
            try {
              return await this.buildTree(itemPath, basePath, repositoryName);
            } catch (error) {
              // アクセスできないファイル/ディレクトリはスキップ
              logger.debug(`Skipping inaccessible item: ${itemPath}`, { error });
              return null;
            }
          }),
        );

        node.children = children.filter(Boolean) as TreeNode[];
        // ディレクトリを先に、その後ファイルをアルファベット順でソート
        node.children.sort((a, b) => {
          if (a.type === b.type) {
            return a.name.localeCompare(b.name);
          }
          return a.type === "directory" ? -1 : 1;
        });
      } catch (error) {
        logger.error("Failed to read directory", { path: currentPath, error });
        node.children = [];
      }
    }

    return node;
  }

  /**
   * ファイル内容を取得
   */
  async getFileContent(repositoryName: string, filePath: string): Promise<FileContent> {
    const repoPath = await this.getRepositoryPath(repositoryName);
    const targetPath = join(repoPath, filePath);

    // パストラバーサル攻撃の防止
    const normalizedPath = relative(repoPath, targetPath);
    if (normalizedPath.startsWith("..")) {
      throw new Error("Invalid path: Access denied");
    }

    if (!existsSync(targetPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = await stat(targetPath);
    if (stats.isDirectory()) {
      throw new Error(`Path is a directory: ${filePath}`);
    }

    // ファイルサイズの制限（10MB）
    const maxSize = 10 * 1024 * 1024;
    if (stats.size > maxSize) {
      throw new Error(`File too large: ${stats.size} bytes (max: ${maxSize} bytes)`);
    }

    // MIMEタイプの判定
    const mimeType = mime.lookup(targetPath) || "application/octet-stream";

    // ファイルを読み込んで、テキストかバイナリかを判定
    const buffer = await readFile(targetPath);
    const isTextFile = isText(targetPath, buffer);

    let content: string;
    let encoding: "utf8" | "base64";

    if (isTextFile) {
      // テキストファイルの場合
      content = buffer.toString("utf-8");
      encoding = "utf8";
    } else {
      // バイナリファイルの場合
      content = buffer.toString("base64");
      encoding = "base64";
    }

    // プログラミング言語の判定
    const language = this.detectLanguage(filePath);

    return {
      path: filePath,
      content,
      encoding,
      size: stats.size,
      mimeType,
      language,
      modifiedAt: stats.mtime.toISOString(),
    };
  }

  /**
   * ファイルの拡張子から言語を判定
   */
  private detectLanguage(filePath: string): string | undefined {
    const ext = extname(filePath).toLowerCase();

    const languageMap: Record<string, string> = {
      ".js": "javascript",
      ".jsx": "javascript",
      ".ts": "typescript",
      ".tsx": "typescript",
      ".py": "python",
      ".java": "java",
      ".c": "c",
      ".cpp": "cpp",
      ".cs": "csharp",
      ".php": "php",
      ".rb": "ruby",
      ".go": "go",
      ".rs": "rust",
      ".swift": "swift",
      ".kt": "kotlin",
      ".scala": "scala",
      ".r": "r",
      ".m": "matlab",
      ".sql": "sql",
      ".html": "html",
      ".htm": "html",
      ".xml": "xml",
      ".css": "css",
      ".scss": "scss",
      ".sass": "sass",
      ".less": "less",
      ".json": "json",
      ".yaml": "yaml",
      ".yml": "yaml",
      ".toml": "toml",
      ".md": "markdown",
      ".mdx": "markdown",
      ".sh": "bash",
      ".bash": "bash",
      ".zsh": "bash",
      ".fish": "fish",
      ".ps1": "powershell",
      ".dockerfile": "dockerfile",
      ".docker": "dockerfile",
      ".svelte": "svelte",
      ".vue": "vue",
      ".lua": "lua",
      ".dart": "dart",
      ".elm": "elm",
      ".clj": "clojure",
      ".ex": "elixir",
      ".exs": "elixir",
      ".erl": "erlang",
      ".hrl": "erlang",
      ".fs": "fsharp",
      ".fsx": "fsharp",
      ".fsi": "fsharp",
      ".ml": "ocaml",
      ".mli": "ocaml",
      ".pas": "pascal",
      ".pp": "pascal",
      ".pl": "perl",
      ".pm": "perl",
      ".t": "perl",
      ".raku": "raku",
      ".rakumod": "raku",
      ".rakutest": "raku",
      ".jl": "julia",
      ".nim": "nim",
      ".nims": "nim",
      ".cr": "crystal",
      ".d": "d",
      ".zig": "zig",
      ".v": "v",
      ".vsh": "v",
      ".proto": "protobuf",
      ".graphql": "graphql",
      ".gql": "graphql",
      ".tf": "terraform",
      ".tfvars": "terraform",
      ".nix": "nix",
    };

    // ファイル名による判定
    const fileName = filePath.split("/").pop()?.toLowerCase();
    if (fileName === "dockerfile" || fileName === "containerfile") {
      return "dockerfile";
    }
    if (fileName === "makefile" || fileName === "gnumakefile") {
      return "makefile";
    }
    if (fileName === "rakefile" || fileName === "gemfile") {
      return "ruby";
    }
    if (fileName === "cmakelists.txt") {
      return "cmake";
    }

    return languageMap[ext];
  }
}

export const repositoryExplorerService = RepositoryExplorerService.getInstance();
