<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import TaskListItem from './TaskListItem.svelte';
	import TaskCard from './TaskCard.svelte';
	import type { TaskResponse } from '$lib/types/api';
	
	interface Props {
		tasks: TaskResponse[];
		onTaskClick: (taskId: string) => void;
	}
	
	let { tasks, onTaskClick }: Props = $props();
</script>

<!-- デスクトップ用のテーブル表示 -->
<div class="hidden lg:block">
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
</div>

<!-- モバイル・タブレット用のカード表示 -->
<div class="lg:hidden">
	<div class="space-y-4">
		<div>
			<h3 class="text-lg font-semibold">実行中のタスク</h3>
			<p class="text-sm text-muted-foreground">{tasks.length} 件のタスク</p>
		</div>
		
		{#if tasks && tasks.length > 0}
			<div class="space-y-3">
				{#each tasks as task (task.taskId)}
					<TaskCard {task} onClick={onTaskClick} />
				{/each}
			</div>
		{:else}
			<Card.Root>
				<Card.Content class="text-center text-muted-foreground py-8">
					タスクがありません
				</Card.Content>
			</Card.Root>
		{/if}
	</div>
</div>