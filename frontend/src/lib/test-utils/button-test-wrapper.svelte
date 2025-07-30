<!-- Button test wrapper component for slot testing -->
<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import type { ButtonProps } from '$lib/components/ui/button/button.svelte';
	
	interface Props extends ButtonProps {
		slotContent?: string;
		complexSlot?: boolean;
	}
	
	let { slotContent, complexSlot, ...buttonProps }: Props = $props();
</script>

<Button {...buttonProps}>
	{#if complexSlot}
		<span class="icon">Icon</span> Button Text
	{:else if slotContent}
		{slotContent}
	{/if}
</Button>