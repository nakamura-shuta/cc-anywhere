<script lang="ts">
	import type { PageData } from './$types';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import * as Table from '$lib/components/ui/table';
	import { Plus, GitCompare, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-svelte';
	import { compareStore } from '$lib/stores/compare.svelte';
	import type { CompareTaskDetailResponse, CompareTaskStatus } from '$lib/types/api';
	import { formatDate } from '$lib/utils/date';
	import { goto } from '$app/navigation';

	// load関数から受け取るデータ
	let { data }: { data: PageData } = $props();

	// フォーム状態
	let instruction = $state('');
	let selectedRepository = $state('');
	let isCreating = $state(false);
	let createError = $state<string | null>(null);

	// ストアの初期化
	$effect(() => {
		if (data.compareTasks) {
			compareStore.items = data.compareTasks;
			compareStore.total = data.pagination?.total || 0;
		}
	});

	// ステータスに応じたバリアント
	function getStatusVariant(status: CompareTaskStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
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
	function getStatusLabel(status: CompareTaskStatus): string {
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
			default:
				return status;
		}
	}

	// 比較タスクを作成
	async function handleCreate() {
		if (!instruction.trim() || !selectedRepository) {
			createError = 'すべての項目を入力してください';
			return;
		}

		isCreating = true;
		createError = null;

		try {
			const result = await compareStore.create({
				instruction: instruction.trim(),
				repositoryId: selectedRepository
			});

			if (result) {
				// 作成成功したら詳細ページへ遷移
				goto(`/compare/${result.compareId}`);
			} else {
				createError = '比較タスクの作成に失敗しました';
			}
		} catch (err) {
			createError = err instanceof Error ? err.message : '比較タスクの作成に失敗しました';
		} finally {
			isCreating = false;
		}
	}

	// 詳細ページへ遷移
	function viewCompareTask(compareId: string) {
		goto(`/compare/${compareId}`);
	}

	// 各Executorのタスク有無を判定
	function hasTask(task: CompareTaskDetailResponse, executor: 'claude' | 'codex' | 'gemini'): boolean {
		const taskIdMap = {
			claude: task.claudeTaskId,
			codex: task.codexTaskId,
			gemini: task.geminiTaskId
		};
		return !!taskIdMap[executor];
	}

	// タスクステータスに応じたアイコンとクラスを取得
	function getExecutorIcon(task: CompareTaskDetailResponse, executor: 'claude' | 'codex' | 'gemini'): { icon: typeof Clock; class: string } {
		const hasTaskId = hasTask(task, executor);
		if (!hasTaskId) {
			return { icon: Clock, class: 'text-muted-foreground' };
		}
		// タスクがある場合は全体ステータスを参考に表示
		switch (task.status) {
			case 'completed':
				return { icon: CheckCircle, class: 'text-green-500' };
			case 'running':
			case 'pending':
				return { icon: Loader2, class: 'text-blue-500 animate-spin' };
			case 'failed':
			case 'cancelled':
				return { icon: XCircle, class: 'text-red-500' };
			case 'partial_success':
				return { icon: CheckCircle, class: 'text-yellow-500' };
			default:
				return { icon: Clock, class: 'text-muted-foreground' };
		}
	}
</script>

<!-- 比較モードページ -->
<div class="space-y-6">
	<!-- ページヘッダー -->
	<div class="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
		<div>
			<h2 class="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2">
				<GitCompare class="h-8 w-8" />
				LLM比較モード
			</h2>
			<p class="text-sm lg:text-base text-muted-foreground">
				Claude, Codex, Geminiの実行結果を同時に比較
			</p>
		</div>
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<!-- 新規作成フォーム -->
		<Card class="lg:col-span-1">
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<Plus class="h-5 w-5" />
					新しい比較タスク
				</CardTitle>
				<CardDescription>
					同じ指示を3つのLLMで同時に実行します
				</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<div class="space-y-2">
					<Label for="repository">リポジトリ</Label>
					<Select.Root
						type="single"
						value={selectedRepository}
						onValueChange={(value) => selectedRepository = value}
					>
						<Select.Trigger id="repository" class="w-full">
							<span data-slot="select-value">{selectedRepository || 'リポジトリを選択'}</span>
						</Select.Trigger>
						<Select.Content>
							{#each data.repositories || [] as repo}
								<Select.Item value={repo.name}>
									{repo.name}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				<div class="space-y-2">
					<Label for="instruction">指示</Label>
					<Textarea
						id="instruction"
						placeholder="例: READMEにプロジェクト概要を追加してください"
						bind:value={instruction}
						rows={4}
					/>
				</div>

				{#if createError}
					<p class="text-sm text-destructive">{createError}</p>
				{/if}

				<Button
					class="w-full"
					onclick={handleCreate}
					disabled={isCreating || !instruction.trim() || !selectedRepository}
				>
					{#if isCreating}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						作成中...
					{:else}
						<GitCompare class="mr-2 h-4 w-4" />
						比較タスクを作成
					{/if}
				</Button>
			</CardContent>
		</Card>

		<!-- 比較タスク一覧 -->
		<Card class="lg:col-span-2">
			<CardHeader>
				<CardTitle>比較タスク一覧</CardTitle>
				<CardDescription>
					{compareStore.total}件の比較タスク
				</CardDescription>
			</CardHeader>
			<CardContent>
				{#if compareStore.items.length === 0}
					<div class="text-center py-8 text-muted-foreground">
						<GitCompare class="h-12 w-12 mx-auto mb-4 opacity-50" />
						<p>比較タスクがありません</p>
						<p class="text-sm">左のフォームから新しい比較タスクを作成してください</p>
					</div>
				{:else}
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>ステータス</Table.Head>
								<Table.Head>指示</Table.Head>
								<Table.Head class="text-center">Claude</Table.Head>
								<Table.Head class="text-center">Codex</Table.Head>
								<Table.Head class="text-center">Gemini</Table.Head>
								<Table.Head>作成日時</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each compareStore.items as task}
								{@const claudeStatus = getExecutorIcon(task, 'claude')}
								{@const codexStatus = getExecutorIcon(task, 'codex')}
								{@const geminiStatus = getExecutorIcon(task, 'gemini')}
								<Table.Row
									class="cursor-pointer hover:bg-muted/50 transition-colors"
									onclick={() => viewCompareTask(task.compareId)}
								>
									<Table.Cell>
										<Badge variant={getStatusVariant(task.status)}>
											{getStatusLabel(task.status)}
										</Badge>
									</Table.Cell>
									<Table.Cell class="max-w-xs">
										<p class="truncate">{task.instruction}</p>
										<p class="text-xs text-muted-foreground">{task.repositoryId}</p>
									</Table.Cell>
									<Table.Cell class="text-center">
										<claudeStatus.icon class="h-5 w-5 mx-auto {claudeStatus.class}" />
									</Table.Cell>
									<Table.Cell class="text-center">
										<codexStatus.icon class="h-5 w-5 mx-auto {codexStatus.class}" />
									</Table.Cell>
									<Table.Cell class="text-center">
										<geminiStatus.icon class="h-5 w-5 mx-auto {geminiStatus.class}" />
									</Table.Cell>
									<Table.Cell class="text-sm text-muted-foreground">
										{formatDate(task.createdAt)}
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				{/if}
			</CardContent>
		</Card>
	</div>
</div>
