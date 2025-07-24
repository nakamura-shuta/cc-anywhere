// APIクライアント - Fetch APIのラッパー

import { getApiBaseUrl, getApiHeaders } from '$lib/config/api';

// APIエラー
export class ApiError extends Error {
	constructor(
		public status: number,
		public statusText: string,
		public data?: any
	) {
		super(`API Error: ${status} ${statusText}`);
		this.name = 'ApiError';
	}
}

// APIレスポンスの型
export interface ApiResponse<T> {
	data?: T;
	error?: string;
	success: boolean;
}

// リクエストオプション
export interface RequestOptions extends RequestInit {
	params?: Record<string, string | number | boolean>;
	timeout?: number;
}

// APIクライアントクラス
export class ApiClient {
	private baseUrl: string;

	constructor(baseUrl?: string) {
		this.baseUrl = baseUrl || getApiBaseUrl();
		// デバッグ用
		if (typeof window !== 'undefined') {
			console.log('ApiClient initialized with baseUrl:', this.baseUrl);
		}
	}

	// URLパラメータの構築
	private buildUrl(endpoint: string, params?: Record<string, string | number | boolean>): string {
		// エンドポイントが絶対URLの場合はそのまま使用
		if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
			const url = new URL(endpoint);
			if (params) {
				Object.entries(params).forEach(([key, value]) => {
					url.searchParams.append(key, String(value));
				});
			}
			return url.toString();
		}
		
		const url = new URL(endpoint, this.baseUrl);
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				url.searchParams.append(key, String(value));
			});
		}
		return url.toString();
	}

	// タイムアウト付きfetch
	private async fetchWithTimeout(url: string, options: RequestInit, timeout = 30000): Promise<Response> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const response = await fetch(url, {
				...options,
				signal: controller.signal
			});
			return response;
		} finally {
			clearTimeout(timeoutId);
		}
	}
	
	// ストリーミングレスポンスの取得
	async stream(endpoint: string, options: RequestOptions = {}): Promise<ReadableStream> {
		const { params, ...fetchOptions } = options;
		const url = this.buildUrl(endpoint, params);

		const defaultOptions: RequestInit = {
			headers: {
				...getApiHeaders(),
				'Accept': 'text/event-stream'
			},
			...fetchOptions
		};

		const response = await this.fetchWithTimeout(url, defaultOptions, options.timeout);

		if (!response.ok) {
			throw new ApiError(response.status, response.statusText);
		}

		if (!response.body) {
			throw new Error('No response body');
		}

		return response.body;
	}

	// 共通リクエスト処理
	async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
		const { params, timeout, ...fetchOptions } = options;
		const url = this.buildUrl(endpoint, params);

		// デバッグ用
		if (typeof window !== 'undefined') {
			console.log('API Request:', {
				endpoint,
				baseUrl: this.baseUrl,
				fullUrl: url,
				method: fetchOptions.method || 'GET'
			});
		}

		const defaultOptions: RequestInit = {
			headers: getApiHeaders(),
			...fetchOptions
		};

		try {
			const response = await this.fetchWithTimeout(url, defaultOptions, timeout);

			// エラーレスポンスの処理
			if (!response.ok) {
				let errorData;
				try {
					errorData = await response.json();
				} catch {
					// JSONパースエラーの場合はテキストを取得
					errorData = { error: await response.text() };
				}
				console.error('API Error:', {
					status: response.status,
					statusText: response.statusText,
					errorData,
					endpoint,
					requestBody: fetchOptions.body
				});
				throw new ApiError(response.status, response.statusText, errorData);
			}

			// 204 No Contentの場合
			if (response.status === 204) {
				return {} as T;
			}

			// JSONレスポンスのパース
			const data = await response.json();
			return data;
		} catch (error) {
			// ネットワークエラーやタイムアウト
			if (error instanceof Error) {
				if (error.name === 'AbortError') {
					throw new Error('Request timeout');
				}
				throw error;
			}
			throw new Error('Unknown error occurred');
		}
	}

	// GET リクエスト
	async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
		return this.request<T>(endpoint, {
			...options,
			method: 'GET'
		});
	}

	// POST リクエスト
	async post<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
		return this.request<T>(endpoint, {
			...options,
			method: 'POST',
			body: body ? JSON.stringify(body) : undefined
		});
	}

	// PUT リクエスト
	async put<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
		return this.request<T>(endpoint, {
			...options,
			method: 'PUT',
			body: body ? JSON.stringify(body) : undefined
		});
	}

	// DELETE リクエスト
	async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
		return this.request<T>(endpoint, {
			...options,
			method: 'DELETE'
		});
	}

	// PATCH リクエスト
	async patch<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
		return this.request<T>(endpoint, {
			...options,
			method: 'PATCH',
			body: body ? JSON.stringify(body) : undefined
		});
	}
}

// デフォルトのAPIクライアントインスタンス
export const apiClient = new ApiClient();