<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Calendar } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Plus } from 'lucide-svelte';
	import ScheduleItem from './ScheduleItem.svelte';
	import type { ScheduledTask } from '$lib/types/api';
	
	interface Props {
		schedules: ScheduledTask[];
		onToggle: (id: string, currentStatus: string) => void;
		onDelete: (id: string, name: string) => void;
		onCreateClick: () => void;
	}
	
	let { schedules, onToggle, onDelete, onCreateClick }: Props = $props();
</script>

<div class="space-y-4">
	{#if schedules.length === 0}
		<Card.Root>
			<Card.Content class="py-12 text-center">
				<Calendar class="mx-auto h-12 w-12 text-muted-foreground mb-4" />
				<p class="text-muted-foreground">スケジュールがありません</p>
				<Button variant="outline" class="mt-4" onclick={onCreateClick}>
					<Plus class="mr-2 h-4 w-4" />
					最初のスケジュールを作成
				</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		{#each schedules as schedule}
			<ScheduleItem 
				{schedule} 
				onToggle={() => onToggle(schedule.id, schedule.status)}
				onDelete={() => onDelete(schedule.id, schedule.name)}
			/>
		{/each}
	{/if}
</div>