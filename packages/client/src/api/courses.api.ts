import apiClient from './client';
import { ApiResponse, Course, PaginatedResponse } from '@study-platform/shared';

export async function getCourses(params?: { status?: string; category?: string; page?: number }) {
  const res = await apiClient.get<ApiResponse<PaginatedResponse<Course>>>('/courses', { params });
  return res.data.data!;
}

export async function getCourse(id: string) {
  const res = await apiClient.get<ApiResponse<Course & { progress: { totalItems: number; completedItems: number; completionRate: number } }>>(`/courses/${id}`);
  return res.data.data!;
}

export async function createCourse(data: { title: string; category: string; description?: string }) {
  const res = await apiClient.post<ApiResponse<Course>>('/courses', data);
  return res.data.data!;
}

export async function updateCourse(id: string, data: Partial<{ title: string; category: string; description: string }>) {
  const res = await apiClient.put<ApiResponse<Course>>(`/courses/${id}`, data);
  return res.data.data!;
}

export async function archiveCourse(id: string) {
  const res = await apiClient.put<ApiResponse<Course>>(`/courses/${id}/archive`);
  return res.data.data!;
}
