<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	
	let apiResult = $state('');
	let error = $state('');
	
	async function testApi() {
		error = '';
		apiResult = 'Testing API...';
		
		try {
			// 直接APIをfetch
			const response = await fetch('http://localhost:5000/api/tasks', {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});
			
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			
			const data = await response.json();
			apiResult = JSON.stringify(data, null, 2);
		} catch (err) {
			console.error('API test failed:', err);
			error = err instanceof Error ? err.message : 'Unknown error';
			apiResult = 'API test failed';
		}
	}
	
	onMount(() => {
		testApi();
	});
</script>

<div class="p-4 space-y-4">
	<h1 class="text-2xl font-bold">API Test Page</h1>
	
	<Button onclick={testApi}>Test API Again</Button>
	
	{#if error}
		<div class="p-4 bg-red-100 text-red-700 rounded">
			Error: {error}
		</div>
	{/if}
	
	<div class="p-4 bg-gray-100 rounded">
		<pre class="whitespace-pre-wrap">{apiResult}</pre>
	</div>
</div>