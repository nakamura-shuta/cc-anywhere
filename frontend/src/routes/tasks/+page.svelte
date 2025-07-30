<script lang="ts">
	import type { PageData } from './$types';
	import { Button } from '$lib/components/ui/button';
	import { Plus, GitBranch } from 'lucide-svelte';
	import { onMount, onDestroy } from 'svelte';
	import TaskList from './components/TaskList.svelte';
	import TaskPagination from './components/TaskPagination.svelte';
	import TaskFilter from './components/TaskFilter.svelte';
	import { taskListStore } from './stores/task-list-migrated.svelte';
	
	// load関数から受け取るデータ
	let { data }: { data: PageData } = $props();
	
	// 現在のフィルター状態
	let currentStatus = $state('all');
	
	// ストアの初期化
	$effect(() => {
		taskListStore.initialize(data.tasks || []);
	});
	
	// コンポーネントのライフサイクル
	onMount(() => {
		// WebSocketの初期化はストア内で行われる
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
	
	// ページ変更
	function handlePageChange(page: number) {
		const params = new URLSearchParams();
		params.set('page', page.toString());
		if (currentStatus !== 'all') {
			params.set('status', currentStatus);
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
		window.location.href = `/tasks?${params.toString()}`;
	}
	
	// フィルタリングされたタスク
	const filteredTasks = $derived(
		currentStatus === 'all' 
			? taskListStore.tasks 
			: taskListStore.tasks.filter(task => task.status === currentStatus)
	);
	
	// URLパラメータから初期状態を設定
	$effect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const statusParam = urlParams.get('status');
		if (statusParam) {
			currentStatus = statusParam;
		}
	});
</script>

<!-- タスク一覧ページ -->
<div class="space-y-6">
	<!-- ページヘッダー -->
	<div class="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
		<div>
			<h2 class="text-2xl lg:text-3xl font-bold tracking-tight">タスク一覧</h2>
			<p class="text-sm lg:text-base text-muted-foreground">実行中のタスクを管理</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" onclick={() => window.location.href = '/tasks/tree'} class="flex-1 lg:flex-initial">
				<GitBranch class="mr-2 h-4 w-4" />
				<span class="hidden sm:inline">ツリー表示</span>
				<span class="sm:hidden">ツリー</span>
			</Button>
			<Button onclick={goToNewTask} class="flex-1 lg:flex-initial">
				<Plus class="mr-2 h-4 w-4" />
				<span class="hidden sm:inline">新しいタスク</span>
				<span class="sm:hidden">新規</span>
			</Button>
		</div>
	</div>

	<!-- フィルター -->
	<TaskFilter 
		currentStatus={currentStatus}
		onStatusChange={handleStatusChange}
	/>

	<!-- タスク一覧 -->
	<TaskList 
		tasks={filteredTasks} 
		onTaskClick={viewTask} 
	/>

	<!-- ページネーション -->
	<TaskPagination 
		currentPage={data.pagination?.page || 1}
		totalPages={data.pagination?.totalPages || 1}
		onPageChange={handlePageChange}
	/>
</div>