import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../app';
import { authenticate } from '../middleware/auth';
import { analyzeHabits } from '../lib/habitAnalyzer';
import { generateWeekSchedule } from '../lib/smartScheduler';

export const smartPlanRouter = Router();
smartPlanRouter.use(authenticate);

smartPlanRouter.get('/profile', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const profile = await prisma.studyHabitProfile.findUnique({ where: { userId } });
    res.json({ success: true, data: profile });
  } catch (err) { next(err); }
});

smartPlanRouter.post('/analyze-habits', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const habits = await analyzeHabits(prisma, userId);

    const profile = await prisma.studyHabitProfile.upsert({
      where: { userId },
      update: {
        bestHours: habits.bestHours,
        bestDaysOfWeek: habits.bestDaysOfWeek,
        avgSessionMinutes: habits.avgSessionMinutes,
        preferredFrequency: habits.preferredFrequency,
        peakProductivityHour: habits.peakProductivityHour,
        weeklyStudyMinutes: habits.weeklyStudyMinutes,
        analysisData: habits.analysisData,
        lastUpdated: new Date(),
      },
      create: {
        userId,
        bestHours: habits.bestHours,
        bestDaysOfWeek: habits.bestDaysOfWeek,
        avgSessionMinutes: habits.avgSessionMinutes,
        preferredFrequency: habits.preferredFrequency,
        peakProductivityHour: habits.peakProductivityHour,
        weeklyStudyMinutes: habits.weeklyStudyMinutes,
        analysisData: habits.analysisData,
      },
    });

    res.json({ success: true, data: profile });
  } catch (err) { next(err); }
});

smartPlanRouter.post('/generate-week', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { weekStart: weekStartStr } = req.body;

    // Default to next Monday
    let weekStart: Date;
    if (weekStartStr) {
      weekStart = new Date(weekStartStr);
    } else {
      weekStart = new Date();
      const day = weekStart.getDay();
      const daysUntilMonday = day === 0 ? 1 : 8 - day;
      weekStart.setDate(weekStart.getDate() + daysUntilMonday);
      weekStart.setHours(0, 0, 0, 0);
    }

    const scheduleData = await generateWeekSchedule(prisma, userId, weekStart);

    // AI explanation
    let aiExplanation: string | null = null;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        const profile = await prisma.studyHabitProfile.findUnique({ where: { userId } });
        const client = new Anthropic({ apiKey });
        const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const message = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `作为学习规划师，用2-3句话中文解释这个学习安排的理由：
最佳学习时段：${profile?.bestHours?.map((h: number) => h + ':00').join(', ') || '未分析'}
最佳学习日：${profile?.bestDaysOfWeek?.map((d: number) => dayNames[d]).join(', ') || '未分析'}
平均每次学习：${profile?.avgSessionMinutes || 45}分钟
本周安排了${scheduleData.itemsScheduled}个任务，总计${scheduleData.totalMinutes}分钟`,
          }],
        });
        const textBlock = message.content.find(b => b.type === 'text');
        if (textBlock && textBlock.type === 'text') aiExplanation = textBlock.text;
      } catch {}
    }

    // Save schedule
    const schedule = await prisma.smartSchedule.upsert({
      where: { userId_weekStart: { userId, weekStart } },
      update: {
        scheduleData,
        aiExplanation,
        status: 'draft',
      },
      create: {
        userId,
        weekStart,
        scheduleData,
        aiExplanation,
        status: 'draft',
      },
    });

    res.json({ success: true, data: schedule });
  } catch (err) { next(err); }
});

smartPlanRouter.get('/schedule', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { weekStart } = req.query;

    let where: any = { userId };
    if (weekStart) {
      where.weekStart = new Date(weekStart as string);
    }

    const schedules = await prisma.smartSchedule.findMany({
      where,
      orderBy: { weekStart: 'desc' },
      take: 4,
    });

    res.json({ success: true, data: schedules });
  } catch (err) { next(err); }
});

smartPlanRouter.put('/schedule/:id', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { status } = req.body;

    const schedule = await prisma.smartSchedule.updateMany({
      where: { id, userId },
      data: { status },
    });

    res.json({ success: true, data: schedule });
  } catch (err) { next(err); }
});

smartPlanRouter.post('/adjust', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { completedItemId } = req.body;

    const currentSchedule = await prisma.smartSchedule.findFirst({
      where: { userId, status: 'active' },
      orderBy: { weekStart: 'desc' },
    });

    if (!currentSchedule) {
      return res.json({ success: true, data: null });
    }

    const scheduleData = currentSchedule.scheduleData as any;
    if (completedItemId && scheduleData?.days) {
      const updatedDays = scheduleData.days.map((day: any) => ({
        ...day,
        slots: day.slots.filter((slot: any) => slot.planItemId !== completedItemId),
      }));
      const adjustments = (currentSchedule.adjustments as any[]) || [];
      adjustments.push({ type: 'completed', itemId: completedItemId, at: new Date().toISOString() });

      await prisma.smartSchedule.update({
        where: { id: currentSchedule.id },
        data: {
          scheduleData: { ...scheduleData, days: updatedDays },
          adjustments,
        },
      });
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});
