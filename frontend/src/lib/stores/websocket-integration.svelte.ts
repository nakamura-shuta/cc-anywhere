import { getWebSocketStore } from './websocket-enhanced.svelte';
import { getGlobalMessageRouter } from './message-router.svelte';
import { taskStore } from './task.svelte';
import { taskGroupStore } from './task-group.svelte';
import { scheduleStore } from './schedule.svelte';
import { getConfig } from '$lib/config';
import { fileChangeStore } from './file-changes.svelte';

/**
 * WebSocketとストアの統合セットアップ
 */
export function setupWebSocketIntegration() {
  const ws = getWebSocketStore();
  const router = getGlobalMessageRouter();
  const config = getConfig();
  
  // WebSocketメッセージをルーターに転送
  ws.onAny(async (message) => {
    await router.route(message);
  });
  
  // タスクストアのメッセージハンドリング
  setupTaskStoreHandlers();
  
  // タスクグループストアのメッセージハンドリング
  setupTaskGroupStoreHandlers();
  
  // スケジュールストアのメッセージハンドリング
  setupScheduleStoreHandlers();
  
  // ファイル変更のメッセージハンドリング
  setupFileChangeHandlers();
  
  // WebSocket自動接続（設定で有効な場合）
  if (config.features.enableWebSocket) {
    ws.connect();
  }
  
  return {
    ws,
    router,
    cleanup: () => {
      ws.destroy();
      router.clear();
    }
  };
}

/**
 * タスクグループストアのメッセージハンドラー設定
 */
function setupTaskGroupStoreHandlers() {
  const router = getGlobalMessageRouter();
  
  // タスクグループのイベント
  router.register('task-group:created', (msg) => {
    taskGroupStore.handleWebSocketUpdate(msg);
  });
  
  router.register('task-group:status', (msg) => {
    taskGroupStore.handleWebSocketUpdate(msg);
  });
  
  router.register('task-group:progress', (msg) => {
    taskGroupStore.handleWebSocketUpdate(msg);
  });
  
  router.register('task-group:task-completed', (msg) => {
    taskGroupStore.handleWebSocketUpdate(msg);
  });
  
  router.register('task-group:log', (msg) => {
    taskGroupStore.handleWebSocketUpdate(msg);
  });
}

/**
 * タスクストアのメッセージハンドラー設定
 */
function setupTaskStoreHandlers() {
  const router = getGlobalMessageRouter();
  
  // タスクのCRUD操作
  router.register('task.created', (msg) => {
    taskStore.handleWebSocketUpdate(msg);
  });
  
  router.register('task.updated', (msg) => {
    taskStore.handleWebSocketUpdate(msg);
  });
  
  router.register('task.deleted', (msg) => {
    taskStore.handleWebSocketUpdate(msg);
  });
  
  // タスク固有のイベント
  router.register('task:update', (msg) => {
    taskStore.handleWebSocketUpdate(msg);
  });
  
  router.register('task:progress', (msg) => {
    taskStore.handleWebSocketUpdate(msg);
  });
  
  // レガシーイベントのサポート
  router.registerPattern('task:*', (msg) => {
    taskStore.handleWebSocketUpdate(msg);
  });
}

/**
 * スケジュールストアのメッセージハンドラー設定
 */
function setupScheduleStoreHandlers() {
  const router = getGlobalMessageRouter();
  
  // スケジュールのCRUD操作
  router.register('schedule.created', (msg) => {
    scheduleStore.handleWebSocketUpdate(msg);
  });
  
  router.register('schedule.updated', (msg) => {
    scheduleStore.handleWebSocketUpdate(msg);
  });
  
  router.register('schedule.deleted', (msg) => {
    scheduleStore.handleWebSocketUpdate(msg);
  });
  
  // スケジュール固有のイベント
  router.register('schedule:update', (msg) => {
    scheduleStore.handleWebSocketUpdate(msg);
  });
  
  router.register('schedule:execution', (msg) => {
    // スケジュール実行イベント
    scheduleStore.handleCustomMessage?.(msg);
  });
}

/**
 * ファイル変更通知のメッセージハンドラー設定
 */
function setupFileChangeHandlers() {
  const router = getGlobalMessageRouter();
  
  // ファイル変更イベント
  router.register('file-change', (msg) => {
    if (msg.payload) {
      fileChangeStore.addChange(msg.payload.path, msg.payload.operation);
    }
  });
}

/**
 * ストア間の連携設定
 */
export function setupStoreComposition() {
  // 将来的に複数のストアを組み合わせる場合の準備
  return {
    // タスク実行時の連携など
  };
}