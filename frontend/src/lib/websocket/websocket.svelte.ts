// WebSocketコンテキスト（Svelte 5 Runes使用）

import { getContext, setContext } from 'svelte';
import { API_ENDPOINTS, getApiKey } from '$lib/config/api';

// WebSocketメッセージ型
export interface WebSocketMessage {
	type: string;
	taskId?: string;
	data?: any;
	error?: string;
	timestamp?: string;
}

// WebSocketクラス（Svelte 5のリアクティブな状態管理）
export class WebSocketConnection {
	// リアクティブな状態
	connected = $state(false);
	connecting = $state(false);
	authenticated = $state(false);
	error = $state<Error | null>(null);
	
	// メッセージストリーム
	messages = $state<WebSocketMessage[]>([]);
	
	// タスクごとのメッセージ（タスクIDをキー）
	taskMessages = $state<Map<string, WebSocketMessage[]>>(new Map());
	
	// サブスクリプション
	subscriptions = $state<Set<string>>(new Set());
	
	// WebSocketインスタンス
	private ws: WebSocket | null = null;
	private url: string;
	private reconnectTimer?: number;
	private heartbeatTimer?: number;
	private reconnectAttempts = 0;
	
	// 派生状態
	get isReady() {
		return this.connected && this.authenticated;
	}
	
	get latestMessage() {
		return this.messages[this.messages.length - 1];
	}
	
	constructor(url?: string) {
		this.url = url || API_ENDPOINTS.websocket;
	}
	
	// 接続
	connect() {
		// ブラウザ環境でのみ実行
		if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
			console.warn('[WebSocket] ブラウザ環境ではありません。接続をスキップします。');
			return;
		}
		
		if (this.connected || this.connecting || this.ws) {
			console.log('[WebSocket] 既に接続中または接続済み', {
				connected: this.connected,
				connecting: this.connecting,
				hasWs: !!this.ws
			});
			return;
		}
		
		this.connecting = true;
		this.error = null;
		
		try {
			console.log('[WebSocket] 接続を開始します:', this.url);
			// グローバルのWebSocketを明示的に使用
			this.ws = new window.WebSocket(this.url);
			
			// WebSocketの状態を確認
			console.log('[WebSocket] WebSocket作成完了', {
				readyState: this.ws.readyState,
				url: this.ws.url
			});
			
			// イベントハンドラー
			this.ws.onopen = () => this.handleOpen();
			this.ws.onmessage = (event) => this.handleMessage(event);
			this.ws.onerror = (error) => this.handleError(error);
			this.ws.onclose = (event) => this.handleClose(event);
		} catch (err) {
			console.error('[WebSocket] 接続エラー:', err);
			this.connecting = false;
			this.error = err instanceof Error ? err : new Error('接続エラー');
		}
	}
	
	// 切断
	disconnect() {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = undefined;
		}
		
		this.stopHeartbeat();
		
		if (this.ws) {
			this.ws.close(1000, 'ユーザーによる切断');
			this.ws = null;
		}
		
		this.connected = false;
		this.connecting = false;
		this.authenticated = false;
		this.subscriptions.clear();
	}
	
	// メッセージ送信
	send(data: any) {
		if (!this.connected || !this.ws) {
			console.error('WebSocket未接続');
			return;
		}
		
		this.ws.send(JSON.stringify(data));
	}
	
	// 認証
	authenticate() {
		// ブラウザ環境でのみ実行
		if (typeof window === 'undefined') {
			console.warn('[WebSocket] ブラウザ環境ではありません。認証をスキップします。');
			return;
		}
		
		const apiKey = getApiKey();
		console.log('[WebSocket] 認証を開始', { hasApiKey: !!apiKey });
		
		if (!apiKey) {
			console.warn('[WebSocket] APIキーが設定されていません');
			// 開発環境の場合はデフォルトAPIキーを使用
			const defaultApiKey = 'hoge';
			console.log('[WebSocket] デフォルトAPIキーを使用します');
			
			const authMessage = {
				type: 'auth',
				payload: {
					apiKey: defaultApiKey
				}
			};
			
			this.send(authMessage);
			return;
		}
		
		const authMessage = {
			type: 'auth',
			payload: {
				apiKey
			}
		};
		
		console.log('[WebSocket] 認証メッセージを送信', { type: authMessage.type });
		this.send(authMessage);
	}
	
	// タスクのサブスクライブ
	subscribe(taskId: string) {
		if (this.subscriptions.has(taskId)) return;
		
		this.subscriptions.add(taskId);
		
		if (this.connected) {
			this.send({
				type: 'subscribe',
				payload: {
					taskId
				}
			});
		}
	}
	
	// タスクのアンサブスクライブ
	unsubscribe(taskId: string) {
		if (!this.subscriptions.has(taskId)) return;
		
		this.subscriptions.delete(taskId);
		
		if (this.connected) {
			this.send({
				type: 'unsubscribe',
				payload: {
					taskId
				}
			});
		}
	}
	
	// タスクのメッセージを取得（リアクティブ）
	getTaskMessages(taskId: string): WebSocketMessage[] {
		// taskMessagesの変更を検知するため、Map全体を参照
		// これによりSvelte 5のリアクティビティが維持される
		const allMessages = this.taskMessages;
		return allMessages.get(taskId) || [];
	}
	
	// タスクのメッセージをクリア
	clearTaskMessages(taskId: string) {
		// Svelte 5のリアクティビティを維持するため、新しいMapを作成
		const newMap = new Map(this.taskMessages);
		newMap.delete(taskId);
		this.taskMessages = newMap;
	}
	
	// ハンドラー
	private handleOpen() {
		console.log('[WebSocket] 接続成功');
		this.connected = true;
		this.connecting = false;
		this.reconnectAttempts = 0;
		
		// 認証
		this.authenticate();
		
		// ハートビート開始
		this.startHeartbeat();
		
		// 再接続時にサブスクリプションを復元
		this.subscriptions.forEach(taskId => {
			this.send({ 
				type: 'subscribe', 
				payload: {
					taskId
				}
			});
		});
	}
	
	private handleMessage(event: MessageEvent) {
		try {
			const rawMessage = JSON.parse(event.data);
			
			// バックエンドからのメッセージ形式を統一形式に変換
			const message: WebSocketMessage = this.normalizeMessage(rawMessage);
			
			// メッセージを記録
			this.messages = [...this.messages, message];
			
			// タスク別にメッセージを記録
			if (message.taskId) {
				const taskMessages = this.taskMessages.get(message.taskId) || [];
				// Svelte 5のリアクティビティを維持するため、新しいMapを作成
				this.taskMessages = new Map(this.taskMessages).set(message.taskId, [...taskMessages, message]);
			}
			
			// デバッグ: すべてのメッセージタイプをログ
			console.log('[WebSocket] メッセージ受信:', message.type, message);
			
			// 認証成功
			if (message.type === 'auth:success') {
				this.authenticated = true;
				console.log('[WebSocket] 認証成功');
			}
			
			// 認証エラー
			if (message.type === 'auth:error') {
				this.authenticated = false;
				console.error('[WebSocket] 認証失敗:', message.error);
			}
			
			// pong（ハートビート応答）
			if (message.type === 'pong') {
				// ハートビート応答を受信
			}
		} catch (error) {
			console.error('メッセージ解析エラー:', error);
		}
	}
	
	private handleError(error: Event) {
		console.error('WebSocketエラー:', error);
		this.error = new Error('WebSocket接続エラー');
	}
	
	private handleClose(event: CloseEvent) {
		console.log('WebSocket切断:', event.code, event.reason);
		this.connected = false;
		this.connecting = false;
		this.authenticated = false;
		this.ws = null;
		
		this.stopHeartbeat();
		
		// 正常終了でない場合は再接続
		if (event.code !== 1000 && event.code !== 1001) {
			this.scheduleReconnect();
		}
	}
	
	// 再接続
	private scheduleReconnect() {
		// 既に再接続タイマーが設定されている場合はスキップ
		if (this.reconnectTimer) {
			return;
		}
		
		if (this.reconnectAttempts >= 10) {
			this.error = new Error('再接続の最大試行回数に達しました');
			return;
		}
		
		this.reconnectAttempts++;
		const delay = Math.min(5000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
		
		console.log(`${delay}ms後に再接続を試みます（${this.reconnectAttempts}/10）`);
		
		this.reconnectTimer = window.setTimeout(() => {
			this.reconnectTimer = undefined;
			// 接続前にwsをクリア
			this.ws = null;
			this.connect();
		}, delay);
	}
	
	// ハートビート
	private startHeartbeat() {
		this.heartbeatTimer = window.setInterval(() => {
			if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
				this.send({ 
					type: 'ping',
					payload: {}
				});
			}
		}, 30000);
	}
	
	private stopHeartbeat() {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = undefined;
		}
	}
	
	// バックエンドのメッセージ形式を統一形式に変換
	private normalizeMessage(rawMessage: any): WebSocketMessage {
		// バックエンド形式: { type: "task:log", payload: { taskId, log, ... } }
		// 統一形式: { type: "task:log", taskId, data: { log, ... }, timestamp }
		
		if (rawMessage.payload) {
			// payloadがある場合は、バックエンド形式
			const { type, payload } = rawMessage;
			const { taskId, timestamp, ...data } = payload || {};
			
			return {
				type,
				taskId,
				data,
				timestamp: timestamp || new Date().toISOString()
			};
		} else {
			// すでに統一形式の場合はそのまま返す
			return {
				...rawMessage,
				timestamp: rawMessage.timestamp || new Date().toISOString()
			};
		}
	}
}

// コンテキストキー
const WEBSOCKET_KEY = Symbol('websocket');

// WebSocketコンテキストの設定
export function setWebSocketContext(ws: WebSocketConnection) {
	setContext(WEBSOCKET_KEY, ws);
}

// WebSocketコンテキストの取得
export function getWebSocketContext(): WebSocketConnection {
	const ws = getContext<WebSocketConnection>(WEBSOCKET_KEY);
	if (!ws) {
		throw new Error('WebSocketコンテキストが設定されていません');
	}
	return ws;
}

// WebSocketコネクションのファクトリー
export function createWebSocketConnection(url?: string): WebSocketConnection {
	return new WebSocketConnection(url);
}