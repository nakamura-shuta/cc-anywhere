/**
 * Chat API client
 */

import { apiClient } from './client';
import { getApiBaseUrl } from '$lib/config';

// Types
export interface ChatSession {
	id: string;
	userId: string;
	characterId: string;
	workingDirectory?: string;
	// Note: Only 'claude' is currently supported
	executor: 'claude';
	sdkSessionId?: string;
	createdAt: string;
	updatedAt: string;
}

export interface ChatMessage {
	id: string;
	role: 'user' | 'agent';
	content: string;
	createdAt: string;
}

export interface Character {
	id: string;
	name: string;
	model: 'claude' | 'codex';
	avatar?: string;
	description?: string;
	systemPrompt?: string;
	isBuiltIn: boolean;
	createdAt?: string;
}

export interface CreateSessionRequest {
	characterId: string;
	workingDirectory?: string;
	// Note: Only 'claude' is currently supported
	executor?: 'claude';
}

export interface CreateCharacterRequest {
	name: string;
	avatar?: string;
	description?: string;
	systemPrompt: string;
}

export interface UpdateCharacterRequest {
	name?: string;
	avatar?: string;
	description?: string;
	systemPrompt?: string;
}

export interface SessionsListResponse {
	items: ChatSession[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export interface MessagesResponse {
	messages: ChatMessage[];
	count: number;
}

export interface CharactersResponse {
	builtIn: Character[];
	custom: Character[];
}

export interface StreamTokenResponse {
	token: string;
	expiresAt: string;
}

export interface ChatWebSocketMessage {
	type: string;
	data: unknown;
	timestamp: string;
}

export interface MessageInfo {
	id: string;
	createdAt: string;
}

export interface ChatCompleteData {
	userMessage: MessageInfo;
	agentMessage: MessageInfo;
	sdkSessionId?: string;
	mode?: 'resume' | 'new_session';
}

export interface ChatWebSocketCallbacks {
	onConnect?: (sessionId: string) => void;
	onText?: (text: string) => void;
	onToolUse?: (tool: string, input: unknown) => void;
	onError?: (error: string) => void;
	onComplete?: (data: ChatCompleteData) => void;
	onClose?: () => void;
}

// API Functions

/**
 * Session APIs
 */
export async function createSession(request: CreateSessionRequest): Promise<ChatSession> {
	return apiClient.post<ChatSession>('/api/chat/sessions', request);
}

export async function getSessions(page = 1, limit = 20): Promise<SessionsListResponse> {
	return apiClient.get<SessionsListResponse>('/api/chat/sessions', {
		params: { page, limit }
	});
}

export async function getSession(sessionId: string): Promise<ChatSession> {
	return apiClient.get<ChatSession>(`/api/chat/sessions/${sessionId}`);
}

export async function deleteSession(sessionId: string): Promise<void> {
	await apiClient.delete(`/api/chat/sessions/${sessionId}`);
}

/**
 * Message APIs
 */
export async function getMessages(sessionId: string): Promise<MessagesResponse> {
	return apiClient.get<MessagesResponse>(`/api/chat/sessions/${sessionId}/messages`);
}

export async function sendMessage(sessionId: string, content: string): Promise<ChatMessage> {
	return apiClient.post<ChatMessage>(`/api/chat/sessions/${sessionId}/messages`, { content });
}

/**
 * Stream APIs
 */
export async function getStreamToken(sessionId: string): Promise<StreamTokenResponse> {
	return apiClient.post<StreamTokenResponse>(`/api/chat/sessions/${sessionId}/stream-token`, {});
}

/**
 * Create WebSocket connection for chat session
 */
export function createChatWebSocket(
	sessionId: string,
	token: string,
	callbacks: ChatWebSocketCallbacks
): WebSocket {
	// Use API base URL to get correct backend host
	const apiBaseUrl = getApiBaseUrl();
	const wsUrl = apiBaseUrl
		.replace(/^https:/, 'wss:')
		.replace(/^http:/, 'ws:');
	const fullWsUrl = `${wsUrl}/api/chat/sessions/${sessionId}/ws?token=${encodeURIComponent(token)}`;

	const ws = new WebSocket(fullWsUrl);

	ws.onopen = () => {
		console.log('Chat WebSocket connected');
	};

	ws.onmessage = (event) => {
		try {
			const message = JSON.parse(event.data) as ChatWebSocketMessage;

			switch (message.type) {
				case 'connected':
					callbacks.onConnect?.((message.data as { sessionId: string }).sessionId);
					break;
				case 'text':
					callbacks.onText?.((message.data as { text: string }).text);
					break;
				case 'tool_use':
					const toolData = message.data as { tool: string; toolInput: unknown };
					callbacks.onToolUse?.(toolData.tool, toolData.toolInput);
					break;
				case 'error':
					callbacks.onError?.((message.data as { message: string }).message);
					break;
				case 'complete':
					callbacks.onComplete?.(message.data as ChatCompleteData);
					break;
			}
		} catch (error) {
			console.error('Failed to parse WebSocket message:', error);
		}
	};

	ws.onclose = () => {
		console.log('Chat WebSocket closed');
		callbacks.onClose?.();
	};

	ws.onerror = (error) => {
		console.error('Chat WebSocket error:', error);
		callbacks.onError?.('WebSocket connection error');
	};

	return ws;
}

/**
 * Send message through WebSocket
 */
export function sendWebSocketMessage(ws: WebSocket, content: string): void {
	if (ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify({ type: 'message', content }));
	} else {
		console.error('WebSocket is not open');
	}
}

/**
 * Character APIs
 */
export async function getCharacters(): Promise<CharactersResponse> {
	return apiClient.get<CharactersResponse>('/api/chat/characters');
}

export async function getCharacter(characterId: string): Promise<Character> {
	return apiClient.get<Character>(`/api/chat/characters/${characterId}`);
}

export async function createCharacter(request: CreateCharacterRequest): Promise<Character> {
	return apiClient.post<Character>('/api/chat/characters', request);
}

export async function updateCharacter(characterId: string, request: UpdateCharacterRequest): Promise<Character> {
	return apiClient.put<Character>(`/api/chat/characters/${characterId}`, request);
}

export async function deleteCharacter(characterId: string): Promise<void> {
	await apiClient.delete(`/api/chat/characters/${characterId}`);
}
