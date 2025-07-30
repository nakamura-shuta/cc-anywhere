// セッションサービス

import { apiClient } from '$lib/api/client';
import type { 
	Session, 
	CreateSessionRequest, 
	CreateSessionResponse,
	ContinueSessionRequest,
	ContinueSessionResponse,
	GetSessionHistoryResponse,
	ListSessionsResponse
} from '$lib/types/api';

export const sessionService = {
	// セッション一覧の取得
	async list(params?: { 
		status?: string; 
		userId?: string; 
		limit?: number; 
		offset?: number 
	}): Promise<ListSessionsResponse> {
		return apiClient.get<ListSessionsResponse>('/api/sessions', { params });
	},

	// 単一セッションの取得
	async get(id: string): Promise<Session> {
		return apiClient.get<Session>(`/api/sessions/${id}`);
	},

	// セッションの作成
	async create(data: CreateSessionRequest): Promise<CreateSessionResponse> {
		return apiClient.post<CreateSessionResponse>('/api/sessions', data);
	},

	// セッションの継続
	async continue(sessionId: string, data: Omit<ContinueSessionRequest, 'sessionId'>): Promise<ContinueSessionResponse> {
		return apiClient.post<ContinueSessionResponse>(`/api/sessions/${sessionId}/continue`, data);
	},

	// セッションの削除
	async delete(id: string): Promise<void> {
		return apiClient.delete(`/api/sessions/${id}`);
	},

	// セッション履歴の取得
	async getHistory(id: string, params?: { limit?: number; offset?: number }): Promise<GetSessionHistoryResponse> {
		return apiClient.get<GetSessionHistoryResponse>(`/api/sessions/${id}/history`, { params });
	}
};