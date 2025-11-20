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
			<div class="flex items-center gap-1">
				<span class="animate-[pulse_1.2s_ease-in-out_infinite]">Typing</span>
				<span class="inline-flex gap-1">
					<span class="w-1 h-1 rounded-full bg-muted-foreground animate-bounce"></span>
					<span class="w-1 h-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.15s]"></span>
					<span class="w-1 h-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.3s]"></span>
				</span>
			</div>
		</div>
	{/if}
</div>
