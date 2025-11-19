/**
 * Chat API client
 */

import { apiClient } from './client';

// Types
export interface ChatSession {
	id: string;
	userId: string;
	characterId: string;
	workingDirectory?: string;
	executor: 'claude' | 'codex';
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
	avatar?: string;
	description?: string;
	systemPrompt?: string;
	isBuiltIn: boolean;
	createdAt?: string;
}

export interface CreateSessionRequest {
	characterId: string;
	workingDirectory?: string;
	executor?: 'claude' | 'codex';
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

export interface ProcessMessageResponse {
	messageId: string;
	content: string;
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

export async function processMessage(sessionId: string, content: string): Promise<ProcessMessageResponse> {
	return apiClient.post<ProcessMessageResponse>(`/api/chat/sessions/${sessionId}/process`, { content });
}

/**
 * Stream APIs
 */
export async function getStreamToken(sessionId: string): Promise<StreamTokenResponse> {
	return apiClient.post<StreamTokenResponse>(`/api/chat/sessions/${sessionId}/stream-token`);
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
