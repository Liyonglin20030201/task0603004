import apiClient from './client';
import { ApiResponse, StudyHabitProfile, SmartSchedule, DailyAdaptResult } from '@study-platform/shared';

export async function getHabitProfile() {
  const res = await apiClient.get<ApiResponse<StudyHabitProfile | null>>('/smart-plan/profile');
  return res.data.data!;
}

export async function analyzeHabits() {
  const res = await apiClient.post<ApiResponse<StudyHabitProfile>>('/smart-plan/analyze-habits');
  return res.data.data!;
}

export async function generateWeekSchedule(weekStart?: string) {
  const res = await apiClient.post<ApiResponse<SmartSchedule>>('/smart-plan/generate-week', { weekStart });
  return res.data.data!;
}

export async function getSchedules(weekStart?: string) {
  const res = await apiClient.get<ApiResponse<SmartSchedule[]>>('/smart-plan/schedule', { params: { weekStart } });
  return res.data.data!;
}

export async function updateScheduleStatus(id: string, status: string) {
  const res = await apiClient.put<ApiResponse<any>>(`/smart-plan/schedule/${id}`, { status });
  return res.data.data!;
}

export async function adjustSchedule(completedItemId: string) {
  await apiClient.post('/smart-plan/adjust', { completedItemId });
}

export async function dailyAdapt(completedItemId: string, masteryRating: number, actualDuration?: number) {
  const res = await apiClient.post<ApiResponse<DailyAdaptResult>>('/smart-plan/daily-adapt', {
    completedItemId,
    masteryRating,
    actualDuration,
  });
  return res.data.data!;
}
