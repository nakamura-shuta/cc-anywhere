<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Plus } from 'lucide-svelte';
	import type { PageData } from './$types';
	import { toast } from 'svelte-sonner';
	import ScheduleFormDialog from '$lib/components/scheduler/ScheduleFormDialog.svelte';
	import ScheduleList from './components/ScheduleList.svelte';
	import ScheduleFilter from './components/ScheduleFilter.svelte';
	import SchedulePagination from './components/SchedulePagination.svelte';
	import { scheduleListStore } from './stores/schedule-list-migrated.svelte';
	
	let { data }: { data: PageData } = $props();
	let isCreateDialogOpen = $state(false);
	let selectedStatus = $state(data.status || 'all');
	
	// ストアの初期化
	$effect(() => {
		scheduleListStore.initialize(data.schedules);
	});
	
	// スケジュールの有効/無効を切り替え
	async function handleToggleSchedule(id: string, currentStatus: string) {
		const success = await scheduleListStore.toggleSchedule(id, currentStatus);
		if (success) {
			const newStatus = currentStatus === 'active' ? false : true;
			toast.success(`スケジュールを${newStatus ? '有効' : '無効'}にしました`);
		} else {
			toast.error(scheduleListStore.error || 'スケジュールの更新に失敗しました');
		}
	}
	
	// スケジュールを削除
	async function handleDeleteSchedule(id: string, name: string) {
		if (!confirm(`「${name}」を削除してもよろしいですか？`)) {
			return;
		}
		
		const success = await scheduleListStore.deleteSchedule(id);
		if (success) {
			toast.success('スケジュールを削除しました');
		} else {
			toast.error(scheduleListStore.error || 'スケジュールの削除に失敗しました');
		}
	}
	
	// スケジュールが作成されたときの処理
	function handleScheduleCreated(event: CustomEvent<any>) {
		// 新しいスケジュールをストアに追加
		scheduleListStore.schedules = [...scheduleListStore.schedules, event.detail];
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
	function handlePageChange(pageNum: number) {
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
		<ScheduleFilter {selectedStatus} onStatusChange={handleStatusChange} />
	</div>
	
	<!-- スケジュール一覧 -->
	<ScheduleList 
		schedules={scheduleListStore.schedules}
		onToggle={handleToggleSchedule}
		onDelete={handleDeleteSchedule}
		onCreateClick={() => isCreateDialogOpen = true}
	/>
	
	<!-- ページネーション -->
	<SchedulePagination 
		currentPage={data.currentPage}
		totalPages={data.totalPages}
		onPageChange={handlePageChange}
	/>
</div>

<!-- スケジュール作成ダイアログ -->
<ScheduleFormDialog 
	bind:open={isCreateDialogOpen} 
	on:create={handleScheduleCreated}
/>