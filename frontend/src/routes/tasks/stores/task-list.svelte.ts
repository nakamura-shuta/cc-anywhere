import type { TaskResponse } from '$lib/types/api';
import type { WebSocketConnection } from '$lib/websocket/websocket.svelte';

class TaskListStore {
	// 状態管理
	tasks = $state<TaskResponse[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);
	
	// WebSocket接続
	private ws: WebSocketConnection | null = null;
	private messageHandler: ((event: Event) => void) | null = null;
	
	// 初期化
	initialize(initialTasks: TaskResponse[], ws: WebSocketConnection) {
		this.tasks = initialTasks || [];
		this.ws = ws;
		this.setupWebSocket();
	}
	
	// クリーンアップ
	cleanup() {
		if (this.messageHandler) {
			window.removeEventListener('websocket:message', this.messageHandler);
			this.messageHandler = null;
		}
	}
	
	// WebSocketのセットアップ
	private setupWebSocket() {
		// メッセージハンドラーの作成
		this.messageHandler = (event: Event) => {
			const customEvent = event as CustomEvent;
			const message = customEvent.detail;
			
			// タスクの状態変更に応じて一覧を更新
			switch (message.type) {
				case 'task:update':
					this.handleTaskUpdate(message);
					break;
				case 'task:status':
				case 'task:running':
					// 旧形式のサポート（互換性のため）
					this.handleTaskStatusUpdate(message);
					break;
				case 'task:completed':
				case 'task:failed':
				case 'task:cancelled':
					// 旧形式のサポート（互換性のため）
					this.handleTaskStatusUpdate(message);
					break;
			}
		};
		
		// イベントリスナーの登録
		window.addEventListener('websocket:message', this.messageHandler);
		
		if (!this.ws) return;
		
		// WebSocketに接続
		if (!this.ws.connected) {
			this.ws.connect();
		}
		
		// 接続が確立したら、すべてのタスクをサブスクライブ
		if (this.ws.connected && this.ws.authenticated) {
			this.subscribeToAllTasks();
		} else {
			// 接続が確立するまで待つ
			const checkConnection = setInterval(() => {
				if (this.ws && this.ws.connected && this.ws.authenticated) {
					this.subscribeToAllTasks();
					clearInterval(checkConnection);
				}
			}, 100);
			
			// タイムアウト設定
			setTimeout(() => clearInterval(checkConnection), 5000);
		}
	}
	
	// すべてのタスクをサブスクライブ
	private subscribeToAllTasks() {
		if (this.ws) {
			this.ws.subscribe('*');
		}
	}
	
	// task:updateメッセージの処理
	private handleTaskUpdate(message: any) {
		const taskId = message.taskId || message.data?.taskId || message.payload?.taskId;
		const payload = message.data || message.payload || {};
		const status = payload.status;
		
		if (!taskId) {
			console.warn('[TaskListStore] タスクIDが見つかりません:', message);
			return;
		}
		
		// 既存のタスクを探す
		const existingTaskIndex = this.tasks.findIndex(t => t.taskId === taskId);
		
		if (existingTaskIndex >= 0) {
			// 既存タスクの更新
			const updatedTask = { ...this.tasks[existingTaskIndex] };
			
			// ステータスの更新
			if (status) {
				updatedTask.status = status;
			}
			
			// メタデータから他のフィールドを更新
			const metadata = payload.metadata || message.data?.metadata || {};
			if (metadata.completedAt) {
				updatedTask.completedAt = metadata.completedAt;
			}
			if (metadata.duration) {
				updatedTask.duration = metadata.duration;
			}
			if (metadata.error) {
				updatedTask.error = metadata.error;
			}
			if (metadata.workingDirectory) {
				updatedTask.workingDirectory = metadata.workingDirectory;
			}
			
			// 更新日時
			updatedTask.updatedAt = message.timestamp || payload.timestamp || new Date().toISOString();
			
			// 新しい配列を作成して更新
			this.tasks = [
				...this.tasks.slice(0, existingTaskIndex), 
				updatedTask, 
				...this.tasks.slice(existingTaskIndex + 1)
			];
		} else if (status === 'pending' || status === 'running') {
			// 新しいタスクの場合（pendingまたはrunningステータス）
			// APIから詳細情報を取得
			this.fetchTaskDetails(taskId);
		}
	}
	
	// タスクの状態更新（旧形式）
	private handleTaskStatusUpdate(message: any) {
		const taskId = message.taskId || message.data?.taskId || message.payload?.taskId;
		const updateData = message.data || message.payload || message;
		
		if (!taskId) return;
		
		// タスクを見つけて更新
		const index = this.tasks.findIndex(t => t.taskId === taskId);
		if (index !== -1) {
			const updatedTask = { ...this.tasks[index] };
			
			// 状態を更新
			if (updateData.status) {
				updatedTask.status = updateData.status;
			}
			
			// その他のフィールドも更新
			if (updateData.updatedAt) {
				updatedTask.updatedAt = updateData.updatedAt;
			}
			if (updateData.completedAt) {
				updatedTask.completedAt = updateData.completedAt;
			}
			if (updateData.duration) {
				updatedTask.duration = updateData.duration;
			}
			if (updateData.error) {
				updatedTask.error = updateData.error;
			}
			
			// 新しい配列を作成して更新
			this.tasks = [
				...this.tasks.slice(0, index), 
				updatedTask, 
				...this.tasks.slice(index + 1)
			];
		}
	}
	
	// タスクの詳細情報を取得
	private async fetchTaskDetails(taskId: string) {
		try {
			const response = await fetch(`http://localhost:5000/api/tasks/${taskId}`, {
				headers: {
					'Content-Type': 'application/json'
				}
			});
			
			if (response.ok) {
				const task = await response.json();
				// 既に存在しないか再確認
				const exists = this.tasks.some(t => t.taskId === taskId);
				if (!exists) {
					// idフィールドを追加
					const newTask: TaskResponse = {
						...task,
						id: task.id || task.taskId
					};
					this.tasks = [newTask, ...this.tasks];
				}
			}
		} catch {
			// タスク詳細の取得に失敗した場合は無視
		}
	}
}

// シングルトンインスタンスをエクスポート
export const taskListStore = new TaskListStore();