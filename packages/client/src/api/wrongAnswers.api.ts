import apiClient from './client';
import { ApiResponse, WrongAnswer, PaginatedResponse } from '@study-platform/shared';

export interface WrongAnswerStats {
  total: number;
  dueToday: number;
  mastered: number;
  learning: number;
  newItems: number;
  reviewedToday: number;
}

export async function getWrongAnswers(params?: { courseId?: string; tag?: string; page?: number }) {
  const res = await apiClient.get<ApiResponse<PaginatedResponse<WrongAnswer>>>('/wrong-answers', { params });
  return res.data.data!;
}

export async function createWrongAnswer(data: { courseId: string; question: string; wrongAnswer: string; correctAnswer: string; explanation?: string; tags?: string[] }) {
  const res = await apiClient.post<ApiResponse<WrongAnswer>>('/wrong-answers', data);
  return res.data.data!;
}

export async function updateWrongAnswer(id: string, data: any) {
  const res = await apiClient.put<ApiResponse<WrongAnswer>>(`/wrong-answers/${id}`, data);
  return res.data.data!;
}

export async function deleteWrongAnswer(id: string) {
  await apiClient.delete(`/wrong-answers/${id}`);
}

export async function getDueWrongAnswers() {
  const res = await apiClient.get<ApiResponse<WrongAnswer[]>>('/wrong-answers/due');
  return res.data.data!;
}

export async function reviewWrongAnswer(id: string, quality: number) {
  const res = await apiClient.post<ApiResponse<WrongAnswer>>(`/wrong-answers/${id}/review`, { quality });
  return res.data.data!;
}

export async function getWrongAnswerStats() {
  const res = await apiClient.get<ApiResponse<WrongAnswerStats>>('/wrong-answers/stats');
  return res.data.data!;
}
