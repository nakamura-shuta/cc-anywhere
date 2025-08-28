/**
 * API Client Helper
 * APIテストで使用する共通クライアント設定
 */

import axios, { AxiosInstance } from 'axios';

export const createApiClient = (apiKey?: string): AxiosInstance => {
  const instance = axios.create({
    baseURL: process.env.API_BASE_URL || 'http://localhost:5000',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey || process.env.API_KEY || 'hello'
    },
    timeout: 30000,
    // シリアライズ可能にするための設定
    validateStatus: (status) => status < 500
  });
  
  return instance;
};

export const waitForTaskCompletion = async (
  api: AxiosInstance,
  taskId: string,
  maxAttempts: number = 30
): Promise<string> => {
  let taskStatus = 'queued';
  let attempts = 0;

  while (attempts < maxAttempts && !['completed', 'failed', 'cancelled'].includes(taskStatus)) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const statusResponse = await api.get(`/api/tasks/${taskId}`);
    taskStatus = statusResponse.data.status;
    
    console.log(`ステータス確認 (${attempts + 1}/${maxAttempts}):`, taskStatus);
    attempts++;
  }

  return taskStatus;
};