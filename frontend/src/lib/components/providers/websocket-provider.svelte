<script lang="ts">
	import { createWebSocketConnection, setWebSocketContext } from '$lib/websocket/websocket.svelte';
	import { browser } from '$app/environment';
	import type { Snippet } from 'svelte';
	
	// Props
	let { children }: { children: Snippet } = $props();
	
	// WebSocket接続を作成
	const ws = createWebSocketConnection();
	
	// コンテキストに設定
	setWebSocketContext(ws);
	
	// 開発環境ではWebSocketを無効化（必要に応じて有効化）
	const ENABLE_WEBSOCKET = false;
	
	// ブラウザ環境でのみ接続
	$effect(() => {
		if (browser && ENABLE_WEBSOCKET) {
			ws.connect();
			
			// クリーンアップ
			return () => {
				ws.disconnect();
			};
		}
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