import { PrismaClient } from '@prisma/client';

export interface HabitProfile {
  bestHours: number[];
  bestDaysOfWeek: number[];
  avgSessionMinutes: number;
  preferredFrequency: number;
  peakProductivityHour: number;
  weeklyStudyMinutes: number;
  analysisData: {
    hourDistribution: Record<number, number>;
    dayDistribution: Record<number, number>;
    sessionLengths: number[];
  };
}

export async function analyzeHabits(prisma: PrismaClient, userId: string): Promise<HabitProfile> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);

  const checkIns = await prisma.checkIn.findMany({
    where: { userId, checkInDate: { gte: ninetyDaysAgo } },
    select: { checkInDate: true, durationMinutes: true, createdAt: true },
  });

  // Hour distribution (use createdAt as proxy for study time)
  const hourCounts: Record<number, number> = {};
  const hourMinutes: Record<number, number> = {};
  for (let h = 0; h < 24; h++) {
    hourCounts[h] = 0;
    hourMinutes[h] = 0;
  }

  const dayCounts: Record<number, number> = {};
  for (let d = 0; d < 7; d++) dayCounts[d] = 0;

  const sessionLengths: number[] = [];

  for (const ci of checkIns) {
    const hour = new Date(ci.createdAt).getHours();
    const day = new Date(ci.checkInDate).getDay();
    hourCounts[hour]++;
    hourMinutes[hour] += ci.durationMinutes || 30;
    dayCounts[day]++;
    if (ci.durationMinutes) sessionLengths.push(ci.durationMinutes);
  }

  // Best hours: top 4 by weighted score (count * avgMinutes)
  const hourScores = Object.entries(hourCounts).map(([h, count]) => ({
    hour: parseInt(h),
    score: count * (hourMinutes[parseInt(h)] / Math.max(count, 1)),
  }));
  hourScores.sort((a, b) => b.score - a.score);
  const bestHours = hourScores.slice(0, 4).filter(h => h.score > 0).map(h => h.hour);

  // Best days of week: top 4
  const dayScores = Object.entries(dayCounts).map(([d, count]) => ({
    day: parseInt(d),
    count,
  }));
  dayScores.sort((a, b) => b.count - a.count);
  const bestDaysOfWeek = dayScores.slice(0, 4).filter(d => d.count > 0).map(d => d.day);

  // Average session length
  const avgSessionMinutes = sessionLengths.length > 0
    ? Math.round(sessionLengths.reduce((a, b) => a + b, 0) / sessionLengths.length)
    : 45;

  // Preferred frequency (days per week with activity)
  const weeks = 90 / 7;
  const activeDays = new Set(checkIns.map((c: any) => new Date(c.checkInDate).toISOString().slice(0, 10))).size;
  const preferredFrequency = Math.round(activeDays / weeks) || 3;

  // Peak productivity hour
  const peakProductivityHour = bestHours[0] || 9;

  // Weekly study minutes (last 4 weeks average)
  const fourWeeksAgo = new Date(Date.now() - 28 * 86400000);
  const recentCheckIns = checkIns.filter((c: any) => new Date(c.checkInDate) >= fourWeeksAgo);
  const weeklyStudyMinutes = Math.round(
    recentCheckIns.reduce((s: number, c: any) => s + (c.durationMinutes || 0), 0) / 4
  );

  return {
    bestHours,
    bestDaysOfWeek,
    avgSessionMinutes,
    preferredFrequency,
    peakProductivityHour,
    weeklyStudyMinutes,
    analysisData: {
      hourDistribution: hourCounts,
      dayDistribution: dayCounts,
      sessionLengths,
    },
  };
}
