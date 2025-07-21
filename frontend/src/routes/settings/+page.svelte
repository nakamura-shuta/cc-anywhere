<!-- 
	設定ページ
	/settings パスでアクセスできるページ
	アプリケーションの各種設定を管理
-->
<script lang="ts">
	// 設定値の管理（仮）
	let apiKey = '';
	let maxTurns = 50;
	let theme = 'light';
</script>

<div class="container">
	<h1>設定</h1>
	
	<!-- ホームへ戻るリンク -->
	<nav>
		<a href="/">← ホームに戻る</a>
	</nav>
	
	<!-- 設定フォーム -->
	<div class="settings-form">
		<h2>基本設定</h2>
		
		<div class="form-group">
			<label for="apiKey">APIキー</label>
			<input 
				id="apiKey" 
				type="password" 
				bind:value={apiKey}
				placeholder="APIキーを入力"
			/>
		</div>
		
		<div class="form-group">
			<label for="maxTurns">最大ターン数</label>
			<input 
				id="maxTurns" 
				type="number" 
				bind:value={maxTurns}
				min="1" 
				max="100"
			/>
		</div>
		
		<div class="form-group">
			<label for="theme">テーマ</label>
			<select id="theme" bind:value={theme}>
				<option value="light">ライト</option>
				<option value="dark">ダーク</option>
			</select>
		</div>
		
		<button class="save-button">設定を保存</button>
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

	h2 {
		color: #555;
		font-size: 1.5rem;
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

	/* 設定フォームのスタイル */
	.settings-form {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		max-width: 600px;
	}

	/* フォームグループのスタイル */
	.form-group {
		margin-bottom: 1.5rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: bold;
		color: #555;
	}

	input, select {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
	}

	input:focus, select:focus {
		outline: none;
		border-color: #0066cc;
	}

	/* 保存ボタンのスタイル */
	.save-button {
		background-color: #0066cc;
		color: white;
		padding: 0.75rem 2rem;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		cursor: pointer;
		transition: background-color 0.3s;
	}

	.save-button:hover {
		background-color: #0052a3;
	}
</style>