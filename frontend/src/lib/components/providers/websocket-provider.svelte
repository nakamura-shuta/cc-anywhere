<script lang="ts">
	import { createWebSocketConnection, setWebSocketContext } from '$lib/websocket/websocket.svelte';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	
	// Props
	let { children }: { children: Snippet } = $props();
	
	// WebSocket接続を作成
	const ws = createWebSocketConnection();
	
	// コンテキストに設定
	setWebSocketContext(ws);
	
	// WebSocketを有効化
	const ENABLE_WEBSOCKET = true;
	
	// マウント時に一度だけ接続
	onMount(() => {
		console.log('[WebSocketProvider] onMountが呼ばれました', {
			browser,
			ENABLE_WEBSOCKET,
			wsInstance: !!ws
		});
		
		if (ENABLE_WEBSOCKET && browser) {
			console.log('[WebSocketProvider] ブラウザ環境でWebSocket接続を開始');
			// 少し遅延を入れて接続
			setTimeout(() => {
				ws.connect();
			}, 100);
		}
		
		// クリーンアップ
		return () => {
			console.log('[WebSocketProvider] アンマウント時にWebSocket切断');
			if (browser) {
				ws.disconnect();
			}
		};
	});
</script>

{#if children}
	{@render children()}
{/if}

{#if ws.error && ENABLE_WEBSOCKET}
	<!-- エラー通知 -->
	<div class="fixed bottom-4 right-4 max-w-sm z-50">
		<div class="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg">
			<p class="text-sm font-medium">WebSocket接続エラー</p>
			<p class="text-sm">{ws.error.message}</p>
		</div>
	</div>
{/if}