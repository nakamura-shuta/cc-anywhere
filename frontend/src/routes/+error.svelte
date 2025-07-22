<script lang="ts">
	import { page } from '$app/stores';
</script>

<div class="flex items-center justify-center bg-background py-16">
	<div class="text-center space-y-4">
		<h1 class="text-4xl font-bold">エラーが発生しました</h1>
		<p class="text-xl text-muted-foreground">ステータス: {$page.status}</p>
		<p class="text-lg">{$page.error?.message || 'Unknown error'}</p>
		<pre class="mt-4 p-4 bg-muted rounded text-left max-w-lg mx-auto overflow-auto">
{JSON.stringify($page, null, 2)}
		</pre>
	</div>
</div>