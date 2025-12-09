<script lang="ts">
	import type { PageData } from './$types';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { Separator } from '$lib/components/ui/separator';
	import {
		ArrowLeft,
		GitCompare,
		Clock,
		CheckCircle,
		XCircle,
		Loader2,
		FileText,
		GitBranch,
		Timer,
		Files,
		ExternalLink
	} from 'lucide-svelte';
	import { compareStore } from '$lib/stores/compare.svelte';
	import type { CompareTaskStatus, CompareTaskDetailResponse } from '$lib/types/api';
	import { formatDate } from '$lib/utils/date';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';

	// load関数から受け取るデータ
	let { data }: { data: PageData } = $props();

	// 自動更新用のインターバルID
	let refreshInterval: ReturnType<typeof setInterval> | null = null;

	// 自動更新が必要かどうか
	const needsRefresh = $derived(
		data.compareTask?.status === 'pending' || data.compareTask?.status === 'running'
	);

	onMount(() => {
		// running/pending状態の場合は5秒ごとに更新
		if (needsRefresh) {
			refreshInterval = setInterval(async () => {
				if (data.compareTask) {
					await compareStore.getById(data.compareTask.compareId);
					// ストアから更新されたデータを取得
					const updated = compareStore.items.find((t) => t.compareId === data.compareTask?.compareId);
					if (updated) {
						data.compareTask = updated;
					}
				}
			}, 5000);
		}
	});

	onDestroy(() => {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
	});

	// ステータスに応じたバリアント
	function getStatusVariant(
		status: CompareTaskStatus | string
	): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'completed':
				return 'default';
			case 'running':
			case 'pending':
				return 'secondary';
			case 'failed':
			case 'cancelled':
				return 'destructive';
			case 'partial_success':
				return 'outline';
			default:
				return 'secondary';
		}
	}

	// ステータスラベル
	function getStatusLabel(status: CompareTaskStatus | string): string {
		switch (status) {
			case 'completed':
				return '完了';
			case 'running':
				return '実行中';
			case 'pending':
				return '待機中';
			case 'failed':
				return '失敗';
			case 'cancelled':
				return 'キャンセル';
			case 'partial_success':
				return '部分成功';
			case 'cancelling':
				return 'キャンセル中';
			case 'timeout':
				return 'タイムアウト';
			default:
				return status;
		}
	}

	// Executor情報
	const executors = [
		{ key: 'claude' as const, name: 'Claude', icon: '/claude.png', color: 'border-orange-500' },
		{ key: 'codex' as const, name: 'Codex', icon: '/codex.png', color: 'border-blue-500' },
		{ key: 'gemini' as const, name: 'Gemini', icon: '/gemini.png', color: 'border-emerald-500' }
	];

	// ExecutorのタスクIDを取得
	function getTaskId(task: CompareTaskDetailResponse | null | undefined, executor: 'claude' | 'codex' | 'gemini'): string | null {
		if (!task) return null;
		const taskIdMap = {
			claude: task.claudeTaskId,
			codex: task.codexTaskId,
			gemini: task.geminiTaskId
		};
		return taskIdMap[executor];
	}

	// タスクがあるかどうか
	function hasTask(task: CompareTaskDetailResponse | null | undefined, executor: 'claude' | 'codex' | 'gemini'): boolean {
		return !!getTaskId(task, executor);
	}

	// ファイルステータスのラベル
	function getFileStatusLabel(status: string): string {
		switch (status) {
			case 'A':
				return '追加';
			case 'M':
				return '変更';
			case 'D':
				return '削除';
			case 'R':
				return '名前変更';
			case 'C':
				return 'コピー';
			default:
				return status;
		}
	}

	// ファイルステータスの色
	function getFileStatusColor(status: string): string {
		switch (status) {
			case 'A':
				return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950';
			case 'M':
				return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950';
			case 'D':
				return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950';
			default:
				return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-950';
		}
	}

	// タスク詳細ページへ移動
	function goToTaskDetail(taskId: string) {
		goto(`/tasks/${taskId}`);
	}
</script>

<!-- 比較タスク詳細ページ -->
<div class="space-y-6">
	<!-- ヘッダー -->
	<div class="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
		<div class="space-y-2">
			<Button variant="ghost" size="sm" onclick={() => goto('/compare')}>
				<ArrowLeft class="mr-2 h-4 w-4" />
				比較タスク一覧
			</Button>
			<div class="flex items-center gap-3">
				<GitCompare class="h-8 w-8" />
				<div>
					<h2 class="text-2xl font-bold">比較タスク詳細</h2>
					<p class="text-muted-foreground">{data.compareTask?.repositoryId}</p>
				</div>
				<Badge variant={getStatusVariant(data.compareTask?.status || 'pending')}>
					{getStatusLabel(data.compareTask?.status || 'pending')}
				</Badge>
				{#if needsRefresh}
					<Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
				{/if}
			</div>
		</div>
	</div>

	<!-- 指示内容 -->
	<Card>
		<CardHeader class="pb-2">
			<CardTitle class="text-lg">指示内容</CardTitle>
		</CardHeader>
		<CardContent>
			<p class="whitespace-pre-wrap">{data.compareTask?.instruction}</p>
			<div class="flex gap-4 mt-4 text-sm text-muted-foreground">
				<span class="flex items-center gap-1">
					<GitBranch class="h-4 w-4" />
					ベースコミット: {data.compareTask?.baseCommit?.substring(0, 7)}
				</span>
				<span class="flex items-center gap-1">
					<Clock class="h-4 w-4" />
					作成: {formatDate(data.compareTask?.createdAt || '')}
				</span>
			</div>
		</CardContent>
	</Card>

	<!-- 3カラムレイアウト: 各LLMの結果 -->
	<div class="grid gap-4 md:grid-cols-3">
		{#each executors as executor}
			{@const taskId = getTaskId(data.compareTask, executor.key)}
			{@const taskExists = hasTask(data.compareTask, executor.key)}
			<Card class="border-t-4 {executor.color}">
				<CardHeader class="pb-2">
					<div class="flex items-center justify-between">
						<CardTitle class="flex items-center gap-2">
							<img src={executor.icon} alt={executor.name} class="w-6 h-6" />
							{executor.name}
						</CardTitle>
						{#if taskExists}
							<Badge variant={getStatusVariant(data.compareTask?.status || 'pending')}>
								{getStatusLabel(data.compareTask?.status || 'pending')}
							</Badge>
						{:else}
							<Badge variant="secondary">待機中</Badge>
						{/if}
					</div>
				</CardHeader>
				<CardContent class="space-y-4">
					{#if taskExists && taskId}
						<!-- タスクID表示 -->
						<div class="text-sm text-muted-foreground">
							<span>タスクID: </span>
							<code class="text-xs bg-muted px-1 py-0.5 rounded">{taskId.substring(0, 8)}...</code>
						</div>

						<!-- ステータスアイコン -->
						<div class="flex justify-center py-4">
							{#if data.compareTask?.status === 'completed'}
								<CheckCircle class="h-16 w-16 text-green-500" />
							{:else if data.compareTask?.status === 'running' || data.compareTask?.status === 'pending'}
								<Loader2 class="h-16 w-16 text-blue-500 animate-spin" />
							{:else if data.compareTask?.status === 'failed' || data.compareTask?.status === 'cancelled'}
								<XCircle class="h-16 w-16 text-red-500" />
							{:else if data.compareTask?.status === 'partial_success'}
								<CheckCircle class="h-16 w-16 text-yellow-500" />
							{:else}
								<Clock class="h-16 w-16 text-muted-foreground" />
							{/if}
						</div>

						<!-- 詳細リンク -->
						<Button
							variant="outline"
							class="w-full"
							onclick={() => goToTaskDetail(taskId)}
						>
							<ExternalLink class="mr-2 h-4 w-4" />
							詳細を表示
						</Button>
					{:else}
						<div class="flex flex-col items-center justify-center py-8 text-muted-foreground">
							<Clock class="h-12 w-12 mb-2" />
							<p>タスク未開始</p>
						</div>
					{/if}
				</CardContent>
			</Card>
		{/each}
	</div>

	<!-- 変更ファイル比較テーブル -->
	{#if data.files && data.files.files.length > 0}
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<FileText class="h-5 w-5" />
					変更ファイル比較
				</CardTitle>
				<CardDescription>
					各LLMが変更したファイルの一覧
					{#if data.files.truncated}
						（{data.files.totalCount}件中{data.files.files.length}件表示）
					{:else}
						（{data.files.files.length}件）
					{/if}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>ファイルパス</Table.Head>
							<Table.Head class="text-center w-24">Claude</Table.Head>
							<Table.Head class="text-center w-24">Codex</Table.Head>
							<Table.Head class="text-center w-24">Gemini</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each data.files.files as file}
							<Table.Row>
								<Table.Cell class="font-mono text-sm">{file.path}</Table.Cell>
								<Table.Cell class="text-center">
									{#if file.claude}
										<span
											class="inline-block px-2 py-0.5 rounded text-xs font-medium {getFileStatusColor(
												file.claude
											)}"
										>
											{getFileStatusLabel(file.claude)}
										</span>
									{:else}
										<span class="text-muted-foreground">-</span>
									{/if}
								</Table.Cell>
								<Table.Cell class="text-center">
									{#if file.codex}
										<span
											class="inline-block px-2 py-0.5 rounded text-xs font-medium {getFileStatusColor(
												file.codex
											)}"
										>
											{getFileStatusLabel(file.codex)}
										</span>
									{:else}
										<span class="text-muted-foreground">-</span>
									{/if}
								</Table.Cell>
								<Table.Cell class="text-center">
									{#if file.gemini}
										<span
											class="inline-block px-2 py-0.5 rounded text-xs font-medium {getFileStatusColor(
												file.gemini
											)}"
										>
											{getFileStatusLabel(file.gemini)}
										</span>
									{:else}
										<span class="text-muted-foreground">-</span>
									{/if}
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</CardContent>
		</Card>
	{/if}
</div>
