import apiClient from './client';
import { AuthResponse, ApiResponse } from '@study-platform/shared';

export async function login(email: string, password: string) {
  const res = await apiClient.post<ApiResponse<AuthResponse>>('/auth/login', { email, password });
  return res.data.data!;
}

export async function register(email: string, password: string, nickname: string) {
  const res = await apiClient.post<ApiResponse<AuthResponse>>('/auth/register', { email, password, nickname });
  return res.data.data!;
}

export async function getMe() {
  const res = await apiClient.get<ApiResponse>('/auth/me');
  return res.data.data;
}
