<!-- 
	タスク一覧ページ
	/tasks パスでアクセスできるページ
	将来的にはAPIからタスクデータを取得して表示
-->
<script lang="ts">
	// 仮のタスクデータ（後でAPIから取得）
	const tasks = [
		{ id: '1', instruction: 'サンプルタスク1', status: 'completed' },
		{ id: '2', instruction: 'サンプルタスク2', status: 'running' },
		{ id: '3', instruction: 'サンプルタスク3', status: 'pending' }
	];
</script>

<div class="container">
	<h1>タスク一覧</h1>
	
	<!-- ホームへ戻るリンク -->
	<nav>
		<a href="/">← ホームに戻る</a>
	</nav>
	
	<!-- タスクリスト -->
	<div class="task-list">
		{#each tasks as task}
			<div class="task-card">
				<h3>{task.instruction}</h3>
				<p>Status: <span class="status-{task.status}">{task.status}</span></p>
			</div>
		{/each}
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

	/* タスクリストのスタイル */
	.task-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* タスクカードのスタイル */
	.task-card {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		transition: transform 0.2s;
	}

	.task-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(0,0,0,0.15);
	}

	/* ステータスのスタイル */
	.status-completed { color: #4caf50; }
	.status-running { color: #2196f3; }
	.status-pending { color: #ff9800; }
</style>