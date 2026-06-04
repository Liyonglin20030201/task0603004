import { PrismaClient } from '@prisma/client';

export interface TimeSlot {
  hour: number;
  planItemId: string;
  planItemTitle: string;
  courseTitle: string;
  durationMinutes: number;
}

export interface DaySchedule {
  date: string;
  dayOfWeek: number;
  slots: TimeSlot[];
}

export interface WeekScheduleData {
  days: DaySchedule[];
  totalMinutes: number;
  itemsScheduled: number;
}

interface SchedulableItem {
  id: string;
  title: string;
  courseTitle: string;
  scheduledDate: Date;
  deadlinePriority: number;
}

export async function generateWeekSchedule(
  prisma: PrismaClient,
  userId: string,
  weekStart: Date
): Promise<WeekScheduleData> {
  const profile = await prisma.studyHabitProfile.findUnique({ where: { userId } });

  const bestHours = profile?.bestHours || [9, 10, 14, 15, 20, 21];
  const bestDays = profile?.bestDaysOfWeek || [1, 2, 3, 4, 5];
  const sessionDuration = profile?.avgSessionMinutes || 45;
  const maxDailyMinutes = Math.round(sessionDuration * 2.5);

  // Get pending plan items for this week and beyond
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const planItems = await prisma.planItem.findMany({
    where: {
      plan: { userId, status: { in: ['active', 'delayed'] } },
      status: 'pending',
    },
    include: { plan: { include: { course: { select: { title: true } } } } },
    orderBy: { scheduledDate: 'asc' },
  });

  // Priority: items with earlier scheduled dates come first
  const schedulable: SchedulableItem[] = planItems.map((item: any) => ({
    id: item.id,
    title: item.title,
    courseTitle: item.plan.course.title,
    scheduledDate: new Date(item.scheduledDate),
    deadlinePriority: Math.max(0, 30 - Math.floor((new Date(item.scheduledDate).getTime() - weekStart.getTime()) / 86400000)),
  }));

  schedulable.sort((a, b) => b.deadlinePriority - a.deadlinePriority);

  // Build weekly schedule
  const days: DaySchedule[] = [];
  let totalMinutes = 0;
  let itemIndex = 0;

  for (let d = 0; d < 7; d++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + d);
    const dayOfWeek = date.getDay();
    const dateStr = date.toISOString().slice(0, 10);

    const daySchedule: DaySchedule = { date: dateStr, dayOfWeek, slots: [] };

    if (!bestDays.includes(dayOfWeek)) {
      days.push(daySchedule);
      continue;
    }

    let dayMinutes = 0;
    const availableHours = [...bestHours].sort((a, b) => a - b);

    for (const hour of availableHours) {
      if (itemIndex >= schedulable.length) break;
      if (dayMinutes + sessionDuration > maxDailyMinutes) break;

      const item = schedulable[itemIndex];
      daySchedule.slots.push({
        hour,
        planItemId: item.id,
        planItemTitle: item.title,
        courseTitle: item.courseTitle,
        durationMinutes: sessionDuration,
      });

      dayMinutes += sessionDuration;
      totalMinutes += sessionDuration;
      itemIndex++;
    }

    days.push(daySchedule);
  }

  return {
    days,
    totalMinutes,
    itemsScheduled: itemIndex,
  };
}

export function adjustScheduleAfterCheckin(
  scheduleData: WeekScheduleData,
  completedItemId: string
): WeekScheduleData {
  const updatedDays = scheduleData.days.map(day => ({
    ...day,
    slots: day.slots.filter(slot => slot.planItemId !== completedItemId),
  }));

  const itemsScheduled = updatedDays.reduce((s, d) => s + d.slots.length, 0);
  const totalMinutes = updatedDays.reduce((s, d) => s + d.slots.reduce((ss, sl) => ss + sl.durationMinutes, 0), 0);

  return { days: updatedDays, totalMinutes, itemsScheduled };
}
