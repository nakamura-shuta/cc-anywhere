<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { ChatMessage } from '$lib/api/chat';
	import MessageBubble from './MessageBubble.svelte';

	interface Props {
		messages: ChatMessage[];
		isLoading?: boolean;
	}

	let { messages, isLoading = false }: Props = $props();
	let scrollContainer: HTMLDivElement;

	// Auto-scroll to bottom when new messages arrive
	$effect(() => {
		if (messages.length > 0) {
			tick().then(() => {
				if (scrollContainer) {
					scrollContainer.scrollTop = scrollContainer.scrollHeight;
				}
			});
		}
	});
</script>

<div
	bind:this={scrollContainer}
	class="h-full overflow-y-auto p-4 space-y-4"
>
	{#if messages.length === 0}
		<div class="flex h-full items-center justify-center">
			<p class="text-muted-foreground">No messages yet. Start a conversation!</p>
		</div>
	{:else}
		{#each messages as message (message.id)}
			<MessageBubble {message} />
		{/each}
	{/if}

	{#if isLoading}
		<div class="flex items-center gap-2 text-muted-foreground">
			<div class="animate-pulse">Thinking...</div>
		</div>
	{/if}
</div>
