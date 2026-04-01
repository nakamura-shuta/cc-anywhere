import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { getApiBaseUrl } from '$lib/config';

const AUTH_TOKEN_KEY = 'cc-anywhere-api-key';

export interface AuthUser {
	id: string;
	username: string;
	displayName?: string;
	avatarUrl?: string;
	authProvider?: string;
}

class AuthStore {
	private authenticated = $state(false);
	private token = $state<string | null>(null);
	private loading = $state(true);
	user = $state<AuthUser | null>(null);

	private initPromise: Promise<void> | null = null;

	constructor() {
		if (browser) {
			this.initPromise = this.initialize();
		}
	}

	async waitForInit(): Promise<void> {
		if (this.initPromise) await this.initPromise;
	}

	private async initialize(): Promise<void> {
		let savedToken: string | null = null;

		try {
			savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
		} catch { /* ignore */ }

		if (savedToken) {
			// Verify token and load user info
			const success = await this.loginWithKey(savedToken);
			if (!success) {
				this.clearAuth();
			}
		}

		this.loading = false;
	}

	async checkAuth(): Promise<{ enabled: boolean; requiresAuth: boolean; hasRegisteredUsers?: boolean }> {
		try {
			const baseUrl = getApiBaseUrl();
			const response = await fetch(`${baseUrl}/api/auth/status`);
			if (!response.ok) return { enabled: false, requiresAuth: false };
			return response.json();
		} catch {
			return { enabled: false, requiresAuth: false };
		}
	}

	async register(username: string): Promise<{ success: boolean; apiKey?: string; error?: string }> {
		try {
			const baseUrl = getApiBaseUrl();
			const response = await fetch(`${baseUrl}/api/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username }),
			});

			if (!response.ok) {
				const err = await response.json().catch(() => ({ error: 'Registration failed' }));
				return { success: false, error: err.error };
			}

			const data = await response.json();
			// Auto-login after registration
			this.token = data.apiKey;
			this.user = data.user;
			this.authenticated = true;
			this.saveToken(data.apiKey);

			return { success: true, apiKey: data.apiKey };
		} catch (error) {
			return { success: false, error: 'Registration failed' };
		}
	}

	async loginWithKey(apiKey: string): Promise<boolean> {
		try {
			const baseUrl = getApiBaseUrl();
			const response = await fetch(`${baseUrl}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ apiKey }),
			});

			if (!response.ok) return false;

			const data = await response.json();
			this.token = apiKey;
			this.user = data.user;
			this.authenticated = true;
			this.saveToken(apiKey);
			return true;
		} catch {
			return false;
		}
	}

	/** Legacy: authenticate with .env admin key */
	async authenticate(token: string): Promise<boolean> {
		// Try user login first
		const userLogin = await this.loginWithKey(token);
		if (userLogin) return true;

		// Fallback to verify endpoint (admin key)
		try {
			const baseUrl = getApiBaseUrl();
			const response = await fetch(`${baseUrl}/api/auth/verify?api_key=${token}`);
			if (!response.ok) return false;

			const result = await response.json();
			if (result.valid) {
				this.token = token;
				this.user = result.user || { id: 'admin', username: 'admin' };
				this.authenticated = true;
				this.saveToken(token);
				return true;
			}
			return false;
		} catch {
			return false;
		}
	}

	getAuthHeaders(): Record<string, string> {
		if (this.token) {
			return { 'X-API-Key': this.token };
		}
		return {};
	}

	clearAuth() {
		this.token = null;
		this.user = null;
		this.authenticated = false;
		try { localStorage.removeItem(AUTH_TOKEN_KEY); } catch { /* ignore */ }
	}

	async logout() {
		this.clearAuth();
		await goto('/auth');
	}

	get isAuthenticated() {
		return this.authenticated;
	}

	get isLoading() {
		return this.loading;
	}

	get authToken() {
		return this.token;
	}

	private saveToken(token: string) {
		try { localStorage.setItem(AUTH_TOKEN_KEY, token); } catch { /* ignore */ }
	}
}

export const authStore = new AuthStore();
