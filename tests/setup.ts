// Vitest setup file
import { vi } from "vitest";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env.test file
const testEnvPath = path.resolve(process.cwd(), ".env.test");
dotenv.config({ path: testEnvPath });

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
