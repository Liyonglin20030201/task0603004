import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function updateGroupGoalProgress(groupId: string): Promise<void> {
  const goals = await prisma.groupGoal.findMany({
    where: { groupId, status: 'active', targetType: { not: null }, targetValue: { not: null } },
  });

  if (goals.length === 0) return;

  const memberIds = (await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  })).map((m: any) => m.userId);

  if (memberIds.length === 0) return;

  for (const goal of goals) {
    let progress = 0;
    const since = goal.createdAt;

    if (goal.targetType === 'checkin_count') {
      const count = await prisma.checkIn.count({
        where: { userId: { in: memberIds }, checkInDate: { gte: since } },
      });
      progress = Math.min(count / goal.targetValue!, 1.0);
    } else if (goal.targetType === 'study_minutes') {
      const result = await prisma.checkIn.aggregate({
        where: { userId: { in: memberIds }, checkInDate: { gte: since } },
        _sum: { durationMinutes: true },
      });
      const totalMinutes = result._sum.durationMinutes || 0;
      progress = Math.min(totalMinutes / goal.targetValue!, 1.0);
    } else if (goal.targetType === 'completion_rate') {
      const plans = await prisma.learningPlan.findMany({
        where: { userId: { in: memberIds }, status: { in: ['active', 'completed', 'delayed'] } },
        include: { items: { select: { status: true } } },
      });
      if (plans.length > 0) {
        const totalItems = plans.reduce((sum: number, p: any) => sum + p.items.length, 0);
        const completedItems = plans.reduce((sum: number, p: any) => sum + p.items.filter((i: any) => i.status === 'completed').length, 0);
        const avgRate = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
        progress = Math.min(avgRate / goal.targetValue!, 1.0);
      }
    }

    const update: any = { progress };
    if (progress >= 1.0) {
      update.status = 'completed';
    }

    await prisma.groupGoal.update({ where: { id: goal.id }, data: update });
  }
}
