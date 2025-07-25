<script lang="ts">
	import type { PageData } from './$types';
	import { Button } from '$lib/components/ui/button';
	import { Plus, GitBranch } from 'lucide-svelte';
	import { onMount, onDestroy } from 'svelte';
	import TaskList from './components/TaskList.svelte';
	import TaskPagination from './components/TaskPagination.svelte';
	import { taskListStore } from './stores/task-list.svelte';
	
	// load関数から受け取るデータ
	let { data }: { data: PageData } = $props();
	
	// WebSocketコンテキストの取得とストアの初期化
	import { getWebSocketContext } from '$lib/websocket/websocket.svelte';
	
	// ストアの初期化
	$effect(() => {
		// コンポーネント内でWebSocketコンテキストを取得
		const ws = getWebSocketContext();
		taskListStore.initialize(data.tasks || [], ws);
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
		window.location.href = `/tasks?page=${page}`;
	}
</script>

<!-- タスク一覧ページ -->
<div class="space-y-6">
	<!-- ページヘッダー -->
	<div class="flex justify-between items-center">
		<div>
			<h2 class="text-3xl font-bold tracking-tight">タスク一覧</h2>
			<p class="text-muted-foreground">実行中のタスクを管理</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" onclick={() => window.location.href = '/tasks/tree'}>
				<GitBranch class="mr-2 h-4 w-4" />
				ツリー表示
			</Button>
			<Button onclick={goToNewTask}>
				<Plus class="mr-2 h-4 w-4" />
				新しいタスク
			</Button>
		</div>
	</div>

	<!-- タスク一覧 -->
	<TaskList 
		tasks={taskListStore.tasks} 
		onTaskClick={viewTask} 
	/>

	<!-- ページネーション -->
	<TaskPagination 
		currentPage={data.pagination?.page || 1}
		totalPages={data.pagination?.totalPages || 1}
		onPageChange={handlePageChange}
	/>
</div>