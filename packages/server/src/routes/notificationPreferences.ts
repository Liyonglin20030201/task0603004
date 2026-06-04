import { Router } from 'express';
import { prisma } from '../app';
import { authenticate } from '../middleware/auth';
import { sendEmail } from '../lib/emailSender';
import { sendSms } from '../lib/smsSender';

export const notificationPreferenceRouter = Router();
notificationPreferenceRouter.use(authenticate);

notificationPreferenceRouter.get('/', async (req, res, next) => {
  try {
    const preferences = await prisma.notificationPreference.findMany({
      where: { userId: req.user!.userId },
      orderBy: [{ type: 'asc' }, { channel: 'asc' }],
    });
    res.json({ success: true, data: preferences });
  } catch (err) { next(err); }
});

notificationPreferenceRouter.put('/', async (req, res, next) => {
  try {
    const { preferences } = req.body as {
      preferences: Array<{ type: string; channel: string; enabled: boolean }>;
    };

    if (!Array.isArray(preferences)) {
      return res.status(400).json({ success: false, error: 'preferences 必须是数组' });
    }

    const results = await prisma.$transaction(
      preferences.map((pref) =>
        prisma.notificationPreference.upsert({
          where: {
            userId_type_channel: {
              userId: req.user!.userId,
              type: pref.type as any,
              channel: pref.channel as any,
            },
          },
          update: { enabled: pref.enabled },
          create: {
            userId: req.user!.userId,
            type: pref.type as any,
            channel: pref.channel as any,
            enabled: pref.enabled,
          },
        })
      )
    );

    res.json({ success: true, data: results });
  } catch (err) { next(err); }
});

notificationPreferenceRouter.get('/phone', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { phone: true },
    });
    res.json({ success: true, data: { phone: user?.phone || null } });
  } catch (err) { next(err); }
});

notificationPreferenceRouter.put('/phone', async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (phone) {
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ success: false, error: '手机号格式不正确' });
      }
    }

    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { phone: phone || null },
    });

    res.json({ success: true, message: '手机号已更新' });
  } catch (err) { next(err); }
});

notificationPreferenceRouter.post('/test-email', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { email: true, nickname: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const sent = await sendEmail({
      to: user.email,
      subject: '[学习平台] 邮件通知测试',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1890ff;">邮件通知测试成功！</h2>
          <p>Hi ${user.nickname}，你已成功配置邮件通知。</p>
          <p>今后的学习提醒、目标进度等通知将同时发送到此邮箱。</p>
          <hr style="border: none; border-top: 1px solid #eee;" />
          <p style="color: #999; font-size: 12px;">此邮件由学习平台自动发送</p>
        </div>
      `,
    });

    if (sent) {
      res.json({ success: true, message: '测试邮件已发送' });
    } else {
      res.json({ success: false, error: 'SMTP未配置或发送失败' });
    }
  } catch (err) { next(err); }
});

notificationPreferenceRouter.post('/test-sms', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { phone: true, nickname: true },
    });

    if (!user?.phone) {
      return res.status(400).json({ success: false, error: '未设置手机号' });
    }

    const sent = await sendSms(user.phone, `Hi ${user.nickname}，短信通知测试成功！`);
    if (sent) {
      res.json({ success: true, message: '测试短信已发送' });
    } else {
      res.json({ success: false, error: 'SMS未配置或发送失败' });
    }
  } catch (err) { next(err); }
});
