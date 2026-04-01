import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { authStore } from '$lib/stores/auth.svelte';
import { browser } from '$app/environment';

export const prerender = false;
export const ssr = false;
export const csr = true;

export const load: LayoutLoad = async ({ url }) => {
	if (!browser) return {};

	// Auth page and root are always accessible
	if (url.pathname === '/auth' || url.pathname === '/auth/error' || url.pathname === '/') {
		return {};
	}

	// Wait for auth store initialization
	await authStore.waitForInit();

	// Check auth status from server
	const authStatus = await authStore.checkAuth();

	// Auth not required (no admin key and no registered users)
	if (!authStatus.enabled && !authStatus.requiresAuth) {
		return {};
	}

	// URL has api_key param → try to authenticate
	const token = url.searchParams.get('api_key');
	if (token) {
		const success = await authStore.authenticate(token);
		if (success) {
			const cleanUrl = new URL(url);
			cleanUrl.searchParams.delete('api_key');
			throw redirect(307, cleanUrl.pathname + cleanUrl.search);
		}
	}

	// Not authenticated → redirect to /auth
	if (!authStore.isAuthenticated) {
		throw redirect(307, '/auth');
	}

	return {};
};
