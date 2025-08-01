<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Select from '$lib/components/ui/select';
	import { repositoryService } from '$lib/services/repository.service';
	import { onMount } from 'svelte';
	
	// Props
	let { currentStatus, onStatusChange, currentRepository = '', onRepositoryChange }: {
		currentStatus: string;
		onStatusChange: (status: string) => void;
		currentRepository?: string;
		onRepositoryChange?: (repository: string) => void;
	} = $props();
	
	// リポジトリ一覧
	let repositories = $state<string[]>([]);
	
	// リポジトリ一覧を取得
	onMount(async () => {
		try {
			const repoList = await repositoryService.list();
			repositories = repoList.map(repo => repo.name);
		} catch (error) {
			console.error('Failed to load repositories:', error);
		}
	});
	
	// フィルターオプション
	const filters = [
		{ value: 'all', label: 'すべて', variant: 'outline' as const },
		{ value: 'running', label: '実行中', variant: 'secondary' as const },
		{ value: 'completed', label: '完了', variant: 'default' as const },
		{ value: 'failed', label: '失敗', variant: 'destructive' as const },
		{ value: 'cancelled', label: 'キャンセル', variant: 'outline' as const }
	];
</script>

<div class="space-y-4">
	<!-- ステータスフィルター -->
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
	
	<!-- リポジトリフィルター -->
	{#if repositories.length > 0 && onRepositoryChange}
		<div class="flex items-center gap-2">
			<span class="text-sm text-muted-foreground">リポジトリ:</span>
			<Select.Root type="single" bind:value={currentRepository} onValueChange={(value: string) => onRepositoryChange(value === 'all' ? '' : value)}>
				<Select.Trigger class="w-48">
					<span data-slot="select-value">{currentRepository || "すべてのリポジトリ"}</span>
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="all">すべてのリポジトリ</Select.Item>
					{#each repositories as repo}
						<Select.Item value={repo}>{repo}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	{/if}
</div>