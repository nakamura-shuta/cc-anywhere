<script lang="ts">
	import type { PageData } from './$types';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { goto } from '$app/navigation';
	import { format } from 'date-fns';
	import { ja } from 'date-fns/locale';
	import { Plus, RefreshCw, Eye, XCircle } from 'lucide-svelte';
	
	// load関数から受け取るデータ
	let { data }: { data: PageData } = $props();
	
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
	function formatDate(date: string | undefined) {
		if (!date) return '-';
		return format(new Date(date), 'yyyy/MM/dd HH:mm', { locale: ja });
	}
	
	// タスクの詳細表示
	function viewTask(taskId: string) {
		// 一時的な回避策：window.location.hrefを使用
		window.location.href = `/tasks/${taskId}`;
	}
	
	// タスクのキャンセル
	async function cancelTask(taskId: string) {
		if (!confirm('このタスクをキャンセルしますか？')) return;
		
		try {
			const response = await fetch(`http://localhost:5000/api/tasks/${taskId}`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json'
				}
			});
			
			if (response.ok) {
				// ページをリロード
				window.location.reload();
			}
		} catch (error) {
			console.error('Failed to cancel task:', error);
		}
	}
	
	// リフレッシュ
	function refresh() {
		window.location.reload();
	}
	
	// 新しいタスク画面へ
	function goToNewTask() {
		// 一時的な回避策：window.location.hrefを使用
		window.location.href = '/api';
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
			<Button variant="outline" onclick={refresh}>
				<RefreshCw class="mr-2 h-4 w-4" />
				更新
			</Button>
			<Button onclick={goToNewTask}>
				<Plus class="mr-2 h-4 w-4" />
				新しいタスク
			</Button>
		</div>
	</div>

	<!-- タスク一覧 -->
	<Card.Root>
		<Card.Header>
			<Card.Title>実行中のタスク</Card.Title>
			<Card.Description>
				{data.pagination?.total || 0} 件のタスク（{data.pagination?.page || 1}/{data.pagination?.totalPages || 1} ページ）
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>ステータス</Table.Head>
						<Table.Head>指示内容</Table.Head>
						<Table.Head>作成日時</Table.Head>
						<Table.Head>更新日時</Table.Head>
						<Table.Head class="text-right">操作</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if data.tasks && data.tasks.length > 0}
						{#each data.tasks as task}
							<Table.Row>
								<Table.Cell>
									<Badge variant={getStatusVariant(task.status)}>
										{task.status}
									</Badge>
								</Table.Cell>
								<Table.Cell class="max-w-md truncate">
									{task.instruction}
								</Table.Cell>
								<Table.Cell>
									{formatDate(task.createdAt)}
								</Table.Cell>
								<Table.Cell>
									{formatDate(task.completedAt || task.startedAt || task.createdAt)}
								</Table.Cell>
								<Table.Cell class="text-right">
									<div class="flex gap-2 justify-end">
										<Button 
											variant="ghost" 
											size="sm"
											onclick={() => viewTask(task.taskId)}
										>
											<Eye class="h-4 w-4" />
										</Button>
										{#if task.status === 'running' || task.status === 'pending'}
											<Button 
												variant="ghost" 
												size="sm"
												onclick={() => cancelTask(task.taskId)}
											>
												<XCircle class="h-4 w-4" />
											</Button>
										{/if}
									</div>
								</Table.Cell>
							</Table.Row>
						{/each}
					{:else}
						<Table.Row>
							<Table.Cell colspan={5} class="text-center text-muted-foreground">
								タスクがありません
							</Table.Cell>
						</Table.Row>
					{/if}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>

	<!-- ページネーション -->
	{#if data.pagination && data.pagination.totalPages > 1}
		<div class="flex justify-center gap-2">
			<Button 
				variant="outline" 
				disabled={data.pagination.page <= 1}
				onclick={() => window.location.href = `/tasks?page=${data.pagination.page - 1}`}
			>
				前へ
			</Button>
			<div class="flex items-center px-4">
				ページ {data.pagination.page} / {data.pagination.totalPages}
			</div>
			<Button 
				variant="outline" 
				disabled={data.pagination.page >= data.pagination.totalPages}
				onclick={() => window.location.href = `/tasks?page=${data.pagination.page + 1}`}
			>
				次へ
			</Button>
		</div>
	{/if}
</div>