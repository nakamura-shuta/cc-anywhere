<!-- WebSocket接続状態表示コンポーネント -->
<script lang="ts">
	import { Wifi, WifiOff } from 'lucide-svelte';
	import { getWebSocketStore } from '$lib/stores/websocket-enhanced.svelte';
	
	const ws = getWebSocketStore();
	
	// 接続状態を派生
	const isConnected = $derived(ws.status === 'connected');
	const isConnecting = $derived(ws.status === 'connecting');
</script>

<div class="flex items-center gap-2 text-sm">
	{#if isConnected}
		<Wifi class="h-4 w-4 text-green-500" />
		<span class="text-muted-foreground">接続済み</span>
	{:else if isConnecting}
		<Wifi class="h-4 w-4 text-yellow-500 animate-pulse" />
		<span class="text-muted-foreground">接続中...</span>
	{:else}
		<WifiOff class="h-4 w-4 text-destructive" />
		<span class="text-muted-foreground">未接続</span>
	{/if}
</div>