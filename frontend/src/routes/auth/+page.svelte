<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';

	let mode = $state<'choose' | 'register' | 'login' | 'registered'>('choose');
	let username = $state('');
	let apiKeyInput = $state('');
	let newApiKey = $state('');
	let error = $state('');
	let loading = $state(false);
	let copied = $state(false);

	onMount(async () => {
		// Already authenticated → go to chat
		if (authStore.isAuthenticated) {
			await goto('/chat');
			return;
		}

		// Check if auth is required
		const status = await authStore.checkAuth();
		if (!status.enabled && !status.requiresAuth) {
			await goto('/chat');
		}
	});

	async function handleRegister() {
		if (!username.trim() || username.trim().length < 2) {
			error = 'Username must be at least 2 characters';
			return;
		}

		loading = true;
		error = '';

		const result = await authStore.register(username.trim());
		if (result.success && result.apiKey) {
			newApiKey = result.apiKey;
			mode = 'registered';
		} else {
			error = result.error || 'Registration failed';
		}

		loading = false;
	}

	async function handleLogin() {
		if (!apiKeyInput.trim()) {
			error = 'API Key is required';
			return;
		}

		loading = true;
		error = '';

		const success = await authStore.loginWithKey(apiKeyInput.trim());
		if (success) {
			await goto('/chat');
		} else {
			// Try legacy admin key
			const adminSuccess = await authStore.authenticate(apiKeyInput.trim());
			if (adminSuccess) {
				await goto('/chat');
			} else {
				error = 'Invalid API Key';
			}
		}

		loading = false;
	}

	async function handleCopy() {
		await navigator.clipboard.writeText(newApiKey);
		copied = true;
		setTimeout(() => copied = false, 2000);
	}

	async function handleGoToChat() {
		await goto('/chat');
	}
</script>

<div class="flex min-h-screen items-center justify-center p-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="text-center">
			<Card.Title class="text-2xl">CC-Anywhere</Card.Title>
			<Card.Description>
				{#if mode === 'registered'}
					Registration complete
				{:else}
					Sign in or create an account
				{/if}
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if mode === 'registered'}
				<!-- Registration success -->
				<div class="rounded-lg bg-green-50 p-4 text-center dark:bg-green-950">
					<p class="mb-2 text-sm font-medium text-green-800 dark:text-green-200">
						Welcome, {authStore.user?.username}!
					</p>
					<p class="mb-3 text-xs text-green-600 dark:text-green-400">
						Save your API Key. It will not be shown again.
					</p>
					<div class="flex items-center gap-2 rounded bg-white p-2 font-mono text-xs dark:bg-gray-900">
						<span class="flex-1 overflow-x-auto whitespace-nowrap">{newApiKey}</span>
						<Button size="sm" variant="outline" onclick={handleCopy}>
							{copied ? 'Copied!' : 'Copy'}
						</Button>
					</div>
				</div>
				<Button class="w-full" onclick={handleGoToChat}>
					Start chatting
				</Button>

			{:else if mode === 'register'}
				<!-- Register form -->
				<div>
					<label class="mb-1 block text-sm font-medium" for="username">Username</label>
					<input
						id="username"
						type="text"
						class="w-full rounded-md border bg-background px-3 py-2 text-sm"
						placeholder="Choose a username"
						bind:value={username}
						onkeydown={(e) => e.key === 'Enter' && handleRegister()}
					/>
				</div>
				{#if error}
					<p class="text-sm text-red-500">{error}</p>
				{/if}
				<Button class="w-full" onclick={handleRegister} disabled={loading}>
					{loading ? 'Registering...' : 'Register'}
				</Button>
				<button class="w-full text-center text-sm text-muted-foreground" onclick={() => { mode = 'choose'; error = ''; }}>
					Back
				</button>

			{:else if mode === 'login'}
				<!-- Login form -->
				<div>
					<label class="mb-1 block text-sm font-medium" for="apikey">API Key</label>
					<input
						id="apikey"
						type="password"
						class="w-full rounded-md border bg-background px-3 py-2 text-sm"
						placeholder="Enter your API Key"
						bind:value={apiKeyInput}
						onkeydown={(e) => e.key === 'Enter' && handleLogin()}
					/>
				</div>
				{#if error}
					<p class="text-sm text-red-500">{error}</p>
				{/if}
				<Button class="w-full" onclick={handleLogin} disabled={loading}>
					{loading ? 'Logging in...' : 'Login'}
				</Button>
				<button class="w-full text-center text-sm text-muted-foreground" onclick={() => { mode = 'choose'; error = ''; }}>
					Back
				</button>

			{:else}
				<!-- Choose mode -->
				<Button class="w-full" onclick={() => mode = 'register'}>
					Create new account
				</Button>
				<Button class="w-full" variant="outline" onclick={() => mode = 'login'}>
					Login with API Key
				</Button>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
