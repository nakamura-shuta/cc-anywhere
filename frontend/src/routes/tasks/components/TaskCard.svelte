<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import { RefreshCw, Clock, FolderOpen } from 'lucide-svelte';
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

<Card.Root 
	class="cursor-pointer hover:bg-muted/50 transition-colors min-h-[100px] touch-manipulation"
	onclick={() => onClick(task.taskId)}
>
	<Card.Content class="p-4">
		<div class="space-y-3">
			<!-- ステータスとリポジトリ -->
			<div class="flex items-center justify-between flex-wrap gap-2">
				<Badge variant={getStatusVariant(task.status)} class="text-xs">
					{task.status}
				</Badge>
				<div class="flex items-center gap-1 text-xs text-muted-foreground">
					<FolderOpen class="h-3 w-3" />
					<span>{getRepositoryName(task.context?.workingDirectory || task.workingDirectory)}</span>
				</div>
			</div>
			
			<!-- 指示内容 -->
			<div class="space-y-1">
				<p class="text-sm line-clamp-2">{task.instruction}</p>
				{#if task.continuedFrom || task.parentTaskId}
					<div class="flex items-center gap-1 text-xs text-muted-foreground">
						<RefreshCw class="h-3 w-3" />
						<span>継続タスク</span>
					</div>
				{/if}
			</div>
			
			<!-- 作成日時 -->
			<div class="flex items-center gap-1 text-xs text-muted-foreground">
				<Clock class="h-3 w-3" />
				<span>{formatDate(task.createdAt, 'relative')}</span>
			</div>
		</div>
	</Card.Content>
</Card.Root>