<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { ChevronRight, ChevronDown, GitBranch, Circle } from 'lucide-svelte';
	import type { TaskResponse } from '$lib/types/api';
	import TaskTree from './task-tree.svelte';
	import { formatDate } from '$lib/utils/date';
	import { getStatusVariant } from '$lib/utils/task';
	
	interface TaskNode extends TaskResponse {
		children?: TaskNode[];
	}
	
	interface Props {
		task: TaskNode;
		allTasks: TaskResponse[];
		depth?: number;
	}
	
	let { task, allTasks, depth = 0 }: Props = $props();
	
	// 現在のタスクの子タスクを検索
	let children = $derived(
		allTasks.filter(t => t.continuedFrom === task.taskId || t.parentTaskId === task.taskId)
	);
	
	// ツリーノードを構築
	let taskNode = $derived({
		...task,
		children: children.map(child => ({
			...child,
			children: allTasks.filter(t => t.continuedFrom === child.taskId || t.parentTaskId === child.taskId)
		}))
	});
	
	// 折りたたみ状態
	let isOpen = $state(depth < 2); // 深さ2まではデフォルトで開く
	
	// タスク詳細へ遷移
	function viewTask(taskId: string) {
		window.location.href = `/tasks/${taskId}`;
	}
</script>

<div class="relative">
	{#if depth > 0}
		<!-- 親タスクからの接続線 -->
		<div class="absolute left-0 top-0 w-6 h-6 border-l-2 border-b-2 border-muted-foreground/30 rounded-bl-lg" 
			style="margin-left: {(depth - 1) * 1.5}rem; margin-top: -0.75rem;">
		</div>
	{/if}
	
	<div style="margin-left: {depth * 1.5}rem;">
		{#if taskNode.children && taskNode.children.length > 0}
			<Collapsible.Root bind:open={isOpen}>
				<div class="flex items-start gap-2">
					<!-- 展開/折りたたみボタン -->
					<Collapsible.Trigger>
						<Button 
							variant="ghost" 
							size="icon" 
							class="h-6 w-6 p-0"
						>
							{#if isOpen}
								<ChevronDown class="h-4 w-4" />
							{:else}
								<ChevronRight class="h-4 w-4" />
							{/if}
						</Button>
					</Collapsible.Trigger>
					
					<!-- タスク情報 -->
					<button
						type="button" 
						class="flex-1 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer text-left"
						onclick={() => viewTask(task.taskId)}
					>
						<div class="flex items-start justify-between">
							<div class="flex-1 space-y-1">
								<div class="flex items-center gap-2">
									<Badge variant={getStatusVariant(task.status)}>
										{task.status}
									</Badge>
									<span class="text-xs text-muted-foreground">
										{formatDate(task.createdAt, 'full')}
									</span>
									{#if taskNode.children.length > 0}
										<div class="flex items-center gap-1 text-xs text-muted-foreground">
											<GitBranch class="h-3 w-3" />
											<span>{taskNode.children.length} 継続</span>
										</div>
									{/if}
								</div>
								<p class="text-sm line-clamp-2">{task.instruction}</p>
							</div>
						</div>
					</button>
				</div>
				
				<!-- 子タスク -->
				<Collapsible.Content>
					<div class="mt-3 space-y-3 relative">
						{#if depth < 5} <!-- 最大深さ5まで表示 -->
							{#each taskNode.children as child, index}
								<div class="relative">
									{#if index < taskNode.children.length - 1}
										<!-- 縦の接続線 -->
										<div class="absolute left-0 top-6 bottom-0 w-px bg-muted-foreground/30"
											style="margin-left: 0.75rem;">
										</div>
									{/if}
									<TaskTree 
										task={child} 
										allTasks={allTasks} 
										depth={depth + 1} 
									/>
								</div>
							{/each}
						{:else}
							<p class="text-sm text-muted-foreground ml-6">
								さらに {taskNode.children.length} 件の継続タスク...
							</p>
						{/if}
					</div>
				</Collapsible.Content>
			</Collapsible.Root>
		{:else}
			<!-- 子タスクがない場合 -->
			<div class="flex items-start gap-2">
				<div class="h-6 w-6 flex items-center justify-center">
					<Circle class="h-2 w-2 fill-current text-muted-foreground" />
				</div>
				<button
					type="button" 
					class="flex-1 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer text-left"
					onclick={() => viewTask(task.taskId)}
				>
					<div class="flex items-start justify-between">
						<div class="flex-1 space-y-1">
							<div class="flex items-center gap-2">
								<Badge variant={getStatusVariant(task.status)}>
									{task.status}
								</Badge>
								<span class="text-xs text-muted-foreground">
									{formatDate(task.createdAt, 'full')}
								</span>
							</div>
							<p class="text-sm line-clamp-2">{task.instruction}</p>
						</div>
					</div>
				</button>
			</div>
		{/if}
	</div>
</div>