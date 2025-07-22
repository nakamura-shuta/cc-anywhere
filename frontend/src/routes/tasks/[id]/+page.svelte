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
	import { ArrowLeft, RefreshCw, XCircle, Download } from 'lucide-svelte';
	import { onMount } from 'svelte';
	
	// load関数から受け取るデータ
	let { data }: { data: PageData } = $props();
	
	// WebSocketでタスクを監視
	const ws = useTaskWebSocket(data.task.id);
	
	// タスクの状態（WebSocketからの更新を反映）
	let currentTask = $state(data.task);
	
	// ログ（初期値 + WebSocketからのリアルタイム更新）
	let logs = $state<string[]>(data.logs || []);
	
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
			// 重複を避けるため、新しいログのみ追加
			const existingLogsSet = new Set(logs);
			const newLogs = ws.logs.filter(log => !existingLogsSet.has(log));
			if (newLogs.length > 0) {
				logs = [...logs, ...newLogs];
			}
		}
		
		// ステータス変更を検知
		if (ws.statusChange) {
			// タスクのステータスを更新
			currentTask = {
				...currentTask,
				status: ws.statusChange.type.replace('task:', '') as TaskStatus,
				updatedAt: new Date().toISOString()
			};
			
			// ステータスが完了系の場合、タスクを再取得
			if (['task:completed', 'task:failed', 'task:cancelled'].includes(ws.statusChange.type)) {
				refreshTask();
			}
		}
	});
</script>

<div class="container mx-auto p-6 max-w-4xl">
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
				<div>
					<p class="text-sm text-muted-foreground">指示内容</p>
					<p class="whitespace-pre-wrap">{data.task.instruction}</p>
				</div>
				{#if data.task.context?.workingDirectory}
					<div>
						<p class="text-sm text-muted-foreground">作業ディレクトリ</p>
						<p class="font-mono">{data.task.context.workingDirectory}</p>
					</div>
				{/if}
				<div class="grid grid-cols-2 gap-4">
					<div>
						<p class="text-sm text-muted-foreground">作成日時</p>
						<p>{formatDate(data.task.createdAt)}</p>
					</div>
					<div>
						<p class="text-sm text-muted-foreground">更新日時</p>
						<p>{formatDate(data.task.updatedAt)}</p>
					</div>
				</div>
				{#if data.task.error}
					<div>
						<p class="text-sm text-muted-foreground">エラー</p>
						<p class="text-destructive">{data.task.error}</p>
					</div>
				{/if}
			</Card.Content>
			{#if data.task.status === 'running' || data.task.status === 'pending'}
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
		</Card.Root>

		<!-- 進捗表示 -->
		{#if ws.progress && currentTask.status === 'running'}
			<Card.Root>
				<Card.Header>
					<Card.Title>実行進捗</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="space-y-2">
						<div class="flex justify-between text-sm">
							<span>{ws.progress.message}</span>
							<span>{ws.progress.percent}%</span>
						</div>
						<div class="w-full bg-muted rounded-full h-2">
							<div 
								class="bg-primary h-2 rounded-full transition-all duration-300"
								style="width: {ws.progress.percent}%"
							></div>
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
					<pre class="bg-muted p-4 rounded-lg overflow-auto max-h-96">
						<code>{JSON.stringify(data.task.result, null, 2)}</code>
					</pre>
				</Card.Content>
			</Card.Root>
		{/if}

		<!-- ログ -->
		<Card.Root>
			<Card.Header>
				<div class="flex items-center justify-between">
					<Card.Title>実行ログ</Card.Title>
					<Button 
						variant="outline" 
						size="sm"
						onclick={downloadLogs}
						class="gap-2"
					>
						<Download class="h-4 w-4" />
						ダウンロード
					</Button>
				</div>
			</Card.Header>
			<Card.Content>
				{#if logs.length > 0}
					<div class="bg-black text-green-400 p-4 rounded-lg font-mono text-sm overflow-auto max-h-96">
						{#each logs as log}
							<div class="whitespace-pre-wrap">{log}</div>
						{/each}
					</div>
				{:else}
					<p class="text-muted-foreground">ログがありません</p>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>