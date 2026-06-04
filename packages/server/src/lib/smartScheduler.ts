import { PrismaClient } from '@prisma/client';

export interface TimeSlot {
  hour: number;
  planItemId: string;
  planItemTitle: string;
  courseTitle: string;
  courseId: string;
  durationMinutes: number;
  priority: number;
  priorityReason?: string;
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
  courseId: string;
  scheduledDate: Date;
  deadlinePriority: number;
  masteryPriority: number;
  priorityReason: string;
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

  const planItems = await prisma.planItem.findMany({
    where: {
      plan: { userId, status: { in: ['active', 'delayed'] } },
      status: 'pending',
    },
    include: { plan: { include: { course: { select: { id: true, title: true } } } } },
    orderBy: { scheduledDate: 'asc' },
  });

  // Get course mastery data for priority scoring
  const courseMastery = await getCourseMasteryScores(prisma, userId);

  const schedulable: SchedulableItem[] = planItems.map((item: any) => {
    const daysUntilDue = Math.floor((new Date(item.scheduledDate).getTime() - weekStart.getTime()) / 86400000);
    const deadlinePriority = Math.max(0, 30 - daysUntilDue);
    const mastery = courseMastery.get(item.plan.course.id) || 0.5;
    // Lower mastery = higher priority (need more practice)
    const masteryPriority = Math.round((1 - mastery) * 20);

    let priorityReason = '';
    if (daysUntilDue <= 1) priorityReason = '即将到期';
    else if (mastery < 0.3) priorityReason = '掌握度较低，需加强';
    else if (daysUntilDue <= 3) priorityReason = '临近截止';

    return {
      id: item.id,
      title: item.title,
      courseTitle: item.plan.course.title,
      courseId: item.plan.course.id,
      scheduledDate: new Date(item.scheduledDate),
      deadlinePriority,
      masteryPriority,
      priorityReason,
    };
  });

  // Combined priority: deadline (60%) + mastery need (40%)
  schedulable.sort((a, b) => {
    const scoreA = a.deadlinePriority * 0.6 + a.masteryPriority * 0.4;
    const scoreB = b.deadlinePriority * 0.6 + b.masteryPriority * 0.4;
    return scoreB - scoreA;
  });

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
      const priority = Math.round(item.deadlinePriority * 0.6 + item.masteryPriority * 0.4);
      daySchedule.slots.push({
        hour,
        planItemId: item.id,
        planItemTitle: item.title,
        courseTitle: item.courseTitle,
        courseId: item.courseId,
        durationMinutes: sessionDuration,
        priority,
        priorityReason: item.priorityReason,
      });

      dayMinutes += sessionDuration;
      totalMinutes += sessionDuration;
      itemIndex++;
    }

    days.push(daySchedule);
  }

  return { days, totalMinutes, itemsScheduled: itemIndex };
}

export interface DailyAdaptResult {
  reorderedSlots: TimeSlot[];
  adjustmentReason: string;
  coursePriorityChanges: { courseId: string; courseTitle: string; direction: 'up' | 'down'; reason: string }[];
}

export async function adaptAfterDailyCompletion(
  prisma: PrismaClient,
  userId: string,
  completedItemId: string,
  masteryRating: number, // 1-5: how well the user felt they mastered it
  actualDuration: number | null
): Promise<DailyAdaptResult> {
  const currentSchedule = await prisma.smartSchedule.findFirst({
    where: { userId, status: 'active' },
    orderBy: { weekStart: 'desc' },
  });

  if (!currentSchedule) {
    return { reorderedSlots: [], adjustmentReason: '无活跃计划', coursePriorityChanges: [] };
  }

  const scheduleData = currentSchedule.scheduleData as any;
  const todayStr = new Date().toISOString().slice(0, 10);

  // Find the completed item's course
  const completedItem = await prisma.planItem.findUnique({
    where: { id: completedItemId },
    include: { plan: { include: { course: { select: { id: true, title: true } } } } },
  });

  if (!completedItem) {
    return { reorderedSlots: [], adjustmentReason: '任务不存在', coursePriorityChanges: [] };
  }

  const completedCourseId = completedItem.plan.course.id;
  const completedCourseTitle = completedItem.plan.course.title;

  // Get remaining slots for today and future days
  const futureDays = scheduleData.days.filter((day: any) => day.date >= todayStr);
  let allRemainingSlots: TimeSlot[] = [];
  for (const day of futureDays) {
    allRemainingSlots.push(...day.slots.filter((s: any) => s.planItemId !== completedItemId));
  }

  const coursePriorityChanges: DailyAdaptResult['coursePriorityChanges'] = [];
  let adjustmentReason = '';

  if (masteryRating <= 2) {
    // Low mastery: boost priority for same course items
    allRemainingSlots = allRemainingSlots.map((slot: any) => {
      if (slot.courseId === completedCourseId) {
        return { ...slot, priority: Math.min(100, (slot.priority || 50) + 15), priorityReason: '前次掌握不佳，需巩固' };
      }
      return slot;
    });
    coursePriorityChanges.push({
      courseId: completedCourseId,
      courseTitle: completedCourseTitle,
      direction: 'up',
      reason: `掌握评分 ${masteryRating}/5，提升该课程后续任务优先级`,
    });
    adjustmentReason = `「${completedCourseTitle}」掌握不够扎实，后续同课程任务优先级已提升`;
  } else if (masteryRating >= 4) {
    // High mastery: can deprioritize same course, boost others
    allRemainingSlots = allRemainingSlots.map((slot: any) => {
      if (slot.courseId === completedCourseId) {
        return { ...slot, priority: Math.max(0, (slot.priority || 50) - 10) };
      }
      return { ...slot, priority: Math.min(100, (slot.priority || 50) + 5) };
    });
    coursePriorityChanges.push({
      courseId: completedCourseId,
      courseTitle: completedCourseTitle,
      direction: 'down',
      reason: `掌握评分 ${masteryRating}/5，已掌握良好，降低紧迫度`,
    });
    adjustmentReason = `「${completedCourseTitle}」掌握良好，智能调配更多时间给薄弱科目`;
  } else {
    adjustmentReason = '掌握程度正常，维持当前排序';
  }

  // Check if user was faster/slower than expected
  const profile = await prisma.studyHabitProfile.findUnique({ where: { userId } });
  const expectedDuration = profile?.avgSessionMinutes || 45;
  if (actualDuration && actualDuration < expectedDuration * 0.6) {
    // Much faster: user is in flow, can handle more
    adjustmentReason += '；完成速度较快，学习状态好';
  } else if (actualDuration && actualDuration > expectedDuration * 1.5) {
    // Much slower: might be tired, reduce remaining load
    adjustmentReason += '；耗时较长，建议适当休息';
  }

  // Re-sort remaining slots by updated priority
  allRemainingSlots.sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));

  // Redistribute into future days
  const updatedDays = scheduleData.days.map((day: any) => {
    if (day.date < todayStr) return day;
    return { ...day, slots: [] };
  });

  let slotIdx = 0;
  const bestHours = profile?.bestHours || [9, 10, 14, 15, 20, 21];
  const bestDays = profile?.bestDaysOfWeek || [1, 2, 3, 4, 5];
  const maxDailyMinutes = Math.round(expectedDuration * 2.5);

  for (const day of updatedDays) {
    if (day.date < todayStr) continue;
    if (!bestDays.includes(day.dayOfWeek)) continue;

    let dayMinutes = 0;
    const hours = [...bestHours].sort((a: number, b: number) => a - b);

    for (const hour of hours) {
      if (slotIdx >= allRemainingSlots.length) break;
      if (dayMinutes + expectedDuration > maxDailyMinutes) break;

      day.slots.push({ ...allRemainingSlots[slotIdx], hour });
      dayMinutes += expectedDuration;
      slotIdx++;
    }
  }

  // Save updated schedule
  const adjustments = (currentSchedule.adjustments as any[]) || [];
  adjustments.push({
    type: 'daily_adapt',
    itemId: completedItemId,
    masteryRating,
    actualDuration,
    changes: coursePriorityChanges,
    at: new Date().toISOString(),
  });

  const itemsScheduled = updatedDays.reduce((s: number, d: any) => s + d.slots.length, 0);
  const totalMinutes = updatedDays.reduce((s: number, d: any) => s + d.slots.reduce((ss: number, sl: any) => ss + sl.durationMinutes, 0), 0);

  await prisma.smartSchedule.update({
    where: { id: currentSchedule.id },
    data: {
      scheduleData: { days: updatedDays, totalMinutes, itemsScheduled },
      adjustments,
    },
  });

  // Get today's remaining reordered slots
  const todayDay = updatedDays.find((d: any) => d.date === todayStr);
  const reorderedSlots = todayDay?.slots || [];

  return { reorderedSlots, adjustmentReason, coursePriorityChanges };
}

async function getCourseMasteryScores(prisma: PrismaClient, userId: string): Promise<Map<string, number>> {
  const courses = await prisma.course.findMany({
    where: { userId, status: 'active' },
    include: {
      learningPlans: {
        where: { status: { in: ['active', 'delayed'] } },
        include: { items: { select: { status: true } } },
      },
      wrongAnswers: {
        where: { userId },
        select: { reviewCount: true },
      },
    },
  });

  const masteryMap = new Map<string, number>();

  for (const course of courses) {
    const totalItems = course.learningPlans.reduce((s: number, p: any) => s + p.items.length, 0);
    const completedItems = course.learningPlans.reduce(
      (s: number, p: any) => s + p.items.filter((i: any) => i.status === 'completed').length, 0
    );
    const completionRate = totalItems > 0 ? completedItems / totalItems : 0;

    const totalWA = course.wrongAnswers.length;
    const masteredWA = course.wrongAnswers.filter((w: any) => w.reviewCount >= 5).length;
    const waRate = totalWA > 0 ? masteredWA / totalWA : 1;

    // Combined mastery: 60% completion + 40% wrong-answer mastery
    const mastery = completionRate * 0.6 + waRate * 0.4;
    masteryMap.set(course.id, mastery);
  }

  return masteryMap;
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
