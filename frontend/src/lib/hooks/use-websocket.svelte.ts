// WebSocketフック（Svelte 5 Runes使用）

import { getWebSocketContext, type WebSocketMessage } from '$lib/websocket/websocket.svelte';

// タスクのWebSocket通信を管理するフック
export function useTaskWebSocket(taskId: string) {
	const ws = getWebSocketContext();
	
	// タスクをサブスクライブ
	$effect(() => {
		ws.subscribe(taskId);
		
		// クリーンアップ時にアンサブスクライブ
		return () => {
			ws.unsubscribe(taskId);
		};
	});
	
	// タスクのメッセージを取得（リアクティブ）
	const messages = $derived(ws.getTaskMessages(taskId));
	
	// 最新のログメッセージ
	const logs = $derived(
		messages
			.filter(m => m.type === 'task:log')
			.map(m => m.data?.log || '')
	);
	
	// タスクの進捗
	const progress = $derived(
		(() => {
			const progressMessages = messages.filter(m => m.type === 'task:progress');
			if (progressMessages.length === 0) return null;
			
			const latest = progressMessages[progressMessages.length - 1];
			return {
				percent: latest.data?.percent || 0,
				message: latest.data?.message || ''
			};
		})()
	);
	
	// タスクのステータス変更
	const statusChange = $derived(
		(() => {
			const statusMessages = messages.filter(m => 
				['task:completed', 'task:failed', 'task:cancelled'].includes(m.type)
			);
			if (statusMessages.length === 0) return null;
			
			return statusMessages[statusMessages.length - 1];
		})()
	);
	
	return {
		connected: ws.connected,
		authenticated: ws.authenticated,
		get messages() { return messages; },
		get logs() { return logs; },
		get progress() { return progress; },
		get statusChange() { return statusChange; },
		clearMessages: () => ws.clearTaskMessages(taskId)
	};
}

// WebSocket接続状態を管理するフック
export function useWebSocketStatus() {
	const ws = getWebSocketContext();
	
	return {
		connected: ws.connected,
		connecting: ws.connecting,
		authenticated: ws.authenticated,
		error: ws.error,
		isReady: ws.isReady,
		connect: () => ws.connect(),
		disconnect: () => ws.disconnect()
	};
}

// リアルタイムメッセージを監視するフック
export function useWebSocketMessages(filter?: (message: WebSocketMessage) => boolean) {
	const ws = getWebSocketContext();
	
	// フィルタリングされたメッセージ
	const filteredMessages = $derived(
		filter ? ws.messages.filter(filter) : ws.messages
	);
	
	// 最新のメッセージ
	const latestMessage = $derived(
		filteredMessages[filteredMessages.length - 1]
	);
	
	return {
		get messages() { return filteredMessages; },
		get latestMessage() { return latestMessage; }
	};
}