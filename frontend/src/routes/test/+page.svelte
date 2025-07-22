<script>
	function handleClick() {
		console.log('Button clicked!');
		alert('Button clicked!');
	}
</script>

<div>
	<h1>イベントハンドラーテスト</h1>
	<button type="button" style="padding: 10px; background: blue; color: white; cursor: pointer;" onclick={handleClick}>
		クリックテスト
	</button>
	
	<p>下のボタンも試してください：</p>
	<button type="button" onclick={() => alert('インラインハンドラーが動作しました')}>
		インラインハンドラーテスト
	</button>
</div>

<style>
	button {
		margin: 10px 0;
		padding: 10px 20px;
		font-size: 16px;
	}
</style>