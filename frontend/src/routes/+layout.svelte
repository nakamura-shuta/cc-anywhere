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

<!-- 
	ページ全体のレイアウト構造
	min-h-screenで最小高さを画面高さに設定
	flex flex-colで縦方向のフレックスボックスレイアウトを適用
-->
<div class="min-h-screen flex flex-col">
	<!-- ヘッダー部分 -->
	<header class="border-b">
		<div class="container mx-auto px-4 py-4">
			<nav class="flex items-center justify-between">
				<!-- ロゴ/タイトル -->
				<a href="/" class="text-xl font-bold">
					CC-Anywhere
				</a>
				
				<!-- 
					ナビゲーションメニュー
					各アイテムをループで表示
					現在のページと一致する場合はdefaultバリアント、それ以外はghostバリアント
				-->
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
	
	<!-- 
		メインコンテンツエリア
		flex-1で残りの高さを全て使用
		slotに各ページのコンテンツが挿入される
	-->
	<main class="flex-1 container mx-auto px-4 py-8">
		<slot />
	</main>
	
	<!-- フッター部分 -->
	<footer class="border-t mt-auto">
		<div class="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
			CC-Anywhere © 2024 - Claude Code SDK Server
		</div>
	</footer>
</div>