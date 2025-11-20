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
						<div class="flex items-center gap-3">
							{#if character.avatar}
								<img
									src={character.avatar}
									alt={character.name}
									class="h-10 w-10 rounded-full object-cover"
								/>
							{:else}
								<div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
									<span class="text-lg">🤖</span>
								</div>
							{/if}
							<div>
								<Card.Title class="text-base">{character.name}</Card.Title>
								{#if character.description}
									<Card.Description class="text-xs">
										{character.description}
									</Card.Description>
								{/if}
							</div>
						</div>
					</Card.Header>
					<Card.Content class="pt-0">
						<div class="flex items-center gap-2">
							{#if character.isBuiltIn}
								<span class="text-muted-foreground text-xs">Built-in</span>
							{:else}
								<span class="text-muted-foreground text-xs">Custom</span>
							{/if}
							<span class="text-muted-foreground text-xs">• {character.model}</span>
						</div>
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
