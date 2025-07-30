/**
 * アプリケーション設定の統一管理
 */
export const config = {
  api: {
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:5000',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  websocket: {
    url: import.meta.env.VITE_WS_URL || 'ws://localhost:5000',
    reconnectDelay: 1000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000,
  },
  auth: {
    tokenKey: 'cc-anywhere-token',
    refreshTokenKey: 'cc-anywhere-refresh-token',
  },
  ui: {
    defaultPageSize: 20,
    maxPageSize: 100,
    debounceDelay: 300,
    toastDuration: 3000,
  },
  features: {
    enableWebSocket: true,
    enableAutoSave: true,
    enableOfflineMode: false,
  },
} as const;

/**
 * 環境に応じた設定の取得
 */
export function getConfig() {
  return config;
}

/**
 * WebSocket URLの取得（HTTPからWSへの変換対応）
 */
export function getWebSocketUrl(): string {
  const wsUrl = config.websocket.url;
  if (wsUrl) {
    // /wsエンドポイントを追加
    return wsUrl.endsWith('/ws') ? wsUrl : `${wsUrl}/ws`;
  }
  
  // API URLからWebSocket URLを生成
  const apiUrl = config.api.baseUrl;
  let wsBaseUrl: string;
  if (apiUrl.startsWith('https://')) {
    wsBaseUrl = apiUrl.replace('https://', 'wss://');
  } else if (apiUrl.startsWith('http://')) {
    wsBaseUrl = apiUrl.replace('http://', 'ws://');
  } else {
    wsBaseUrl = 'ws://localhost:5000';
  }
  
  return `${wsBaseUrl}/ws`;
}

/**
 * APIエンドポイントの構築
 */
export function buildApiUrl(path: string): string {
  const baseUrl = config.api.baseUrl;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}