// タスクWebSocketフック（新しい実装）

import { getWebSocketStore } from '$lib/stores/websocket-enhanced.svelte';
import type { WebSocketMessage } from '$lib/stores/websocket-enhanced.svelte';

// タスクのWebSocket通信を管理するフック
export function useTaskWebSocket(taskId: string, initialStatistics?: any, initialData?: {
	toolUsageCount?: Record<string, number>;
	todos?: any[];
	currentTurn?: number;
	maxTurns?: number;
	logs?: string[];
	toolExecutions?: any[];
	claudeResponses?: any[];
}) {
	const ws = getWebSocketStore();
	
	// タスク関連のメッセージを保存
	let taskMessages = $state<WebSocketMessage[]>([]);
	
	// タスクをサブスクライブ
	$effect(() => {
		// 接続が確立されたら購読
		if (ws.isConnected) {
			ws.send({
				type: 'subscribe',
				payload: { taskId }
			});
		}
		
		// 接続イベントをリッスン
		const unsubscribeAuth = ws.on('auth:success', () => {
			ws.send({
				type: 'subscribe',
				payload: { taskId }
			});
		});
		
		// クリーンアップ時にアンサブスクライブ
		return () => {
			unsubscribeAuth();
			if (ws.isConnected) {
				ws.send({
					type: 'unsubscribe',
					payload: { taskId }
				});
			}
		};
	});
	
	// タスク関連のメッセージをリッスン
	$effect(() => {
		const unsubscribe = ws.onAny((message) => {
			// タスクIDが一致するメッセージを保存
			if (message.payload?.taskId === taskId || 
			    (message.type.startsWith('task:') && !message.payload?.taskId)) {
				taskMessages = [...taskMessages, message];
			}
		});
		
		return unsubscribe;
	});
	
	// 最新のログメッセージ（すべてのログタイプを含む）
	const logs = $derived(
		(() => {
			const wsLogs = taskMessages
				.filter(m => ['task:log', 'task:tool:start', 'task:tool:end', 'task:claude:response', 'task:todo_update'].includes(m.type))
				.map(m => {
					// メッセージタイプに応じてフォーマット
					switch (m.type) {
						case 'task:log':
							return m.payload?.log || '';
						case 'task:tool:start':
							return `🛠️ [${m.payload?.tool}] 開始${m.payload?.input ? `: ${JSON.stringify(m.payload.input).slice(0, 100)}...` : ''}`;
						case 'task:tool:end':
							return `✅ [${m.payload?.tool}] ${m.payload?.success ? '成功' : '失敗'}${m.payload?.duration ? ` (${m.payload.duration}ms)` : ''}`;
						case 'task:claude:response':
							return `🤖 Claude: ${m.payload?.text || ''}`;
						case 'task:todo_update':
							if (m.payload?.todos) {
								return `📝 TODO更新: ${m.payload.todos.map((t: any) => `${t.content} [${t.status}]`).join(', ')}`;
							}
							return '📝 TODO更新';
						default:
							return JSON.stringify(m.payload);
					}
				});
			
			// WebSocketログがない場合は初期ログを使用
			if (wsLogs.length === 0 && initialData?.logs && initialData.logs.length > 0) {
				return initialData.logs;
			}
			
			return wsLogs;
		})()
	);
	
	// ツール実行状況（初期データとWebSocketメッセージをマージ）
	const toolExecutions = $derived(
		(() => {
			// WebSocketメッセージから取得
			const wsMessages = taskMessages.filter(m => m.type === 'task:tool:start' || m.type === 'task:tool:end');
			
			// ツールIDごとにstartとendをペアリング
			const toolMap = new Map<string, any>();
			const completedTools: any[] = [];
			const toolByName = new Map<string, any[]>(); // ツール名でもトラッキング
			
			wsMessages.forEach(m => {
				const toolId = m.payload?.toolId;
				const toolName = m.payload?.tool || '';
				
				
				if (m.type === 'task:tool:start') {
					const startEvent = {
						type: 'task:tool:start',
						tool: toolName,
						toolId: toolId || `${toolName}-${m.timestamp}`,
						args: m.payload?.input,
						timestamp: m.timestamp || new Date().toISOString()
					};
					
					// toolIdがある場合はそれで記録
					if (toolId) {
						toolMap.set(toolId, startEvent);
					}
					
					// ツール名でも記録（toolIdがない場合のフォールバック）
					if (!toolByName.has(toolName)) {
						toolByName.set(toolName, []);
					}
					toolByName.get(toolName)!.push(startEvent);
					
				} else if (m.type === 'task:tool:end') {
					let startEvent = null;
					
					// まずtoolIdで探す
					if (toolId && toolMap.has(toolId)) {
						startEvent = toolMap.get(toolId);
						toolMap.delete(toolId);
					} 
					// toolIdがない場合、ツール名で最も古い開始イベントを探す
					else if (toolByName.has(toolName) && toolByName.get(toolName)!.length > 0) {
						const toolEvents = toolByName.get(toolName)!;
						startEvent = toolEvents.shift(); // 最も古いものを取得
						// toolMapからも削除
						if (startEvent.toolId && toolMap.has(startEvent.toolId)) {
							toolMap.delete(startEvent.toolId);
						}
					}
					
					// 終了イベントを記録
					completedTools.push({
						type: 'task:tool:end',
						tool: toolName,
						toolId: toolId || startEvent?.toolId || `${toolName}-${m.timestamp}`,
						args: startEvent?.args,
						output: m.payload?.output,
						duration: m.payload?.duration,
						success: m.payload?.success,
						error: m.payload?.error,
						timestamp: m.timestamp || new Date().toISOString()
					});
				}
			});
			
			// まだ終了していないツール（実行中）を追加
			const runningTools = Array.from(toolMap.values());
			const wsExecutions = [...completedTools, ...runningTools];
			
			// 初期データがある場合は、それを使用
			if (wsExecutions.length === 0) {
				// 詳細なツール実行履歴がある場合はそれを使用
				if (initialData?.toolExecutions && initialData.toolExecutions.length > 0) {
					// 初期データをそのまま完了したツールとして表示
					return initialData.toolExecutions.map((exec: any) => ({
						type: 'task:tool:end', // すべて完了として表示
						tool: exec.tool,
						toolId: `${exec.tool}-${exec.timestamp}`,
						args: exec.args,
						output: exec.output,
						duration: exec.duration,
						success: exec.success !== false,
						error: exec.error,
						timestamp: exec.timestamp
					}));
				}
				// 詳細履歴がない場合は、toolUsageCountから疑似的な履歴を作成
				else if (initialData?.toolUsageCount) {
					const initialExecutions: any[] = [];
					Object.entries(initialData.toolUsageCount).forEach(([tool, count]) => {
						for (let i = 0; i < count; i++) {
							initialExecutions.push({
								type: 'task:tool:end',
								tool,
								toolId: `${tool}-${i}`,
								success: true,
								timestamp: new Date().toISOString()
							});
						}
					});
					return initialExecutions;
				}
			}
			
			return wsExecutions;
		})()
	);
	
	// Claude応答（初期データとWebSocketメッセージをマージ）
	const claudeResponses = $derived(
		(() => {
			// WebSocketメッセージから取得
			const wsResponses = taskMessages
				.filter(m => m.type === 'task:claude:response')
				.map(m => ({
					response: m.payload?.text || '',
					turnNumber: m.payload?.turnNumber,
					maxTurns: m.payload?.maxTurns,
					timestamp: m.timestamp || new Date().toISOString()
				}));
			
			// 初期データがある場合は、それを使用
			if (wsResponses.length === 0) {
				// 詳細なClaude応答履歴がある場合はそれを使用
				if (initialData?.claudeResponses && initialData.claudeResponses.length > 0) {
					return initialData.claudeResponses.map(resp => ({
						response: resp.text || '',
						turnNumber: resp.turnNumber,
						maxTurns: resp.maxTurns,
						timestamp: resp.timestamp
					}));
				}
				// 詳細履歴がない場合は、ターン数から疑似的な履歴を作成
				else if (initialData?.currentTurn && initialData.currentTurn > 0) {
					const initialResponses = [];
					for (let i = 1; i <= initialData.currentTurn; i++) {
						initialResponses.push({
							response: `Turn ${i}`,
							turnNumber: i,
							maxTurns: initialData.maxTurns || 0,
							timestamp: new Date().toISOString()
						});
					}
					return initialResponses;
				}
			}
			
			return wsResponses;
		})()
	);
	
	// タスク統計
	const statistics = $derived(
		(() => {
			const statsMessages = taskMessages.filter(m => m.type === 'task:statistics');
			
			// WebSocketメッセージがある場合はそれを優先
			if (statsMessages.length > 0) {
				const latest = statsMessages[statsMessages.length - 1];
				// statistics オブジェクトが payload 内にネストされている可能性を考慮
				const stats = latest.payload?.statistics || latest.payload || null;
				
				return stats;
			}
			
			// WebSocketメッセージがない場合は初期値を使用
			if (initialStatistics) {
				return initialStatistics;
			}
			
			return null;
		})()
	);
	
	// TODOリスト更新（初期データとWebSocketメッセージをマージ）
	const todoUpdates = $derived(
		(() => {
			// 最新のTODOリストを取得（WebSocketメッセージを逆順に確認）
			const latestTodoMessage = taskMessages
				.filter(m => m.type === 'task:todo_update' && m.payload?.todos)
				.reverse()[0];
			
			if (latestTodoMessage && latestTodoMessage.payload?.todos) {
				// 最新のTODOリストをそのまま使用
				return latestTodoMessage.payload.todos.map((todo: any) => ({
					id: todo.id,
					content: todo.content || '',
					status: todo.status || '',
					priority: todo.priority || 'medium',
					timestamp: latestTodoMessage.timestamp || new Date().toISOString()
				}));
			}
			
			// WebSocketメッセージがない場合は初期データを使用
			if (initialData?.todos && initialData.todos.length > 0) {
				return initialData.todos.map((todo: any) => ({
					id: todo.id,
					content: todo.content || '',
					status: todo.status || '',
					priority: todo.priority || 'medium',
					timestamp: new Date().toISOString()
				}));
			}
			
			return [];
		})()
	);
	
	// タスクの進捗
	const progress = $derived(
		(() => {
			// 進捗メッセージとClaude応答から進捗を計算
			const progressMessages = taskMessages.filter(m => m.type === 'task:progress');
			const claudeMessages = taskMessages.filter(m => m.type === 'task:claude:response');
			
			// 最新のClaude応答からturn情報を取得
			const latestClaude = claudeMessages[claudeMessages.length - 1];
			const turn = latestClaude?.payload?.turnNumber || 0;
			const maxTurns = latestClaude?.payload?.maxTurns || 0;
			
			// 最新の進捗メッセージ
			const latestProgress = progressMessages[progressMessages.length - 1];
			const phase = latestProgress?.payload?.progress?.phase || latestProgress?.payload?.phase;
			const message = latestProgress?.payload?.progress?.message || latestProgress?.payload?.message || '';
			
			// フェーズに基づいて進捗を計算
			let percent = 0;
			if (phase === 'setup') percent = 10;
			else if (phase === 'planning') percent = 20;
			else if (phase === 'execution') {
				// ターン数に基づいて進捗を計算（20%～80%）
				if (maxTurns > 0) {
					percent = Math.min(80, 20 + (turn / maxTurns) * 60);
				} else {
					percent = 50;
				}
			}
			else if (phase === 'cleanup') percent = 90;
			else if (phase === 'complete') percent = 100;
			
			// 初期データがある場合
			if (percent === 0 && initialData?.currentTurn && initialData.maxTurns) {
				percent = Math.min(80, 20 + (initialData.currentTurn / initialData.maxTurns) * 60);
			}
			
			return {
				percent: Math.round(percent),
				message,
				phase,
				turn,
				maxTurns
			};
		})()
	);
	
	// 最新の状態変更（タスクの状態更新）
	const statusChange = $derived(
		(() => {
			const statusMessages = taskMessages.filter(m => 
				['task:status', 'task:running', 'task:completed', 'task:failed', 'task:cancelled', 'task:update'].includes(m.type)
			);
			
			return statusMessages[statusMessages.length - 1] || null;
		})()
	);
	
	return {
		get connected() { return ws.isConnected; },
		get messages() { return taskMessages; },
		get logs() { return logs; },
		get toolExecutions() { return toolExecutions; },
		get claudeResponses() { return claudeResponses; },
		get statistics() { return statistics; },
		get todoUpdates() { return todoUpdates; },
		get progress() { return progress; },
		get statusChange() { return statusChange; },
		clearMessages: () => { taskMessages = []; }
	};
}