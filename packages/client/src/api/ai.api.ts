import apiClient from './client';
import { ApiResponse } from '@study-platform/shared';

export async function generateReview(courseId?: string) {
  const res = await apiClient.post<ApiResponse<any>>('/ai/generate-review', { courseId });
  return res.data.data!;
}

export async function getSuggestions() {
  const res = await apiClient.get<ApiResponse<any[]>>('/ai/suggestions');
  return res.data.data!;
}

export async function acceptSuggestion(id: string) {
  const res = await apiClient.put<ApiResponse<any>>(`/ai/suggestions/${id}/accept`);
  return res.data;
}
