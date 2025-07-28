<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import { RefreshCw } from 'lucide-svelte';
	import type { TaskResponse } from '$lib/types/api';
	import { formatDate } from '$lib/utils/date';
	import { getStatusVariant } from '$lib/utils/task';
	
	interface Props {
		task: TaskResponse;
		onClick: (taskId: string) => void;
	}
	
	let { task, onClick }: Props = $props();
	
	// 作業ディレクトリパスからリポジトリ名を取得
	function getRepositoryName(path: string | undefined): string {
		if (!path) return '-';
		const parts = path.split('/');
		return parts[parts.length - 1] || '-';
	}
</script>

<Table.Row 
	class="cursor-pointer hover:bg-muted/50 transition-colors"
	onclick={() => onClick(task.taskId)}
>
	<Table.Cell>
		<Badge variant={getStatusVariant(task.status)}>
			{task.status}
		</Badge>
	</Table.Cell>
	<Table.Cell class="text-sm">
		{getRepositoryName(task.context?.workingDirectory || task.workingDirectory)}
	</Table.Cell>
	<Table.Cell class="max-w-md">
		<div class="space-y-1">
			<p class="truncate">{task.instruction}</p>
			{#if task.continuedFrom || task.parentTaskId}
				<div class="flex items-center gap-1 text-xs text-muted-foreground">
					<RefreshCw class="h-3 w-3" />
					<span>継続タスク</span>
				</div>
			{/if}
		</div>
	</Table.Cell>
	<Table.Cell>
		{formatDate(task.createdAt, 'full')}
	</Table.Cell>
</Table.Row>