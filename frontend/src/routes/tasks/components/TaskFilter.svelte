<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	
	// Props
	let { currentStatus, onStatusChange }: {
		currentStatus: string;
		onStatusChange: (status: string) => void;
	} = $props();
	
	// フィルターオプション
	const filters = [
		{ value: 'all', label: 'すべて', variant: 'outline' as const },
		{ value: 'running', label: '実行中', variant: 'secondary' as const },
		{ value: 'completed', label: '完了', variant: 'default' as const },
		{ value: 'failed', label: '失敗', variant: 'destructive' as const },
		{ value: 'cancelled', label: 'キャンセル', variant: 'outline' as const }
	];
</script>

<div class="flex gap-2 flex-wrap">
	{#each filters as filter}
		<Button
			variant={currentStatus === filter.value ? 'default' : 'outline'}
			size="sm"
			onclick={() => onStatusChange(filter.value)}
		>
			{filter.label}
		</Button>
	{/each}
</div>