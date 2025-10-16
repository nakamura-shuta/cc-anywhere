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

	// Executorラベルを取得
	function getExecutorLabel(executor: string | undefined): string {
		if (!executor) return 'Claude'; // デフォルトはClaude
		return executor === 'claude' ? 'Claude' : executor === 'codex' ? 'Codex' : executor;
	}

	// Executorアイコンパスを取得
	function getExecutorIcon(executor: string | undefined): string {
		const type = executor || 'claude';
		return type === 'claude' ? '/claude.png' : type === 'codex' ? '/codex.png' : '/claude.png';
	}

	// Executor色を取得
	function getExecutorColor(executor: string | undefined): string {
		const type = executor || 'claude';
		return type === 'claude' ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-400'
		     : type === 'codex' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400'
		     : 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-950 dark:border-gray-800 dark:text-gray-400';
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
			<div class="flex items-center gap-2">
				{#if task.continuedFrom || task.parentTaskId}
					<div class="flex items-center gap-1 text-xs text-muted-foreground">
						<RefreshCw class="h-3 w-3" />
						<span>継続タスク</span>
					</div>
				{/if}
				<div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium {getExecutorColor(task.executor || task.options?.executor)}">
					<img
						src={getExecutorIcon(task.executor || task.options?.executor)}
						alt={getExecutorLabel(task.executor || task.options?.executor)}
						class="w-3.5 h-3.5"
					/>
					<span>{getExecutorLabel(task.executor || task.options?.executor)}</span>
				</div>
			</div>
		</div>
	</Table.Cell>
	<Table.Cell>
		{formatDate(task.createdAt, 'full')}
	</Table.Cell>
</Table.Row>