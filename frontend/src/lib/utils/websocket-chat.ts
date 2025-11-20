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
}

/**
 * Send a message via WebSocket and handle streaming response
 */
export async function sendMessageViaWebSocket(
	sessionId: string,
	content: string,
	callbacks: WebSocketChatCallbacks
): Promise<void> {
	// Get stream token for WebSocket authentication
	const tokenResponse = await chatApi.getStreamToken(sessionId);

	let responseText = '';

	const ws = chatApi.createChatWebSocket(sessionId, tokenResponse.token, {
		onConnect: () => {
			// Send message after connection established
			chatApi.sendWebSocketMessage(ws, content);
		},
		onText: (text) => {
			responseText += text;
			callbacks.onTextChunk?.(text);
		},
		onError: (errorMessage) => {
			ws.close();
			callbacks.onError(new Error(errorMessage));
		},
		onComplete: (data: ChatCompleteData) => {
			ws.close();
			callbacks.onComplete({
				userMessage: data.userMessage,
				agentMessage: data.agentMessage,
				content: responseText
			});
		},
		onClose: () => {
			// Connection closed - no action needed
		}
	});
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
