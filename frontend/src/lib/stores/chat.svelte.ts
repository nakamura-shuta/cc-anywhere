/**
 * Chat store for managing chat sessions and messages
 */

import * as chatApi from '$lib/api/chat';
import type { ChatSession, ChatMessage, Character } from '$lib/api/chat';
import {
	sendMessageViaWebSocket,
	createTempUserMessage,
	createUserMessageFromServer,
	createAgentMessageFromServer
} from '$lib/utils/websocket-chat';

/**
 * Chat store class using Svelte 5 runes
 */
class ChatStore {
	// State
	sessions = $state<ChatSession[]>([]);
	currentSession = $state<ChatSession | null>(null);
	messages = $state<ChatMessage[]>([]);
	characters = $state<{ builtIn: Character[]; custom: Character[] }>({
		builtIn: [],
		custom: []
	});
	loading = $state(false);
	error = $state<Error | null>(null);
	isStreaming = $state(false);

	// Derived state
	allCharacters = $derived([...this.characters.builtIn, ...this.characters.custom]);

	// Session methods
	async loadSessions(page = 1, limit = 20): Promise<void> {
		try {
			this.loading = true;
			this.error = null;
			const response = await chatApi.getSessions(page, limit);
			this.sessions = response.items;
		} catch (err) {
			this.error = err instanceof Error ? err : new Error('Failed to load sessions');
		} finally {
			this.loading = false;
		}
	}

	async createSession(characterId: string, workingDirectory?: string, executor: 'claude' = 'claude'): Promise<ChatSession | null> {
		try {
			this.loading = true;
			this.error = null;
			const session = await chatApi.createSession({
				characterId,
				workingDirectory,
				executor
			});
			this.sessions = [session, ...this.sessions];
			this.currentSession = session;
			this.messages = [];
			return session;
		} catch (err) {
			this.error = err instanceof Error ? err : new Error('Failed to create session');
			return null;
		} finally {
			this.loading = false;
		}
	}

	async selectSession(sessionId: string): Promise<void> {
		try {
			this.loading = true;
			this.error = null;

			const session = await chatApi.getSession(sessionId);
			this.currentSession = session;

			const messagesResponse = await chatApi.getMessages(sessionId);
			this.messages = messagesResponse.messages;
		} catch (err) {
			this.error = err instanceof Error ? err : new Error('Failed to load session');
		} finally {
			this.loading = false;
		}
	}

	async deleteSession(sessionId: string): Promise<boolean> {
		try {
			this.loading = true;
			this.error = null;
			await chatApi.deleteSession(sessionId);
			this.sessions = this.sessions.filter(s => s.id !== sessionId);
			if (this.currentSession?.id === sessionId) {
				this.currentSession = null;
				this.messages = [];
			}
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err : new Error('Failed to delete session');
			return false;
		} finally {
			this.loading = false;
		}
	}

	// Message methods
	async sendMessage(content: string): Promise<boolean> {
		if (!this.currentSession) {
			this.error = new Error('No session selected');
			return false;
		}

		const sessionId = this.currentSession.id;

		try {
			this.isStreaming = true;
			this.error = null;

			// Add user message immediately (optimistic update)
			const tempUserMessage = createTempUserMessage(content);
			this.messages = [...this.messages, tempUserMessage];

			// Add temporary agent message for streaming display
			const tempAgentMessage: ChatMessage = {
				id: `streaming-${Date.now()}`,
				role: 'agent',
				content: '',
				createdAt: new Date().toISOString()
			};
			this.messages = [...this.messages, tempAgentMessage];

			return new Promise<boolean>((resolve) => {
				sendMessageViaWebSocket(sessionId, content, {
					onTextChunk: (text) => {
						// Update the streaming agent message with new text
						this.messages = this.messages.map(m =>
							m.id === tempAgentMessage.id
								? { ...m, content: m.content + text }
								: m
						);
					},
					onComplete: (result) => {
						// Replace temp user message with server-confirmed data
						this.messages = this.messages.map(m => {
							if (m.id === tempUserMessage.id) {
								return createUserMessageFromServer(result, content);
							}
							if (m.id === tempAgentMessage.id) {
								return createAgentMessageFromServer(result);
							}
							return m;
						});

						this.isStreaming = false;
						resolve(true);
					},
					onError: (error) => {
						this.error = error;
						this.messages = this.messages.filter(m =>
							!m.id.startsWith('temp-') && !m.id.startsWith('streaming-')
						);
						this.isStreaming = false;
						resolve(false);
					}
				}).catch((err) => {
					this.error = err instanceof Error ? err : new Error('Failed to send message');
					this.messages = this.messages.filter(m =>
						!m.id.startsWith('temp-') && !m.id.startsWith('streaming-')
					);
					this.isStreaming = false;
					resolve(false);
				});
			});
		} catch (err) {
			this.error = err instanceof Error ? err : new Error('Failed to send message');
			this.messages = this.messages.filter(m =>
				!m.id.startsWith('temp-') && !m.id.startsWith('streaming-')
			);
			this.isStreaming = false;
			return false;
		}
	}

	// Character methods
	async loadCharacters(): Promise<void> {
		try {
			this.loading = true;
			this.error = null;
			const response = await chatApi.getCharacters();
			this.characters = response;
		} catch (err) {
			this.error = err instanceof Error ? err : new Error('Failed to load characters');
		} finally {
			this.loading = false;
		}
	}

	async createCharacter(name: string, systemPrompt: string, description?: string): Promise<Character | null> {
		try {
			this.loading = true;
			this.error = null;
			const character = await chatApi.createCharacter({
				name,
				systemPrompt,
				description
			});
			this.characters = {
				...this.characters,
				custom: [...this.characters.custom, { ...character, isBuiltIn: false }]
			};
			return character;
		} catch (err) {
			this.error = err instanceof Error ? err : new Error('Failed to create character');
			return null;
		} finally {
			this.loading = false;
		}
	}

	async deleteCharacter(characterId: string): Promise<boolean> {
		try {
			this.loading = true;
			this.error = null;
			await chatApi.deleteCharacter(characterId);
			this.characters = {
				...this.characters,
				custom: this.characters.custom.filter(c => c.id !== characterId)
			};
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err : new Error('Failed to delete character');
			return false;
		} finally {
			this.loading = false;
		}
	}

	// Helper to get character by ID
	getCharacterById(characterId: string): Character | undefined {
		return this.allCharacters.find(c => c.id === characterId);
	}

	// Clear current session
	clearCurrentSession(): void {
		this.currentSession = null;
		this.messages = [];
	}

	// Clear error
	clearError(): void {
		this.error = null;
	}
}

// Export singleton instance
export const chatStore = new ChatStore();
