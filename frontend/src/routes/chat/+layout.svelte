<script lang="ts">
	let { children } = $props();
</script>

<!-- チャット専用レイアウト: overflow-hiddenで固定高さ -->
<div class="h-full overflow-hidden -mx-4 -my-4 lg:-my-8">
	{@render children?.()}
</div>
