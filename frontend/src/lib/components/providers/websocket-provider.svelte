<script lang="ts">
	import { getWebSocketStore } from '$lib/stores/websocket-enhanced.svelte';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	
	// Props
	let { children }: { children: Snippet } = $props();
	
	// 新しいWebSocketストアを使用
	const ws = getWebSocketStore();
	
	// WebSocketを有効化
	const ENABLE_WEBSOCKET = true;
	
	// マウント時に一度だけ接続
	onMount(() => {
		console.log('[WebSocketProvider] onMountが呼ばれました', {
			browser,
			ENABLE_WEBSOCKET,
			wsInstance: !!ws,
			currentStatus: ws.status
		});
		
		if (ENABLE_WEBSOCKET && browser && !ws.isConnected) {
			console.log('[WebSocketProvider] ブラウザ環境でWebSocket接続を開始');
			// 少し遅延を入れて接続
			setTimeout(() => {
				ws.connect();
			}, 100);
		}
		
		// クリーンアップ
		return () => {
			// WebSocketProviderレベルでは切断しない（グローバルで管理）
			console.log('[WebSocketProvider] アンマウント（接続は維持）');
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