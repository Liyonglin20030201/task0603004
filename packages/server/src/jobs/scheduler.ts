import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { sendNotification } from '../lib/notificationSender';
import { redis } from '../lib/redis';
import { generatePredictions, DailyDataPoint } from '../lib/predictionEngine';
import { detectAlerts, computeAlertInputs } from '../lib/alertDetector';
import { analyzeHabits } from '../lib/habitAnalyzer';
import { generateWeekSchedule } from '../lib/smartScheduler';

const prisma = new PrismaClient();

export function startCronJobs() {
  // Daily at 8:00 AM - detect overdue plans and create notifications
  cron.schedule('0 8 * * *', async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const overduePlans = await prisma.learningPlan.findMany({
        where: {
          status: { in: ['active', 'delayed'] },
          items: {
            some: {
              status: 'pending',
              scheduledDate: { lt: today },
            },
          },
        },
        include: {
          user: { select: { id: true } },
          items: { where: { status: 'pending', scheduledDate: { lt: today } } },
        },
      });

      for (const plan of overduePlans) {
        const overdueCount = plan.items.length;
        try {
          await sendNotification({
            userId: plan.userId,
            type: 'reminder',
            title: '学习计划有逾期项目',
            content: `你的计划「${plan.title}」有 ${overdueCount} 个项目逾期未完成，请及时处理延期或完成打卡。`,
          });
        } catch (e) { console.error('[Cron] Notification failed for user:', plan.userId, e); }
      }

      console.log(`[Cron] Processed ${overduePlans.length} overdue plans`);
    } catch (err) {
      console.error('[Cron] Error checking overdue plans:', err);
    }
  });

  // Daily at 8:30 AM - Ebbinghaus spaced repetition review reminders
  cron.schedule('30 8 * * *', async () => {
    try {
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      const usersWithDueReviews = await prisma.wrongAnswer.groupBy({
        by: ['userId'],
        where: { nextReviewDate: { lte: today } },
        _count: { id: true },
      });

      for (const group of usersWithDueReviews) {
        const count = group._count.id;
        if (count === 0) continue;

        const existing = await prisma.notification.findFirst({
          where: {
            userId: group.userId,
            type: 'reminder',
            title: '错题复习提醒',
            read: false,
            createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        });
        if (existing) continue;

        try {
          await sendNotification({
            userId: group.userId,
            type: 'reminder',
            title: '错题复习提醒',
            content: `根据艾宾浩斯遗忘曲线，你有 ${count} 道错题到了最佳复习时间，及时复习可以显著提高记忆保持率！`,
          });
        } catch (e) { console.error('[Cron] Notification failed for user:', group.userId, e); }
      }

      console.log(`[Cron] Sent review reminders to ${usersWithDueReviews.length} users`);
    } catch (err) {
      console.error('[Cron] Error sending review reminders:', err);
    }
  });

  // Daily at 9:00 AM - remind about today's tasks
  cron.schedule('0 9 * * *', async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const usersWithTasks = await prisma.planItem.findMany({
        where: {
          status: 'pending',
          scheduledDate: today,
        },
        select: {
          plan: { select: { userId: true } },
        },
        distinct: ['planId'],
      });

      const userIds = Array.from(new Set<string>(usersWithTasks.map((t: any) => t.plan.userId)));

      for (const userId of userIds) {
        const count = await prisma.planItem.count({
          where: {
            status: 'pending',
            scheduledDate: today,
            plan: { userId },
          },
        });

        try {
          await sendNotification({
            userId,
            type: 'reminder',
            title: '今日学习提醒',
            content: `今天有 ${count} 个学习任务等待完成，加油！`,
          });
        } catch (e) { console.error('[Cron] Notification failed for user:', userId, e); }
      }

      console.log(`[Cron] Sent reminders to ${userIds.length} users`);
    } catch (err) {
      console.error('[Cron] Error sending reminders:', err);
    }
  });

  // Every Sunday at 20:00 - generate weekly summary notification
  cron.schedule('0 20 * * 0', async () => {
    try {
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      const users = await prisma.user.findMany({ select: { id: true } });

      for (const user of users) {
        const checkInCount = await prisma.checkIn.count({
          where: { userId: user.id, checkInDate: { gte: weekAgo } },
        });

        if (checkInCount > 0) {
          try {
            await sendNotification({
              userId: user.id,
              type: 'achievement',
              title: '本周学习总结',
              content: `本周你完成了 ${checkInCount} 次打卡，继续保持！`,
            });
          } catch (e) { console.error('[Cron] Notification failed for user:', user.id, e); }
        }
      }

      console.log(`[Cron] Weekly summaries sent`);
    } catch (err) {
      console.error('[Cron] Error generating weekly summaries:', err);
    }
  });

  // Daily at 21:00 - Goal deadline reminders
  cron.schedule('0 21 * * *', async () => {
    try {
      const threeDaysLater = new Date();
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);
      threeDaysLater.setHours(23, 59, 59, 999);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);

      const approachingGoals = await prisma.learningGoal.findMany({
        where: {
          status: 'active',
          targetDate: { lte: threeDaysLater, gte: new Date() },
        },
      });

      for (const goal of approachingGoals) {
        const daysLeft = Math.ceil((goal.targetDate!.getTime() - Date.now()) / 86400000);
        await sendNotification({
          userId: goal.userId,
          type: 'goal',
          title: '目标截止提醒',
          content: `你的目标「${goal.title}」还有 ${daysLeft} 天到期，当前进度 ${Math.round(goal.progress * 100)}%`,
        });
      }
      console.log(`[Cron] Goal reminders sent: ${approachingGoals.length}`);
    } catch (err) {
      console.error('[Cron] Error sending goal reminders:', err);
    }
  });

  // Daily at 20:00 - Group daily check-in summary
  cron.schedule('0 20 * * *', async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const groups = await prisma.studyGroup.findMany({
        include: { members: { select: { userId: true } } },
      });

      for (const group of groups) {
        const memberIds = group.members.map((m: any) => m.userId);
        const todayCheckIns = await prisma.checkIn.findMany({
          where: { userId: { in: memberIds }, checkInDate: { gte: today } },
          select: { userId: true },
        });

        const checkedInUsers = new Set(todayCheckIns.map((c: any) => c.userId));
        const checkedCount = checkedInUsers.size;

        for (const memberId of memberIds) {
          await sendNotification({
            userId: memberId,
            type: 'group',
            title: `小组打卡动态`,
            content: `「${group.name}」今日 ${checkedCount}/${memberIds.length} 人已打卡${!checkedInUsers.has(memberId) ? '，你还没打卡哦！' : '，继续保持！'}`,
          });
        }
      }
      console.log(`[Cron] Group summaries sent for ${groups.length} groups`);
    } catch (err) {
      console.error('[Cron] Error sending group summaries:', err);
    }
  });

  // Every 4 hours - Clear group leaderboard caches (safety net)
  cron.schedule('0 */4 * * *', async () => {
    try {
      const groups = await prisma.studyGroup.findMany({ select: { id: true } });
      for (const group of groups) {
        await redis.del(`group:lb:${group.id}`).catch(() => {});
      }
      console.log(`[Cron] Cleared ${groups.length} leaderboard caches`);
    } catch (err) {
      console.error('[Cron] Error clearing leaderboards:', err);
    }
  });

  // 1st of month at 02:00 - Auto-generate monthly reports
  cron.schedule('0 2 1 * *', async () => {
    try {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      lastMonth.setDate(1);
      lastMonth.setHours(0, 0, 0, 0);

      const users = await prisma.user.findMany({ select: { id: true } });
      for (const user of users) {
        const hasActivity = await prisma.checkIn.count({
          where: { userId: user.id, checkInDate: { gte: lastMonth } },
        });
        if (hasActivity > 0) {
          await sendNotification({
            userId: user.id,
            type: 'system',
            title: '月度报告已可生成',
            content: '你上月的学习分析报告已准备就绪，点击查看详情。',
          });
        }
      }
      console.log(`[Cron] Monthly report notifications sent`);
    } catch (err) {
      console.error('[Cron] Error with monthly reports:', err);
    }
  });

  // Daily at 03:00 - Generate learning predictions for active users
  cron.schedule('0 3 * * *', async () => {
    try {
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      const activeUsers = await prisma.checkIn.groupBy({
        by: ['userId'],
        where: { checkInDate: { gte: weekAgo } },
      });

      for (const { userId } of activeUsers) {
        try {
          const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);
          const checkIns = await prisma.checkIn.findMany({
            where: { userId, checkInDate: { gte: sixtyDaysAgo } },
            select: { checkInDate: true, durationMinutes: true },
          });

          const studyTimeData: DailyDataPoint[] = [];
          for (let i = 59; i >= 0; i--) {
            const d = new Date(Date.now() - i * 86400000);
            const dateStr = d.toISOString().slice(0, 10);
            const dayData = checkIns.filter((c: any) => new Date(c.checkInDate).toISOString().slice(0, 10) === dateStr);
            studyTimeData.push({ date: dateStr, value: dayData.reduce((s: number, c: any) => s + (c.durationMinutes || 0), 0) });
          }

          const prediction = generatePredictions(studyTimeData, 14, 'study_time');
          if (prediction.predictions.length > 0) {
            await prisma.learningPrediction.deleteMany({ where: { userId, type: 'study_time', horizonDays: 14 } });
            await prisma.learningPrediction.create({
              data: { userId, type: 'study_time', horizonDays: 14, predictions: prediction.predictions, modelParams: prediction.modelParams },
            });
          }

          // Detect alerts
          const alertInputs = await computeAlertInputs(prisma, userId);
          const alerts = detectAlerts(alertInputs);
          if (alerts.length > 0) {
            await prisma.learningAlert.updateMany({ where: { userId, dismissed: false }, data: { dismissed: true } });
            for (const alert of alerts) {
              await prisma.learningAlert.create({
                data: { userId, severity: alert.severity as any, alertType: alert.alertType, title: alert.title, description: alert.description, triggerData: alert.triggerData },
              });
            }
          }
        } catch (e) { console.error('[Cron] Prediction failed for user:', userId, e); }
      }
      console.log(`[Cron] Predictions generated for ${activeUsers.length} users`);
    } catch (err) {
      console.error('[Cron] Error generating predictions:', err);
    }
  });

  // Every Monday at 01:00 - Auto-generate weekly smart schedules
  cron.schedule('0 1 * * 1', async () => {
    try {
      const usersWithActivePlans = await prisma.learningPlan.findMany({
        where: { status: { in: ['active', 'delayed'] } },
        select: { userId: true },
        distinct: ['userId'],
      });

      const weekStart = new Date();
      weekStart.setHours(0, 0, 0, 0);

      for (const { userId } of usersWithActivePlans) {
        try {
          const profile = await prisma.studyHabitProfile.findUnique({ where: { userId } });
          if (!profile) continue;

          const scheduleData = await generateWeekSchedule(prisma, userId, weekStart);
          await prisma.smartSchedule.upsert({
            where: { userId_weekStart: { userId, weekStart } },
            update: { scheduleData, status: 'draft' },
            create: { userId, weekStart, scheduleData, status: 'draft' },
          });
        } catch (e) { console.error('[Cron] Schedule generation failed for user:', userId, e); }
      }
      console.log(`[Cron] Weekly schedules generated for ${usersWithActivePlans.length} users`);
    } catch (err) {
      console.error('[Cron] Error generating weekly schedules:', err);
    }
  });

  // Daily at 04:00 - Refresh partner profile stats
  cron.schedule('0 4 * * *', async () => {
    try {
      const profiles = await prisma.partnerProfile.findMany({ where: { isSearching: true } });
      for (const profile of profiles) {
        try {
          const habits = await analyzeHabits(prisma, profile.userId);
          await prisma.studyHabitProfile.upsert({
            where: { userId: profile.userId },
            update: { weeklyStudyMinutes: habits.weeklyStudyMinutes, lastUpdated: new Date() },
            create: { userId: profile.userId, bestHours: habits.bestHours, bestDaysOfWeek: habits.bestDaysOfWeek, avgSessionMinutes: habits.avgSessionMinutes, preferredFrequency: habits.preferredFrequency, peakProductivityHour: habits.peakProductivityHour, weeklyStudyMinutes: habits.weeklyStudyMinutes },
          });

          const lastCheckIn = await prisma.checkIn.findFirst({
            where: { userId: profile.userId },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          });
          if (lastCheckIn) {
            await prisma.partnerProfile.update({
              where: { userId: profile.userId },
              data: { lastActive: lastCheckIn.createdAt },
            });
          }
        } catch (e) { console.error('[Cron] Partner refresh failed for:', profile.userId, e); }
      }
      console.log(`[Cron] Partner profiles refreshed: ${profiles.length}`);
    } catch (err) {
      console.error('[Cron] Error refreshing partner profiles:', err);
    }
  });

  console.log('[Cron] Scheduled jobs started');
}
