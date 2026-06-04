import apiClient from './client';

export const createGroup = (data: { name: string; description?: string; joinPolicy?: string; maxMembers?: number }) =>
  apiClient.post('/groups', data).then((r: any) => r.data);

export const getMyGroups = () =>
  apiClient.get('/groups').then((r: any) => r.data);

export const discoverGroups = (params?: { page?: number; pageSize?: number; search?: string }) =>
  apiClient.get('/groups/discover', { params }).then((r: any) => r.data);

export const getGroup = (id: string) =>
  apiClient.get(`/groups/${id}`).then((r: any) => r.data);

export const updateGroup = (id: string, data: { name?: string; description?: string; joinPolicy?: string; maxMembers?: number }) =>
  apiClient.put(`/groups/${id}`, data).then((r: any) => r.data);

export const deleteGroup = (id: string) =>
  apiClient.delete(`/groups/${id}`).then((r: any) => r.data);

export const joinGroup = (id: string) =>
  apiClient.post(`/groups/${id}/join`).then((r: any) => r.data);

export const leaveGroup = (id: string) =>
  apiClient.post(`/groups/${id}/leave`).then((r: any) => r.data);

export const removeMember = (groupId: string, userId: string) =>
  apiClient.delete(`/groups/${groupId}/members/${userId}`).then((r: any) => r.data);

export const updateMemberRole = (groupId: string, userId: string, role: string) =>
  apiClient.put(`/groups/${groupId}/members/${userId}/role`, { role }).then((r: any) => r.data);

export const shareItem = (groupId: string, data: { itemType: string; itemId: string }) =>
  apiClient.post(`/groups/${groupId}/share`, data).then((r: any) => r.data);

export const getSharedItems = (groupId: string) =>
  apiClient.get(`/groups/${groupId}/shared`).then((r: any) => r.data);

export const getGroupCheckins = (groupId: string) =>
  apiClient.get(`/groups/${groupId}/checkins`).then((r: any) => r.data);

export const getLeaderboard = (groupId: string) =>
  apiClient.get(`/groups/${groupId}/leaderboard`).then((r: any) => r.data);

export const getGroupProgress = (groupId: string) =>
  apiClient.get(`/groups/${groupId}/progress`).then((r: any) => r.data);

export const createGroupGoal = (groupId: string, data: { title: string; description?: string; targetDate?: string }) =>
  apiClient.post(`/groups/${groupId}/goals`, data).then((r: any) => r.data);

export const getGroupGoals = (groupId: string) =>
  apiClient.get(`/groups/${groupId}/goals`).then((r: any) => r.data);

export const updateGroupGoal = (groupId: string, goalId: string, data: { title?: string; description?: string; targetDate?: string | null; status?: string }) =>
  apiClient.put(`/groups/${groupId}/goals/${goalId}`, data).then((r: any) => r.data);

export const getGroupMessages = (groupId: string, params?: { page?: number; pageSize?: number }) =>
  apiClient.get(`/groups/${groupId}/messages`, { params }).then((r: any) => r.data);

export const sendGroupMessage = (groupId: string, content: string) =>
  apiClient.post(`/groups/${groupId}/messages`, { content }).then((r: any) => r.data);
