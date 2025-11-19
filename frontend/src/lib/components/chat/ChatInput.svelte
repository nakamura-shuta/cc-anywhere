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

	function handleSubmit() {
		const trimmed = value.trim();
		if (trimmed && !disabled) {
			onSend(trimmed);
			value = '';
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSubmit();
		}
	}
</script>

<div class="flex gap-2">
	<Textarea
		bind:value
		{placeholder}
		{disabled}
		onkeydown={handleKeydown}
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
