<!-- WebSocket接続状態表示コンポーネント -->
<script lang="ts">
	import { Wifi, WifiOff } from 'lucide-svelte';
	import { useWebSocketStatus } from '$lib/hooks/use-websocket.svelte';
	
	const wsStatus = useWebSocketStatus();
</script>

<div class="flex items-center gap-2 text-sm">
	{#if wsStatus.connected}
		<Wifi class="h-4 w-4 text-green-500" />
		<span class="text-muted-foreground">
			{wsStatus.authenticated ? '接続済み' : '認証中...'}
		</span>
	{:else if wsStatus.connecting}
		<Wifi class="h-4 w-4 text-yellow-500 animate-pulse" />
		<span class="text-muted-foreground">接続中...</span>
	{:else}
		<WifiOff class="h-4 w-4 text-destructive" />
		<span class="text-muted-foreground">未接続</span>
	{/if}
</div>