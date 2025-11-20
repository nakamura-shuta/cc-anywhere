<script lang="ts">
	import type { ChatMessage } from '$lib/api/chat';
	import { parseMessageContent } from '$lib/utils/message-parser';

	interface Props {
		message: ChatMessage;
	}

	let { message }: Props = $props();

	const isUser = $derived(message.role === 'user');
	const contentParts = $derived(parseMessageContent(message.content));
</script>

<div class="flex {isUser ? 'justify-end' : 'justify-start'}">
	<div
		class="max-w-[80%] rounded-lg px-4 py-2 {isUser
			? 'bg-primary text-primary-foreground'
			: 'bg-muted'}"
	>
		<div class="whitespace-pre-wrap break-words text-sm">
			{#each contentParts as part}
				{#if part.type === 'image'}
					<img
						src={part.content}
						alt={part.alt || 'Image'}
						class="my-2 max-w-full rounded-md"
						loading="lazy"
					/>
				{:else}
					{part.content}
				{/if}
			{/each}
		</div>
		<div class="mt-1 text-xs opacity-70">
			{new Date(message.createdAt).toLocaleTimeString()}
		</div>
	</div>
</div>
