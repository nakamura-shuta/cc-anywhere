<script lang="ts">
	import type { ChatMessage } from '$lib/api/chat';

	interface Props {
		message: ChatMessage;
	}

	let { message }: Props = $props();

	const isUser = $derived(message.role === 'user');
</script>

<div class="flex {isUser ? 'justify-end' : 'justify-start'}">
	<div
		class="max-w-[80%] rounded-lg px-4 py-2 {isUser
			? 'bg-primary text-primary-foreground'
			: 'bg-muted'}"
	>
		<div class="whitespace-pre-wrap break-words text-sm">
			{message.content}
		</div>
		<div class="mt-1 text-xs opacity-70">
			{new Date(message.createdAt).toLocaleTimeString()}
		</div>
	</div>
</div>
