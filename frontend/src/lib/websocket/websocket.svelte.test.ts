// WebSocketのテスト
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocketConnection } from './websocket.svelte';

// WebSocketのモッククラス
class MockWebSocket {
	readyState = WebSocket.CONNECTING;
	onopen: ((event: Event) => void) | null = null;
	onclose: ((event: CloseEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	
	constructor(public url: string) {
		setTimeout(() => {
			(this as any).readyState = WebSocket.OPEN;
			this.onopen?.(new Event('open'));
		}, 0);
	}
	
	send(_data: string) {
		// メッセージ送信のモック
	}
	
	close(code?: number, reason?: string) {
		(this as any).readyState = WebSocket.CLOSED;
		this.onclose?.(new CloseEvent('close', { code, reason }));
	}
}

describe('WebSocketConnection', () => {
	let ws: WebSocketConnection;
	
	beforeEach(() => {
		global.WebSocket = MockWebSocket as any;
		vi.clearAllMocks();
		// localStorageのモック
		vi.mocked(localStorage.getItem).mockReturnValue('test-api-key');
		
		ws = new WebSocketConnection('ws://localhost:5000');
	});
	
	describe('接続管理', () => {
		it('connect()で接続を開始', async () => {
			expect(ws.connected).toBe(false);
			expect(ws.connecting).toBe(false);
			
			ws.connect();
			
			expect(ws.connecting).toBe(true);
			
			// 非同期処理を待つ
			await new Promise(resolve => setTimeout(resolve, 10));
			
			expect(ws.connected).toBe(true);
			expect(ws.connecting).toBe(false);
		});
		
		it('disconnect()で切断', () => {
			ws.connect();
			ws.disconnect();
			
			expect(ws.connected).toBe(false);
			expect(ws.connecting).toBe(false);
		});
	});
	
	describe('メッセージ処理', () => {
		it('受信したメッセージを記録', async () => {
			ws.connect();
			await new Promise(resolve => setTimeout(resolve, 10));
			
			const mockMessage = {
				type: 'task:created',
				taskId: 'task-1',
				data: { status: 'running' }
			};
			
			// メッセージイベントをシミュレート
			const mockWs = ws['ws'] as MockWebSocket;
			mockWs.onmessage?.(new MessageEvent('message', {
				data: JSON.stringify(mockMessage)
			}));
			
			expect(ws.messages).toHaveLength(1);
			expect(ws.messages[0]).toEqual(expect.objectContaining(mockMessage));
		});
		
		it('タスクごとにメッセージを分類', async () => {
			ws.connect();
			await new Promise(resolve => setTimeout(resolve, 10));
			
			const mockMessage = {
				type: 'task:log',
				taskId: 'task-1',
				data: { log: 'Processing...' }
			};
			
			const mockWs = ws['ws'] as MockWebSocket;
			mockWs.onmessage?.(new MessageEvent('message', {
				data: JSON.stringify(mockMessage)
			}));
			
			const taskMessages = ws.getTaskMessages('task-1');
			expect(taskMessages).toHaveLength(1);
			expect(taskMessages[0].data.log).toBe('Processing...');
		});
	});
	
	describe('認証', () => {
		it('接続時に自動認証を試みる', async () => {
			const sendSpy = vi.fn();
			
			ws.connect();
			await new Promise(resolve => setTimeout(resolve, 10));
			
			const mockWs = ws['ws'] as MockWebSocket;
			mockWs.send = sendSpy;
			
			// 認証メッセージが送信されたか確認
			ws.authenticate();
			
			expect(sendSpy).toHaveBeenCalledWith(
				JSON.stringify({
					type: 'auth',
					apiKey: 'test-api-key'
				})
			);
		});
		
		it('認証成功メッセージで状態を更新', async () => {
			ws.connect();
			await new Promise(resolve => setTimeout(resolve, 10));
			
			const mockWs = ws['ws'] as MockWebSocket;
			mockWs.onmessage?.(new MessageEvent('message', {
				data: JSON.stringify({ type: 'auth:success' })
			}));
			
			expect(ws.authenticated).toBe(true);
		});
	});
	
	describe('サブスクリプション', () => {
		it('タスクをサブスクライブ', async () => {
			const sendSpy = vi.fn();
			
			ws.connect();
			await new Promise(resolve => setTimeout(resolve, 10));
			
			const mockWs = ws['ws'] as MockWebSocket;
			mockWs.send = sendSpy;
			
			ws.subscribe('task-1');
			
			expect(ws.subscriptions.has('task-1')).toBe(true);
			expect(sendSpy).toHaveBeenCalledWith(
				JSON.stringify({
					type: 'subscribe',
					taskId: 'task-1'
				})
			);
		});
		
		it('タスクをアンサブスクライブ', async () => {
			const sendSpy = vi.fn();
			
			ws.connect();
			await new Promise(resolve => setTimeout(resolve, 10));
			
			const mockWs = ws['ws'] as MockWebSocket;
			mockWs.send = sendSpy;
			
			ws.subscribe('task-1');
			ws.unsubscribe('task-1');
			
			expect(ws.subscriptions.has('task-1')).toBe(false);
			expect(sendSpy).toHaveBeenLastCalledWith(
				JSON.stringify({
					type: 'unsubscribe',
					taskId: 'task-1'
				})
			);
		});
	});
});