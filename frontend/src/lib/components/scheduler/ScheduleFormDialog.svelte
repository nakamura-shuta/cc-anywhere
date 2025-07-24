<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { scheduleService } from '$lib/services/schedule.service';
	import { repositoryService, type Repository } from '$lib/services/repository.service';
	import { createEventDispatcher } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { toDateTimeLocal, fromDateTimeLocal } from '$lib/utils/date';
	import { onMount } from 'svelte';
	
	let { open = $bindable(false) }: { open: boolean } = $props();
	
	const dispatch = createEventDispatcher();
	
	// フォームの状態
	let formData = $state({
		name: '',
		description: '',
		instruction: '',
		workingDirectory: '',
		scheduleType: 'cron' as 'cron' | 'once',
		cronExpression: '0 0 * * *', // デフォルト: 毎日0時
		executeAt: '',
		timezone: 'Asia/Tokyo',
		timeout: 300
	});
	
	let isSubmitting = $state(false);
	let repositories = $state<Repository[]>([]);
	let loadingRepositories = $state(true);
	
	// プリセットCron式
	const cronPresets = [
		{ label: '毎時（0分）', value: '0 * * * *' },
		{ label: '毎日（0時）', value: '0 0 * * *' },
		{ label: '毎週日曜（0時）', value: '0 0 * * 0' },
		{ label: '毎月1日（0時）', value: '0 0 1 * *' },
		{ label: '平日（月-金）9時', value: '0 9 * * 1-5' },
		{ label: '30分ごと', value: '*/30 * * * *' },
		{ label: '6時間ごと', value: '0 */6 * * *' }
	];
	
	// リポジトリ一覧を取得
	onMount(async () => {
		try {
			repositories = await repositoryService.list();
		} catch (err) {
			console.error('Failed to load repositories:', err);
			toast.error('リポジトリの取得に失敗しました');
		} finally {
			loadingRepositories = false;
		}
	});
	
	// ダイアログが開いたときにフォームをリセット
	$effect(() => {
		if (open) {
			formData = {
				name: '',
				description: '',
				instruction: '',
				workingDirectory: '',
				scheduleType: 'cron',
				cronExpression: '0 0 * * *',
				executeAt: '',
				timezone: 'Asia/Tokyo',
				timeout: 300
			};
		}
	});
	
	// Cronプリセットを適用
	function applyCronPreset(value: string) {
		formData.cronExpression = value;
	}
	
	// フォームの送信
	async function handleSubmit(event: Event) {
		event.preventDefault();
		// バリデーション
		if (!formData.name.trim()) {
			toast.error('名前を入力してください');
			return;
		}
		
		if (!formData.instruction.trim()) {
			toast.error('実行する指示を入力してください');
			return;
		}
		
		if (formData.scheduleType === 'cron' && !formData.cronExpression.trim()) {
			toast.error('Cron式を入力してください');
			return;
		}
		
		if (formData.scheduleType === 'once' && !formData.executeAt) {
			toast.error('実行日時を入力してください');
			return;
		}
		
		isSubmitting = true;
		
		try {
			// スケジュール設定の構築
			const schedule: any = {
				type: formData.scheduleType,
				timezone: formData.timezone
			};
			
			if (formData.scheduleType === 'cron') {
				schedule.expression = formData.cronExpression;
			} else {
				schedule.executeAt = fromDateTimeLocal(formData.executeAt);
			}
			
			// タスクリクエストの構築
			const taskRequest: any = {
				instruction: formData.instruction,
				context: {},
				options: {
					timeout: formData.timeout * 1000 // 秒をミリ秒に変換
				}
			};
			
			if (formData.workingDirectory) {
				taskRequest.context.workingDirectory = formData.workingDirectory;
			}
			
			// スケジュールを作成
			const created = await scheduleService.create({
				name: formData.name,
				description: formData.description || undefined,
				taskRequest,
				schedule,
				status: 'active'
			});
			
			// 親コンポーネントに通知
			dispatch('create', created);
			
			// ダイアログを閉じる
			open = false;
		} catch (err) {
			console.error('Failed to create schedule:', err);
			toast.error('スケジュールの作成に失敗しました');
		} finally {
			isSubmitting = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-2xl max-h-[90vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>新規スケジュール作成</Dialog.Title>
			<Dialog.Description>
				定期的に実行するタスクを設定します
			</Dialog.Description>
		</Dialog.Header>
		
		<form onsubmit={handleSubmit} class="space-y-6">
			<!-- 基本情報 -->
			<div class="space-y-4">
				<h3 class="text-sm font-medium">基本情報</h3>
				
				<div class="space-y-2">
					<Label for="name">名前 *</Label>
					<Input
						id="name"
						bind:value={formData.name}
						placeholder="例: DBバックアップ"
						required
					/>
				</div>
				
				<div class="space-y-2">
					<Label for="description">説明</Label>
					<Textarea
						id="description"
						bind:value={formData.description}
						placeholder="このスケジュールの説明（任意）"
						rows={2}
					/>
				</div>
			</div>
			
			<!-- タスク設定 -->
			<div class="space-y-4">
				<h3 class="text-sm font-medium">タスク設定</h3>
				
				<div class="space-y-2">
					<Label for="instruction">実行する指示 *</Label>
					<Textarea
						id="instruction"
						bind:value={formData.instruction}
						placeholder="例: データベースのバックアップを作成して、S3にアップロードしてください"
						rows={3}
						required
					/>
				</div>
				
				<div class="space-y-2">
					<Label for="workingDirectory">作業ディレクトリ（リポジトリ）</Label>
					{#if loadingRepositories}
						<div class="text-sm text-muted-foreground">リポジトリを読み込み中...</div>
					{:else if repositories.length === 0}
						<div class="text-sm text-muted-foreground">利用可能なリポジトリがありません</div>
					{:else}
						<select
							id="workingDirectory"
							bind:value={formData.workingDirectory}
							class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						>
							<option value="">選択してください</option>
							{#each repositories as repo}
								<option value={repo.path}>{repo.name} ({repo.path})</option>
							{/each}
						</select>
					{/if}
					<p class="text-xs text-muted-foreground">
						タスクを実行するリポジトリを選択してください
					</p>
				</div>
			</div>
			
			<!-- スケジュール設定 -->
			<div class="space-y-4">
				<h3 class="text-sm font-medium">スケジュール設定</h3>
				
				<div class="space-y-2">
					<div class="flex items-center space-x-2">
						<input
							type="radio"
							id="cron"
							name="scheduleType"
							value="cron"
							checked={formData.scheduleType === 'cron'}
							onchange={() => formData.scheduleType = 'cron'}
							class="h-4 w-4"
						/>
						<Label for="cron">繰り返し実行（Cron式）</Label>
					</div>
					<div class="flex items-center space-x-2">
						<input
							type="radio"
							id="once"
							name="scheduleType"
							value="once"
							checked={formData.scheduleType === 'once'}
							onchange={() => formData.scheduleType = 'once'}
							class="h-4 w-4"
						/>
						<Label for="once">1回のみ実行</Label>
					</div>
				</div>
				
				{#if formData.scheduleType === 'cron'}
					<div class="space-y-2">
						<Label for="cronExpression">Cron式 *</Label>
						<Input
							id="cronExpression"
							bind:value={formData.cronExpression}
							placeholder="例: 0 0 * * * (毎日0時)"
							required
						/>
						<div class="text-sm text-muted-foreground">
							分 時 日 月 曜日 の形式で指定します
						</div>
						
						<!-- Cronプリセット -->
						<div class="space-y-2">
							<Label>よく使うパターン</Label>
							<div class="flex flex-wrap gap-2">
								{#each cronPresets as preset}
									<Button
										type="button"
										variant="outline"
										size="sm"
										onclick={() => applyCronPreset(preset.value)}
									>
										{preset.label}
									</Button>
								{/each}
							</div>
						</div>
					</div>
				{:else}
					<div class="space-y-2">
						<Label for="executeAt">実行日時 *</Label>
						<Input
							id="executeAt"
							type="datetime-local"
							bind:value={formData.executeAt}
							required
						/>
					</div>
				{/if}
				
				<div class="space-y-2">
					<Label>タイムゾーン</Label>
					<select
						bind:value={formData.timezone}
						class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					>
						<option value="Asia/Tokyo">Asia/Tokyo</option>
						<option value="UTC">UTC</option>
						<option value="America/New_York">America/New_York</option>
						<option value="Europe/London">Europe/London</option>
					</select>
				</div>
			</div>
			
			<!-- 詳細設定 -->
			<div class="space-y-4">
				<h3 class="text-sm font-medium">詳細設定</h3>
				
				<div class="space-y-2">
					<Label for="timeout">タイムアウト（秒）</Label>
					<Input
						id="timeout"
						type="number"
						bind:value={formData.timeout}
						min="1"
						max="3600"
					/>
				</div>
			</div>
			
			<Dialog.Footer>
				<Button
					type="button"
					variant="outline"
					onclick={() => open = false}
					disabled={isSubmitting}
				>
					キャンセル
				</Button>
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? '作成中...' : '作成'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>