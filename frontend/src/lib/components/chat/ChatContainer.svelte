<script lang="ts">
	import type { ChatSession, ChatMessage, Character, SDKSessionInfo } from '$lib/api/chat';
	import MessageList from './MessageList.svelte';
	import ChatInput from './ChatInput.svelte';
	import * as Card from '$lib/components/ui/card';

	interface Props {
		session: ChatSession;
		messages: ChatMessage[];
		character?: Character;
		isLoading?: boolean;
		sessionState?: 'idle' | 'running' | 'requires_action' | null;
		sdkSessionInfo?: SDKSessionInfo | null;
		lastChatMode?: 'resume' | 'new_session' | null;
		onSendMessage: (content: string) => void;
		onFork?: () => void;
	}

	let {
		session,
		messages,
		character,
		isLoading = false,
		sessionState = null,
		sdkSessionInfo = null,
		lastChatMode = null,
		onSendMessage,
		onFork,
	}: Props = $props();

	const stateColors: Record<string, string> = {
		idle: 'bg-green-500',
		running: 'bg-yellow-500 animate-pulse',
		requires_action: 'bg-red-500 animate-pulse',
	};

	const stateLabels: Record<string, string> = {
		idle: 'Idle',
		running: 'Running',
		requires_action: 'Action Required',
	};
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
				<div class="flex items-center gap-2">
					<Card.Title class="truncate text-base sm:text-lg">
						{character?.name || 'Chat Session'}
					</Card.Title>
					{#if sessionState}
						<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white {stateColors[sessionState]}">
							{stateLabels[sessionState]}
						</span>
					{/if}
					{#if lastChatMode}
						<span class="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
							{lastChatMode === 'resume' ? 'Resumed' : 'New'}
						</span>
					{/if}
				</div>
				<div class="flex items-center gap-2 text-xs text-muted-foreground">
					<span>{session.executor}</span>
					{#if sdkSessionInfo?.cwd}
						<span class="truncate max-w-[200px]" title={sdkSessionInfo.cwd}>
							{sdkSessionInfo.cwd}
						</span>
					{/if}
					{#if sdkSessionInfo?.gitBranch}
						<span class="rounded bg-muted px-1">{sdkSessionInfo.gitBranch}</span>
					{/if}
				</div>
			</div>
			{#if session.sdkSessionId && onFork}
				<button
					class="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
					onclick={() => onFork?.()}
					title="Fork this session"
				>
					Fork
				</button>
			{/if}
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
