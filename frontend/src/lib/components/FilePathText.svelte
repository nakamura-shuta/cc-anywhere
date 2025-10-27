<script lang="ts">
	import { convertFilePathsToLinks } from '$lib/utils/file-path-linker';

	interface Props {
		text: string;
		taskId: string;
		projectRoot?: string;
		class?: string;
	}

	let { text, taskId, projectRoot, class: className = '' }: Props = $props();

	// テキストをHTMLに変換（ファイルパスをリンク化）
	const html = $derived(convertFilePathsToLinks(text, taskId, projectRoot));
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -->
<span class="file-path-text {className}" data-testid="file-path-text">
	{@html html}
</span>

<style>
	:global(.file-path-text .file-path-link) {
		color: hsl(var(--primary));
		text-decoration: underline;
		cursor: pointer;
		transition: color 0.2s;
	}

	:global(.file-path-text .file-path-link:hover) {
		color: hsl(var(--primary) / 0.8);
		text-decoration: underline;
	}

	:global(.file-path-text .file-path-link:visited) {
		color: hsl(var(--primary) / 0.7);
	}
</style>
