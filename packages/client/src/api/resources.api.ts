import apiClient from './client';

export const uploadResource = (formData: FormData) =>
  apiClient.post('/resources/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r: any) => r.data);

export const getResources = (params?: { page?: number; pageSize?: number; courseId?: string; planId?: string }) =>
  apiClient.get('/resources', { params }).then((r: any) => r.data);

export const getPublicResources = (params?: { page?: number; pageSize?: number; search?: string }) =>
  apiClient.get('/resources/public', { params }).then((r: any) => r.data);

export const getResource = (id: string) =>
  apiClient.get(`/resources/${id}`).then((r: any) => r.data);

export const downloadResource = (id: string) =>
  apiClient.get(`/resources/${id}/download`, { responseType: 'blob' }).then((r: any) => r);

export const updateResource = (id: string, data: { title?: string; description?: string; isPublic?: boolean; courseId?: string | null; planId?: string | null }) =>
  apiClient.put(`/resources/${id}`, data).then((r: any) => r.data);

export const deleteResource = (id: string) =>
  apiClient.delete(`/resources/${id}`).then((r: any) => r.data);
