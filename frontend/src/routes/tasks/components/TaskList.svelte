<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import TaskListItem from './TaskListItem.svelte';
	import type { TaskResponse } from '$lib/types/api';
	
	interface Props {
		tasks: TaskResponse[];
		onTaskClick: (taskId: string) => void;
	}
	
	let { tasks, onTaskClick }: Props = $props();
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>実行中のタスク</Card.Title>
		<Card.Description>
			{tasks.length} 件のタスク
		</Card.Description>
	</Card.Header>
	<Card.Content>
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>ステータス</Table.Head>
					<Table.Head>リポジトリ</Table.Head>
					<Table.Head>指示内容</Table.Head>
					<Table.Head>作成日時</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if tasks && tasks.length > 0}
					{#each tasks as task (task.taskId)}
						<TaskListItem {task} onClick={onTaskClick} />
					{/each}
				{:else}
					<Table.Row>
						<Table.Cell colspan={4} class="text-center text-muted-foreground">
							タスクがありません
						</Table.Cell>
					</Table.Row>
				{/if}
			</Table.Body>
		</Table.Root>
	</Card.Content>
</Card.Root>