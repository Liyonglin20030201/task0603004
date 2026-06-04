import { Router } from 'express';
import { prisma } from '../app';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { redis } from '../lib/redis';
import Anthropic from '@anthropic-ai/sdk';

export const reportRouter = Router();
reportRouter.use(authenticate);

reportRouter.post('/generate', async (req, res, next) => {
  try {
    const { period, periodStart } = req.body;
    if (!period || !periodStart) {
      throw new AppError('period 和 periodStart 为必填', 400);
    }

    const start = new Date(periodStart);
    let end: Date;
    if (period === 'monthly') {
      end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      end.setDate(end.getDate() - 1);
    } else if (period === 'quarterly') {
      end = new Date(start);
      end.setMonth(end.getMonth() + 3);
      end.setDate(end.getDate() - 1);
    } else {
      end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      end.setDate(end.getDate() - 1);
    }

    const existing = await prisma.analysisReport.findUnique({
      where: {
        userId_period_periodStart: {
          userId: req.user!.userId,
          period,
          periodStart: start,
        },
      },
    });

    if (existing && existing.status === 'generating') {
      return res.status(202).json({ success: true, data: existing, message: '报告正在生成中' });
    }

    const report = existing
      ? await prisma.analysisReport.update({
          where: { id: existing.id },
          data: { status: 'generating' },
        })
      : await prisma.analysisReport.create({
          data: {
            userId: req.user!.userId,
            period,
            periodStart: start,
            periodEnd: end,
            status: 'generating',
          },
        });

    // Generate async
    generateReport(report.id, req.user!.userId, start, end).catch(console.error);

    res.status(202).json({ success: true, data: report, message: '报告开始生成' });
  } catch (err) { next(err); }
});

reportRouter.get('/', async (req, res, next) => {
  try {
    const { page = '1', pageSize = '10', period } = req.query;
    const where: any = { userId: req.user!.userId };
    if (period) where.period = period;

    const skip = (Number(page) - 1) * Number(pageSize);
    const [items, total] = await Promise.all([
      prisma.analysisReport.findMany({
        where, skip, take: Number(pageSize),
        orderBy: { periodStart: 'desc' },
        select: { id: true, period: true, periodStart: true, periodEnd: true, status: true, generatedAt: true, createdAt: true },
      }),
      prisma.analysisReport.count({ where }),
    ]);

    res.json({
      success: true,
      data: { items, total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    });
  } catch (err) { next(err); }
});

reportRouter.get('/latest', async (req, res, next) => {
  try {
    const periods = ['monthly', 'quarterly', 'yearly'] as const;
    const latest: Record<string, any> = {};

    for (const period of periods) {
      const cacheKey = `report:${req.user!.userId}:${period}`;
      const cached = await redis.get(cacheKey).catch(() => null);
      if (cached) {
        latest[period] = JSON.parse(cached);
        continue;
      }

      const report = await prisma.analysisReport.findFirst({
        where: { userId: req.user!.userId, period, status: 'completed' },
        orderBy: { periodStart: 'desc' },
      });
      if (report) {
        latest[period] = report;
        await redis.set(cacheKey, JSON.stringify(report), 'EX', 86400).catch(() => {});
      }
    }

    res.json({ success: true, data: latest });
  } catch (err) { next(err); }
});

reportRouter.get('/:id', async (req, res, next) => {
  try {
    const report = await prisma.analysisReport.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!report) throw new AppError('报告不存在', 404);
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
});

reportRouter.delete('/:id', async (req, res, next) => {
  try {
    const report = await prisma.analysisReport.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!report) throw new AppError('报告不存在', 404);

    await prisma.analysisReport.delete({ where: { id: report.id } });
    res.json({ success: true, message: '报告已删除' });
  } catch (err) { next(err); }
});

async function generateReport(reportId: string, userId: string, start: Date, end: Date) {
  try {
    const [checkIns, plans, wrongAnswers, courses] = await Promise.all([
      prisma.checkIn.findMany({
        where: { userId, checkInDate: { gte: start, lte: end } },
        include: { planItem: { select: { title: true, plan: { select: { courseId: true } } } } },
      }),
      prisma.learningPlan.findMany({
        where: { userId, startDate: { lte: end }, endDate: { gte: start } },
        include: { items: true, course: { select: { id: true, title: true } } },
      }),
      prisma.wrongAnswer.findMany({
        where: { userId, createdAt: { gte: start, lte: end } },
      }),
      prisma.course.findMany({
        where: { userId, status: { in: ['active', 'completed'] } },
        include: { learningPlans: { include: { items: true } } },
      }),
    ]);

    const totalStudyMinutes = checkIns.reduce((sum: number, c: any) => sum + (c.durationMinutes || 30), 0);
    const activeDays = new Set(checkIns.map((c: any) => c.checkInDate.toISOString().split('T')[0])).size;
    const completedItems = checkIns.length;

    // Day of week analysis
    const dayOfWeekMinutes: Record<number, number> = {};
    for (const c of checkIns) {
      const dow = c.checkInDate.getDay();
      dayOfWeekMinutes[dow] = (dayOfWeekMinutes[dow] || 0) + (c.durationMinutes || 30);
    }
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const bestDow = Object.entries(dayOfWeekMinutes).sort((a, b) => Number(b[1]) - Number(a[1]))[0];

    // Course progress
    const courseProgress = courses.map((c: any) => {
      const totalItems = c.learningPlans.reduce((sum: number, p: any) => sum + p.items.length, 0);
      const completed = c.learningPlans.reduce((sum: number, p: any) => sum + p.items.filter((i: any) => i.status === 'completed').length, 0);
      return {
        courseId: c.id,
        title: c.title,
        completionRate: totalItems > 0 ? completed / totalItems : 0,
      };
    });

    // Daily trends
    const dailyMap: Record<string, { minutes: number; items: number }> = {};
    for (const c of checkIns) {
      const date = c.checkInDate.toISOString().split('T')[0];
      if (!dailyMap[date]) dailyMap[date] = { minutes: 0, items: 0 };
      dailyMap[date].minutes += c.durationMinutes || 30;
      dailyMap[date].items += 1;
    }
    const trends = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    const reportData = {
      overview: {
        totalStudyMinutes,
        totalCheckIns: checkIns.length,
        activeDays,
        completedItems,
        averageDailyMinutes: activeDays > 0 ? Math.round(totalStudyMinutes / activeDays) : 0,
      },
      efficiency: {
        bestDayOfWeek: bestDow ? dayNames[Number(bestDow[0])] : '无数据',
        averageSessionLength: checkIns.length > 0 ? Math.round(totalStudyMinutes / checkIns.length) : 0,
      },
      knowledge: {
        courseProgress,
        wrongAnswerTrend: {
          total: wrongAnswers.length,
          mastered: wrongAnswers.filter((w: any) => w.reviewCount >= 5).length,
          newThisPeriod: wrongAnswers.length,
        },
      },
      trends,
    };

    // Generate AI summary
    let aiSummary = '';
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        const client = new Anthropic({ apiKey });
        const msg = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: `基于以下学习数据生成个性化的分析总结和建议（中文，简洁有力，200-300字）：

学习时长：${totalStudyMinutes}分钟，活跃天数：${activeDays}天
打卡次数：${checkIns.length}次，日均：${reportData.overview.averageDailyMinutes}分钟
最佳学习日：${reportData.efficiency.bestDayOfWeek}
课程进度：${courseProgress.map((c: any) => `${c.title}(${Math.round(c.completionRate * 100)}%)`).join(', ')}
错题：新增${wrongAnswers.length}道，已掌握${reportData.knowledge.wrongAnswerTrend.mastered}道

请给出：1. 总体评价 2. 效率分析 3. 具体改进建议`,
          }],
        });
        aiSummary = msg.content[0].type === 'text' ? msg.content[0].text : '';
      } catch (err) {
        console.error('[Report] AI summary generation failed:', err);
      }
    }

    await prisma.analysisReport.update({
      where: { id: reportId },
      data: {
        reportData,
        aiSummary,
        status: 'completed',
        generatedAt: new Date(),
      },
    });

    // Clear cache
    const report = await prisma.analysisReport.findUnique({ where: { id: reportId } });
    if (report) {
      await redis.del(`report:${userId}:${report.period}`).catch(() => {});
    }
  } catch (err) {
    console.error('[Report] Generation failed:', err);
    await prisma.analysisReport.update({
      where: { id: reportId },
      data: { status: 'failed' },
    });
  }
}
