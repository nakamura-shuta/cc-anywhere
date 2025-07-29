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
    return wsUrl;
  }
  
  // API URLからWebSocket URLを生成
  const apiUrl = config.api.baseUrl;
  if (apiUrl.startsWith('https://')) {
    return apiUrl.replace('https://', 'wss://');
  } else if (apiUrl.startsWith('http://')) {
    return apiUrl.replace('http://', 'ws://');
  }
  
  return 'ws://localhost:5000';
}

/**
 * APIエンドポイントの構築
 */
export function buildApiUrl(path: string): string {
  const baseUrl = config.api.baseUrl;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}