<!-- 
	SvelteKitのページコンポーネント
	このファイルは / (ルート) パスに対応するページ
	+page.svelteはSvelteKitの命名規則で、そのディレクトリのページコンポーネントを表す
-->
<script lang="ts">
	// TypeScriptを使用してタイプセーフな開発を行う
	// 現時点では特に変数や関数は定義しない
</script>

<!-- ページのメインコンテンツ -->
<div class="container">
	<h1>CC-Anywhere</h1>
	<p>Welcome to CC-Anywhere with SvelteKit!</p>
	
	<!-- 今後のナビゲーションリンク（仮） -->
	<nav>
		<ul>
			<li><a href="/tasks">タスク一覧</a></li>
			<li><a href="/scheduler">スケジューラー</a></li>
			<li><a href="/settings">設定</a></li>
		</ul>
	</nav>
</div>

<style>
	/* コンテナの基本スタイリング */
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	/* 見出しのスタイリング */
	h1 {
		color: #333;
		font-size: 2.5rem;
		margin-bottom: 1rem;
	}

	/* パラグラフのスタイリング */
	p {
		color: #666;
		font-size: 1.2rem;
		margin-bottom: 2rem;
	}

	/* ナビゲーションのスタイリング */
	nav ul {
		list-style: none;
		padding: 0;
		display: flex;
		gap: 1rem;
	}

	nav a {
		color: #0066cc;
		text-decoration: none;
		padding: 0.5rem 1rem;
		border: 1px solid #0066cc;
		border-radius: 4px;
		transition: all 0.3s ease;
	}

	nav a:hover {
		background-color: #0066cc;
		color: white;
	}
</style>