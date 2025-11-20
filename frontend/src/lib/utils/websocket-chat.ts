/**
 * WebSocket chat utilities for handling streaming chat messages
 */

import * as chatApi from '$lib/api/chat';
import type { ChatMessage, ChatCompleteData } from '$lib/api/chat';

export interface WebSocketChatCallbacks {
	onTextChunk?: (text: string) => void;
	onComplete: (result: WebSocketChatResult) => void;
	onError: (error: Error) => void;
}

export interface WebSocketChatResult {
	userMessage: {
		id: string;
		createdAt: string;
	};
	agentMessage: {
		id: string;
		createdAt: string;
	};
	content: string;
	mode?: 'resume' | 'history_fallback';
}

/**
 * Send a message via WebSocket and handle streaming response
 */
export async function sendMessageViaWebSocket(
	sessionId: string,
	content: string,
	callbacks: WebSocketChatCallbacks,
	maxRetries = 1
): Promise<void> {
	let responseText = '';
	let completed = false;
	let retriesLeft = maxRetries;

	const openConnection = async () => {
		const tokenResponse = await chatApi.getStreamToken(sessionId);
		const ws = chatApi.createChatWebSocket(sessionId, tokenResponse.token, {
			onConnect: () => {
				chatApi.sendWebSocketMessage(ws, content);
			},
			onText: (text) => {
				responseText += text;
				callbacks.onTextChunk?.(text);
			},
			onError: (errorMessage) => {
				ws.close();
				if (!completed) {
					callbacks.onError(new Error(errorMessage));
				}
			},
			onComplete: (data: ChatCompleteData) => {
				completed = true;
				ws.close();
				callbacks.onComplete({
					userMessage: data.userMessage,
					agentMessage: data.agentMessage,
					content: responseText,
					mode: (data as any).mode
				});
			},
			onClose: () => {
				if (completed) return;
				if (retriesLeft > 0) {
					retriesLeft -= 1;
					openConnection().catch((err) => callbacks.onError(err));
				} else {
					callbacks.onError(new Error('WebSocket closed before completion'));
				}
			}
		});
	};

	return openConnection();
}

/**
 * Create a temporary user message for optimistic UI update
 */
export function createTempUserMessage(content: string): ChatMessage {
	return {
		id: `temp-${Date.now()}`,
		role: 'user',
		content,
		createdAt: new Date().toISOString()
	};
}

/**
 * Create user message from server response
 */
export function createUserMessageFromServer(
	result: WebSocketChatResult,
	content: string
): ChatMessage {
	return {
		id: result.userMessage.id,
		role: 'user',
		content,
		createdAt: result.userMessage.createdAt
	};
}

/**
 * Create agent message from server response
 */
export function createAgentMessageFromServer(result: WebSocketChatResult): ChatMessage {
	return {
		id: result.agentMessage.id,
		role: 'agent',
		content: result.content,
		createdAt: result.agentMessage.createdAt
	};
}
