import apiClient from './client';
import { ApiResponse, CheckIn } from '@study-platform/shared';

export async function createCheckIn(data: { planItemId: string; durationMinutes?: number; note?: string }) {
  const res = await apiClient.post<ApiResponse<CheckIn>>('/checkins', data);
  return res.data.data!;
}

export async function getCheckIns(params: { date?: string; from?: string; to?: string }) {
  const res = await apiClient.get<ApiResponse<CheckIn[]>>('/checkins', { params });
  return res.data.data!;
}

export async function getStreak() {
  const res = await apiClient.get<ApiResponse<{ currentStreak: number; longestStreak: number }>>('/checkins/streak');
  return res.data.data!;
}

export async function deleteCheckIn(id: string) {
  await apiClient.delete(`/checkins/${id}`);
}
