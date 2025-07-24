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
	// WebSocket接続状態表示コンポーネント
	import WebSocketStatus from '$lib/components/websocket-status.svelte';
	// 現在のページ情報を取得するためのストア
	import { page } from '$app/stores';
	
	// ナビゲーションメニューの定義
	// 各アイテムはhref（リンク先）とlabel（表示テキスト）を持つ
	const navItems = [
		{ href: '/', label: 'ホーム' },
		{ href: '/tasks', label: 'タスク一覧' },
		{ href: '/scheduler', label: 'スケジューラー' },
		{ href: '/settings', label: '設定' },
	];
	
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
						<WebSocketStatus />
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