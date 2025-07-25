<script lang="ts">
	import * as Select from '$lib/components/ui/select';
	
	interface Props {
		selectedStatus: string;
		onStatusChange: (value: string) => void;
	}
	
	let { selectedStatus, onStatusChange }: Props = $props();
	
	// ステータスの選択肢
	const statusOptions = [
		{ value: 'all', label: 'すべて' },
		{ value: 'active', label: '有効' },
		{ value: 'inactive', label: '無効' },
		{ value: 'completed', label: '完了' },
		{ value: 'failed', label: '失敗' }
	];
	
	// 選択されたステータスのラベルを取得
	let selectedStatusLabel = $derived(() => {
		const status = statusOptions.find(s => s.value === selectedStatus);
		return status ? status.label : 'すべて';
	});
	
	function handleValueChange(value: string | undefined) {
		if (value) {
			onStatusChange(value);
		}
	}
</script>

<div class="flex gap-4">
	<Select.Root type="single" bind:value={selectedStatus} onValueChange={handleValueChange}>
		<Select.Trigger class="w-[180px]">
			{selectedStatusLabel()}
		</Select.Trigger>
		<Select.Content>
			{#each statusOptions as option}
				<Select.Item value={option.value} label={option.label} />
			{/each}
		</Select.Content>
	</Select.Root>
</div>