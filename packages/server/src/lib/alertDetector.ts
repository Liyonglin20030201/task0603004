import { PrismaClient } from '@prisma/client';

interface AlertInput {
  userId: string;
  dailyStudyMinutes: number[];
  dailyCheckIns: number[];
  overdueItemsRatio: number;
  wrongAnswerMasteryTrend: number; // slope of mastery rate over 14 days
  recentDates: string[];
}

interface DetectedAlert {
  severity: 'info' | 'warning' | 'critical';
  alertType: string;
  title: string;
  description: string;
  triggerData: Record<string, any>;
}

export function detectAlerts(input: AlertInput): DetectedAlert[] {
  const alerts: DetectedAlert[] = [];
  const { dailyStudyMinutes, dailyCheckIns, overdueItemsRatio, wrongAnswerMasteryTrend } = input;

  // Declining engagement: 3+ consecutive zero-activity days at the end
  const recentActivity = dailyCheckIns.slice(-7);
  let consecutiveZero = 0;
  for (let i = recentActivity.length - 1; i >= 0; i--) {
    if (recentActivity[i] === 0) consecutiveZero++;
    else break;
  }
  if (consecutiveZero >= 3) {
    alerts.push({
      severity: consecutiveZero >= 5 ? 'critical' : 'warning',
      alertType: 'declining_engagement',
      title: '学习参与度下降',
      description: `你已经连续 ${consecutiveZero} 天没有学习活动了，坚持学习是进步的关键！`,
      triggerData: { consecutiveZeroDays: consecutiveZero },
    });
  }

  // Burnout risk: recent daily study time > 2x 30-day average for 5+ consecutive days
  if (dailyStudyMinutes.length >= 30) {
    const avg30 = dailyStudyMinutes.reduce((a, b) => a + b, 0) / dailyStudyMinutes.length;
    const recent7 = dailyStudyMinutes.slice(-7);
    let burnoutDays = 0;
    for (let i = recent7.length - 1; i >= 0; i--) {
      if (recent7[i] > avg30 * 2 && avg30 > 0) burnoutDays++;
      else break;
    }
    if (burnoutDays >= 5) {
      alerts.push({
        severity: 'warning',
        alertType: 'burnout_risk',
        title: '学习强度过高',
        description: `你最近 ${burnoutDays} 天的学习时间超过了平时的两倍，注意劳逸结合！`,
        triggerData: { burnoutDays, avg30: Math.round(avg30), recentAvg: Math.round(recent7.reduce((a, b) => a + b, 0) / recent7.length) },
      });
    }
  }

  // Overdue plans: > 30% items are overdue
  if (overdueItemsRatio > 0.3) {
    alerts.push({
      severity: overdueItemsRatio > 0.5 ? 'critical' : 'warning',
      alertType: 'overdue_plans',
      title: '计划进度落后',
      description: `你有 ${Math.round(overdueItemsRatio * 100)}% 的计划任务已逾期，建议调整计划节奏。`,
      triggerData: { overdueRatio: overdueItemsRatio },
    });
  }

  // Retention decline: wrong answer mastery trend is negative
  if (wrongAnswerMasteryTrend < -0.02) {
    alerts.push({
      severity: 'info',
      alertType: 'retention_decline',
      title: '知识掌握度下滑',
      description: '近期错题掌握率有所下降，建议增加复习频次。',
      triggerData: { masteryTrendSlope: wrongAnswerMasteryTrend },
    });
  }

  return alerts;
}

export async function computeAlertInputs(prisma: PrismaClient, userId: string): Promise<AlertInput> {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [checkIns, planItems, wrongAnswers] = await Promise.all([
    prisma.checkIn.findMany({
      where: { userId, checkInDate: { gte: sixtyDaysAgo } },
      select: { checkInDate: true, durationMinutes: true },
    }),
    prisma.planItem.findMany({
      where: { plan: { userId, status: { in: ['active', 'delayed'] } } },
      select: { status: true, scheduledDate: true },
    }),
    prisma.wrongAnswer.findMany({
      where: { userId },
      select: { reviewCount: true, updatedAt: true },
    }),
  ]);

  // Build daily arrays
  const dailyStudyMinutes: number[] = [];
  const dailyCheckIns: number[] = [];
  const dates: string[] = [];

  for (let i = 59; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    dates.push(dateStr);

    const dayData = checkIns.filter((c: any) => new Date(c.checkInDate).toISOString().slice(0, 10) === dateStr);
    dailyCheckIns.push(dayData.length);
    dailyStudyMinutes.push(dayData.reduce((s: number, c: any) => s + (c.durationMinutes || 0), 0));
  }

  // Overdue ratio
  const todayStr = today.toISOString().slice(0, 10);
  const overdueItems = planItems.filter(
    (i: any) => i.status === 'pending' && new Date(i.scheduledDate).toISOString().slice(0, 10) < todayStr
  ).length;
  const totalPendingOrOverdue = planItems.filter((i: any) => i.status === 'pending').length;
  const overdueItemsRatio = totalPendingOrOverdue > 0 ? overdueItems / totalPendingOrOverdue : 0;

  // Wrong answer mastery trend (simplified: ratio of mastered in recent vs older)
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);
  const recentWA = wrongAnswers.filter((w: any) => new Date(w.updatedAt) >= twoWeeksAgo);
  const olderWA = wrongAnswers.filter((w: any) => new Date(w.updatedAt) < twoWeeksAgo);
  const recentMasteryRate = recentWA.length > 0 ? recentWA.filter((w: any) => w.reviewCount >= 5).length / recentWA.length : 0;
  const olderMasteryRate = olderWA.length > 0 ? olderWA.filter((w: any) => w.reviewCount >= 5).length / olderWA.length : 0;
  const wrongAnswerMasteryTrend = recentWA.length > 0 ? recentMasteryRate - olderMasteryRate : 0;

  return {
    userId,
    dailyStudyMinutes,
    dailyCheckIns,
    overdueItemsRatio,
    wrongAnswerMasteryTrend,
    recentDates: dates,
  };
}
