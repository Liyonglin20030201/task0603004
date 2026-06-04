import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../app';
import { authenticate } from '../middleware/auth';
import { generatePredictions, DailyDataPoint } from '../lib/predictionEngine';
import { detectAlerts, computeAlertInputs } from '../lib/alertDetector';

export const predictionRouter = Router();
predictionRouter.use(authenticate);

predictionRouter.post('/generate', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);

    const checkIns = await prisma.checkIn.findMany({
      where: { userId, checkInDate: { gte: sixtyDaysAgo } },
      select: { checkInDate: true, durationMinutes: true, planItemId: true },
    });

    // Build daily data arrays
    const studyTimeData: DailyDataPoint[] = [];
    const engagementData: DailyDataPoint[] = [];

    for (let i = 59; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const dayData = checkIns.filter((c: any) => new Date(c.checkInDate).toISOString().slice(0, 10) === dateStr);

      studyTimeData.push({ date: dateStr, value: dayData.reduce((s: number, c: any) => s + (c.durationMinutes || 0), 0) });
      engagementData.push({ date: dateStr, value: dayData.length });
    }

    // Completion rate data
    const plans = await prisma.learningPlan.findMany({
      where: { userId, status: { in: ['active', 'delayed'] } },
      include: { items: { select: { status: true, scheduledDate: true } } },
    });
    const completionData: DailyDataPoint[] = [];
    for (let i = 59; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const itemsDue = plans.flatMap((p: any) => p.items).filter(
        (it: any) => new Date(it.scheduledDate).toISOString().slice(0, 10) <= dateStr
      );
      const completed = itemsDue.filter((it: any) => it.status === 'completed').length;
      completionData.push({ date: dateStr, value: itemsDue.length > 0 ? completed / itemsDue.length : 0 });
    }

    // Generate predictions for multiple horizons
    const horizons = [7, 14, 30];
    const allPredictions = [];

    for (const horizon of horizons) {
      allPredictions.push(generatePredictions(studyTimeData, horizon, 'study_time'));
      allPredictions.push(generatePredictions(engagementData, horizon, 'engagement'));
      allPredictions.push(generatePredictions(completionData, horizon, 'completion_rate'));
    }

    // AI commentary
    let aiComment: string | null = null;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        const mainPrediction = allPredictions.find(p => p.type === 'study_time' && p.horizonDays === 14);
        const client = new Anthropic({ apiKey });
        const message = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: `作为学习顾问，基于以下学习数据趋势给出简短建议（2-3句话中文）：
趋势方向：${mainPrediction?.modelParams.trend || 'stable'}
斜率：${mainPrediction?.modelParams.slope || 0}
近7天平均学习时长：${Math.round(studyTimeData.slice(-7).reduce((s, d) => s + d.value, 0) / 7)}分钟
近7天平均打卡次数：${Math.round(engagementData.slice(-7).reduce((s, d) => s + d.value, 0) / 7)}次`,
          }],
        });
        const textBlock = message.content.find(b => b.type === 'text');
        if (textBlock && textBlock.type === 'text') aiComment = textBlock.text;
      } catch {}
    }

    // Save predictions to DB
    await prisma.learningPrediction.deleteMany({ where: { userId } });
    for (const pred of allPredictions) {
      if (pred.predictions.length > 0) {
        await prisma.learningPrediction.create({
          data: {
            userId,
            type: pred.type as any,
            horizonDays: pred.horizonDays,
            predictions: pred.predictions,
            modelParams: pred.modelParams,
            aiComment,
          },
        });
      }
    }

    // Detect and save alerts
    const alertInputs = await computeAlertInputs(prisma, userId);
    const detectedAlerts = detectAlerts(alertInputs);

    await prisma.learningAlert.updateMany({
      where: { userId, dismissed: false },
      data: { dismissed: true },
    });

    for (const alert of detectedAlerts) {
      await prisma.learningAlert.create({
        data: {
          userId,
          severity: alert.severity as any,
          alertType: alert.alertType,
          title: alert.title,
          description: alert.description,
          triggerData: alert.triggerData,
        },
      });
    }

    res.json({ success: true, data: { predictions: allPredictions, aiComment, alerts: detectedAlerts } });
  } catch (err) { next(err); }
});

predictionRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { type, horizonDays } = req.query;

    const where: any = { userId };
    if (type) where.type = type;
    if (horizonDays) where.horizonDays = parseInt(horizonDays as string);

    const predictions = await prisma.learningPrediction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: predictions });
  } catch (err) { next(err); }
});

predictionRouter.get('/trends', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const checkIns = await prisma.checkIn.findMany({
      where: { userId, checkInDate: { gte: thirtyDaysAgo } },
      select: { checkInDate: true, durationMinutes: true },
    });

    const actual: { date: string; studyMinutes: number; checkIns: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const dayData = checkIns.filter((c: any) => new Date(c.checkInDate).toISOString().slice(0, 10) === dateStr);
      actual.push({
        date: dateStr,
        studyMinutes: dayData.reduce((s: number, c: any) => s + (c.durationMinutes || 0), 0),
        checkIns: dayData.length,
      });
    }

    const predictions = await prisma.learningPrediction.findMany({
      where: { userId, type: 'study_time', horizonDays: 14 },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    res.json({
      success: true,
      data: {
        actual,
        predicted: predictions[0]?.predictions || [],
      },
    });
  } catch (err) { next(err); }
});

predictionRouter.get('/alerts', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { dismissed } = req.query;

    const where: any = { userId };
    if (dismissed !== undefined) where.dismissed = dismissed === 'true';

    const alerts = await prisma.learningAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({ success: true, data: alerts });
  } catch (err) { next(err); }
});

predictionRouter.put('/alerts/:id/dismiss', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    await prisma.learningAlert.updateMany({
      where: { id, userId },
      data: { dismissed: true },
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});
