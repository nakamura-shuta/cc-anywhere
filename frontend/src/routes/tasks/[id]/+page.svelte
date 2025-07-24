<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import { taskStore } from '$lib/stores/api.svelte';
	import { taskService } from '$lib/services/task.service';
	import { useTaskWebSocket } from '$lib/hooks/use-websocket.svelte';
	import { TaskStatus } from '$lib/types/api';
	import { format } from 'date-fns';
	import { ja } from 'date-fns/locale';
	import { ArrowLeft, RefreshCw, XCircle, Download, Clock, Activity, MessageSquare, CheckSquare, Folder, ChevronRight, GitBranch } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { Progress } from '$lib/components/ui/progress';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { Separator } from '$lib/components/ui/separator';
	import * as Collapsible from '$lib/components/ui/collapsible';
	
	// load関数から受け取るデータ
	let { data }: { data: PageData } = $props();
	
	// WebSocketでタスクを監視
	const ws = useTaskWebSocket(data.task.id);
	
	// タスクの状態（WebSocketからの更新を反映）
	let currentTask = $state(data.task);
	
	// ログ（初期値 + WebSocketからのリアルタイム更新）
	let logs = $state<string[]>(data.logs || []);
	
	// 自動スクロール用のDOM参照
	let logContainer = $state<HTMLDivElement>();
	let shouldAutoScroll = $state(true);
	
	// タブの選択状態
	let selectedTab = $state('logs');
	
	// タブ切り替え時のデバッグ
	$effect(() => {
		console.log('[TaskDetail] Selected tab changed to:', selectedTab);
	});
	
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
	
	// タスクの更新
	async function refreshTask() {
		await taskStore.fetchTask(data.task.id);
		const logsResponse = await taskService.getLogs(data.task.id);
		logs = logsResponse.logs || [];
	}
	
	// タスクのキャンセル
	async function cancelTask() {
		if (confirm('このタスクをキャンセルしますか？')) {
			await taskStore.cancelTask(data.task.id);
			await refreshTask();
		}
	}
	
	// ログのダウンロード
	function downloadLogs() {
		const content = logs.join('\n');
		const blob = new Blob([content], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `task-${data.task.id}-logs.txt`;
		a.click();
		URL.revokeObjectURL(url);
	}
	
	// WebSocketからのログ更新を監視
	$effect(() => {
		// WebSocketから新しいログを受信したら追加
		if (ws.logs.length > 0) {
			// 既存のログと比較して新しいログのみ追加
			// ws.logsには全てのWebSocketログが含まれるため、既存のlogsに含まれないものだけ追加
			const currentLogCount = logs.length;
			if (ws.logs.length > currentLogCount) {
				// 新しいログのみを追加（最後のN個）
				const newLogs = ws.logs.slice(currentLogCount);
				logs = [...logs, ...newLogs];
				
				// 自動スクロール
				if (shouldAutoScroll && logContainer) {
					setTimeout(() => {
						if (logContainer) {
							logContainer.scrollTop = logContainer.scrollHeight;
						}
					}, 100);
				}
			}
		}
	});
	
	// ステータス変更を監視
	$effect(() => {
		if (ws.statusChange) {
			console.log('[TaskDetail] Status change detected:', ws.statusChange);
			
			// タスクのステータスを更新
			const newStatus = ws.statusChange.data?.status || 
				(ws.statusChange.type === 'task:update' && ws.statusChange.data?.status) ||
				ws.statusChange.type.replace('task:', '');
			
			if (newStatus) {
				currentTask = {
					...currentTask,
					status: newStatus as TaskStatus,
					updatedAt: new Date().toISOString()
				};
			}
			
			// ステータスが完了系の場合、タスクを再取得
			if (['task:completed', 'task:failed', 'task:cancelled', 'completed', 'failed', 'cancelled'].includes(newStatus)) {
				refreshTask();
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
					<p class="font-mono">{data.task.id}</p>
				</div>
				{#if data.task.continuedFrom || data.task.parentTaskId}
					<div>
						<p class="text-sm text-muted-foreground">親タスク</p>
						<Button 
							variant="link" 
							class="h-auto p-0 text-primary hover:underline"
							onclick={() => window.location.href = `/tasks/${data.task.continuedFrom || data.task.parentTaskId}`}
						>
							<Folder class="h-4 w-4 mr-1" />
							{data.task.continuedFrom || data.task.parentTaskId}
						</Button>
					</div>
				{/if}
				<div>
					<p class="text-sm text-muted-foreground mb-2">指示内容</p>
					<div class="bg-muted/50 rounded-lg p-4 max-h-64 overflow-y-auto">
						<p class="whitespace-pre-wrap break-words text-sm">{data.task.instruction}</p>
					</div>
				</div>
				{#if data.task.context?.workingDirectory || data.task.workingDirectory}
					<div>
						<p class="text-sm text-muted-foreground">作業ディレクトリ</p>
						<div class="flex items-center gap-2">
							<Folder class="h-4 w-4 text-muted-foreground flex-shrink-0" />
							<p class="font-mono text-sm text-gray-700 dark:text-gray-300" title={data.task.context?.workingDirectory || data.task.workingDirectory}>
								{truncatePath(data.task.context?.workingDirectory || data.task.workingDirectory || '')}
							</p>
						</div>
					</div>
				{/if}
				{#if data.task.context?.repositories && data.task.context.repositories.length > 0}
					<div>
						<p class="text-sm text-muted-foreground">対象リポジトリ</p>
						<div class="flex flex-wrap gap-2 mt-1">
							{#each data.task.context.repositories as repo}
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
				{#if data.task.error}
					<div>
						<p class="text-sm text-muted-foreground">エラー</p>
						<p class="text-destructive whitespace-pre-wrap break-words">{data.task.error}</p>
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
					<Button 
						variant="default" 
						onclick={() => window.location.href = `/tasks/${data.task.id}/continue`}
						class="gap-2"
					>
						<RefreshCw class="h-4 w-4" />
						継続タスクを作成
					</Button>
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

		<!-- タスク統計 -->
		{#if ws.statistics}
			<Card.Root>
				<Card.Header>
					<Card.Title>実行統計</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
						<div class="text-center">
							<p class="text-2xl font-bold">{ws.statistics?.totalToolCalls || 0}</p>
							<p class="text-sm text-muted-foreground">ツール使用回数</p>
						</div>
						<div class="text-center">
							<p class="text-2xl font-bold">{ws.statistics?.modifiedFiles || 0}</p>
							<p class="text-sm text-muted-foreground">変更ファイル数</p>
						</div>
						<div class="text-center">
							<p class="text-2xl font-bold">{ws.statistics?.totalExecutions || 0}</p>
							<p class="text-sm text-muted-foreground">実行コマンド数</p>
						</div>
						<div class="text-center">
							<p class="text-2xl font-bold">{ws.statistics?.totalTurns || 0}</p>
							<p class="text-sm text-muted-foreground">実行ターン数</p>
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		{/if}

		<!-- 実行結果 -->
		{#if data.task.result}
			<Card.Root>
				<Card.Header>
					<Card.Title>実行結果</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="bg-muted p-4 rounded-lg overflow-auto max-h-96">
						<pre class="text-xs whitespace-pre-wrap break-words font-mono">{JSON.stringify(data.task.result, null, 2)}</pre>
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
				<Tabs bind:value={selectedTab} class="w-full">
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
						{#if logs.length > 0}
							<div 
								bind:this={logContainer}
								class="bg-black text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto overflow-y-auto max-h-96 space-y-1"
							>
								{#each logs as log}
									<div class="whitespace-pre-wrap break-words">{log}</div>
								{/each}
							</div>
						{:else}
							<p class="text-muted-foreground text-center py-8">ログがありません</p>
						{/if}
					</TabsContent>
					
					<!-- ツール実行タブ -->
					<TabsContent value="tools" class="mt-4">
						{#if ws.toolExecutions.length > 0}
							<div class="space-y-2 max-h-96 overflow-x-auto overflow-y-auto">
								{#each ws.toolExecutions as tool}
									<div class="p-3 rounded-lg border {tool.type === 'task:tool:start' ? 'bg-muted/50' : 'bg-green-50 dark:bg-green-950/20'}">
										<div class="flex items-center justify-between">
											<div class="flex items-center gap-2">
												<Badge variant={tool.type === 'task:tool:start' ? 'secondary' : 'default'}>
													{tool.tool}
												</Badge>
												<span class="text-xs text-muted-foreground">
													{formatDate(tool.timestamp)}
												</span>
											</div>
											{#if tool.duration}
												<span class="text-xs text-muted-foreground">
													{tool.duration}ms
												</span>
											{/if}
										</div>
										{#if tool.args}
											<div class="mt-2 overflow-auto max-h-32 bg-muted/50 p-2 rounded">
												<pre class="text-xs whitespace-pre-wrap break-words">{JSON.stringify(tool.args, null, 2)}</pre>
											</div>
										{/if}
										{#if tool.error}
											<div class="mt-2 text-xs text-destructive break-words">エラー: {tool.error}</div>
										{/if}
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
											<p class="whitespace-pre-wrap break-words m-0">{response.response}</p>
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
											<span class="text-xs text-muted-foreground">
												{formatDate(todo.timestamp)}
											</span>
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