import apiClient from './client';

export const createGoal = (data: { title: string; description?: string; type: string; targetDate?: string; parentId?: string; courseId?: string }) =>
  apiClient.post('/goals', data).then((r: any) => r.data);

export const getGoals = (params?: { type?: string; status?: string; page?: number; pageSize?: number }) =>
  apiClient.get('/goals', { params }).then((r: any) => r.data);

export const getGoal = (id: string) =>
  apiClient.get(`/goals/${id}`).then((r: any) => r.data);

export const updateGoal = (id: string, data: { title?: string; description?: string; type?: string; targetDate?: string | null; status?: string; progress?: number }) =>
  apiClient.put(`/goals/${id}`, data).then((r: any) => r.data);

export const deleteGoal = (id: string) =>
  apiClient.delete(`/goals/${id}`).then((r: any) => r.data);

export const decomposeGoal = (id: string) =>
  apiClient.post(`/goals/${id}/decompose`).then((r: any) => r.data);

export const completeGoal = (id: string) =>
  apiClient.post(`/goals/${id}/complete`).then((r: any) => r.data);

export const getAllBadges = () =>
  apiClient.get('/goals/badges/all').then((r: any) => r.data);

export const getMyBadges = () =>
  apiClient.get('/goals/badges/my').then((r: any) => r.data);
