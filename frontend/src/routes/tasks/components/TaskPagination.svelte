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
	<div class="flex justify-center gap-2">
		<Button 
			variant="outline" 
			disabled={currentPage <= 1}
			onclick={() => onPageChange(currentPage - 1)}
		>
			前へ
		</Button>
		<div class="flex items-center px-4">
			ページ {currentPage} / {totalPages}
		</div>
		<Button 
			variant="outline" 
			disabled={currentPage >= totalPages}
			onclick={() => onPageChange(currentPage + 1)}
		>
			次へ
		</Button>
	</div>
{/if}