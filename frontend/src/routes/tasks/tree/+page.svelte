<script lang="ts">
	import type { PageData } from './$types';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';
	import { goto } from '$app/navigation';
	import { format } from 'date-fns';
	import { ja } from 'date-fns/locale';
	import { ArrowLeft, RefreshCw, GitBranch, List } from 'lucide-svelte';
	import TaskTree from '$lib/components/task-tree.svelte';
	
	// load関数から受け取るデータ
	let { data }: { data: PageData } = $props();
	
	// ルートタスク（親タスクを持たないタスク）を抽出
	let rootTasks = $derived(
		data.tasks.filter(task => !task.continuedFrom && !task.parentTaskId)
	);
	
	// リフレッシュ
	function refresh() {
		window.location.reload();
	}
	
	// リスト表示へ切り替え
	function switchToList() {
		window.location.href = '/tasks';
	}
</script>

<!-- タスクツリービューページ -->
<div class="space-y-6">
	<!-- ページヘッダー -->
	<div class="flex justify-between items-center">
		<div>
			<h2 class="text-3xl font-bold tracking-tight">タスクツリー</h2>
			<p class="text-muted-foreground">タスクの継続関係をツリー表示</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" onclick={switchToList}>
				<List class="mr-2 h-4 w-4" />
				リスト表示
			</Button>
			<Button variant="outline" onclick={refresh}>
				<RefreshCw class="mr-2 h-4 w-4" />
				更新
			</Button>
		</div>
	</div>

	<!-- タスクツリー -->
	<Card.Root>
		<Card.Header>
			<div class="flex items-center gap-2">
				<GitBranch class="h-5 w-5" />
				<Card.Title>タスク継続関係</Card.Title>
			</div>
			<Card.Description>
				{rootTasks.length} 件のルートタスク（全 {data.tasks.length} 件）
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if rootTasks.length > 0}
				<div class="space-y-4">
					{#each rootTasks as task}
						<TaskTree task={task} allTasks={data.tasks} />
					{/each}
				</div>
			{:else}
				<p class="text-center text-muted-foreground py-8">
					タスクがありません
				</p>
			{/if}
		</Card.Content>
	</Card.Root>
</div>