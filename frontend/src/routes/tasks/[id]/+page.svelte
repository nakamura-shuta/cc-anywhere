<script lang="ts">
	import type { PageData } from './$types';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import { taskStore } from '$lib/stores/api.svelte';
	import { useTaskWebSocket } from '$lib/hooks/use-websocket.svelte';
	import { TaskStatus } from '$lib/types/api';
	import { format } from 'date-fns';
	import { ja } from 'date-fns/locale';
	import { ArrowLeft, RefreshCw, XCircle, Download, Clock, Activity, MessageSquare, CheckSquare, Folder, ChevronRight, GitBranch, Terminal, FileText, Search, ListTodo, Globe, Layers, CheckCircle, AlertCircle, Loader2 } from 'lucide-svelte';
	import { Progress } from '$lib/components/ui/progress';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { Separator } from '$lib/components/ui/separator';
	
	// load関数から受け取るデータ
	let { data }: { data: PageData } = $props();
	
	// 初期データを抽出（progressDataから）
	const initialData = {
		toolUsageCount: data.task.progressData?.toolUsageCount || {},
		todos: data.task.progressData?.todos || data.task.todos || [],
		currentTurn: data.task.progressData?.currentTurn || 0,
		maxTurns: data.task.progressData?.maxTurns || 0,
		logs: data.task.progressData?.logs || data.task.logs || [],
		// 詳細情報も含める
		toolExecutions: data.task.progressData?.toolExecutions || [],
		claudeResponses: data.task.progressData?.claudeResponses || []
	};
	
	// デバッグ: progressDataの内容を確認
	if (data.task.progressData) {
		console.log('[TaskDetail] progressData:', data.task.progressData);
		console.log('[TaskDetail] initialData:', initialData);
	}
	
	// WebSocketでタスクを監視（初期統計情報と初期データを渡す）
	const ws = useTaskWebSocket(data.task.taskId || data.task.id, null, initialData);
	
	// タスクの状態（WebSocketからの更新を反映）
	let currentTask = $state(data.task);
	
	// ログはWebSocketから取得（初期ログも含まれる）
	// let logs = $state<string[]>(data.logs || []); // 削除：ws.logsを使用
	
	// 自動スクロール用のDOM参照
	let logContainer = $state<HTMLDivElement>();
	let shouldAutoScroll = $state(true);
	
	// タブの選択状態
	let selectedTab = $state('logs');
	
	// タブ切り替え時のデバッグ
	$effect(() => {
		console.log('[TaskDetail] Selected tab changed to:', selectedTab);
	});
	
	// ツールのアイコンを取得
	function getToolIcon(toolName: string) {
		switch (toolName) {
			case 'Bash':
			case 'bash':
				return Terminal;
			case 'Read':
			case 'Write':
			case 'Edit':
			case 'MultiEdit':
				return FileText;
			case 'Grep':
			case 'Glob':
			case 'LS':
				return Search;
			case 'TodoWrite':
				return ListTodo;
			case 'WebSearch':
				return Globe;
			case 'Task':
				return Layers;
			default:
				return null;
		}
	}
	
	// ツール引数を見やすい形式でフォーマット
	function formatToolArgs(toolName: string, args: any): { formatted: string, type: 'text' | 'code' | 'list' } {
		if (!args) return { formatted: '', type: 'text' };
		
		switch (toolName) {
			case 'Bash':
			case 'bash':
				return { 
					formatted: args.command || '',
					type: 'code'
				};
				
			case 'Read':
			case 'Write':
			case 'Edit':
			case 'MultiEdit':
				if (args.file_path) {
					let formatted = `📄 ${args.file_path}`;
					if (toolName === 'Edit' && args.old_string) {
						formatted += '\n\n🔍 検索:\n' + (args.old_string.length > 100 ? args.old_string.substring(0, 100) + '...' : args.old_string);
					}
					if (toolName === 'MultiEdit' && args.edits) {
						formatted += `\n\n📝 ${args.edits.length} 箇所を編集`;
					}
					return { formatted, type: 'text' };
				}
				break;
				
			case 'Grep':
			case 'Glob':
			case 'LS':
				if (args.pattern) {
					return { 
						formatted: `🔍 パターン: ${args.pattern}${args.path ? '\n📁 パス: ' + args.path : ''}`,
						type: 'text'
					};
				} else if (args.path) {
					return { 
						formatted: `📁 パス: ${args.path}`,
						type: 'text'
					};
				}
				break;
				
			case 'TodoWrite':
				if (args.todos && Array.isArray(args.todos)) {
					const todoList = args.todos.map((todo: any) => 
						`${todo.status === 'completed' ? '✅' : todo.status === 'in_progress' ? '🔄' : '⬜'} ${todo.content}`
					).join('\n');
					return { formatted: todoList, type: 'list' };
				}
				break;
				
			case 'WebSearch':
				if (args.query) {
					return { 
						formatted: `🔍 検索: "${args.query}"${args.allowed_domains ? '\n🌐 対象: ' + args.allowed_domains.join(', ') : ''}`,
						type: 'text'
					};
				}
				break;
				
			case 'Task':
				if (args.prompt) {
					const preview = args.prompt.length > 150 ? args.prompt.substring(0, 150) + '...' : args.prompt;
					return { 
						formatted: `📋 タスク: ${args.description || 'サブタスク'}\n\n${preview}`,
						type: 'text'
					};
				}
				break;
		}
		
		// デフォルトはJSON表示
		return { 
			formatted: JSON.stringify(args, null, 2),
			type: 'code'
		};
	}
	
	// タスクのステータスに応じたバッジのバリアント
	function getStatusVariant(status: string) {
		switch (status) {
			case 'completed': return 'default';
			case 'running': return 'secondary';
			case 'failed': return 'destructive';
			case 'cancelled': return 'outline';
			default: return 'secondary';
		}
	}
	
	// 日付フォーマット
	function formatDate(dateString: string) {
		try {
			return format(new Date(dateString), 'yyyy/MM/dd HH:mm:ss', { locale: ja });
		} catch {
			return dateString;
		}
	}
	
	// タスクの経過時間を取得
	function getTaskAge(): number {
		if (!currentTask.completedAt) return 0;
		return Date.now() - new Date(currentTask.completedAt).getTime();
	}
	
	// SDK Continueで続行
	async function handleSdkContinue() {
		// 新しいタスク作成画面に遷移（SDK Continue用パラメータ付き）
		const params = new URLSearchParams({
			continueFromTaskId: currentTask.taskId || currentTask.id,
			mode: 'sdk-continue'
		});
		window.location.href = `/tasks/new?${params.toString()}`;
	}
	
	
	// 長いパスを省略表示
	function truncatePath(path: string, maxLength: number = 60): string {
		if (path.length <= maxLength) return path;
		
		const parts = path.split('/');
		const fileName = parts[parts.length - 1];
		
		// ファイル名が長すぎる場合はそのまま末尾を省略
		if (fileName.length > maxLength - 10) {
			return '...' + path.slice(-(maxLength - 3));
		}
		
		// パスを省略して表示
		let truncated = path;
		let startIndex = 0;
		
		// ホームディレクトリから始まる場合は先頭を省略
		if (path.includes('/Users/') || path.includes('/home/')) {
			const userIndex = path.indexOf('/Users/') >= 0 ? path.indexOf('/Users/') : path.indexOf('/home/');
			const afterUser = path.indexOf('/', userIndex + 7); // /Users/ or /home/ の後の/
			if (afterUser > 0) {
				const nextSlash = path.indexOf('/', afterUser + 1);
				if (nextSlash > 0) {
					startIndex = nextSlash;
					truncated = '~' + path.slice(afterUser);
				}
			}
		}
		
		// それでも長い場合は中間を省略
		if (truncated.length > maxLength) {
			const end = '/' + parts.slice(-2).join('/');
			const maxStart = maxLength - end.length - 3;
			if (maxStart > 10) {
				truncated = truncated.slice(0, maxStart) + '...' + end;
			} else {
				truncated = '...' + end;
			}
		}
		
		return truncated;
	}
	
	// タスク更新中フラグ
	let isRefreshing = $state(false);
	
	// タスクの更新
	async function refreshTask() {
		if (isRefreshing) return; // 更新中は無視
		isRefreshing = true;
		
		try {
			const taskId = currentTask.taskId || currentTask.id;
			await taskStore.fetchTask(taskId);
			const taskState = taskStore.getTaskState(taskId);
			if (taskState.data) {
				currentTask = taskState.data;
			}
			// logsはws.logsを使用するため、ここでは取得しない
			// const logsResponse = await taskService.getLogs(currentTask.taskId || currentTask.id);
			// logs = logsResponse.logs || [];
		} finally {
			isRefreshing = false;
		}
	}
	
	// タスクのキャンセル
	async function cancelTask() {
		if (confirm('このタスクをキャンセルしますか？')) {
			await taskStore.cancelTask(currentTask.taskId || currentTask.id);
			await refreshTask();
		}
	}
	
	// ログのダウンロード
	function downloadLogs() {
		// WebSocketログまたは初期ログを使用
		const logsToDownload = ws.logs.length > 0 ? ws.logs : (data.logs || []);
		const content = logsToDownload.join('\n');
		const blob = new Blob([content], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `task-${currentTask.taskId || currentTask.id}-logs.txt`;
		a.click();
		URL.revokeObjectURL(url);
	}
	
	// 自動スクロール処理
	$effect(() => {
		// ログが更新されたら自動スクロール
		if (shouldAutoScroll && logContainer && ws.logs.length > 0) {
			setTimeout(() => {
				if (logContainer) {
					logContainer.scrollTop = logContainer.scrollHeight;
				}
			}, 100);
		}
	});
	
	// 最後に処理したステータス変更を記録
	let lastProcessedStatus = $state<string | null>(null);
	
	// ステータス変更を監視
	$effect(() => {
		if (!ws.statusChange) return;
		
		const changeType = ws.statusChange.type;
		const changeData = ws.statusChange.data;
		
		// 同じステータス変更を二重に処理しない
		const statusKey = `${changeType}-${changeData?.timestamp || Date.now()}`;
		if (statusKey === lastProcessedStatus) return;
		lastProcessedStatus = statusKey;
		
		console.log('[TaskDetail] Status change detected:', changeType, changeData);
		
		// ステータスを抽出
		const newStatus = changeData?.status || 
			(changeType === 'task:update' && changeData?.status) ||
			changeType.replace('task:', '');
		
		if (newStatus && ['completed', 'failed', 'cancelled', 'running', 'pending'].includes(newStatus)) {
			// ローカルのステータスのみ更新（APIは呼ばない）
			currentTask = {
				...currentTask,
				status: newStatus as TaskStatus,
				updatedAt: new Date().toISOString()
			};
			
			// 完了系のステータスの場合のみ、タスクの詳細を取得
			if (['completed', 'failed', 'cancelled'].includes(newStatus) && !isRefreshing) {
				// 少し待ってからAPIを呼ぶ（サーバー側でsdkSessionIdが保存されるのを待つ）
				setTimeout(() => {
					if (!isRefreshing) refreshTask();
				}, 500);
			}
		}
	});
</script>

<div class="container mx-auto p-4 md:p-6 max-w-7xl">
	<div class="mb-6">
		<Button variant="ghost" onclick={() => window.location.href = '/tasks'} class="gap-2 mb-4">
			<ArrowLeft class="h-4 w-4" />
			タスク一覧に戻る
		</Button>
		<div class="flex items-center justify-between">
			<h1 class="text-3xl font-bold">タスク詳細</h1>
			<div class="flex gap-2">
				{#if ws.connected}
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<div class="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
						リアルタイム更新中
					</div>
				{/if}
				<Button 
					variant="outline" 
					onclick={refreshTask}
					class="gap-2"
				>
					<RefreshCw class="h-4 w-4" />
					更新
				</Button>
			</div>
		</div>
	</div>

	<div class="grid gap-6">
		<!-- タスク情報 -->
		<Card.Root>
			<Card.Header>
				<div class="flex items-center justify-between">
					<Card.Title>タスク情報</Card.Title>
					<Badge variant={getStatusVariant(currentTask.status)}>
						{currentTask.status}
					</Badge>
				</div>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div>
					<p class="text-sm text-muted-foreground">ID</p>
					<p class="font-mono">{currentTask.taskId || currentTask.id}</p>
				</div>
				{#if currentTask.continuedFrom || currentTask.parentTaskId}
					<div>
						<p class="text-sm text-muted-foreground">親タスク</p>
						<Button 
							variant="link" 
							class="h-auto p-0 text-primary hover:underline"
							onclick={() => window.location.href = `/tasks/${currentTask.continuedFrom || currentTask.parentTaskId}`}
						>
							<Folder class="h-4 w-4 mr-1" />
							{currentTask.continuedFrom || currentTask.parentTaskId}
						</Button>
					</div>
				{/if}
				<div>
					<p class="text-sm text-muted-foreground mb-2">指示内容</p>
					<div class="bg-muted/50 rounded-lg p-4 max-h-64 overflow-y-auto">
						<p class="whitespace-pre-wrap break-words text-sm">{currentTask.instruction}</p>
					</div>
				</div>
				{#if currentTask.context?.workingDirectory || currentTask.workingDirectory}
					<div>
						<p class="text-sm text-muted-foreground">作業ディレクトリ</p>
						<div class="flex items-center gap-2">
							<Folder class="h-4 w-4 text-muted-foreground flex-shrink-0" />
							<p class="font-mono text-sm text-gray-700 dark:text-gray-300" title={currentTask.context?.workingDirectory || currentTask.workingDirectory}>
								{truncatePath(currentTask.context?.workingDirectory || currentTask.workingDirectory || '')}
							</p>
						</div>
					</div>
				{/if}
				{#if currentTask.context?.repositories && currentTask.context.repositories.length > 0}
					<div>
						<p class="text-sm text-muted-foreground">対象リポジトリ</p>
						<div class="flex flex-wrap gap-2 mt-1">
							{#each currentTask.context.repositories as repo}
								<Badge variant="secondary" class="text-xs">
									<Folder class="h-3 w-3 mr-1" />
									{repo.split('/').pop()}
								</Badge>
							{/each}
						</div>
					</div>
				{/if}
				<div class="grid grid-cols-2 gap-4">
					<div>
						<p class="text-sm text-muted-foreground">作成日時</p>
						<p class="text-sm">{formatDate(currentTask.createdAt)}</p>
					</div>
					<div>
						<p class="text-sm text-muted-foreground">更新日時</p>
						<p class="text-sm">{currentTask.updatedAt ? formatDate(currentTask.updatedAt) : '-'}</p>
					</div>
				</div>
				{#if currentTask.completedAt}
					<div>
						<p class="text-sm text-muted-foreground">完了日時</p>
						<p class="text-sm">{formatDate(currentTask.completedAt)}</p>
					</div>
				{/if}
				{#if currentTask.error}
					<div>
						<p class="text-sm text-muted-foreground">エラー</p>
						<p class="text-destructive whitespace-pre-wrap break-words">{typeof currentTask.error === 'string' ? currentTask.error : currentTask.error?.message || JSON.stringify(currentTask.error)}</p>
					</div>
				{/if}
			</Card.Content>
			{#if currentTask.status === 'running' || currentTask.status === 'pending'}
				<Card.Footer>
					<Button 
						variant="destructive" 
						onclick={cancelTask}
						class="gap-2"
					>
						<XCircle class="h-4 w-4" />
						タスクをキャンセル
					</Button>
				</Card.Footer>
			{/if}
			{#if currentTask.status === 'completed'}
				<Card.Footer>
					<div class="w-full space-y-4">
						<Separator />
						<div class="space-y-4">
							<h4 class="text-sm font-semibold">継続オプション</h4>
							<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
								{#if currentTask.sdkSessionId}
									<!-- SDK Continue オプション -->
									<div class="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
										<div class="space-y-3">
											<div class="flex items-center gap-2">
												<MessageSquare class="h-5 w-5 text-primary" />
												<h5 class="font-medium">会話を継続</h5>
												<Badge variant="default" class="text-xs">推奨</Badge>
											</div>
											<p class="text-sm text-muted-foreground">
												前回の会話の文脈を保持して続行します
											</p>
											<ul class="text-xs text-muted-foreground space-y-1">
												<li>✅ 30分以内の追加作業</li>
												<li>✅ 同じトピックの継続</li>
												<li>✅ 文脈が必要な作業</li>
											</ul>
											<Button 
												variant="default" 
												onclick={() => handleSdkContinue()}
												class="w-full gap-2"
											>
												<MessageSquare class="h-4 w-4" />
												SDK Continueで続行
											</Button>
										</div>
									</div>
								{:else}
									<!-- SDK Continue 無効化状態 -->
									<div class="p-4 border rounded-lg opacity-50">
										<div class="space-y-3">
											<div class="flex items-center gap-2">
												<MessageSquare class="h-5 w-5 text-muted-foreground" />
												<h5 class="font-medium">会話を継続</h5>
											</div>
											<p class="text-sm text-muted-foreground">
												セッションIDがないため利用できません
											</p>
											<Button 
												variant="outline" 
												disabled
												class="w-full gap-2"
											>
												<MessageSquare class="h-4 w-4" />
												SDK Continue利用不可
											</Button>
										</div>
									</div>
								{/if}
								
								<!-- 継続タスク オプション -->
								<div class="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
									<div class="space-y-3">
										<div class="flex items-center gap-2">
											<RefreshCw class="h-5 w-5 text-primary" />
											<h5 class="font-medium">結果を基に新規タスク</h5>
											{#if !currentTask.sdkSessionId || getTaskAge() > 30 * 60 * 1000}
												<Badge variant="default" class="text-xs">推奨</Badge>
											{/if}
										</div>
										<p class="text-sm text-muted-foreground">
											前回の結果を参考に新しいタスクを開始します
										</p>
										<ul class="text-xs text-muted-foreground space-y-1">
											<li>✅ 時間経過後の作業</li>
											<li>✅ 異なる種類の作業</li>
											<li>✅ 新しい文脈での作業</li>
										</ul>
										<Button 
											variant="outline" 
											onclick={() => window.location.href = `/tasks/${currentTask.taskId || currentTask.id}/continue`}
											class="w-full gap-2"
										>
											<RefreshCw class="h-4 w-4" />
											継続タスクを作成
										</Button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</Card.Footer>
			{/if}
		</Card.Root>

		<!-- 進捗表示 -->
		{#if ws.progress && currentTask.status === 'running'}
			<Card.Root>
				<Card.Header>
					<Card.Title>実行進捗</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="space-y-4">
						<div class="space-y-2">
							<div class="flex justify-between text-sm">
								<span>{ws.progress.message}</span>
								<span>{ws.progress.percent}%</span>
							</div>
							<Progress value={ws.progress.percent} class="h-2" />
						</div>
						{#if ws.progress.turn && ws.progress.maxTurns}
							<div class="flex items-center gap-2 text-sm text-muted-foreground">
								<Clock class="h-4 w-4" />
								<span>ターン {ws.progress.turn} / {ws.progress.maxTurns}</span>
							</div>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>
		{/if}


		<!-- 実行結果 -->
		{#if currentTask.result}
			<Card.Root>
				<Card.Header>
					<Card.Title>実行結果</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="bg-muted p-4 rounded-lg overflow-auto max-h-96">
						{#if typeof currentTask.result === 'string'}
							<div class="text-xs font-mono">
								{#each currentTask.result.split('\n') as line, i}
									{#if i > 0}<br />{/if}
									<span>{line}</span>
								{/each}
							</div>
						{:else}
							<pre class="text-xs whitespace-pre-wrap break-words font-mono">{JSON.stringify(currentTask.result, null, 2)}</pre>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>
		{/if}

		<!-- 継続タスク一覧 -->
		{#if data.childTasks && data.childTasks.length > 0}
			<Card.Root>
				<Card.Header>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<GitBranch class="h-5 w-5" />
							<Card.Title>継続タスク</Card.Title>
						</div>
						<Badge variant="secondary">{data.childTasks.length} 件</Badge>
					</div>
					<Card.Description>
						このタスクから作成された継続タスク
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="space-y-3">
						{#each data.childTasks as childTask}
							<button 
								type="button"
								class="w-full p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer text-left"
								onclick={() => window.location.href = `/tasks/${childTask.id || childTask.taskId}`}
							>
								<div class="flex items-start justify-between">
									<div class="flex-1 space-y-2">
										<div class="flex items-center gap-2">
											<Badge variant={getStatusVariant(childTask.status)}>
												{childTask.status}
											</Badge>
											<span class="text-xs text-muted-foreground">
												{formatDate(childTask.createdAt)}
											</span>
										</div>
										<p class="text-sm">{childTask.instruction}</p>
									</div>
									<ChevronRight class="h-5 w-5 text-muted-foreground flex-shrink-0" />
								</div>
							</button>
						{/each}
					</div>
				</Card.Content>
			</Card.Root>
		{/if}

		<!-- 詳細情報タブ -->
		<Card.Root>
			<Card.Header>
				<div class="flex items-center justify-between">
					<Card.Title>実行詳細</Card.Title>
					<Button 
						variant="outline" 
						size="sm"
						onclick={downloadLogs}
						class="gap-2"
					>
						<Download class="h-4 w-4" />
						ログをダウンロード
					</Button>
				</div>
			</Card.Header>
			<Card.Content>
				<Tabs bind:value={selectedTab} class="w-full" onValueChange={(value) => {
					console.log('[TaskDetail] Tab value changed via onValueChange:', value);
					selectedTab = value;
				}}>
					<TabsList class="grid w-full grid-cols-2 md:grid-cols-4">
						<TabsTrigger value="logs" class="text-xs">
							<Activity class="h-3 w-3 mr-1" />
							ログ
						</TabsTrigger>
						<TabsTrigger value="tools" class="text-xs">
							<Clock class="h-3 w-3 mr-1" />
							ツール実行 ({ws.toolExecutions.length})
						</TabsTrigger>
						<TabsTrigger value="claude" class="text-xs">
							<MessageSquare class="h-3 w-3 mr-1" />
							Claude応答 ({ws.claudeResponses.length})
						</TabsTrigger>
						<TabsTrigger value="todos" class="text-xs">
							<CheckSquare class="h-3 w-3 mr-1" />
							TODO ({ws.todoUpdates.length})
						</TabsTrigger>
					</TabsList>
					
					<!-- ログタブ -->
					<TabsContent value="logs" class="mt-4">
						{#if ws.logs.length > 0 || (data.logs && data.logs.length > 0)}
							<div 
								bind:this={logContainer}
								class="bg-black text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto overflow-y-auto max-h-96 space-y-1"
							>
								<!-- 初期ログを表示（WebSocketログがない場合） -->
								{#if ws.logs.length === 0 && data.logs}
									{#each data.logs as log}
										<div class="whitespace-pre-wrap break-words">{log}</div>
									{/each}
								{:else}
									<!-- WebSocketログを表示（TODO更新などがフォーマットされる） -->
									{#each ws.logs as log}
										<div class="whitespace-pre-wrap break-words">{log}</div>
									{/each}
								{/if}
							</div>
						{:else}
							<p class="text-muted-foreground text-center py-8">ログがありません</p>
						{/if}
					</TabsContent>
					
					<!-- ツール実行タブ -->
					<TabsContent value="tools" class="mt-4">
						{#if ws.toolExecutions.length > 0}
							<div class="space-y-2 max-h-96 overflow-x-auto overflow-y-auto">
								{#each ws.toolExecutions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) as tool}
									{@const isStart = tool.type === 'task:tool:start'}
									{@const isError = tool.error || tool.success === false}
									{@const ToolIcon = getToolIcon(tool.tool)}
									<div class="p-4 rounded-lg border transition-colors {isStart ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' : isError ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'}">
										<div class="flex items-start gap-3">
											<!-- ステータスアイコン -->
											<div class="flex-shrink-0 mt-0.5">
												{#if isStart}
													<Loader2 class="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
												{:else if isError}
													<AlertCircle class="h-5 w-5 text-red-600 dark:text-red-400" />
												{:else}
													<CheckCircle class="h-5 w-5 text-green-600 dark:text-green-400" />
												{/if}
											</div>
											
											<!-- メインコンテンツ -->
											<div class="flex-1 min-w-0">
												<div class="flex items-center gap-2 mb-1">
													{#if ToolIcon}
														<ToolIcon class="h-4 w-4 text-muted-foreground" />
													{/if}
													<span class="font-medium text-sm">{tool.tool}</span>
													<Badge variant={isStart ? 'secondary' : isError ? 'destructive' : 'default'} class="text-xs">
														{isStart ? '実行中' : isError ? '失敗' : '完了'}
													</Badge>
												</div>
												
												<!-- タイムスタンプと実行時間 -->
												<div class="flex items-center gap-3 text-xs text-muted-foreground mb-2">
													<span>{formatDate(tool.timestamp)}</span>
													{#if tool.duration}
														<span class="flex items-center gap-1">
															<Clock class="h-3 w-3" />
															{tool.duration}ms
														</span>
													{/if}
												</div>
												
												<!-- 引数/詳細 -->
												{#if tool.args}
													{@const { formatted, type } = formatToolArgs(tool.tool, tool.args)}
													{#if formatted}
														<div class="overflow-hidden rounded-md {type === 'code' ? 'bg-slate-900 dark:bg-slate-950' : 'bg-background/50'} border">
															{#if type === 'code'}
																<div class="p-3 overflow-x-auto">
																	<pre class="text-xs font-mono {type === 'code' ? 'text-slate-100' : ''}">{formatted}</pre>
																</div>
															{:else}
																<div class="p-3">
																	<p class="text-xs whitespace-pre-wrap break-words {type === 'list' ? 'space-y-1' : ''}">{formatted}</p>
																</div>
															{/if}
														</div>
													{/if}
												{/if}
												
												<!-- 実行結果 -->
												{#if tool.output && tool.type === 'task:tool:end'}
													<div class="mt-2">
														<p class="text-xs font-medium text-muted-foreground mb-1">実行結果:</p>
														<div class="overflow-hidden rounded-md bg-slate-900 dark:bg-slate-950 border">
															<div class="p-3 overflow-x-auto max-h-48 overflow-y-auto">
																{#if typeof tool.output === 'string'}
																	{#each tool.output.split('\n') as line, i}
																		{#if i > 0}<br />{/if}
																		<span class="text-xs font-mono text-slate-100">{line}</span>
																	{/each}
																{:else}
																	<pre class="text-xs font-mono text-slate-100" style="white-space: pre-wrap; word-break: break-word;">{JSON.stringify(tool.output, null, 2)}</pre>
																{/if}
															</div>
														</div>
													</div>
												{/if}
												
												<!-- エラーメッセージ -->
												{#if tool.error}
													<div class="mt-2 p-2 bg-red-100 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
														<p class="text-xs text-red-700 dark:text-red-300 break-words">
															<strong>エラー:</strong> {tool.error}
														</p>
													</div>
												{/if}
											</div>
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-muted-foreground text-center py-8">ツール実行情報がありません</p>
						{/if}
					</TabsContent>
					
					<!-- Claude応答タブ -->
					<TabsContent value="claude" class="mt-4">
						{#if ws.claudeResponses.length > 0}
							<div class="space-y-4 max-h-96 overflow-auto">
								{#each ws.claudeResponses as response}
									<div class="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/20">
										<div class="flex items-center gap-2 mb-2">
											<MessageSquare class="h-4 w-4 text-blue-600 dark:text-blue-400" />
											<span class="text-xs text-muted-foreground">
												{formatDate(response.timestamp)}
												{#if response.turnNumber && response.maxTurns}
													(ターン {response.turnNumber}/{response.maxTurns})
												{/if}
											</span>
										</div>
										<div class="prose prose-sm dark:prose-invert max-w-none">
											{#if typeof response.response === 'string'}
												<div class="m-0">
													{#each response.response.split('\n') as line, i}
														{#if i > 0}<br />{/if}
														<span>{line}</span>
													{/each}
												</div>
											{:else}
												<p class="whitespace-pre-wrap break-words m-0">{response.response}</p>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-muted-foreground text-center py-8">Claude応答がありません</p>
						{/if}
					</TabsContent>
					
					<!-- TODOタブ -->
					<TabsContent value="todos" class="mt-4">
						{#if ws.todoUpdates.length > 0}
							<div class="space-y-2 max-h-96 overflow-x-auto overflow-y-auto">
								{#each ws.todoUpdates as todo}
									<div class="p-3 rounded-lg border">
										<div class="flex items-center justify-between">
											<div class="flex items-center gap-2">
												<Badge variant={todo.status === 'completed' ? 'default' : todo.status === 'in_progress' ? 'secondary' : 'outline'}>
													{todo.status === 'completed' ? '完了' : todo.status === 'in_progress' ? '進行中' : '未実施'}
												</Badge>
												<span class="text-sm break-words flex-1">{todo.content}</span>
												{#if todo.priority === 'high'}
													<Badge variant="destructive" class="text-xs">高</Badge>
												{:else if todo.priority === 'low'}
													<Badge variant="secondary" class="text-xs">低</Badge>
												{/if}
											</div>
											{#if todo.timestamp}
												<span class="text-xs text-muted-foreground">
													{formatDate(todo.timestamp)}
												</span>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-muted-foreground text-center py-8">TODO更新がありません</p>
						{/if}
					</TabsContent>
				</Tabs>
			</Card.Content>
		</Card.Root>
		
	</div>
</div>