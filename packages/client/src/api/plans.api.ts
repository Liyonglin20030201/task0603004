import apiClient from './client';
import { ApiResponse, PaginatedResponse } from '@study-platform/shared';

export async function getPlans(params?: { courseId?: string; status?: string; page?: number }) {
  const res = await apiClient.get<ApiResponse<PaginatedResponse<any>>>('/plans', { params });
  return res.data.data!;
}

export async function getPlan(id: string) {
  const res = await apiClient.get<ApiResponse<any>>(`/plans/${id}`);
  return res.data.data!;
}

export async function createPlan(data: { courseId: string; title: string; startDate: string; endDate: string; items: { title: string; scheduledDate: string; sortOrder?: number }[] }) {
  const res = await apiClient.post<ApiResponse<any>>('/plans', data);
  return res.data.data!;
}

export async function updatePlan(id: string, data: { title?: string; status?: string }) {
  const res = await apiClient.put<ApiResponse<any>>(`/plans/${id}`, data);
  return res.data.data!;
}

export async function delayPlan(id: string) {
  const res = await apiClient.post<ApiResponse<any>>(`/plans/${id}/delay`);
  return res.data;
}

export async function deletePlan(id: string) {
  await apiClient.delete(`/plans/${id}`);
}
