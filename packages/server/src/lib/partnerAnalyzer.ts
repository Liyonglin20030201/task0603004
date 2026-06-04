import { PrismaClient } from '@prisma/client';

interface CourseStrength {
  courseId: string;
  courseTitle: string;
  completionRate: number;
  wrongAnswerMastery: number;
  overallMastery: number;
}

interface ComplementaryArea {
  courseId: string;
  courseTitle: string;
  strongUser: 'me' | 'partner';
  gap: number;
  myMastery: number;
  partnerMastery: number;
}

interface UserLearningStats {
  streak: number;
  weeklyMinutes: number;
  weeklyCheckIns: number;
  totalCourses: number;
  avgSessionMinutes: number;
}

export interface PartnerAnalysis {
  myStrengths: CourseStrength[];
  partnerStrengths: CourseStrength[];
  complementary: ComplementaryArea[];
  sharedCourses: { courseId: string; courseTitle: string; myMastery: number; partnerMastery: number }[];
  myStats: UserLearningStats;
  partnerStats: UserLearningStats;
}

export async function analyzePartnerComparison(
  prisma: PrismaClient,
  myUserId: string,
  partnerId: string
): Promise<PartnerAnalysis> {
  const [myMastery, partnerMastery, myStats, partnerStats] = await Promise.all([
    getUserCourseMastery(prisma, myUserId),
    getUserCourseMastery(prisma, partnerId),
    getUserStats(prisma, myUserId),
    getUserStats(prisma, partnerId),
  ]);

  const allCourseIds = new Set([...myMastery.keys(), ...partnerMastery.keys()]);

  const sharedCourses: PartnerAnalysis['sharedCourses'] = [];
  const complementary: ComplementaryArea[] = [];

  for (const courseId of allCourseIds) {
    const mine = myMastery.get(courseId);
    const theirs = partnerMastery.get(courseId);

    if (mine && theirs) {
      sharedCourses.push({
        courseId,
        courseTitle: mine.courseTitle,
        myMastery: mine.overallMastery,
        partnerMastery: theirs.overallMastery,
      });

      const gap = Math.abs(mine.overallMastery - theirs.overallMastery);
      if (gap >= 0.15) {
        complementary.push({
          courseId,
          courseTitle: mine.courseTitle,
          strongUser: mine.overallMastery > theirs.overallMastery ? 'me' : 'partner',
          gap,
          myMastery: mine.overallMastery,
          partnerMastery: theirs.overallMastery,
        });
      }
    }
  }

  complementary.sort((a, b) => b.gap - a.gap);

  const myStrengths = [...myMastery.values()]
    .filter(c => c.overallMastery >= 0.6)
    .sort((a, b) => b.overallMastery - a.overallMastery)
    .slice(0, 5);

  const partnerStrengths = [...partnerMastery.values()]
    .filter(c => c.overallMastery >= 0.6)
    .sort((a, b) => b.overallMastery - a.overallMastery)
    .slice(0, 5);

  return { myStrengths, partnerStrengths, complementary, sharedCourses, myStats, partnerStats };
}

async function getUserCourseMastery(prisma: PrismaClient, userId: string): Promise<Map<string, CourseStrength>> {
  const courses = await prisma.course.findMany({
    where: { userId, status: 'active' },
    include: {
      learningPlans: {
        where: { status: { in: ['active', 'completed', 'delayed'] } },
        include: { items: { select: { status: true } } },
      },
      wrongAnswers: {
        where: { userId },
        select: { reviewCount: true },
      },
    },
  });

  const map = new Map<string, CourseStrength>();

  for (const course of courses) {
    const totalItems = course.learningPlans.reduce((s: number, p: any) => s + p.items.length, 0);
    const completedItems = course.learningPlans.reduce(
      (s: number, p: any) => s + p.items.filter((i: any) => i.status === 'completed').length, 0
    );
    const completionRate = totalItems > 0 ? completedItems / totalItems : 0;

    const totalWA = course.wrongAnswers.length;
    const masteredWA = course.wrongAnswers.filter((w: any) => w.reviewCount >= 5).length;
    const waRate = totalWA > 0 ? masteredWA / totalWA : 1;

    const overallMastery = completionRate * 0.6 + waRate * 0.4;

    map.set(course.id, {
      courseId: course.id,
      courseTitle: course.title,
      completionRate,
      wrongAnswerMastery: waRate,
      overallMastery,
    });
  }

  return map;
}

async function getUserStats(prisma: PrismaClient, userId: string): Promise<UserLearningStats> {
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const [checkIns, weeklyCheckIns, courses] = await Promise.all([
    prisma.checkIn.findMany({
      where: { userId },
      select: { checkInDate: true, durationMinutes: true },
      orderBy: { checkInDate: 'desc' },
      take: 90,
    }),
    prisma.checkIn.findMany({
      where: { userId, checkInDate: { gte: weekAgo } },
      select: { durationMinutes: true },
    }),
    prisma.course.count({ where: { userId, status: 'active' } }),
  ]);

  // Calculate streak
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateSet = new Set<number>();
  for (const c of checkIns) {
    const d = new Date((c as any).checkInDate);
    d.setHours(0, 0, 0, 0);
    dateSet.add(d.getTime());
  }
  const dates = [...dateSet].sort((a, b) => b - a);

  const todayTime = today.getTime();
  if (dates.length > 0 && (dates[0] === todayTime || dates[0] === todayTime - 86400000)) {
    streak = 1;
    for (let i = 1; i < dates.length; i++) {
      if (dates[i - 1] - dates[i] === 86400000) streak++;
      else break;
    }
  }

  const weeklyMinutes = weeklyCheckIns.reduce((s: number, c: any) => s + (c.durationMinutes || 0), 0);
  const durations = checkIns.filter((c: any) => c.durationMinutes).map((c: any) => c.durationMinutes);
  const avgSessionMinutes = durations.length > 0
    ? Math.round(durations.reduce((s: number, d: number) => s + d, 0) / durations.length)
    : 0;

  return {
    streak,
    weeklyMinutes,
    weeklyCheckIns: weeklyCheckIns.length,
    totalCourses: courses,
    avgSessionMinutes,
  };
}
