// WebSocketフック（Svelte 5 Runes使用）

import { getWebSocketContext, type WebSocketMessage } from '$lib/websocket/websocket.svelte';

// タスクのWebSocket通信を管理するフック
export function useTaskWebSocket(taskId: string) {
	const ws = getWebSocketContext();
	
	// タスクをサブスクライブ
	$effect(() => {
		ws.subscribe(taskId);
		
		// クリーンアップ時にアンサブスクライブ
		return () => {
			ws.unsubscribe(taskId);
		};
	});
	
	// タスクのメッセージを取得（リアクティブ）
	const messages = $derived(ws.getTaskMessages(taskId));
	
	// 最新のログメッセージ（すべてのログタイプを含む）
	const logs = $derived(
		messages
			.filter(m => ['task:log', 'task:tool:start', 'task:tool:end', 'task:claude:response', 'task:todo_update'].includes(m.type))
			.map(m => {
				// メッセージタイプに応じてフォーマット
				switch (m.type) {
					case 'task:log':
						return m.data?.log || '';
					case 'task:tool:start':
						return `🛠️ [${m.data?.tool}] 開始${m.data?.input ? `: ${JSON.stringify(m.data.input).slice(0, 100)}...` : ''}`;
					case 'task:tool:end':
						return `✅ [${m.data?.tool}] ${m.data?.success ? '成功' : '失敗'}${m.data?.duration ? ` (${m.data.duration}ms)` : ''}`;
					case 'task:claude:response':
						return `🤖 Claude: ${m.data?.text || ''}`;
					case 'task:todo_update':
						if (m.data?.todos) {
							return `📝 TODO更新: ${m.data.todos.map((t: any) => `${t.content} [${t.status}]`).join(', ')}`;
						}
						return '📝 TODO更新';
					default:
						return JSON.stringify(m.data);
				}
			})
	);
	
	// ツール実行状況
	const toolExecutions = $derived(
		messages
			.filter(m => m.type === 'task:tool:start' || m.type === 'task:tool:end')
			.map(m => ({
				type: m.type,
				tool: m.data?.tool || '',
				args: m.data?.input,
				duration: m.data?.duration,
				success: m.data?.success,
				error: m.data?.error,
				timestamp: m.timestamp || new Date().toISOString()
			}))
	);
	
	// Claude応答
	const claudeResponses = $derived(
		messages
			.filter(m => m.type === 'task:claude:response')
			.map(m => ({
				response: m.data?.text || '',
				turnNumber: m.data?.turnNumber,
				maxTurns: m.data?.maxTurns,
				timestamp: m.timestamp || new Date().toISOString()
			}))
	);
	
	// タスク統計
	const statistics = $derived(
		(() => {
			const statsMessages = messages.filter(m => m.type === 'task:statistics');
			if (statsMessages.length === 0) return null;
			
			const latest = statsMessages[statsMessages.length - 1];
			// statistics オブジェクトが payload 内にネストされている可能性を考慮
			return latest.data?.statistics || latest.data || null;
		})()
	);
	
	// TODOリスト更新
	const todoUpdates = $derived(
		messages
			.filter(m => m.type === 'task:todo_update')
			.map(m => {
				if (m.data?.todos && Array.isArray(m.data.todos)) {
					return m.data.todos.map((todo: any) => ({
						id: todo.id,
						content: todo.content || '',
						status: todo.status || '',
						priority: todo.priority || 'medium',
						timestamp: m.timestamp || new Date().toISOString()
					}));
				}
				return [];
			})
			.flat()
	);
	
	// タスクの進捗
	const progress = $derived(
		(() => {
			// 進捗メッセージとClaude応答から進捗を計算
			const progressMessages = messages.filter(m => m.type === 'task:progress');
			const claudeMessages = messages.filter(m => m.type === 'task:claude:response');
			
			// 最新のClaude応答からturn情報を取得
			const latestClaude = claudeMessages[claudeMessages.length - 1];
			const turn = latestClaude?.data?.turnNumber || 0;
			const maxTurns = latestClaude?.data?.maxTurns || 0;
			
			// 最新の進捗メッセージ
			const latestProgress = progressMessages[progressMessages.length - 1];
			const phase = latestProgress?.data?.progress?.phase || latestProgress?.data?.phase;
			const message = latestProgress?.data?.progress?.message || latestProgress?.data?.message || '';
			
			// フェーズに基づいて進捗を計算
			let percent = 0;
			if (phase === 'setup') percent = 10;
			else if (phase === 'planning') percent = 20;
			else if (phase === 'execution') {
				// 実行フェーズではターン数も考慮
				if (maxTurns > 0) {
					percent = 20 + Math.min(60, (turn / maxTurns) * 60);
				} else {
					percent = 50; // ターン数が不明な場合は50%
				}
			}
			else if (phase === 'cleanup') percent = 90;
			else if (phase === 'complete') percent = 100;
			
			return {
				percent,
				message,
				turn,
				maxTurns,
				phase
			};
		})()
	);
	
	// タスクのステータス変更
	const statusChange = $derived(
		(() => {
			const statusMessages = messages.filter(m => 
				['task:completed', 'task:failed', 'task:cancelled', 'task:update'].includes(m.type)
			);
			if (statusMessages.length === 0) return null;
			
			return statusMessages[statusMessages.length - 1];
		})()
	);
	
	return {
		get connected() { return ws.connected; },
		get authenticated() { return ws.authenticated; },
		get messages() { return messages; },
		get logs() { return logs; },
		get toolExecutions() { return toolExecutions; },
		get claudeResponses() { return claudeResponses; },
		get statistics() { return statistics; },
		get todoUpdates() { return todoUpdates; },
		get progress() { return progress; },
		get statusChange() { return statusChange; },
		clearMessages: () => ws.clearTaskMessages(taskId)
	};
}

// WebSocket接続状態を管理するフック
export function useWebSocketStatus() {
	const ws = getWebSocketContext();
	
	return {
		get connected() { return ws.connected; },
		get connecting() { return ws.connecting; },
		get authenticated() { return ws.authenticated; },
		get error() { return ws.error; },
		get isReady() { return ws.isReady; },
		connect: () => ws.connect(),
		disconnect: () => ws.disconnect()
	};
}

// リアルタイムメッセージを監視するフック
export function useWebSocketMessages(filter?: (message: WebSocketMessage) => boolean) {
	const ws = getWebSocketContext();
	
	// フィルタリングされたメッセージ
	const filteredMessages = $derived(
		filter ? ws.messages.filter(filter) : ws.messages
	);
	
	// 最新のメッセージ
	const latestMessage = $derived(
		filteredMessages[filteredMessages.length - 1]
	);
	
	return {
		get messages() { return filteredMessages; },
		get latestMessage() { return latestMessage; }
	};
}