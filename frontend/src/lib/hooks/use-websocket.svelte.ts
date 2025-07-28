// WebSocketフック（Svelte 5 Runes使用）

import { getWebSocketContext, type WebSocketMessage } from '$lib/websocket/websocket.svelte';

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
		(() => {
			const wsLogs = messages
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
			const wsMessages = messages.filter(m => m.type === 'task:tool:start' || m.type === 'task:tool:end');
			
			// ツールIDごとにstartとendをペアリング
			const toolMap = new Map<string, any>();
			const completedTools: any[] = [];
			const toolByName = new Map<string, any[]>(); // ツール名でもトラッキング
			
			wsMessages.forEach(m => {
				const toolId = m.data?.toolId;
				const toolName = m.data?.tool || '';
				
				// デバッグログ
				console.log(`[ToolExecution] ${m.type}`, { toolId, toolName, data: m.data });
				
				if (m.type === 'task:tool:start') {
					const startEvent = {
						type: 'task:tool:start',
						tool: toolName,
						toolId: toolId || `${toolName}-${m.timestamp}`,
						args: m.data?.input,
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
						duration: m.data?.duration,
						success: m.data?.success,
						error: m.data?.error,
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
			const wsResponses = messages
				.filter(m => m.type === 'task:claude:response')
				.map(m => ({
					response: m.data?.text || '',
					turnNumber: m.data?.turnNumber,
					maxTurns: m.data?.maxTurns,
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
			const statsMessages = messages.filter(m => m.type === 'task:statistics');
			
			// WebSocketメッセージがある場合はそれを優先
			if (statsMessages.length > 0) {
				const latest = statsMessages[statsMessages.length - 1];
				// statistics オブジェクトが payload 内にネストされている可能性を考慮
				const stats = latest.data?.statistics || latest.data || null;
				
				// デバッグ: 統計情報の内容をログ出力
				if (stats) {
					console.log('[TaskWebSocket] Statistics received from WebSocket:', stats);
				}
				
				return stats;
			}
			
			// WebSocketメッセージがない場合は初期値を使用
			if (initialStatistics) {
				console.log('[TaskWebSocket] Using initial statistics:', initialStatistics);
				return initialStatistics;
			}
			
			return null;
		})()
	);
	
	// TODOリスト更新（初期データとWebSocketメッセージをマージ）
	const todoUpdates = $derived(
		(() => {
			// 最新のTODOリストを取得（WebSocketメッセージを逆順に確認）
			const latestTodoMessage = messages
				.filter(m => m.type === 'task:todo_update' && m.data?.todos)
				.reverse()[0];
			
			if (latestTodoMessage && latestTodoMessage.data?.todos) {
				// 最新のTODOリストをそのまま使用
				return latestTodoMessage.data.todos.map((todo: any) => ({
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