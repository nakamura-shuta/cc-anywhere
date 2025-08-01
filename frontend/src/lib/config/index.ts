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
 * APIのベースURLを取得（環境に応じて動的に決定）
 */
export function getApiBaseUrl(): string {
  // ブラウザ環境では現在の環境から動的に判断
  if (typeof window !== 'undefined') {
    // 環境変数が設定されている場合はそれを使用
    if (config.api.baseUrl && !config.api.baseUrl.includes('localhost')) {
      return config.api.baseUrl;
    }
    
    // 開発環境の場合、現在のホストから判断
    const { protocol, hostname } = window.location;
    
    // ngrokなどのトンネル経由の場合は同じホストを使用
    if (!hostname.includes('localhost') && !hostname.includes('127.0.0.1')) {
      return `${protocol}//${hostname}`;
    }
    
    // ローカル開発環境の場合は環境変数またはデフォルト値を使用
    return config.api.baseUrl;
  }
  
  // SSR環境では環境変数を使用
  return config.api.baseUrl;
}

/**
 * WebSocket URLの取得（HTTPからWSへの変換対応）
 */
export function getWebSocketUrl(): string {
  // ブラウザ環境では現在のホストから動的にURLを生成
  if (typeof window !== 'undefined') {
    // APIのベースURLからWebSocket URLを生成
    const apiBaseUrl = getApiBaseUrl();
    
    // HTTPプロトコルをWebSocketプロトコルに変換
    const wsUrl = apiBaseUrl
      .replace(/^https:/, 'wss:')
      .replace(/^http:/, 'ws:');
    
    // /wsエンドポイントを追加
    return `${wsUrl}/ws`;
  }
  
  // SSR環境での既定値
  const wsUrl = config.websocket.url;
  if (wsUrl) {
    // /wsエンドポイントを追加
    return wsUrl.endsWith('/ws') ? wsUrl : `${wsUrl}/ws`;
  }
  
  return 'ws://localhost:5000/ws';
}

/**
 * APIエンドポイントの構築
 */
export function buildApiUrl(path: string): string {
  const baseUrl = config.api.baseUrl;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}