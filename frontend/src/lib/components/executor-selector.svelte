<script lang="ts">
	import * as Select from '$lib/components/ui/select';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import type { ExecutorType, ExecutorInfo } from '$lib/types/api';
	import { onMount } from 'svelte';

	interface Props {
		value?: ExecutorType;
		onchange?: (value: ExecutorType | undefined) => void;
		disabled?: boolean;
		showLabel?: boolean;
		apiKey?: string;
	}

	let {
		value = $bindable(),
		onchange,
		disabled = false,
		showLabel = true,
		apiKey
	}: Props = $props();

	let executors = $state<ExecutorInfo[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Fetch available executors from API
	onMount(async () => {
		try {
			const headers: Record<string, string> = {
				'Content-Type': 'application/json'
			};

			// Add API key if provided or available in localStorage
			const key = apiKey || (typeof window !== 'undefined' ? localStorage.getItem('cc-anywhere-api-key') : null);
			if (key) {
				headers['X-API-Key'] = key;
			}

			const response = await fetch('/api/executors', {
				headers
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch executors: ${response.statusText}`);
			}

			const data = await response.json();
			executors = data.executors || [];
		} catch (err) {
			console.error('Failed to load executors:', err);
			error = err instanceof Error ? err.message : 'Unknown error';
			// Fallback to default executors
			executors = [
				{ type: 'claude', available: true, description: 'Claude Agent SDK - Official Anthropic agent framework' },
				{ type: 'codex', available: false, description: 'OpenAI Codex SDK - AI coding assistant' }
			];
		} finally {
			loading = false;
		}
	});

	// Get label for selected executor
	const selectedLabel = $derived.by(() => {
		if (!value) return 'Executor を選択';
		const executor = executors.find(e => e.type === value);
		return executor ? getExecutorLabel(executor) : value;
	});

	function getExecutorLabel(executor: ExecutorInfo): string {
		const label = executor.type === 'claude' ? 'Claude' : executor.type === 'codex' ? 'Codex' : executor.type;
		return label;
	}

	function handleValueChange(newValue: string | undefined) {
		const executorType = newValue as ExecutorType | undefined;
		value = executorType;
		onchange?.(executorType);
	}
</script>

{#if showLabel}
	<Label for="executor-selector">Executor</Label>
{/if}

<Select.Root type="single" value={value} onValueChange={handleValueChange} disabled={disabled || loading}>
	<Select.Trigger id="executor-selector" class="w-full">
		{#if loading}
			<span class="text-muted-foreground">読み込み中...</span>
		{:else}
			{selectedLabel}
		{/if}
	</Select.Trigger>
	<Select.Content>
		{#if error}
			<div class="p-2 text-sm text-destructive">
				{error}
			</div>
		{/if}

		{#each executors as executor}
			<Select.Item
				value={executor.type}
				label={getExecutorLabel(executor)}
				disabled={!executor.available}
			>
				<div class="flex flex-col w-full">
					<div class="flex items-center justify-between">
						<span>{getExecutorLabel(executor)}</span>
						{#if !executor.available}
							<Badge variant="outline" class="ml-2 text-xs">利用不可</Badge>
						{/if}
					</div>
					<div class="text-xs text-muted-foreground mt-1">
						{executor.description}
					</div>
				</div>
			</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>

{#if !showLabel}
	<p class="text-xs text-muted-foreground mt-1">
		タスク実行に使用するAgent SDKを選択してください
	</p>
{/if}
