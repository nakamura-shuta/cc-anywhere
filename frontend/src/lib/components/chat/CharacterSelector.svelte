<script lang="ts">
	import type { Character } from '$lib/api/chat';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';

	interface Props {
		characters: Character[];
		onSelect: (characterId: string) => void;
		onCancel: () => void;
	}

	let { characters, onSelect, onCancel }: Props = $props();
</script>

<div class="space-y-4">
	<div class="grid gap-3 sm:grid-cols-2">
		{#each characters as character (character.id)}
			<Card.Root
				class="cursor-pointer transition-colors hover:bg-muted"
			>
				<button
					class="w-full text-left"
					onclick={() => onSelect(character.id)}
				>
					<Card.Header class="pb-2">
						<Card.Title class="text-base">{character.name}</Card.Title>
						{#if character.description}
							<Card.Description class="text-xs">
								{character.description}
							</Card.Description>
						{/if}
					</Card.Header>
					<Card.Content class="pt-0">
						{#if character.isBuiltIn}
							<span class="text-muted-foreground text-xs">Built-in</span>
						{:else}
							<span class="text-muted-foreground text-xs">Custom</span>
						{/if}
					</Card.Content>
				</button>
			</Card.Root>
		{/each}
	</div>

	<div class="flex justify-end">
		<Button variant="outline" onclick={onCancel}>
			Cancel
		</Button>
	</div>
</div>
