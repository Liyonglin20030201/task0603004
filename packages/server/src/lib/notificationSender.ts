import { PrismaClient } from '@prisma/client';
import { sendEmail } from './emailSender';
import { sendSms } from './smsSender';

const prisma = new PrismaClient();

export async function sendNotification(params: {
  userId: string;
  type: 'reminder' | 'system' | 'achievement' | 'group' | 'goal';
  title: string;
  content: string;
  scheduledFor?: Date;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      content: params.content,
      channel: 'in_app',
      scheduledFor: params.scheduledFor,
    },
  });

  const [emailPref, smsPref, user] = await Promise.all([
    prisma.notificationPreference.findUnique({
      where: {
        userId_type_channel: {
          userId: params.userId,
          type: params.type,
          channel: 'email',
        },
      },
    }),
    prisma.notificationPreference.findUnique({
      where: {
        userId_type_channel: {
          userId: params.userId,
          type: params.type,
          channel: 'sms',
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: params.userId },
      select: { email: true, nickname: true, phone: true },
    }),
  ]);

  if (!user) return;

  if (emailPref?.enabled && user.email) {
    await sendEmail({
      to: user.email,
      subject: `[学习平台] ${params.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1890ff;">${params.title}</h2>
          <p>${params.content}</p>
          <hr style="border: none; border-top: 1px solid #eee;" />
          <p style="color: #999; font-size: 12px;">此邮件由学习平台自动发送</p>
        </div>
      `,
    });
  }

  if (smsPref?.enabled && user.phone) {
    await sendSms(user.phone, `${params.title}: ${params.content}`);
  }
}
