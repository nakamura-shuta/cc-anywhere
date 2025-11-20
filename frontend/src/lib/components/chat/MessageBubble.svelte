<script lang="ts">
	import type { ChatMessage } from '$lib/api/chat';
	import { parseMessageContent } from '$lib/utils/message-parser';

	interface Props {
		message: ChatMessage;
		characterAvatar?: string;
	}

	let { message, characterAvatar }: Props = $props();

	const isUser = $derived(message.role === 'user');
	const contentParts = $derived(parseMessageContent(message.content));
</script>

<div class="flex {isUser ? 'justify-end' : 'justify-start'} gap-1.5 sm:gap-2">
	{#if !isUser && characterAvatar}
		<img
			src={characterAvatar}
			alt="AI"
			class="h-6 w-6 flex-shrink-0 rounded-full object-cover sm:h-8 sm:w-8"
		/>
	{/if}
	<div
		class="max-w-[85%] rounded-lg px-3 py-2 sm:max-w-[80%] sm:px-4 {isUser
			? 'bg-primary text-primary-foreground'
			: 'bg-muted'}"
	>
		<div class="whitespace-pre-wrap break-words text-xs sm:text-sm">
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
		<div class="mt-1 text-[10px] opacity-70 sm:text-xs">
			{new Date(message.createdAt).toLocaleTimeString()}
		</div>
	</div>
</div>
