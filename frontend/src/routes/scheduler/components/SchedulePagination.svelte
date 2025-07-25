<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	
	interface Props {
		currentPage: number;
		totalPages: number;
		onPageChange: (page: number) => void;
	}
	
	let { currentPage, totalPages, onPageChange }: Props = $props();
</script>

{#if totalPages > 1}
	<div class="mt-8 flex justify-center gap-2">
		<Button 
			variant="outline" 
			size="sm"
			disabled={currentPage === 1}
			onclick={() => onPageChange(currentPage - 1)}
		>
			前へ
		</Button>
		
		{#each Array(totalPages) as _, i}
			{#if i + 1 === 1 || i + 1 === totalPages || (i + 1 >= currentPage - 2 && i + 1 <= currentPage + 2)}
				<Button
					variant={i + 1 === currentPage ? "default" : "outline"}
					size="sm"
					onclick={() => onPageChange(i + 1)}
				>
					{i + 1}
				</Button>
			{:else if i + 1 === currentPage - 3 || i + 1 === currentPage + 3}
				<span class="px-2">...</span>
			{/if}
		{/each}
		
		<Button 
			variant="outline" 
			size="sm"
			disabled={currentPage === totalPages}
			onclick={() => onPageChange(currentPage + 1)}
		>
			次へ
		</Button>
	</div>
{/if}