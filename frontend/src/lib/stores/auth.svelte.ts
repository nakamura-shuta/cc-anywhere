import { browser } from '$app/environment';
import { goto } from '$app/navigation';

const AUTH_TOKEN_KEY = 'cc-anywhere-api-key';
const AUTH_TOKEN_EXPIRY_KEY = 'cc-anywhere-api-key-expiry';

class AuthStore {
	private authenticated = $state(false);
	private token = $state<string | null>(null);
	private loading = $state(true);
	private initPromise: Promise<void> | null = null;
	
	constructor() {
		if (browser) {
			this.initPromise = this.initialize();
		}
	}
	
	private async initialize(): Promise<void> {
		let savedToken: string | null = null;
		let savedExpiry: string | null = null;
		
		// localStorageから読み込みを試みる
		try {
			savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
			savedExpiry = localStorage.getItem(AUTH_TOKEN_EXPIRY_KEY);
		} catch {
			// localStorageが利用不可
		}
		
		// localStorageで見つからない場合、sessionStorageを試す
		if (!savedToken) {
			try {
				savedToken = sessionStorage.getItem(AUTH_TOKEN_KEY);
				savedExpiry = sessionStorage.getItem(AUTH_TOKEN_EXPIRY_KEY);
			} catch {
				// sessionStorageも利用不可
			}
		}
		
		// トークンが見つかった場合、有効性をチェック
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
	
	// 初期化が完了するまで待つ
	async waitForInit(): Promise<void> {
		if (this.initPromise) {
			await this.initPromise;
		}
	}
	
	async checkAuth(): Promise<{ enabled: boolean; requiresAuth: boolean }> {
		try {
			const response = await fetch('/api/auth/status');
			if (!response.ok) {
				throw new Error('Failed to check auth status');
			}
			const status = await response.json();
			return status;
		} catch {
			return { enabled: false, requiresAuth: false };
		}
	}
	
	async authenticate(token: string): Promise<boolean> {
		try {
			// api_keyパラメータを使用
			const response = await fetch(`/api/auth/verify?api_key=${token}`);
			
			if (!response.ok) {
				throw new Error('Authentication failed');
			}
			
			const result = await response.json();
			
			if (result.valid) {
				this.token = token;
				this.authenticated = true;
				
				// トークンを保存（24時間有効）
				const expiryTime = Date.now() + (24 * 60 * 60 * 1000);
				
				// localStorageを試す
				try {
					localStorage.setItem(AUTH_TOKEN_KEY, token);
					localStorage.setItem(AUTH_TOKEN_EXPIRY_KEY, expiryTime.toString());
				} catch {
					// localStorageが失敗した場合、sessionStorageを試す
					try {
						sessionStorage.setItem(AUTH_TOKEN_KEY, token);
						sessionStorage.setItem(AUTH_TOKEN_EXPIRY_KEY, expiryTime.toString());
					} catch {
						// どちらも失敗した場合でも、メモリには保持される
						console.warn('[Auth] Storage not available, token kept in memory only');
					}
				}
				
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
		this.authenticated = false;
		try {
			localStorage.removeItem(AUTH_TOKEN_KEY);
			localStorage.removeItem(AUTH_TOKEN_EXPIRY_KEY);
		} catch {
			// エラーは無視
		}
		try {
			sessionStorage.removeItem(AUTH_TOKEN_KEY);
			sessionStorage.removeItem(AUTH_TOKEN_EXPIRY_KEY);
		} catch {
			// エラーは無視
		}
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