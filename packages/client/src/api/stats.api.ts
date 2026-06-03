import apiClient from './client';
import { ApiResponse, StatsOverview, DailyStats, CourseStats } from '@study-platform/shared';

export async function getStatsOverview() {
  const res = await apiClient.get<ApiResponse<StatsOverview>>('/stats/overview');
  return res.data.data!;
}

export async function getDailyStats(from?: string, to?: string) {
  const res = await apiClient.get<ApiResponse<DailyStats[]>>('/stats/daily', { params: { from, to } });
  return res.data.data!;
}

export async function getCourseStats(includeArchived?: boolean) {
  const res = await apiClient.get<ApiResponse<CourseStats[]>>('/stats/courses', { params: { includeArchived } });
  return res.data.data!;
}

export async function getWeeklyReport() {
  const res = await apiClient.get<ApiResponse<any>>('/stats/weekly-report');
  return res.data.data!;
}

export async function getCalendarEvents(month: string) {
  const res = await apiClient.get<ApiResponse<any[]>>('/calendar', { params: { month } });
  return res.data.data!;
}

export async function getNotifications(params?: { unreadOnly?: boolean; page?: number }) {
  const res = await apiClient.get<ApiResponse<any>>('/notifications', { params });
  return res.data.data!;
}

export async function markNotificationRead(id: string) {
  await apiClient.put(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  await apiClient.put('/notifications/read-all');
}
