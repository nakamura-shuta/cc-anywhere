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

<div class="flex h-full flex-col p-2 sm:p-4">
	<!-- Mobile: Horizontal tabs for Sessions/Chat -->
	<div class="mb-2 flex gap-2 md:hidden">
		<Button
			variant={!showNewSession && !chatStore.currentSession ? 'default' : 'outline'}
			size="sm"
			class="flex-1"
			onclick={() => { showNewSession = false; chatStore.clearCurrentSession(); }}
		>
			Sessions
		</Button>
		<Button
			variant="outline"
			size="sm"
			onclick={() => showNewSession = true}
		>
			New
		</Button>
	</div>

	<div class="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:gap-4 md:grid-cols-4">
		<!-- Sidebar - hidden on mobile when in chat -->
		<div class="hidden md:col-span-1 md:flex md:flex-col {chatStore.currentSession || showNewSession ? '' : 'flex flex-col'}">
			<Card.Root class="flex min-h-0 flex-1 flex-col">
				<Card.Header class="flex-shrink-0 pb-2">
					<Card.Title class="flex items-center justify-between">
						<span>Sessions</span>
						<Button size="sm" onclick={() => showNewSession = true}>
							New
						</Button>
					</Card.Title>
				</Card.Header>
				<Card.Content class="min-h-0 flex-1 overflow-y-auto">
					<SessionList
						sessions={chatStore.sessions}
						currentSessionId={chatStore.currentSession?.id}
						onSelect={handleSelectSession}
						onDelete={handleDeleteSession}
					/>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Mobile Session List -->
		{#if !chatStore.currentSession && !showNewSession}
			<div class="flex flex-col md:hidden">
				<Card.Root class="flex min-h-0 flex-1 flex-col">
					<Card.Header class="flex-shrink-0 pb-2">
						<Card.Title>Sessions</Card.Title>
					</Card.Header>
					<Card.Content class="min-h-0 flex-1 overflow-y-auto">
						<SessionList
							sessions={chatStore.sessions}
							currentSessionId={undefined}
							onSelect={handleSelectSession}
							onDelete={handleDeleteSession}
						/>
					</Card.Content>
				</Card.Root>
			</div>
		{/if}

		<!-- Main Chat Area -->
		<div class="flex min-h-0 flex-col md:col-span-3 {!chatStore.currentSession && !showNewSession ? 'hidden md:flex' : ''}">
			{#if showNewSession}
				<Card.Root class="flex min-h-0 flex-1 flex-col">
					<Card.Header class="flex-shrink-0">
						<Card.Title>New Chat Session</Card.Title>
						<Card.Description>Select a character to start chatting</Card.Description>
					</Card.Header>
					<Card.Content class="min-h-0 flex-1 overflow-y-auto">
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
					character={chatStore.getCharacterById(chatStore.currentSession.characterId)}
					isLoading={chatStore.isStreaming}
					onSendMessage={(content) => chatStore.sendMessage(content)}
				/>
			{:else}
				<Card.Root class="flex min-h-0 flex-1 items-center justify-center">
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

{#if chatStore.lastChatMode}
	<div class="fixed bottom-4 left-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground shadow">
		Mode: {chatStore.lastChatMode === 'resume' ? 'Session Resume (sdkSessionId)' : 'History Fallback'}
	</div>
{/if}
</div>
