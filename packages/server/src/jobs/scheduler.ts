import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

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
        await prisma.notification.create({
          data: {
            userId: plan.userId,
            type: 'reminder',
            title: '学习计划有逾期项目',
            content: `你的计划「${plan.title}」有 ${overdueCount} 个项目逾期未完成，请及时处理延期或完成打卡。`,
          },
        });
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

        await prisma.notification.create({
          data: {
            userId: group.userId,
            type: 'reminder',
            title: '错题复习提醒',
            content: `根据艾宾浩斯遗忘曲线，你有 ${count} 道错题到了最佳复习时间，及时复习可以显著提高记忆保持率！`,
          },
        });
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

      const userIds = [...new Set(usersWithTasks.map(t => t.plan.userId))];

      for (const userId of userIds) {
        const count = await prisma.planItem.count({
          where: {
            status: 'pending',
            scheduledDate: today,
            plan: { userId },
          },
        });

        await prisma.notification.create({
          data: {
            userId,
            type: 'reminder',
            title: '今日学习提醒',
            content: `今天有 ${count} 个学习任务等待完成，加油！`,
          },
        });
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
          await prisma.notification.create({
            data: {
              userId: user.id,
              type: 'achievement',
              title: '本周学习总结',
              content: `本周你完成了 ${checkInCount} 次打卡，继续保持！`,
            },
          });
        }
      }

      console.log(`[Cron] Weekly summaries sent`);
    } catch (err) {
      console.error('[Cron] Error generating weekly summaries:', err);
    }
  });

  console.log('[Cron] Scheduled jobs started');
}
