import apiClient from './client';
import { ApiResponse, LearningPrediction, LearningAlert } from '@study-platform/shared';

export async function generatePredictions() {
  const res = await apiClient.post<ApiResponse<{ predictions: any[]; aiComment: string | null; alerts: any[] }>>('/predictions/generate');
  return res.data.data!;
}

export async function getPredictions(params?: { type?: string; horizonDays?: number }) {
  const res = await apiClient.get<ApiResponse<LearningPrediction[]>>('/predictions', { params });
  return res.data.data!;
}

export async function getPredictionTrends() {
  const res = await apiClient.get<ApiResponse<{ actual: any[]; predicted: any[] }>>('/predictions/trends');
  return res.data.data!;
}

export async function getAlerts(dismissed?: boolean) {
  const res = await apiClient.get<ApiResponse<LearningAlert[]>>('/predictions/alerts', { params: { dismissed } });
  return res.data.data!;
}

export async function dismissAlert(id: string) {
  await apiClient.put(`/predictions/alerts/${id}/dismiss`);
}
