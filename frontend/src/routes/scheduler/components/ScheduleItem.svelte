<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Clock } from 'lucide-svelte';
	import { formatDate } from '$lib/utils/date';
	import type { ScheduledTask } from '$lib/types/api';
	
	interface Props {
		schedule: ScheduledTask;
		onToggle: () => void;
		onDelete: () => void;
	}
	
	let { schedule, onToggle, onDelete }: Props = $props();
	
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
	function getCronDescription(schedule: ScheduledTask): string {
		if (schedule.schedule.type === 'once') {
			return '1回のみ';
		}
		
		const expr = schedule.schedule.expression;
		if (!expr) return '-';
		
		// 簡単なCron式の解釈
		if (expr === '0 * * * *') return '毎時';
		if (expr === '0 0 * * *') return '毎日';
		if (expr === '0 0 * * 0') return '毎週';
		if (expr === '0 0 1 * *') return '毎月';
		
		return expr;
	}
</script>

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
						<span>頻度: {getCronDescription(schedule)}</span>
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
						onclick={onToggle}
					>
						{schedule.status === 'active' ? '無効にする' : '有効にする'}
					</Button>
				{/if}
				<Button
					variant="outline"
					size="sm"
					class="text-destructive"
					onclick={onDelete}
				>
					削除
				</Button>
			</div>
		</div>
	</Card.Content>
</Card.Root>