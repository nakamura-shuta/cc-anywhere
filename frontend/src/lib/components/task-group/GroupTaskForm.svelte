<script lang="ts" module>
	// Exported types for external use
	export interface TaskDefinition {
		id: string;
		name: string;
		instruction: string;
		dependencies: string[];
	}

	export interface GroupTaskSubmitData {
		name: string;
		tasks: TaskDefinition[];
		execution: {
			mode: 'sequential' | 'parallel' | 'mixed';
			continueSession: boolean;
			continueOnError?: boolean;
		};
		context?: {
			workingDirectory?: string;
		};
	}
</script>

<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import RadioGroup from '$lib/components/ui/radio-group/radio-group.svelte';
	import RadioGroupItem from '$lib/components/ui/radio-group/radio-group-item.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Trash2, Plus, AlertCircle, ChevronDown, ChevronUp } from 'lucide-svelte';
	
	interface Props {
		onSubmit: (data: GroupTaskSubmitData) => void | Promise<void>;
		workingDirectory?: string;
		submitting?: boolean;
	}
	
	let { onSubmit, workingDirectory, submitting = false }: Props = $props();
	
	// Form state
	let groupName = $state('');
	let tasks = $state<TaskDefinition[]>([
		{ id: 'task-1', name: '', instruction: '', dependencies: [] }
	]);
	let executionMode = $state<'sequential' | 'parallel' | 'mixed'>('sequential');
	let continueOnError = $state(false);
	let validationErrors = $state<string[]>([]);
	let expandedTasks = $state<Set<string>>(new Set(['task-1']));
	
	// Generate unique task ID
	function generateTaskId(): string {
		return `task-${tasks.length + 1}`;
	}
	
	// Add new task
	function addTask() {
		const newTaskId = generateTaskId();
		tasks = [...tasks, {
			id: newTaskId,
			name: '',
			instruction: '',
			dependencies: []
		}];
		expandedTasks.add(newTaskId);
	}
	
	// Remove task
	function removeTask(taskId: string) {
		// Remove the task
		tasks = tasks.filter(t => t.id !== taskId);
		
		// Remove this task from other tasks' dependencies
		tasks = tasks.map(t => ({
			...t,
			dependencies: t.dependencies.filter(dep => dep !== taskId)
		}));
		
		// Remove from expanded set
		expandedTasks.delete(taskId);
	}
	
	// Toggle task expansion
	function toggleTaskExpansion(taskId: string) {
		const newExpandedTasks = new Set(expandedTasks);
		if (newExpandedTasks.has(taskId)) {
			newExpandedTasks.delete(taskId);
		} else {
			newExpandedTasks.add(taskId);
		}
		expandedTasks = newExpandedTasks; // Trigger reactivity
	}
	
	// Get available dependencies for a task (all tasks before it)
	function getAvailableDependencies(taskId: string): TaskDefinition[] {
		const taskIndex = tasks.findIndex(t => t.id === taskId);
		return tasks.filter((_, index) => index < taskIndex);
	}
	
	// Check for circular dependencies
	function hasCircularDependency(taskId: string, dependencies: string[], visited = new Set<string>()): boolean {
		if (visited.has(taskId)) return true;
		visited.add(taskId);
		
		for (const dep of dependencies) {
			const depTask = tasks.find(t => t.id === dep);
			if (depTask && hasCircularDependency(dep, depTask.dependencies, new Set(visited))) {
				return true;
			}
		}
		
		return false;
	}
	
	// Validate form
	function validateForm(): boolean {
		const errors: string[] = [];
		
		if (!groupName.trim()) {
			errors.push('グループ名を入力してください');
		}
		
		if (tasks.length === 0) {
			errors.push('少なくとも1つのタスクが必要です');
		}
		
		// Validate each task
		tasks.forEach((task, index) => {
			if (!task.name.trim()) {
				errors.push(`タスク${index + 1}の名前を入力してください`);
			}
			if (!task.instruction.trim()) {
				errors.push(`タスク${index + 1}の指示内容を入力してください`);
			}
			
			// Check for circular dependencies
			if (hasCircularDependency(task.id, task.dependencies)) {
				errors.push(`タスク${index + 1}に循環参照があります`);
			}
		});
		
		validationErrors = errors;
		return errors.length === 0;
	}
	
	// Determine execution mode based on dependencies
	function determineExecutionMode(): 'sequential' | 'parallel' | 'mixed' {
		if (executionMode !== 'sequential') {
			return executionMode;
		}
		
		// Auto-detect mode based on dependencies
		const hasDependencies = tasks.some(t => t.dependencies.length > 0);
		if (!hasDependencies) {
			return tasks.length > 1 ? 'parallel' : 'sequential';
		}
		
		// If there are dependencies, it's either sequential or mixed
		// Check if any stage has multiple tasks (mixed mode)
		const stages = buildExecutionStages();
		const hasParallelStage = stages.some(stage => stage.length > 1);
		
		return hasParallelStage ? 'mixed' : 'sequential';
	}
	
	// Build execution stages for visualization
	function buildExecutionStages(): string[][] {
		const stages: string[][] = [];
		const executed = new Set<string>();
		
		while (executed.size < tasks.length) {
			const stage = tasks.filter(task => {
				if (executed.has(task.id)) return false;
				return task.dependencies.every(dep => executed.has(dep));
			}).map(t => t.id);
			
			if (stage.length === 0) break; // Prevent infinite loop
			
			stages.push(stage);
			stage.forEach(id => executed.add(id));
		}
		
		return stages;
	}
	
	// Handle form submission
	async function handleSubmit() {
		if (!validateForm()) {
			return;
		}
		
		const submitData: GroupTaskSubmitData = {
			name: groupName.trim(),
			tasks: tasks.map(t => ({
				id: t.id,
				name: t.name.trim(),
				instruction: t.instruction.trim(),
				dependencies: t.dependencies
			})),
			execution: {
				mode: determineExecutionMode(),
				continueSession: true,
				continueOnError
			}
		};
		
		if (workingDirectory) {
			submitData.context = { workingDirectory };
		}
		
		await onSubmit(submitData);
	}
	
	// Update task
	function updateTask(taskId: string, field: keyof TaskDefinition, value: any) {
		tasks = tasks.map(t => 
			t.id === taskId ? { ...t, [field]: value } : t
		);
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>グループタスク設定</Card.Title>
		<Card.Description>
			複数のタスクをグループ化して実行します。依存関係を設定すると、適切な順序で実行されます。
		</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-6">
		<!-- Group Name -->
		<div class="space-y-2">
			<Label for="group-name" class="required">グループ名</Label>
			<Input
				id="group-name"
				bind:value={groupName}
				placeholder="例: CI/CDパイプライン"
				disabled={submitting}
			/>
		</div>
		
		<!-- Tasks -->
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<Label>タスク一覧</Label>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onclick={addTask}
					disabled={submitting}
					class="gap-2"
				>
					<Plus class="h-4 w-4" />
					タスクを追加
				</Button>
			</div>
			
			{#each tasks as task, index (task.id)}
				<Card.Root data-testid="task-card" class="relative">
					<Card.Header class="pb-3">
						<div class="flex items-center justify-between">
							<button
								type="button"
								onclick={() => toggleTaskExpansion(task.id)}
								class="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
							>
								{#if expandedTasks.has(task.id)}
									<ChevronUp class="h-4 w-4" />
								{:else}
									<ChevronDown class="h-4 w-4" />
								{/if}
								<span class="font-semibold">タスク {index + 1}</span>
								{#if task.name}
									<span class="text-muted-foreground">- {task.name}</span>
								{/if}
							</button>
							{#if tasks.length > 1}
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onclick={() => removeTask(task.id)}
									disabled={submitting}
									data-testid="remove-task-button"
								>
									<Trash2 class="h-4 w-4" />
								</Button>
							{/if}
						</div>
					</Card.Header>
					
					{#if expandedTasks.has(task.id)}
						<Card.Content class="space-y-4 pt-0">
							<!-- Task Name -->
							<div class="space-y-2">
								<Label for={`task-name-${index}`}>タスク名</Label>
								<Input
									id={`task-name-${index}`}
									data-testid={`task-name-${index}`}
									value={task.name}
									oninput={(e) => updateTask(task.id, 'name', e.currentTarget.value)}
									placeholder="例: テスト実行"
									disabled={submitting}
								/>
							</div>
							
							<!-- Task Instruction -->
							<div class="space-y-2">
								<Label for={`task-instruction-${index}`}>指示内容</Label>
								<Textarea
									id={`task-instruction-${index}`}
									data-testid={`task-instruction-${index}`}
									value={task.instruction}
									oninput={(e) => updateTask(task.id, 'instruction', e.currentTarget.value)}
									placeholder="例: npm test を実行してください"
									rows={3}
									disabled={submitting}
								/>
							</div>
							
							<!-- Dependencies -->
							{#if index > 0}
								<div class="space-y-2">
									<Label for={`task-deps-${index}`}>依存タスク（任意）</Label>
									<Select.Root
										type="single"
										value={task.dependencies[0] || 'none'}
										onValueChange={(value) => {
											if (value) {
												const deps = value === 'none' ? [] : [value];
												updateTask(task.id, 'dependencies', deps);
											}
										}}
									>
										<Select.Trigger
											id={`task-deps-${index}`}
											data-testid="dependency-select"
											disabled={submitting}
										>
											{task.dependencies.length > 0 
												? getAvailableDependencies(task.id).find(d => d.id === task.dependencies[0])?.name || '依存関係なし' 
												: '依存関係なし'}
										</Select.Trigger>
										<Select.Content>
											<Select.Item value="none">依存関係なし</Select.Item>
											{#each getAvailableDependencies(task.id) as depTask}
												<Select.Item value={depTask.id}>
													{depTask.name || `タスク ${tasks.indexOf(depTask) + 1}`}
												</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>
									{#if task.dependencies.length > 0}
										<p class="text-sm text-muted-foreground">
											依存: {task.dependencies.map(depId => {
												const depTask = tasks.find(t => t.id === depId);
												const depIndex = tasks.indexOf(depTask!);
												return depTask?.name || `タスク ${depIndex + 1}`;
											}).join(', ')}
										</p>
									{/if}
								</div>
							{/if}
						</Card.Content>
					{/if}
				</Card.Root>
			{/each}
		</div>
		
		<!-- Execution Mode -->
		<div class="space-y-2">
			<Label>実行モード</Label>
			<RadioGroup bind:value={executionMode}>
				<div class="flex items-center space-x-2">
					<RadioGroupItem value="sequential" id="mode-sequential" />
					<Label for="mode-sequential" class="font-normal cursor-pointer">
						順次実行（依存関係に従う）
					</Label>
				</div>
				<div class="flex items-center space-x-2">
					<RadioGroupItem value="parallel" id="mode-parallel" />
					<Label for="mode-parallel" class="font-normal cursor-pointer">
						並列実行（すべて同時実行）
					</Label>
				</div>
				<div class="flex items-center space-x-2">
					<RadioGroupItem value="mixed" id="mode-mixed" />
					<Label for="mode-mixed" class="font-normal cursor-pointer">
						混合実行（依存関係を自動解析）
					</Label>
				</div>
			</RadioGroup>
		</div>
		
		<!-- Continue on Error -->
		<div class="flex items-center space-x-2">
			<input
				type="checkbox"
				id="continue-on-error"
				bind:checked={continueOnError}
				disabled={submitting}
				class="h-4 w-4"
			/>
			<Label for="continue-on-error" class="font-normal cursor-pointer">
				エラーが発生しても続行する
			</Label>
		</div>
		
		<!-- Validation Errors -->
		{#if validationErrors.length > 0}
			<Alert.Root variant="destructive">
				<AlertCircle class="h-4 w-4" />
				<Alert.Title>入力エラー</Alert.Title>
				<Alert.Description>
					<ul class="list-disc list-inside space-y-1">
						{#each validationErrors as error}
							<li>{error}</li>
						{/each}
					</ul>
				</Alert.Description>
			</Alert.Root>
		{/if}
		
		<!-- Execution Preview -->
		{#if tasks.some(t => t.dependencies.length > 0)}
			<div class="p-4 bg-muted rounded-lg space-y-2">
				<p class="text-sm font-semibold">実行順序プレビュー:</p>
				<div class="text-sm text-muted-foreground">
					{#each buildExecutionStages() as stage, stageIndex}
						{#if stageIndex > 0}
							<span class="mx-2">→</span>
						{/if}
						{#if stage.length > 1}
							<span>[</span>
						{/if}
						{#each stage as taskId, taskIdx}
							{#if taskIdx > 0}
								<span>, </span>
							{/if}
							<span>
								{tasks.find(t => t.id === taskId)?.name || `タスク ${tasks.findIndex(t => t.id === taskId) + 1}`}
							</span>
						{/each}
						{#if stage.length > 1}
							<span>]</span>
						{/if}
					{/each}
				</div>
			</div>
		{/if}
	</Card.Content>
	<Card.Footer>
		<Button
			onclick={handleSubmit}
			disabled={submitting}
			class="w-full"
		>
			{submitting ? '実行中...' : 'グループタスクを実行'}
		</Button>
	</Card.Footer>
</Card.Root>