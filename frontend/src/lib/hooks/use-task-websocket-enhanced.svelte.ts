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
				// デバッグログ
				if (message.type === 'task:tool:start' || message.type === 'task:tool:end') {
					console.log('[WebSocket] Tool event received:', {
						type: message.type,
						tool: message.payload?.tool,
						toolId: message.payload?.toolId,
						timestamp: message.timestamp
					});
				}
				taskMessages = [...taskMessages, message];
			}
		});

		return unsubscribe;
	});
	
	// Reasoning メッセージ（Codex SDK v0.52.0+）
	const reasoningMessages = $derived(
		(() => {
			return taskMessages
				.filter(m => m.type === 'task:reasoning')
				.map(m => ({
					id: m.payload?.id || '',
					text: m.payload?.text || '',
					timestamp: m.timestamp || new Date().toISOString()
				}));
		})()
	);

	// 最新のログメッセージ（すべてのログタイプを含む）
	const logs = $derived(
		(() => {
			// 初期データ（APIから取得）がある場合はそれを優先
			if (initialData?.logs && initialData.logs.length > 0 && taskMessages.length === 0) {
				// APIから取得したログを新形式に変換（古い形式の場合）
				return initialData.logs.map(log => {
					// 新形式の判定: タイムスタンプパターンを含むかチェック
					// 例: "2025/1/29 12:34:56" または "2025/07/31 13:10:20"
					const timestampPattern = /\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?/;
					
					// 新形式のログの特徴:
					// 1. "ツール名\n2025/07/31 13:10:20: 詳細" (tool:start)
					// 2. "✓ 成功\n2025/07/31 13:10:21" (tool:result)
					// 3. "📝 TODO更新\n• タスク [completed]\n2025/07/31 13:10:22" (todo_update)
					// 4. "2025/07/31 13:10:23 (ターン 1/5)\nテキスト..." (claude:response)
					
					// 新形式かどうかチェック（タイムスタンプが複数行の中に含まれている）
					const lines = log.split('\n');
					const hasTimestampInFormat = lines.some(line => timestampPattern.test(line));
					
					// 新形式の場合はそのまま返す
					if (hasTimestampInFormat && lines.length > 1) {
						return log;
					}
					
					// 単一行でもタイムスタンプが正しい位置にある新形式はそのまま返す
					// 例: "ログメッセージ"（task:log）
					if (lines.length === 1 && !timestampPattern.test(log)) {
						// 古い形式のパターンにマッチしない単純なログメッセージ
						const oldPatterns = [
							/^\[(.*?)\]\s*([✓✗⚡])\s*(開始|成功|失敗)/, // [Tool] ✓ 成功
							/^(\w+)\s+(完了|失敗)\s+\d{4}\//, // Tool 完了 2025/...
							/^ターン\s*\d+\/\d+/ // ターン 1/5
						];
						
						const isOldFormat = oldPatterns.some(pattern => pattern.test(log));
						if (!isOldFormat) {
							return log;
						}
					}
					
					// 以下、古い形式の変換処理
					
					// パターン1: "TodoWrite 完了 2025/07/31 13:10" 形式（単一行の古い形式）
					const toolCompletePattern = /^(\w+)\s+(完了|失敗)\s+(\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2})$/;
					const toolCompleteMatch = log.match(toolCompletePattern);
					if (toolCompleteMatch) {
						const [, , status, timestamp] = toolCompleteMatch;
						const statusEmoji = status === '完了' ? '✓ 成功' : '✗ 失敗';
						return `${statusEmoji}\n${timestamp}`;
					}
					
					// パターン2: "2025/07/31 13:10 (ターン 1/30)\nTurn 1" 形式（旧バックエンド形式）
					const claudeResponsePattern = /^(\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2})\s*\(ターン\s*(\d+)\/(\d+)\)\s*\n\s*Turn\s+(\d+)$/;
					const claudeMatch = log.match(claudeResponsePattern);
					if (claudeMatch) {
						const [, timestamp, turnNumber, maxTurns] = claudeMatch;
						// 新形式に変換（ただし実際の応答テキストは不明なので空文字）
						return `${timestamp} (ターン ${turnNumber}/${maxTurns})\n`;
					}
					
					// パターン2.5: "🤖 クラウド応答 (ターン 1/30)\nTurn 1\n2025/07/31 13:10" 形式（現在のバックエンド形式）
					const currentBackendPattern = /^🤖\s*クラウド応答\s*\(ターン\s*(\d+)\/(\d+)\)\s*\n\s*Turn\s+\d+\s*\n\s*(\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2})$/;
					const currentMatch = log.match(currentBackendPattern);
					if (currentMatch) {
						const [, turnNumber, maxTurns, timestamp] = currentMatch;
						// 新形式に変換（ただし実際の応答テキストは不明なので空文字）
						return `${timestamp} (ターン ${turnNumber}/${maxTurns})\n`;
					}
					
					// パターン3: 既存の古い形式 "[ToolName] ✓ 成功: details"
					const oldToolPattern = /^\[(.*?)\]\s*([✓✗⚡])\s*(開始|成功|失敗)(?:\s*:\s*(.*))?$/;
					const match = log.match(oldToolPattern);
					
					if (match) {
						const [, tool, , action, details] = match;
						const timestamp = new Date().toLocaleString('ja-JP'); // 実際のタイムスタンプは不明なので現在時刻を使用
						
						if (action === '開始') {
							const toolInput = details ? `: ${details}` : '';
							return `🛠️ ${tool}\n開始${toolInput}\n${timestamp}`;
						} else {
							const statusEmoji = action === '成功' ? '✅ 完了' : '❌ 失敗';
							return `${statusEmoji}\n${tool}\n${timestamp}`;
						}
					}
					
					// 変換できない場合はそのまま返す
					return log;
				});
			}
			
			// WebSocketメッセージがある場合はフォーマットして使用
			const wsLogs = taskMessages
				.filter(m => ['task:log', 'task:tool:start', 'task:tool:end', 'task:claude:response', 'task:todo_update'].includes(m.type))
				.map(m => {
					const timestamp = new Date(m.timestamp || Date.now()).toLocaleString('ja-JP');
					
					// task:logはすでにフォーマット済みの可能性があるのでそのまま返す
					if (m.type === 'task:log') {
						return m.payload?.log || '';
					}
					
					// WebSocketメッセージをフォーマット（バックエンドと同じ形式）
					switch (m.type) {
						case 'task:tool:start': {
							// Use formatted input if available, otherwise fall back to raw input
							const formattedInput = m.payload?.formattedInput;
							let displayInput = '';
							
							if (formattedInput) {
								// For TodoWrite with multiple lines, add proper indentation
								if (m.payload?.tool === 'TodoWrite' && formattedInput.includes('\n')) {
									displayInput = '\n' + formattedInput;
								} else {
									displayInput = formattedInput ? `: ${formattedInput}` : '';
								}
							} else if (m.payload?.input) {
								// Fallback to raw input with truncation
								displayInput = `: ${JSON.stringify(m.payload.input).slice(0, 100)}...`;
							}
							
							return `${m.payload?.tool}\n${timestamp}${displayInput}`;
						}
						case 'task:tool:end': {
							const status = m.payload?.success ? '✅ 完了' : '❌ 失敗';
							const duration = m.payload?.duration ? `\n実行時間: ${m.payload.duration}ms` : '';
							return `${status}\n${m.payload?.tool}${duration}\n${timestamp}`;
						}
						case 'task:claude:response': {
							const turnInfo = m.payload?.turnNumber && m.payload?.maxTurns 
								? ` (ターン ${m.payload.turnNumber}/${m.payload.maxTurns})` 
								: '';
							const responseText = m.payload?.text || '';
							return `${timestamp}${turnInfo}\n${responseText}`;
						}
						case 'task:todo_update':
							if (m.payload?.todos) {
								const todoList = m.payload.todos.map((t: any) => `  • ${t.content} [${t.status}]`).join('\n');
								return `📝 TODO更新\n${todoList}\n${timestamp}`;
							}
							return `📝 TODO更新\n${timestamp}`;
						default:
							return JSON.stringify(m.payload);
					}
				});
			
			return wsLogs;
		})()
	);
	
	// ツール実行状況（初期データとWebSocketメッセージをマージ）
	const toolExecutions = $derived(
		(() => {
			// WebSocketメッセージから取得
			const wsMessages = taskMessages.filter(m => m.type === 'task:tool:start' || m.type === 'task:tool:end');

			// デバッグログ
			if (wsMessages.length > 0) {
				console.log('[WebSocket] Tool messages count:', wsMessages.length);
			}

			// ツールIDごとにstartとendをペアリング
			const toolMap = new Map<string, any>();
			const completedTools: any[] = [];
			const toolByName = new Map<string, any[]>(); // ツール名でもトラッキング

			wsMessages.forEach((m, index) => {
				const toolId = m.payload?.toolId;
				const toolName = m.payload?.tool || '';


				if (m.type === 'task:tool:start') {
					// 【修正】新しいツール開始時に、前の同じツール名のツールを自動完了させる
					// toolByNameから最も古い実行中のツールを取得
					if (toolByName.has(toolName) && toolByName.get(toolName)!.length > 0) {
						const previousTools = toolByName.get(toolName)!;
						const previousTool = previousTools[previousTools.length - 1];

						// 次のメッセージを確認（次がtool:startの場合、前のツールは完了したとみなす）
						const nextMessage = wsMessages[index + 1];
						if (nextMessage && nextMessage.type === 'task:tool:start') {
							// 前のツールを完了としてマーク
							completedTools.push({
								type: 'task:tool:end',
								tool: previousTool.tool,
								toolId: previousTool.toolId,
								args: previousTool.args,
								output: '', // outputは不明
								duration: undefined,
								success: true, // 成功と仮定
								error: undefined,
								timestamp: m.timestamp || new Date().toISOString()
							});

							// toolMapから削除
							if (previousTool.toolId && toolMap.has(previousTool.toolId)) {
								toolMap.delete(previousTool.toolId);
							}
							// toolByNameから削除
							previousTools.pop();
						}
					}

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

			// 【修正】タスク完了時は、すべての実行中ツールを完了扱いにする
			const runningTools = Array.from(toolMap.values());
			// タスクステータスをWebSocketメッセージから取得
			const taskUpdateMessages = taskMessages.filter(m => m.type === 'task:update');
			const latestStatus = taskUpdateMessages.length > 0
				? taskUpdateMessages[taskUpdateMessages.length - 1].payload?.status
				: null;
			const isTaskCompleted = latestStatus === 'completed' || latestStatus === 'failed' || latestStatus === 'cancelled';

			if (isTaskCompleted && runningTools.length > 0) {
				console.log('[WebSocket] Task completed, auto-completing remaining tools:', {
					status: latestStatus,
					runningToolsCount: runningTools.length,
					tools: runningTools.map(t => t.tool)
				});

				// すべての実行中ツールを完了としてマーク
				runningTools.forEach(tool => {
					completedTools.push({
						type: 'task:tool:end',
						tool: tool.tool,
						toolId: tool.toolId,
						args: tool.args,
						output: '',
						duration: undefined,
						success: true,
						error: undefined,
						timestamp: new Date().toISOString()
					});
				});

				// wsExecutionsには完了したツールのみを含める
				const wsExecutions = completedTools;

				// デバッグログ
				console.log('[WebSocket] Tool executions (task completed):', {
					completed: completedTools.length,
					running: 0,
					total: wsExecutions.length
				});

				return wsExecutions;
			}

			const wsExecutions = [...completedTools, ...runningTools];

			// デバッグログ
			console.log('[WebSocket] Tool executions:', {
				completed: completedTools.length,
				running: runningTools.length,
				total: wsExecutions.length
			});

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
		get reasoningMessages() { return reasoningMessages; },
		get statistics() { return statistics; },
		get todoUpdates() { return todoUpdates; },
		get progress() { return progress; },
		get statusChange() { return statusChange; },
		clearMessages: () => { taskMessages = []; }
	};
}