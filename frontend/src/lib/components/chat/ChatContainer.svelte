<script lang="ts">
	import type { ChatSession, ChatMessage, Character } from '$lib/api/chat';
	import MessageList from './MessageList.svelte';
	import ChatInput from './ChatInput.svelte';
	import * as Card from '$lib/components/ui/card';

	interface Props {
		session: ChatSession;
		messages: ChatMessage[];
		character?: Character;
		isLoading?: boolean;
		onSendMessage: (content: string) => void;
	}

	let { session, messages, character, isLoading = false, onSendMessage }: Props = $props();
</script>

<Card.Root class="flex min-h-0 flex-1 flex-col">
	<Card.Header class="flex-shrink-0 border-b pb-2">
		<div class="flex items-center gap-3">
			{#if character?.avatar}
				<img
					src={character.avatar}
					alt={character.name}
					class="h-8 w-8 rounded-full object-cover"
				/>
			{/if}
			<div class="min-w-0 flex-1">
				<Card.Title class="truncate text-base sm:text-lg">
					{character?.name || 'Chat Session'}
				</Card.Title>
				<Card.Description class="text-xs sm:text-sm">
					{session.executor}
				</Card.Description>
			</div>
		</div>
	</Card.Header>

	<Card.Content class="min-h-0 flex-1 overflow-hidden p-0">
		<MessageList {messages} {isLoading} characterAvatar={character?.avatar} />
	</Card.Content>

	<div class="flex-shrink-0 border-t p-2 sm:p-4">
		<ChatInput
			onSend={onSendMessage}
			disabled={isLoading}
			placeholder="Type a message..."
		/>
	</div>
</Card.Root>
