<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';

	interface Props {
		onSend: (content: string) => void;
		disabled?: boolean;
		placeholder?: string;
	}

	let { onSend, disabled = false, placeholder = 'Type a message...' }: Props = $props();

	let value = $state('');
	let isComposing = $state(false);

	function handleSubmit() {
		const trimmed = value.trim();
		if (trimmed && !disabled) {
			onSend(trimmed);
			value = '';
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		// Ignore Enter during IME composition (e.g., Japanese input)
		if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
			event.preventDefault();
			handleSubmit();
		}
	}

	function handleCompositionStart() {
		isComposing = true;
	}

	function handleCompositionEnd() {
		isComposing = false;
	}
</script>

<div class="flex gap-2">
	<Textarea
		bind:value
		{placeholder}
		{disabled}
		onkeydown={handleKeydown}
		oncompositionstart={handleCompositionStart}
		oncompositionend={handleCompositionEnd}
		class="min-h-[60px] resize-none"
		rows={2}
	/>
	<Button
		onclick={handleSubmit}
		{disabled}
		class="self-end"
	>
		Send
	</Button>
</div>
