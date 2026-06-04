import apiClient from './client';
import { ApiResponse, PartnerProfile, MatchScore, PartnerRequest, Partnership, PartnerProgress } from '@study-platform/shared';

export async function getPartnerProfile() {
  const res = await apiClient.get<ApiResponse<PartnerProfile | null>>('/partners/profile');
  return res.data.data!;
}

export async function updatePartnerProfile(data: Partial<PartnerProfile>) {
  const res = await apiClient.put<ApiResponse<PartnerProfile>>('/partners/profile', data);
  return res.data.data!;
}

export async function getMatches() {
  const res = await apiClient.get<ApiResponse<MatchScore[]>>('/partners/matches');
  return res.data.data!;
}

export async function sendPartnerRequest(toUserId: string, message?: string, score?: number) {
  const res = await apiClient.post<ApiResponse<PartnerRequest>>('/partners/request', { toUserId, message, score });
  return res.data.data!;
}

export async function getPartnerRequests(direction?: 'sent' | 'received') {
  const res = await apiClient.get<ApiResponse<PartnerRequest[]>>('/partners/requests', { params: { direction } });
  return res.data.data!;
}

export async function respondToRequest(id: string, status: 'accepted' | 'rejected') {
  await apiClient.put(`/partners/requests/${id}`, { status });
}

export async function getPartners() {
  const res = await apiClient.get<ApiResponse<Partnership[]>>('/partners');
  return res.data.data!;
}

export async function getPartnerProgress(userId: string) {
  const res = await apiClient.get<ApiResponse<PartnerProgress>>(`/partners/${userId}/progress`);
  return res.data.data!;
}

export async function removePartner(userId: string) {
  await apiClient.delete(`/partners/${userId}`);
}
