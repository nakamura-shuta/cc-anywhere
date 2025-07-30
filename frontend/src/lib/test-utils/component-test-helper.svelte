<!-- Svelte 5対応のテストヘルパーコンポーネント -->
<script lang="ts">
	import type { Component } from 'svelte';
	
	interface Props {
		component: Component<Record<string, unknown>>;
		props?: Record<string, unknown>;
		children?: string;
	}
	
	let { component: Comp, props = {}, children }: Props = $props();
</script>

<Comp {...props}>
	{#if children}
		{children}
	{/if}
</Comp>