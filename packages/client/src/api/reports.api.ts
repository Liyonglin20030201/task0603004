import apiClient from './client';

export const generateReport = (data: { period: string; periodStart: string }) =>
  apiClient.post('/reports/generate', data).then((r: any) => r.data);

export const getReports = (params?: { page?: number; pageSize?: number; period?: string }) =>
  apiClient.get('/reports', { params }).then((r: any) => r.data);

export const getReport = (id: string) =>
  apiClient.get(`/reports/${id}`).then((r: any) => r.data);

export const getLatestReports = () =>
  apiClient.get('/reports/latest').then((r: any) => r.data);

export const deleteReport = (id: string) =>
  apiClient.delete(`/reports/${id}`).then((r: any) => r.data);
