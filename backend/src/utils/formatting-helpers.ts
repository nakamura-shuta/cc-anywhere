/**
 * フォーマット処理のヘルパー関数
 *
 * 日付、タイムスタンプ、タスクID、実行時間などの共通フォーマット処理を提供します。
 */
export class FormattingHelpers {
  /**
   * 日本語形式でタイムスタンプをフォーマット
   *
   * @param date - Date、number、またはstring形式のタイムスタンプ
   * @returns 日本語形式のタイムスタンプ文字列（例: "2025/11/06 14:30:45"）
   *
   * @example
   * ```typescript
   * FormattingHelpers.formatJapaneseTimestamp(Date.now());
   * // => "2025/11/06 14:30:45"
   *
   * FormattingHelpers.formatJapaneseTimestamp(new Date());
   * // => "2025/11/06 14:30:45"
   * ```
   */
  static formatJapaneseTimestamp(date: Date | number | string): string {
    return new Date(date).toLocaleString("ja-JP");
  }

  /**
   * タスクIDを生成
   *
   * prefixと現在時刻、ランダム文字列を組み合わせて一意なIDを生成します。
   *
   * @param prefix - IDのプレフィックス（デフォルト: "task"）
   * @returns 生成されたタスクID（例: "task-1699265445123-a7b3c9d"）
   *
   * @example
   * ```typescript
   * FormattingHelpers.generateTaskId();
   * // => "task-1699265445123-a7b3c9d"
   *
   * FormattingHelpers.generateTaskId("codex-task");
   * // => "codex-task-1699265445123-x9y2z4w"
   * ```
   */
  static generateTaskId(prefix = "task"): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * 実行時間を人間が読みやすい形式にフォーマット
   *
   * ミリ秒を適切な単位（ms、秒、分秒）で表示します。
   *
   * @param ms - ミリ秒単位の実行時間
   * @returns フォーマット済みの実行時間文字列
   *
   * @example
   * ```typescript
   * FormattingHelpers.formatDuration(500);
   * // => "500ms"
   *
   * FormattingHelpers.formatDuration(5000);
   * // => "5.0s"
   *
   * FormattingHelpers.formatDuration(125000);
   * // => "2m 5s"
   * ```
   */
  static formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}
