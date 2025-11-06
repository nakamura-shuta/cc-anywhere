import { logger } from "./logger";

/**
 * 共通エラーハンドリングヘルパー
 *
 * データベース操作や非同期処理でのエラーハンドリングを統一的に提供します。
 */
export class ErrorHandlers {
  /**
   * データベース操作のエラーハンドリング
   *
   * データベース更新失敗時のログ出力を統一的に処理します。
   * エラーはログに記録されますが、例外は再スローされません。
   *
   * @param operation - 実行した操作の説明（例: "update task status"）
   * @param context - エラーコンテキスト情報（taskId等）
   * @param error - 発生したエラーオブジェクト
   *
   * @example
   * ```typescript
   * try {
   *   await repository.updateStatus(taskId, status);
   * } catch (error) {
   *   await ErrorHandlers.handleDatabaseError(
   *     "update task status",
   *     { taskId },
   *     error
   *   );
   * }
   * ```
   */
  static async handleDatabaseError(
    operation: string,
    context: Record<string, unknown>,
    error: unknown,
  ): Promise<void> {
    logger.error(`Failed to ${operation}`, { ...context, error });
  }

  /**
   * 非同期操作のエラーハンドリング（callbackあり）
   *
   * 非同期操作でエラーが発生した際のログ出力と、
   * オプショナルなエラーハンドリングコールバックの実行を行います。
   * コールバック内でエラーが発生した場合も適切にログに記録されます。
   *
   * @param operation - 実行した操作の説明
   * @param error - 発生したエラーオブジェクト
   * @param onError - エラー時に実行するコールバック関数（オプション）
   *
   * @example
   * ```typescript
   * try {
   *   await someAsyncOperation();
   * } catch (error) {
   *   await ErrorHandlers.handleAsyncError(
   *     "execute task",
   *     error,
   *     async () => {
   *       // クリーンアップ処理
   *       await cleanup();
   *     }
   *   );
   * }
   * ```
   */
  static async handleAsyncError(
    operation: string,
    error: unknown,
    onError?: () => Promise<void>,
  ): Promise<void> {
    logger.error(`Error in ${operation}`, { error });
    if (onError) {
      try {
        await onError();
      } catch (callbackError) {
        logger.error(`Error in error handler for ${operation}`, {
          error: callbackError,
        });
      }
    }
  }
}
