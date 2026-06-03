import apiClient from './client';
import { ApiResponse, Note, PaginatedResponse } from '@study-platform/shared';

export async function getNotes(params?: { courseId?: string; tag?: string; search?: string; page?: number }) {
  const res = await apiClient.get<ApiResponse<PaginatedResponse<Note>>>('/notes', { params });
  return res.data.data!;
}

export async function createNote(data: { title: string; content?: string; courseId?: string; tags?: string[] }) {
  const res = await apiClient.post<ApiResponse<Note>>('/notes', data);
  return res.data.data!;
}

export async function updateNote(id: string, data: { title?: string; content?: string; tags?: string[] }) {
  const res = await apiClient.put<ApiResponse<Note>>(`/notes/${id}`, data);
  return res.data.data!;
}

export async function deleteNote(id: string) {
  await apiClient.delete(`/notes/${id}`);
}
