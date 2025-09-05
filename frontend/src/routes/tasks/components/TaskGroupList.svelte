<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Progress } from '$lib/components/ui/progress';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { 
		Play, 
		CheckCircle2, 
		XCircle, 
		Loader2, 
		Clock, 
		FolderTree,
		ChevronRight,
		X,
		AlertCircle,
		Terminal,
		Trash2
	} from 'lucide-svelte';
	import type { TaskGroupSummary, TaskGroupStats, TaskGroupStatusResponse, TaskGroupLog } from '$lib/types/task-groups';
	import { taskGroupStore } from '$lib/stores/task-group.svelte';
	import { taskGroupService } from '$lib/services/task-group.service';
	import { onMount } from 'svelte';
	
	interface Props {
		groups: TaskGroupSummary[];
		stats: TaskGroupStats;
		loading: boolean;
		error: Error | null;
		selectedGroup: TaskGroupStatusResponse | null;
		onGroupClick: (groupId: string) => void;
		onGroupCancel: (groupId: string) => void;
	}
	
	let { 
		groups = [], 
		stats,
		loading = false,
		error = null,
		selectedGroup = null,
		onGroupClick,
		onGroupCancel
	}: Props = $props();
	
	// Database logs for non-running groups
	let databaseLogs = $state<TaskGroupLog[]>([]);
	let loadingLogs = $state(false);
	
	// ステータスに応じたアイコンを取得
	function getStatusIcon(status: string) {
		switch (status) {
			case 'running':
				return Loader2;
			case 'completed':
				return CheckCircle2;
			case 'failed':
				return XCircle;
			case 'cancelled':
				return X;
			default:
				return Clock;
		}
	}
	
	// ステータスに応じた色を取得
	function getStatusColor(status: string) {
		switch (status) {
			case 'running':
				return 'text-blue-500';
			case 'completed':
				return 'text-green-500';
			case 'failed':
				return 'text-red-500';
			case 'cancelled':
				return 'text-gray-500';
			default:
				return 'text-yellow-500';
		}
	}
	
	// ステータスバッジのvariant取得
	function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'running':
				return 'default';
			case 'completed':
				return 'secondary'; // success variant doesn't exist, use secondary
			case 'failed':
				return 'destructive';
			case 'cancelled':
				return 'secondary';
			default:
				return 'outline';
		}
	}
	
	// 実行モードの表示名を取得
	function getExecutionModeLabel(mode: string) {
		switch (mode) {
			case 'sequential':
				return '順次実行';
			case 'parallel':
				return '並列実行';
			case 'mixed':
				return '混合実行';
			default:
				return mode;
		}
	}
	
	// 経過時間を計算
	function getElapsedTime(startedAt: string, updatedAt: string) {
		const start = new Date(startedAt).getTime();
		const update = new Date(updatedAt).getTime();
		const elapsed = Math.floor((update - start) / 1000);
		
		if (elapsed < 60) {
			return `${elapsed}秒`;
		} else if (elapsed < 3600) {
			return `${Math.floor(elapsed / 60)}分`;
		} else {
			return `${Math.floor(elapsed / 3600)}時間`;
		}
	}
	
	// 選択されたグループのログを取得
	// 実行中ならWebSocketログ、それ以外ならデータベースログを使用
	const selectedGroupLogs = $derived(
		selectedGroup 
			? (selectedGroup.status === 'running' 
				? taskGroupStore.getLogsForGroup(selectedGroup.groupId)
				: databaseLogs.map(log => ({
					taskId: log.taskId,
					taskName: log.taskName,
					log: log.logMessage,
					timestamp: log.timestamp,
					level: log.logLevel
				})))
			: []
	);
	
	// 選択されたグループが変更されたら、履歴からログを取得
	$effect(() => {
		if (selectedGroup && selectedGroup.status !== 'running') {
			// 非実行中のグループはデータベースからログを取得
			loadingLogs = true;
			databaseLogs = [];
			taskGroupService.getHistory(selectedGroup.groupId)
				.then(history => {
					databaseLogs = history.logs || [];
				})
				.catch(err => {
					console.error('Failed to fetch task group logs:', err);
					databaseLogs = [];
				})
				.finally(() => {
					loadingLogs = false;
				});
		} else {
			// 実行中のグループはWebSocketログを使用
			databaseLogs = [];
			loadingLogs = false;
		}
	});
		
	// ログレベルのスタイルを取得
	function getLogLevelStyle(level?: string) {
		switch (level) {
			case 'error':
				return 'text-red-500';
			case 'warning':
				return 'text-yellow-500';
			case 'debug':
				return 'text-gray-500';
			default:
				return 'text-foreground';
		}
	}
	
	// タイムスタンプをフォーマット
	function formatTimestamp(timestamp: string) {
		const date = new Date(timestamp);
		return date.toLocaleTimeString('ja-JP', { 
			hour: '2-digit', 
			minute: '2-digit', 
			second: '2-digit',
			fractionalSecondDigits: 3
		});
	}
</script>

<div class="space-y-4">
	<!-- 統計情報 -->
	{#if stats}
		<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
			<Card>
				<CardHeader class="pb-2">
					<CardDescription>合計</CardDescription>
					<CardTitle class="text-2xl">{stats.total}</CardTitle>
				</CardHeader>
			</Card>
			<Card>
				<CardHeader class="pb-2">
					<CardDescription>実行中</CardDescription>
					<CardTitle class="text-2xl text-blue-500">{stats.running}</CardTitle>
				</CardHeader>
			</Card>
			<Card>
				<CardHeader class="pb-2">
					<CardDescription>完了</CardDescription>
					<CardTitle class="text-2xl text-green-500">{stats.completed}</CardTitle>
				</CardHeader>
			</Card>
			<Card>
				<CardHeader class="pb-2">
					<CardDescription>失敗</CardDescription>
					<CardTitle class="text-2xl text-red-500">{stats.failed}</CardTitle>
				</CardHeader>
			</Card>
			<Card>
				<CardHeader class="pb-2">
					<CardDescription>待機中</CardDescription>
					<CardTitle class="text-2xl text-yellow-500">{stats.pending}</CardTitle>
				</CardHeader>
			</Card>
			<Card>
				<CardHeader class="pb-2">
					<CardDescription>キャンセル</CardDescription>
					<CardTitle class="text-2xl text-gray-500">{stats.cancelled}</CardTitle>
				</CardHeader>
			</Card>
		</div>
	{/if}
	
	<!-- エラー表示 -->
	{#if error}
		<Alert variant="destructive">
			<AlertCircle class="h-4 w-4" />
			<AlertDescription>{error.message}</AlertDescription>
		</Alert>
	{/if}
	
	<!-- ローディング -->
	{#if loading && groups.length === 0}
		<div class="space-y-4">
			{#each Array(3) as _}
				<Card>
					<CardHeader>
						<Skeleton class="h-6 w-48" />
						<Skeleton class="h-4 w-32 mt-2" />
					</CardHeader>
					<CardContent>
						<Skeleton class="h-2 w-full" />
					</CardContent>
				</Card>
			{/each}
		</div>
	{/if}
	
	<!-- グループ一覧 -->
	{#if groups.length > 0}
		<div class="space-y-4">
			{#each groups as group}
				<Card class="cursor-pointer hover:bg-accent/50 transition-colors" onclick={() => onGroupClick(group.id)}>
					<CardHeader>
						<div class="flex items-start justify-between">
							<div class="space-y-1 flex-1">
								<div class="flex items-center gap-2">
									<FolderTree class="h-4 w-4 text-muted-foreground" />
									<CardTitle class="text-lg">{group.name}</CardTitle>
									<Badge variant={getStatusVariant(group.status)}>
										{group.status}
									</Badge>
									<Badge variant="outline" class="ml-auto">
										{getExecutionModeLabel(group.executionMode)}
									</Badge>
								</div>
								<CardDescription class="flex items-center gap-4">
									<span>タスク: {group.completedTasks}/{group.totalTasks}</span>
									{#if group.currentTask}
										<span class="text-xs">実行中: {group.currentTask}</span>
									{/if}
									<span class="text-xs text-muted-foreground">
										{getElapsedTime(group.startedAt, group.updatedAt)}
									</span>
								</CardDescription>
							</div>
							<div class="flex items-center gap-2">
								{#if group.status === 'running'}
									<Button 
										size="sm" 
										variant="ghost" 
										onclick={(e) => {
											e.stopPropagation();
											onGroupCancel(group.id);
										}}
									>
										<X class="h-4 w-4" />
									</Button>
								{/if}
								<ChevronRight class="h-4 w-4 text-muted-foreground" />
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<div class="space-y-2">
							<Progress value={group.progress} class="h-2" />
							<div class="text-xs text-muted-foreground text-right">
								{group.progress}%
							</div>
						</div>
					</CardContent>
				</Card>
			{/each}
		</div>
	{:else if !loading}
		<Card>
			<CardContent class="text-center py-8">
				<FolderTree class="h-12 w-12 text-muted-foreground mx-auto mb-4" />
				<p class="text-muted-foreground">タスクグループがありません</p>
			</CardContent>
		</Card>
	{/if}
	
	<!-- 詳細表示（選択されたグループ） -->
	{#if selectedGroup}
		<Card class="mt-6">
			<CardHeader>
				<CardTitle>グループ詳細: {selectedGroup.groupId}</CardTitle>
				<CardDescription>
					セッションID: {selectedGroup.sessionId || 'N/A'}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="space-y-3">
					{#each selectedGroup.tasks as task}
						{@const StatusIcon = getStatusIcon(task.status)}
						<div class="flex items-center justify-between p-3 border rounded-lg">
							<div class="flex items-center gap-3">
								<StatusIcon class={`h-4 w-4 ${getStatusColor(task.status)} ${task.status === 'running' ? 'animate-spin' : ''}`} />
								<div>
									<p class="font-medium">{task.name}</p>
									<p class="text-sm text-muted-foreground">ID: {task.id}</p>
								</div>
							</div>
							<div class="text-right">
								<Badge variant={getStatusVariant(task.status)}>
									{task.status}
								</Badge>
								{#if task.error}
									<p class="text-xs text-red-500 mt-1">{task.error}</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</CardContent>
		</Card>
		
		<!-- ログ表示 (選択されたグループのログ) -->
		{#if selectedGroupLogs.length > 0}
			<Card class="mt-4">
				<CardHeader class="flex flex-row items-center justify-between">
					<div class="flex items-center gap-2">
						<Terminal class="h-4 w-4" />
						<CardTitle>実行ログ</CardTitle>
					</div>
					<Button 
						size="sm" 
						variant="ghost" 
						onclick={() => taskGroupStore.clearLogs(selectedGroup.groupId)}
					>
						<Trash2 class="h-4 w-4" />
					</Button>
				</CardHeader>
				<CardContent>
					<ScrollArea class="h-[400px] w-full">
						<div class="space-y-1 p-4 bg-muted/50 rounded-lg font-mono text-sm">
							{#each selectedGroupLogs as log}
								<div class="flex gap-2">
									<span class="text-muted-foreground text-xs w-24 shrink-0">
										{formatTimestamp(log.timestamp)}
									</span>
									<span class="text-primary/70 w-32 shrink-0 truncate">
										[{log.taskName}]
									</span>
									<span class={getLogLevelStyle(log.level)}>
										{log.log}
									</span>
								</div>
							{/each}
						</div>
					</ScrollArea>
				</CardContent>
			</Card>
		{:else if selectedGroup}
			<Card class="mt-4">
				<CardHeader>
					<div class="flex items-center gap-2">
						<Terminal class="h-4 w-4" />
						<CardTitle>実行ログ</CardTitle>
					</div>
				</CardHeader>
				<CardContent>
					{#if loadingLogs}
						<div class="flex items-center justify-center p-8 text-muted-foreground">
							<Loader2 class="h-4 w-4 animate-spin mr-2" />
							ログを取得中...
						</div>
					{:else if selectedGroup.status === 'running'}
						<div class="flex items-center justify-center p-8 text-muted-foreground">
							<Loader2 class="h-4 w-4 animate-spin mr-2" />
							実行ログを待機中...
						</div>
					{:else}
						<div class="flex items-center justify-center p-8 text-muted-foreground">
							ログがありません
						</div>
					{/if}
				</CardContent>
			</Card>
		{/if}
	{/if}
</div>