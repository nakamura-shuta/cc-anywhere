<!-- テスト用のコンポーネント -->
<script lang="ts">
	interface Task {
		id: string;
		title: string;
		status?: string;
	}
	
	interface Props {
		store: {
			tasks: Task[];
			loading: boolean;
			error: Error | null;
			taskCount: number;
			activeTasks: Task[];
			addTask: (task: Task) => void;
		};
	}
	
	let { store }: Props = $props();
</script>

<div>
	<p>Tasks: {store.taskCount}</p>
	<p>Active: {store.activeTasks.length}</p>
	
	{#if store.loading}
		<p>Loading...</p>
	{/if}
	
	{#if store.error}
		<p>Error: {store.error.message}</p>
	{/if}
	
	{#each store.tasks as task}
		<div>{task.title}</div>
	{/each}
</div>