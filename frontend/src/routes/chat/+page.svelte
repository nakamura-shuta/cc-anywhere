<script lang="ts">
	import { onMount } from 'svelte';
	import { chatStore } from '$lib/stores/chat.svelte';
	import ChatContainer from '$lib/components/chat/ChatContainer.svelte';
	import SessionList from '$lib/components/chat/SessionList.svelte';
	import CharacterSelector from '$lib/components/chat/CharacterSelector.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';

	let showNewSession = $state(false);

	onMount(async () => {
		await Promise.all([
			chatStore.loadSessions(),
			chatStore.loadCharacters()
		]);
	});

	async function handleCreateSession(characterId: string) {
		await chatStore.createSession(characterId);
		showNewSession = false;
	}

	async function handleSelectSession(sessionId: string) {
		await chatStore.selectSession(sessionId);
	}

	async function handleDeleteSession(sessionId: string) {
		await chatStore.deleteSession(sessionId);
	}
</script>

<div class="container mx-auto h-full p-4">
	<div class="grid h-full grid-cols-1 gap-4 md:grid-cols-4">
		<!-- Sidebar -->
		<div class="md:col-span-1">
			<Card.Root class="h-full">
				<Card.Header class="pb-2">
					<Card.Title class="flex items-center justify-between">
						<span>Sessions</span>
						<Button size="sm" onclick={() => showNewSession = true}>
							New
						</Button>
					</Card.Title>
				</Card.Header>
				<Card.Content class="overflow-y-auto">
					<SessionList
						sessions={chatStore.sessions}
						currentSessionId={chatStore.currentSession?.id}
						onSelect={handleSelectSession}
						onDelete={handleDeleteSession}
					/>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Main Chat Area -->
		<div class="md:col-span-3">
			{#if showNewSession}
				<Card.Root class="h-full">
					<Card.Header>
						<Card.Title>New Chat Session</Card.Title>
						<Card.Description>Select a character to start chatting</Card.Description>
					</Card.Header>
					<Card.Content>
						<CharacterSelector
							characters={chatStore.allCharacters}
							onSelect={handleCreateSession}
							onCancel={() => showNewSession = false}
						/>
					</Card.Content>
				</Card.Root>
			{:else if chatStore.currentSession}
				<ChatContainer
					session={chatStore.currentSession}
					messages={chatStore.messages}
					isLoading={chatStore.isStreaming}
					onSendMessage={(content) => chatStore.sendMessage(content)}
				/>
			{:else}
				<Card.Root class="flex h-full items-center justify-center">
					<Card.Content class="text-center">
						<p class="text-muted-foreground mb-4">
							Select a session or create a new one to start chatting
						</p>
						<Button onclick={() => showNewSession = true}>
							New Session
						</Button>
					</Card.Content>
				</Card.Root>
			{/if}
		</div>
	</div>

	{#if chatStore.error}
		<div class="fixed bottom-4 right-4 rounded-lg bg-red-500 p-4 text-white shadow-lg">
			<p>{chatStore.error.message}</p>
			<button
				class="mt-2 text-sm underline"
				onclick={() => chatStore.clearError()}
			>
				Dismiss
			</button>
		</div>
	{/if}
</div>
