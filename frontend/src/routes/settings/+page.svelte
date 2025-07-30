<script lang="ts">
	import { onMount } from 'svelte';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { settingsService } from '$lib/services/settings.service';
	import type { Settings } from '$lib/services/settings.service';

	let settings: Settings | null = null;
	let selectedMode: string = '';
	let loading = false;
	let error: string | null = null;
	let successMessage: string | null = null;

	onMount(async () => {
		await loadSettings();
	});

	async function loadSettings() {
		try {
			loading = true;
			settings = await settingsService.getSettings();
			selectedMode = settings.executionMode;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load settings';
		} finally {
			loading = false;
		}
	}

	async function saveSettings() {
		try {
			loading = true;
			error = null;
			successMessage = null;
			
			const updated = await settingsService.updateSettings({
				executionMode: selectedMode as 'api-key' | 'bedrock'
			});
			
			settings = updated;
			successMessage = 'Settings saved successfully';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save settings';
		} finally {
			loading = false;
		}
	}

	function getModeDescription(mode: string): string {
		switch (mode) {
			case 'api-key':
				return 'Direct connection to Anthropic API (faster, requires API key)';
			case 'bedrock':
				return 'AWS Bedrock (enterprise, requires AWS credentials, us-east-1 only)';
			default:
				return '';
		}
	}
</script>

<svelte:head>
	<title>Settings | CC-Anywhere</title>
</svelte:head>

<div class="container mx-auto py-8">
	<h1 class="text-3xl font-bold mb-8">Settings</h1>

	{#if loading && !settings}
		<div class="text-center">Loading settings...</div>
	{:else if settings}
		<Card>
			<CardHeader>
				<CardTitle>Claude Code Execution Mode</CardTitle>
				<CardDescription>
					Choose how Claude Code SDK connects to the AI service
				</CardDescription>
			</CardHeader>
			<CardContent class="space-y-6">
				{#if error}
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				{/if}
				
				{#if successMessage}
					<Alert>
						<AlertDescription>{successMessage}</AlertDescription>
					</Alert>
				{/if}

				<div class="space-y-4">
					<RadioGroup bind:value={selectedMode}>
						<div class="flex items-start space-x-3 p-4 border rounded-lg {selectedMode === 'api-key' ? 'bg-muted' : ''}">
							<RadioGroupItem value="api-key" id="api-key" 
											disabled={!settings.availableModes.includes('api-key')} />
							<div class="flex-1">
								<Label for="api-key" class="text-base font-medium cursor-pointer">
									API Key Mode
									{#if settings.executionMode === 'api-key'}
										<Badge class="ml-2">Current</Badge>
									{/if}
									{#if !settings.credentials.apiKey}
										<Badge variant="secondary" class="ml-2">Not configured</Badge>
									{/if}
								</Label>
								<p class="text-sm text-muted-foreground mt-1">
									{getModeDescription('api-key')}
								</p>
							</div>
						</div>

						<div class="flex items-start space-x-3 p-4 border rounded-lg {selectedMode === 'bedrock' ? 'bg-muted' : ''}">
							<RadioGroupItem value="bedrock" id="bedrock" 
											disabled={!settings.availableModes.includes('bedrock')} />
							<div class="flex-1">
								<Label for="bedrock" class="text-base font-medium cursor-pointer">
									Amazon Bedrock
									{#if settings.executionMode === 'bedrock'}
										<Badge class="ml-2">Current</Badge>
									{/if}
									{#if !settings.credentials.bedrock}
										<Badge variant="secondary" class="ml-2">Not configured</Badge>
									{/if}
								</Label>
								<p class="text-sm text-muted-foreground mt-1">
									{getModeDescription('bedrock')}
								</p>
							</div>
						</div>
					</RadioGroup>
				</div>

				<div class="pt-4">
					<Button 
						onclick={saveSettings} 
						disabled={loading || selectedMode === settings.executionMode}
					>
						Save Settings
					</Button>
				</div>

				<div class="pt-6 border-t">
					<h3 class="text-sm font-medium mb-3">Configuration Status</h3>
					<div class="space-y-2 text-sm">
						<div class="flex justify-between">
							<span>API Key:</span>
							<Badge variant={settings.credentials.apiKey ? 'default' : 'secondary'}>
								{settings.credentials.apiKey ? 'Configured' : 'Not configured'}
							</Badge>
						</div>
						<div class="flex justify-between">
							<span>AWS Credentials:</span>
							<Badge variant={settings.credentials.bedrock ? 'default' : 'secondary'}>
								{settings.credentials.bedrock ? 'Configured' : 'Not configured'}
							</Badge>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	{/if}
</div>

