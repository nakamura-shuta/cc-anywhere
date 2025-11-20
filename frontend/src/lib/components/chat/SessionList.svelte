<script lang="ts">
	import type { ChatSession } from '$lib/api/chat';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		sessions: ChatSession[];
		currentSessionId?: string;
		onSelect: (sessionId: string) => void;
		onDelete: (sessionId: string) => void;
	}

	let { sessions, currentSessionId, onSelect, onDelete }: Props = $props();

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('ja-JP', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="space-y-2">
	{#if sessions.length === 0}
		<p class="text-muted-foreground py-4 text-center text-sm">
			No sessions yet
		</p>
	{:else}
		{#each sessions as session (session.id)}
			<div
				class="group flex items-center justify-between rounded-lg p-2 transition-colors
					{currentSessionId === session.id
						? 'bg-primary/10'
						: 'hover:bg-muted'}"
			>
				<button
					class="flex-1 text-left"
					onclick={() => onSelect(session.id)}
				>
					<div class="text-sm font-medium">{session.characterId}</div>
					<div class="text-muted-foreground text-xs">
						{formatDate(session.updatedAt)}
					</div>
				</button>
				<Button
					variant="ghost"
					size="sm"
					class="opacity-0 group-hover:opacity-100"
					onclick={(e: Event) => {
						e.stopPropagation();
						onDelete(session.id);
					}}
				>
					Delete
				</Button>
			</div>
		{/each}
	{/if}
</div>
