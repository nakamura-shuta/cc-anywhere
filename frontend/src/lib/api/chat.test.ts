import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	createSession,
	getSessions,
	getSession,
	deleteSession,
	getMessages,
	sendMessage,
	getStreamToken,
	getCharacters,
	getCharacter,
	createCharacter,
	updateCharacter,
	deleteCharacter
} from './chat';
import { apiClient } from './client';

// Mock the API client
vi.mock('./client', () => ({
	apiClient: {
		get: vi.fn(),
		post: vi.fn(),
		put: vi.fn(),
		delete: vi.fn()
	}
}));

describe('Chat API', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Session APIs', () => {
		it('should create a session', async () => {
			const mockSession = {
				id: 'session-123',
				userId: 'user-1',
				characterId: 'default',
				executor: 'claude',
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z'
			};
			vi.mocked(apiClient.post).mockResolvedValue(mockSession);

			const result = await createSession({
				characterId: 'default',
				executor: 'claude'
			});

			expect(apiClient.post).toHaveBeenCalledWith('/api/chat/sessions', {
				characterId: 'default',
				executor: 'claude'
			});
			expect(result).toEqual(mockSession);
		});

		it('should get sessions list', async () => {
			const mockResponse = {
				items: [],
				total: 0,
				page: 1,
				limit: 20,
				totalPages: 0
			};
			vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

			const result = await getSessions(1, 20);

			expect(apiClient.get).toHaveBeenCalledWith('/api/chat/sessions', {
				params: { page: 1, limit: 20 }
			});
			expect(result).toEqual(mockResponse);
		});

		it('should get a session by ID', async () => {
			const mockSession = {
				id: 'session-123',
				userId: 'user-1',
				characterId: 'default',
				executor: 'claude',
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z'
			};
			vi.mocked(apiClient.get).mockResolvedValue(mockSession);

			const result = await getSession('session-123');

			expect(apiClient.get).toHaveBeenCalledWith('/api/chat/sessions/session-123');
			expect(result).toEqual(mockSession);
		});

		it('should delete a session', async () => {
			vi.mocked(apiClient.delete).mockResolvedValue(undefined);

			await deleteSession('session-123');

			expect(apiClient.delete).toHaveBeenCalledWith('/api/chat/sessions/session-123');
		});
	});

	describe('Message APIs', () => {
		it('should get messages for a session', async () => {
			const mockResponse = {
				messages: [
					{
						id: 'msg-1',
						role: 'user',
						content: 'Hello',
						createdAt: '2024-01-01T00:00:00Z'
					}
				],
				count: 1
			};
			vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

			const result = await getMessages('session-123');

			expect(apiClient.get).toHaveBeenCalledWith('/api/chat/sessions/session-123/messages');
			expect(result).toEqual(mockResponse);
		});

		it('should send a message', async () => {
			const mockMessage = {
				id: 'msg-1',
				role: 'user',
				content: 'Hello',
				createdAt: '2024-01-01T00:00:00Z'
			};
			vi.mocked(apiClient.post).mockResolvedValue(mockMessage);

			const result = await sendMessage('session-123', 'Hello');

		expect(apiClient.post).toHaveBeenCalledWith(
			'/api/chat/sessions/session-123/messages',
			{ content: 'Hello' }
		);
		expect(result).toEqual(mockMessage);
	});
	});

	describe('Stream APIs', () => {
		it('should get stream token', async () => {
			const mockResponse = {
				token: 'jwt-token',
				expiresAt: '2024-01-01T00:05:00Z'
			};
			vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

			const result = await getStreamToken('session-123');

			expect(apiClient.post).toHaveBeenCalledWith(
				'/api/chat/sessions/session-123/stream-token'
			);
			expect(result).toEqual(mockResponse);
		});
	});

	describe('Character APIs', () => {
		it('should get characters', async () => {
			const mockResponse = {
				builtIn: [{ id: 'default', name: 'Claude', isBuiltIn: true }],
				custom: []
			};
			vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

			const result = await getCharacters();

			expect(apiClient.get).toHaveBeenCalledWith('/api/chat/characters');
			expect(result).toEqual(mockResponse);
		});

		it('should get a character by ID', async () => {
			const mockCharacter = {
				id: 'default',
				name: 'Claude',
				systemPrompt: 'You are helpful',
				isBuiltIn: true
			};
			vi.mocked(apiClient.get).mockResolvedValue(mockCharacter);

			const result = await getCharacter('default');

			expect(apiClient.get).toHaveBeenCalledWith('/api/chat/characters/default');
			expect(result).toEqual(mockCharacter);
		});

		it('should create a character', async () => {
			const mockCharacter = {
				id: 'char-1',
				name: 'My Bot',
				systemPrompt: 'Be helpful',
				isBuiltIn: false,
				createdAt: '2024-01-01T00:00:00Z'
			};
			vi.mocked(apiClient.post).mockResolvedValue(mockCharacter);

			const result = await createCharacter({
				name: 'My Bot',
				systemPrompt: 'Be helpful'
			});

			expect(apiClient.post).toHaveBeenCalledWith('/api/chat/characters', {
				name: 'My Bot',
				systemPrompt: 'Be helpful'
			});
			expect(result).toEqual(mockCharacter);
		});

		it('should update a character', async () => {
			const mockCharacter = {
				id: 'char-1',
				name: 'Updated Bot',
				systemPrompt: 'Be helpful',
				isBuiltIn: false
			};
			vi.mocked(apiClient.put).mockResolvedValue(mockCharacter);

			const result = await updateCharacter('char-1', { name: 'Updated Bot' });

			expect(apiClient.put).toHaveBeenCalledWith('/api/chat/characters/char-1', {
				name: 'Updated Bot'
			});
			expect(result).toEqual(mockCharacter);
		});

		it('should delete a character', async () => {
			vi.mocked(apiClient.delete).mockResolvedValue(undefined);

			await deleteCharacter('char-1');

			expect(apiClient.delete).toHaveBeenCalledWith('/api/chat/characters/char-1');
		});
	});
});
