<script lang="ts">
	import { RepositoryExplorer } from '$lib/components/repository-explorer';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	
	// デフォルトのリポジトリ設定
	const repositories = [
		{ name: 'cc-anywhere', path: '/Users/nakamura.shuta/dev/cc-anywhere' }
	];
</script>

<div class="page-container">
	<Card>
		<CardHeader>
			<CardTitle>Repository Explorer</CardTitle>
			<CardDescription>
				Browse and explore repository files and directories
			</CardDescription>
		</CardHeader>
		<CardContent class="explorer-content">
			<RepositoryExplorer {repositories} />
		</CardContent>
	</Card>
</div>

<style>
	.page-container {
		padding: 1.5rem;
		max-width: 1400px;
		margin: 0 auto;
	}
	
	:global(.explorer-content) {
		height: 600px;
		padding: 0 !important;
	}
</style>