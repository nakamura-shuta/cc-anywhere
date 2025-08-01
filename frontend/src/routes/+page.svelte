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
	<p>Welcome to CC-Anywhere</p>
	
	
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
		flex-wrap: wrap;
	}

	nav li {
		flex: 1 1 auto;
		min-width: 150px;
	}

	nav a {
		color: #0066cc;
		text-decoration: none;
		padding: 0.75rem 1rem;
		border: 1px solid #0066cc;
		border-radius: 4px;
		transition: all 0.3s ease;
		display: block;
		text-align: center;
		white-space: nowrap;
	}

	nav a:hover {
		background-color: #0066cc;
		color: white;
	}

	/* モバイル向けレスポンシブ対応 */
	@media (max-width: 768px) {
		.container {
			padding: 1rem;
		}

		h1 {
			font-size: 2rem;
		}

		p {
			font-size: 1rem;
			margin-bottom: 1.5rem;
		}

		nav ul {
			flex-direction: column;
			gap: 0.75rem;
		}

		nav li {
			width: 100%;
			min-width: unset;
		}

		nav a {
			padding: 1rem;
			font-size: 1.1rem;
		}
	}

	/* 小さいスマートフォン向け */
	@media (max-width: 375px) {
		h1 {
			font-size: 1.75rem;
		}

		nav a {
			padding: 0.875rem 0.75rem;
			font-size: 1rem;
		}
	}
</style>