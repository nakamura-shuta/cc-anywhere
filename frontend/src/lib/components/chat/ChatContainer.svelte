<script lang="ts">
	import type { ChatSession, ChatMessage } from '$lib/api/chat';
	import MessageList from './MessageList.svelte';
	import ChatInput from './ChatInput.svelte';
	import * as Card from '$lib/components/ui/card';

	interface Props {
		session: ChatSession;
		messages: ChatMessage[];
		isLoading?: boolean;
		onSendMessage: (content: string) => void;
	}

	let { session, messages, isLoading = false, onSendMessage }: Props = $props();
</script>

<Card.Root class="flex h-full flex-col">
	<Card.Header class="border-b pb-2">
		<Card.Title class="text-lg">
			Chat Session
		</Card.Title>
		<Card.Description>
			{session.characterId} | {session.executor}
		</Card.Description>
	</Card.Header>

	<Card.Content class="flex-1 overflow-hidden p-0">
		<MessageList {messages} {isLoading} />
	</Card.Content>

	<div class="border-t p-4">
		<ChatInput
			onSend={onSendMessage}
			disabled={isLoading}
			placeholder="Type a message..."
		/>
	</div>
</Card.Root>
