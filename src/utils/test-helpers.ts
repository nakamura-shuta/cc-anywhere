/**
 * Test helper utilities
 */

import { vi, expect } from "vitest";

/**
 * Helper to properly handle async rejections in tests
 */
export async function expectRejection<T = any>(
  promise: Promise<T>,
  expectedError?: string | RegExp | Error,
): Promise<void> {
  try {
    await promise;
    throw new Error("Expected promise to reject, but it resolved");
  } catch (error) {
    if (expectedError) {
      if (expectedError instanceof Error) {
        expect(error).toEqual(expectedError);
      } else if (expectedError instanceof RegExp) {
        expect((error as Error).message).toMatch(expectedError);
      } else {
        expect((error as Error).message).toBe(expectedError);
      }
    }
  }
}

/**
 * Helper to wait for promise rejection without unhandled rejection warnings
 */
export function waitForRejection<T = any>(promise: Promise<T>): Promise<Error> {
  return promise.then(
    () => {
      throw new Error("Expected promise to reject, but it resolved");
    },
    (error) => error as Error,
  );
}

/**
 * Create a deferred promise for testing
 */
export function createDeferred<T = void>() {
  let resolve: (value: T | PromiseLike<T>) => void;
  let reject: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
}

/**
 * Advance timers and wait for promises
 */
export async function advanceTimersAndWait(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await new Promise((resolve) => setImmediate(resolve));
}
