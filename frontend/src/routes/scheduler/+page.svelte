<!-- 
	スケジューラーページ
	/scheduler パスでアクセスできるページ
	タスクのスケジューリング機能を提供（今後実装）
-->
<script lang="ts">
	// 将来的にスケジュール管理のロジックを追加
</script>

<div class="container">
	<h1>スケジューラー</h1>
	
	<!-- ホームへ戻るリンク -->
	<nav>
		<a href="/">← ホームに戻る</a>
	</nav>
	
	<!-- スケジューラーコンテンツ（仮） -->
	<div class="scheduler-content">
		<p>スケジューラー機能は現在開発中です。</p>
		<p>ここでは以下の機能を提供予定です：</p>
		<ul>
			<li>定期実行タスクの設定</li>
			<li>Cron式によるスケジュール管理</li>
			<li>実行履歴の確認</li>
		</ul>
	</div>
</div>

<style>
	/* コンテナのスタイル */
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	/* 見出しのスタイル */
	h1 {
		color: #333;
		font-size: 2rem;
		margin-bottom: 1rem;
	}

	/* ナビゲーションのスタイル */
	nav {
		margin-bottom: 2rem;
	}

	nav a {
		color: #0066cc;
		text-decoration: none;
	}

	nav a:hover {
		text-decoration: underline;
	}

	/* コンテンツエリアのスタイル */
	.scheduler-content {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
	}

	/* リストのスタイル */
	ul {
		margin-top: 1rem;
		margin-left: 2rem;
	}

	li {
		margin-bottom: 0.5rem;
	}
</style>