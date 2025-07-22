// WebSocketストア（Svelte 5 Runes使用）

import { wsClient, type WebSocketMessage, type WebSocketEventType } from '$lib/websocket/client';

// タスクのリアルタイム状態管理
export class WebSocketStore {
	// 接続状態
	get connected() {
		return wsClient.connected;
	}
	
	get connecting() {
		return wsClient.connecting;
	}
	
	get error() {
		return wsClient.error;
	}
	
	// 最新のメッセージ
	latestMessage = $state<WebSocketMessage | null>(null);
	
	// タスクごとのログ（タスクIDをキーとしたMap）
	private taskLogs = $state(new Map<string, string[]>());
	
	// タスクごとの進捗（タスクIDをキーとしたMap）
	private taskProgress = $state(new Map<string, { percent: number; message: string }>());
	
	// 接続
	async connect(): Promise<void> {
		// すべてのイベントを監視
		wsClient.onAny((message) => {
			this.latestMessage = message;
			this.handleMessage(message);
		});
		
		return wsClient.connect();
	}
	
	// 切断
	disconnect(): void {
		wsClient.disconnect();
	}
	
	// タスクのログを取得
	getTaskLogs(taskId: string): string[] {
		return this.taskLogs.get(taskId) || [];
	}
	
	// タスクの進捗を取得
	getTaskProgress(taskId: string): { percent: number; message: string } | undefined {
		return this.taskProgress.get(taskId);
	}
	
	// タスクのログをクリア
	clearTaskLogs(taskId: string): void {
		this.taskLogs.delete(taskId);
		this.taskProgress.delete(taskId);
	}
	
	// すべてクリア
	clearAll(): void {
		this.taskLogs.clear();
		this.taskProgress.clear();
		this.latestMessage = null;
	}
	
	// メッセージハンドリング
	private handleMessage(message: WebSocketMessage): void {
		switch (message.type) {
			case 'task:log':
				if (message.taskId) {
					const logs = this.taskLogs.get(message.taskId) || [];
					logs.push(message.data.log);
					this.taskLogs.set(message.taskId, logs);
				}
				break;
				
			case 'task:progress':
				if (message.taskId && message.data.percent !== undefined) {
					this.taskProgress.set(message.taskId, {
						percent: message.data.percent,
						message: message.data.message || ''
					});
				}
				break;
				
			case 'task:completed':
			case 'task:failed':
			case 'task:cancelled':
				// タスク完了時は進捗を100%または0%に設定
				if (message.taskId) {
					const percent = message.type === 'task:completed' ? 100 : 0;
					this.taskProgress.set(message.taskId, {
						percent,
						message: message.type.replace('task:', '')
					});
				}
				break;
		}
	}
	
	// 特定のイベントを購読
	subscribe(event: WebSocketEventType, callback: (message: WebSocketMessage) => void): () => void {
		return wsClient.on(event, callback);
	}
	
	// タスクのログを購読（リアクティブ）
	subscribeTaskLogs(taskId: string) {
		// Svelte 5のderived相当の機能
		return {
			logs: this.getTaskLogs(taskId)
		};
	}
	
	// タスクの進捗を購読（リアクティブ）
	subscribeTaskProgress(taskId: string) {
		// Svelte 5のderived相当の機能
		return {
			progress: this.getTaskProgress(taskId)
		};
	}
}

// シングルトンインスタンス
export const websocketStore = new WebSocketStore();