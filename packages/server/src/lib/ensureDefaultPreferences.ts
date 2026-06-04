import { PrismaClient } from '@prisma/client';

const ALL_TYPES = ['reminder', 'system', 'achievement', 'group', 'goal'] as const;
const DEFAULT_CHANNELS = [
  { channel: 'in_app' as const, enabled: true },
  { channel: 'email' as const, enabled: false },
  { channel: 'sms' as const, enabled: false },
];

export async function ensureDefaultPreferences(prisma: PrismaClient, userId: string): Promise<void> {
  const existing = await prisma.notificationPreference.count({ where: { userId } });
  if (existing > 0) return;

  const data = ALL_TYPES.flatMap((type) =>
    DEFAULT_CHANNELS.map((ch) => ({
      userId,
      type,
      channel: ch.channel,
      enabled: ch.enabled,
    }))
  );

  await prisma.notificationPreference.createMany({ data, skipDuplicates: true });
}
