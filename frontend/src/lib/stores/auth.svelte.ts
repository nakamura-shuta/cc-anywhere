import { browser } from '$app/environment';
import { goto } from '$app/navigation';

const AUTH_TOKEN_KEY = 'cc-anywhere-auth-token';
const AUTH_TOKEN_EXPIRY_KEY = 'cc-anywhere-auth-expiry';

class AuthStore {
	private authenticated = $state(false);
	private token = $state<string | null>(null);
	private loading = $state(true);
	
	constructor() {
		if (browser) {
			this.initialize();
		}
	}
	
	private initialize() {
		// localStorageから既存トークンを復元
		const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
		const savedExpiry = localStorage.getItem(AUTH_TOKEN_EXPIRY_KEY);
		
		if (savedToken && savedExpiry) {
			const expiryTime = parseInt(savedExpiry, 10);
			if (Date.now() < expiryTime) {
				this.token = savedToken;
				this.authenticated = true;
			} else {
				// 期限切れの場合はクリア
				this.clearAuth();
			}
		}
		
		this.loading = false;
	}
	
	async checkAuth(): Promise<{ enabled: boolean; requiresAuth: boolean }> {
		try {
			const response = await fetch('/api/auth/status');
			if (!response.ok) {
				throw new Error('Failed to check auth status');
			}
			return await response.json();
		} catch (error) {
			console.error('Failed to check auth status:', error);
			return { enabled: false, requiresAuth: false };
		}
	}
	
	async authenticate(token: string): Promise<boolean> {
		try {
			const response = await fetch(`/api/auth/verify?auth_token=${token}`);
			if (!response.ok) {
				throw new Error('Authentication failed');
			}
			
			const result = await response.json();
			if (result.valid) {
				this.token = token;
				this.authenticated = true;
				
				// トークンを保存（24時間有効）
				const expiryTime = Date.now() + (24 * 60 * 60 * 1000);
				localStorage.setItem(AUTH_TOKEN_KEY, token);
				localStorage.setItem(AUTH_TOKEN_EXPIRY_KEY, expiryTime.toString());
				
				return true;
			}
			
			return false;
		} catch (error) {
			console.error('Authentication error:', error);
			return false;
		}
	}
	
	getAuthHeaders(): Record<string, string> {
		if (this.token) {
			return { 'X-Auth-Token': this.token };
		}
		return {};
	}
	
	clearAuth() {
		this.token = null;
		this.authenticated = false;
		localStorage.removeItem(AUTH_TOKEN_KEY);
		localStorage.removeItem(AUTH_TOKEN_EXPIRY_KEY);
	}
	
	async logout() {
		this.clearAuth();
		await goto('/auth/error');
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
}

// シングルトンインスタンス
export const authStore = new AuthStore();