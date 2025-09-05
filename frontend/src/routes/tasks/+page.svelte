<script lang="ts">
	import type { PageData } from './$types';
	import { Button } from '$lib/components/ui/button';
	import { Plus, GitBranch, FolderTree } from 'lucide-svelte';
	import { onMount, onDestroy } from 'svelte';
	import TaskList from './components/TaskList.svelte';
	import TaskPagination from './components/TaskPagination.svelte';
	import TaskFilter from './components/TaskFilter.svelte';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import TaskGroupList from './components/TaskGroupList.svelte';
	import { taskListStore } from './stores/task-list-migrated.svelte';
	import { taskGroupStore } from '$lib/stores/task-group.svelte';
	
	// load関数から受け取るデータ
	let { data }: { data: PageData } = $props();
	
	// 現在のフィルター状態
	let currentStatus = $state('all');
	let currentRepository = $state('');
	
	// 現在のタブ
	let activeTab = $state('single');
	
	// ストアの初期化
	$effect(() => {
		taskListStore.initialize(data.tasks || []);
	});
	
	// コンポーネントのライフサイクル
	onMount(async () => {
		// WebSocketの初期化はストア内で行われる
		// タスクグループストアの初期化
		await taskGroupStore.init();
	});
	
	onDestroy(() => {
		taskListStore.cleanup();
	});
	
	// タスクの詳細表示
	function viewTask(taskId: string) {
		window.location.href = `/tasks/${taskId}`;
	}
	
	// 新しいタスク画面へ
	function goToNewTask() {
		window.location.href = '/tasks/new';
	}
	
	// タスクグループの詳細表示
	function viewTaskGroup(groupId: string) {
		taskGroupStore.fetchStatus(groupId);
	}
	
	// タスクグループのキャンセル
	async function cancelTaskGroup(groupId: string) {
		await taskGroupStore.cancel(groupId);
	}
	
	// ページ変更
	function handlePageChange(page: number) {
		const params = new URLSearchParams();
		params.set('page', page.toString());
		if (currentStatus !== 'all') {
			params.set('status', currentStatus);
		}
		if (currentRepository) {
			params.set('repository', currentRepository);
		}
		window.location.href = `/tasks?${params.toString()}`;
	}
	
	// ステータスフィルター変更
	function handleStatusChange(status: string) {
		const params = new URLSearchParams();
		params.set('page', '1'); // フィルター変更時は1ページ目に戻る
		if (status !== 'all') {
			params.set('status', status);
		}
		if (currentRepository) {
			params.set('repository', currentRepository);
		}
		window.location.href = `/tasks?${params.toString()}`;
	}
	
	// リポジトリフィルター変更
	function handleRepositoryChange(repository: string) {
		const params = new URLSearchParams();
		params.set('page', '1'); // フィルター変更時は1ページ目に戻る
		if (currentStatus !== 'all') {
			params.set('status', currentStatus);
		}
		if (repository) {
			params.set('repository', repository);
		}
		window.location.href = `/tasks?${params.toString()}`;
	}
	
	// タスクはサーバーサイドでフィルタリング済みなので、そのまま使用
	const filteredTasks = $derived(taskListStore.tasks);
	
	// URLパラメータから初期状態を設定
	$effect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const statusParam = urlParams.get('status');
		const repositoryParam = urlParams.get('repository');
		if (statusParam) {
			currentStatus = statusParam;
		}
		if (repositoryParam) {
			currentRepository = repositoryParam;
		}
	});
</script>

<!-- タスク一覧ページ -->
<div class="space-y-6">
	<!-- ページヘッダー -->
	<div class="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
		<div>
			<h2 class="text-2xl lg:text-3xl font-bold tracking-tight">タスク管理</h2>
			<p class="text-sm lg:text-base text-muted-foreground">タスクとタスクグループを管理</p>
		</div>
		<div class="flex gap-2">
			{#if activeTab === 'single'}
				<Button variant="outline" onclick={() => window.location.href = '/tasks/tree'} class="flex-1 lg:flex-initial">
					<GitBranch class="mr-2 h-4 w-4" />
					<span class="hidden sm:inline">ツリー表示</span>
					<span class="sm:hidden">ツリー</span>
				</Button>
			{/if}
			<Button onclick={goToNewTask} class="flex-1 lg:flex-initial">
				<Plus class="mr-2 h-4 w-4" />
				<span class="hidden sm:inline">新しいタスク</span>
				<span class="sm:hidden">新規</span>
			</Button>
		</div>
	</div>

	<!-- タブ切り替え -->
	<Tabs value={activeTab} onValueChange={(value) => activeTab = value}>
		<TabsList class="grid w-full grid-cols-2 max-w-[400px]">
			<TabsTrigger value="single" class="flex items-center gap-2">
				<span>単一タスク</span>
				{#if taskListStore.tasks.length > 0}
					<span class="text-xs bg-primary/20 px-1.5 py-0.5 rounded-full">
						{taskListStore.tasks.length}
					</span>
				{/if}
			</TabsTrigger>
			<TabsTrigger value="group" class="flex items-center gap-2">
				<FolderTree class="h-4 w-4" />
				<span>タスクグループ</span>
				{#if taskGroupStore.groups.length > 0}
					<span class="text-xs bg-primary/20 px-1.5 py-0.5 rounded-full">
						{taskGroupStore.groups.length}
					</span>
				{/if}
			</TabsTrigger>
		</TabsList>

		<!-- 単一タスクタブ -->
		<TabsContent value="single" class="space-y-4">
			<!-- フィルター -->
			<TaskFilter 
				currentStatus={currentStatus}
				onStatusChange={handleStatusChange}
				currentRepository={currentRepository}
				onRepositoryChange={handleRepositoryChange}
			/>

			<!-- タスク一覧 -->
			<TaskList 
				tasks={filteredTasks} 
				onTaskClick={viewTask}
				currentRepository={currentRepository}
			/>

			<!-- ページネーション -->
			<TaskPagination 
				currentPage={data.pagination?.page || 1}
				totalPages={data.pagination?.totalPages || 1}
				onPageChange={handlePageChange}
			/>
		</TabsContent>

		<!-- タスクグループタブ -->
		<TabsContent value="group" class="space-y-4">
			<!-- タスクグループ一覧 -->
			<TaskGroupList 
				groups={taskGroupStore.groups}
				stats={taskGroupStore.stats}
				loading={taskGroupStore.loading}
				error={taskGroupStore.error}
				onGroupClick={viewTaskGroup}
				onGroupCancel={cancelTaskGroup}
				selectedGroup={taskGroupStore.selectedGroup}
			/>
		</TabsContent>
	</Tabs>
</div>