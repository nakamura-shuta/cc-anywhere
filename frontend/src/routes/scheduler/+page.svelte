<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Plus, Calendar, Clock } from 'lucide-svelte';
	import type { PageData } from './$types';
	import { scheduleService } from '$lib/services/schedule.service';
	import { toast } from 'svelte-sonner';
	import ScheduleFormDialog from '$lib/components/scheduler/ScheduleFormDialog.svelte';
	import { formatDate } from '$lib/utils/date';
	
	let { data }: { data: PageData } = $props();
	let schedules = $state(data.schedules);
	let isCreateDialogOpen = $state(false);
	let selectedStatus = $state(data.status || 'all');
	
	// ステータスに応じたバッジの色を取得
	function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
		switch (status) {
			case 'active':
				return 'default';
			case 'inactive':
				return 'secondary';
			case 'completed':
				return 'outline';
			case 'failed':
				return 'destructive';
			default:
				return 'secondary';
		}
	}
	
	// ステータスの表示名を取得
	function getStatusLabel(status: string): string {
		switch (status) {
			case 'active':
				return '有効';
			case 'inactive':
				return '無効';
			case 'completed':
				return '完了';
			case 'failed':
				return '失敗';
			default:
				return status;
		}
	}
	
	// Cron式から頻度の説明を生成
	function getCronDescription(schedule: any): string {
		if (schedule.type === 'once') {
			return '1回のみ';
		}
		
		const expr = schedule.expression;
		if (!expr) return '-';
		
		// 簡単なCron式の解釈
		if (expr === '0 * * * *') return '毎時';
		if (expr === '0 0 * * *') return '毎日';
		if (expr === '0 0 * * 0') return '毎週';
		if (expr === '0 0 1 * *') return '毎月';
		
		return expr;
	}
	
	// スケジュールの有効/無効を切り替え
	async function toggleSchedule(id: string, currentStatus: string) {
		try {
			const newStatus = currentStatus === 'active' ? false : true;
			const updated = await scheduleService.toggle(id, newStatus);
			
			// ローカルの状態を更新
			schedules = schedules.map(s => 
				s.id === id ? { ...s, status: updated.status } : s
			);
			
			toast.success(`スケジュールを${newStatus ? '有効' : '無効'}にしました`);
		} catch (err) {
			console.error('Failed to toggle schedule:', err);
			toast.error('スケジュールの更新に失敗しました');
		}
	}
	
	// スケジュールを削除
	async function deleteSchedule(id: string, name: string) {
		if (!confirm(`「${name}」を削除してもよろしいですか？`)) {
			return;
		}
		
		try {
			await scheduleService.delete(id);
			
			// ローカルの状態から削除
			schedules = schedules.filter(s => s.id !== id);
			
			toast.success('スケジュールを削除しました');
		} catch (err) {
			console.error('Failed to delete schedule:', err);
			toast.error('スケジュールの削除に失敗しました');
		}
	}
	
	// スケジュールが作成されたときの処理
	function handleScheduleCreated(event: CustomEvent<any>) {
		schedules = [event.detail, ...schedules];
		isCreateDialogOpen = false;
		toast.success('スケジュールを作成しました');
	}
	
	// ステータスフィルターの変更
	function handleStatusChange(value: string | undefined) {
		if (!value) return;
		selectedStatus = value;
		const params = new URLSearchParams($page.url.searchParams);
		if (value === 'all') {
			params.delete('status');
		} else {
			params.set('status', value);
		}
		params.set('page', '1'); // ページをリセット
		goto(`?${params.toString()}`);
	}
	
	// ページネーション
	function goToPage(pageNum: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', pageNum.toString());
		goto(`?${params.toString()}`);
	}
</script>

<div class="container mx-auto py-8">
	<div class="mb-8">
		<div class="flex items-center justify-between mb-4">
			<div>
				<h1 class="text-3xl font-bold">スケジューラー</h1>
				<p class="text-muted-foreground mt-1">定期実行タスクの管理</p>
			</div>
			<Button onclick={() => isCreateDialogOpen = true}>
				<Plus class="mr-2 h-4 w-4" />
				新規作成
			</Button>
		</div>
		
		<!-- フィルター -->
		<div class="flex gap-4">
			<select
				value={selectedStatus}
				onchange={(e) => handleStatusChange(e.currentTarget.value)}
				class="flex h-9 w-[180px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
			>
				<option value="all">すべて</option>
				<option value="active">有効</option>
				<option value="inactive">無効</option>
				<option value="completed">完了</option>
				<option value="failed">失敗</option>
			</select>
		</div>
	</div>
	
	<!-- スケジュール一覧 -->
	<div class="space-y-4">
		{#if schedules.length === 0}
			<Card.Root>
				<Card.Content class="py-12 text-center">
					<Calendar class="mx-auto h-12 w-12 text-muted-foreground mb-4" />
					<p class="text-muted-foreground">スケジュールがありません</p>
					<Button variant="outline" class="mt-4" onclick={() => isCreateDialogOpen = true}>
						<Plus class="mr-2 h-4 w-4" />
						最初のスケジュールを作成
					</Button>
				</Card.Content>
			</Card.Root>
		{:else}
			{#each schedules as schedule}
				<Card.Root>
					<Card.Content class="p-6">
						<div class="flex items-center justify-between">
							<div class="flex-1">
								<div class="flex items-center gap-3 mb-2">
									<h3 class="text-lg font-semibold">{schedule.name}</h3>
									<Badge variant={getStatusBadgeVariant(schedule.status)}>
										{getStatusLabel(schedule.status)}
									</Badge>
								</div>
								{#if schedule.description}
									<p class="text-sm text-muted-foreground mb-3">{schedule.description}</p>
								{/if}
								<div class="flex items-center gap-6 text-sm text-muted-foreground">
									<div class="flex items-center gap-1">
										<Clock class="h-4 w-4" />
										<span>頻度: {getCronDescription(schedule.schedule)}</span>
									</div>
									{#if schedule.metadata.nextExecuteAt}
										<div>
											次回実行: {formatDate(schedule.metadata.nextExecuteAt)}
										</div>
									{/if}
									{#if schedule.metadata.lastExecutedAt}
										<div>
											最終実行: {formatDate(schedule.metadata.lastExecutedAt)}
										</div>
									{/if}
								</div>
							</div>
							
							<div class="flex gap-2">
								{#if schedule.status === 'active' || schedule.status === 'inactive'}
									<Button
										variant="outline"
										size="sm"
										onclick={() => toggleSchedule(schedule.id, schedule.status)}
									>
										{schedule.status === 'active' ? '無効にする' : '有効にする'}
									</Button>
								{/if}
								<Button
									variant="outline"
									size="sm"
									class="text-destructive"
									onclick={() => deleteSchedule(schedule.id, schedule.name)}
								>
									削除
								</Button>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		{/if}
	</div>
	
	<!-- ページネーション -->
	{#if data.totalPages > 1}
		<div class="mt-8 flex justify-center gap-2">
			<Button 
				variant="outline" 
				size="sm"
				disabled={data.currentPage === 1}
				onclick={() => goToPage(data.currentPage - 1)}
			>
				前へ
			</Button>
			
			{#each Array(data.totalPages) as _, i}
				{#if i + 1 === 1 || i + 1 === data.totalPages || (i + 1 >= data.currentPage - 2 && i + 1 <= data.currentPage + 2)}
					<Button
						variant={i + 1 === data.currentPage ? "default" : "outline"}
						size="sm"
						onclick={() => goToPage(i + 1)}
					>
						{i + 1}
					</Button>
				{:else if i + 1 === data.currentPage - 3 || i + 1 === data.currentPage + 3}
					<span class="px-2">...</span>
				{/if}
			{/each}
			
			<Button 
				variant="outline" 
				size="sm"
				disabled={data.currentPage === data.totalPages}
				onclick={() => goToPage(data.currentPage + 1)}
			>
				次へ
			</Button>
		</div>
	{/if}
</div>

<!-- スケジュール作成ダイアログ -->
<ScheduleFormDialog 
	bind:open={isCreateDialogOpen} 
	on:create={handleScheduleCreated}
/>