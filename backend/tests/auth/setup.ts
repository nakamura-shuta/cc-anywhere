// 認証テスト専用のセットアップファイル
import "reflect-metadata";
import { vi } from "vitest";

// 環境変数を直接設定（.envファイルを読み込まない）
// この設定は認証テストでのみ使用される

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  // Keep warn and error for important messages
  warn: console.warn,
  error: console.error,
};

// Suppress unhandled promise rejection warnings during tests
const originalEmitWarning = process.emitWarning.bind(process);
process.emitWarning = (warning: any, ...args: any[]) => {
  if (typeof warning === "string" && warning.includes("PromiseRejectionHandledWarning")) {
    return;
  }
  originalEmitWarning(warning, ...args);
};
