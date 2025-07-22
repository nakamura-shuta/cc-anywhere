<!--
	+layout.svelte: SvelteKitのレイアウトコンポーネント
	このファイルは全てのページで共通して使用されるレイアウトを定義
	app.cssをインポートすることで、グローバルスタイルを適用
-->
<script lang="ts">
	// グローバルCSSをインポート
	import '../app.css';
	// shadcn-svelteのButtonコンポーネントをインポート
	import { Button } from '$lib/components/ui/button';
	
	// Svelte 5の$props()を使用してchildrenを受け取る
	let { children } = $props();
	// WebSocketプロバイダー
	import WebSocketProvider from '$lib/components/providers/websocket-provider.svelte';
	// WebSocket接続状態フック
	import { useWebSocketStatus } from '$lib/hooks/use-websocket.svelte';
	// 現在のページ情報を取得するためのストア
	import { page } from '$app/stores';
	import { Wifi, WifiOff } from 'lucide-svelte';
	
	// WebSocket接続状態
	let wsStatus = $state<ReturnType<typeof useWebSocketStatus> | null>(null);
	
	// ナビゲーションメニューの定義
	// 各アイテムはhref（リンク先）とlabel（表示テキスト）を持つ
	const navItems = [
		{ href: '/', label: 'ホーム' },
		{ href: '/tasks', label: 'タスク一覧' },
		{ href: '/scheduler', label: 'スケジューラー' },
		{ href: '/settings', label: '設定' },
	];
	
	// WebSocket接続状態を取得
	$effect(() => {
		wsStatus = useWebSocketStatus();
	});
	
</script>

<!-- WebSocketプロバイダーでラップ -->
<WebSocketProvider>
	<div class="h-screen flex flex-col overflow-hidden">
		<!-- ヘッダー部分 -->
		<header class="border-b">
			<div class="container mx-auto px-4 py-4">
				<nav class="flex items-center justify-between">
					<!-- ロゴ/タイトル -->
					<div class="flex items-center gap-4">
						<a href="/" class="text-xl font-bold">
							CC-Anywhere
						</a>
						
						<!-- WebSocket接続状態 -->
						{#if wsStatus}
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
						{/if}
					</div>
					
					<!-- ナビゲーションメニュー -->
					<div class="flex gap-2">
						{#each navItems as item}
							<Button 
								href={item.href}
								variant={$page.url.pathname === item.href ? 'default' : 'ghost'}
								size="sm"
							>
								{item.label}
							</Button>
						{/each}
					</div>
				</nav>
			</div>
		</header>
		
		<!-- メインコンテンツエリア -->
		<main class="flex-1 overflow-y-auto">
			<div class="container mx-auto px-4 py-8">
				{@render children?.()}
			</div>
		</main>
		
		<!-- フッター部分 -->
		<footer class="border-t flex-shrink-0">
			<div class="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
				CC-Anywhere © 2024 - Claude Code SDK Server
			</div>
		</footer>
	</div>
</WebSocketProvider>