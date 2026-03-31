/**
 * Serialized process.chdir() to prevent race conditions.
 * V2 SDKSessionOptions lacks cwd parameter, so we temporarily
 * change process.cwd() before session creation.
 */

let mutex: Promise<void> = Promise.resolve();

export function withCwd<T>(cwd: string | undefined, fn: () => T): Promise<T> {
  if (!cwd) return Promise.resolve(fn());

  return new Promise<T>((resolve, reject) => {
    mutex = mutex.then(() => {
      const original = process.cwd();
      try {
        process.chdir(cwd);
        const result = fn();
        process.chdir(original);
        resolve(result);
      } catch (error) {
        process.chdir(original);
        reject(error);
      }
    });
  });
}
