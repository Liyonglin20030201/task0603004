import { PrismaClient } from '@prisma/client';

export interface MatchScore {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string;
  totalScore: number;
  breakdown: {
    courseOverlap: number;
    scheduleCompatibility: number;
    paceAlignment: number;
    goalSimilarity: number;
    activityRecency: number;
  };
  sharedCourses: string[];
}

export async function findMatches(
  prisma: PrismaClient,
  userId: string,
  limit: number = 20
): Promise<MatchScore[]> {
  const myProfile = await prisma.partnerProfile.findUnique({
    where: { userId },
    include: { user: { select: { nickname: true } } },
  });

  if (!myProfile) return [];

  // Get existing partnerships and pending requests to exclude
  const [partnerships, requests] = await Promise.all([
    prisma.partnership.findMany({
      where: { OR: [{ user1Id: userId }, { user2Id: userId }], isActive: true },
    }),
    prisma.partnerRequest.findMany({
      where: { OR: [{ fromUserId: userId }, { toUserId: userId }], status: 'pending' },
    }),
  ]);

  const excludeIds = new Set<string>([userId]);
  partnerships.forEach((p: any) => {
    excludeIds.add(p.user1Id);
    excludeIds.add(p.user2Id);
  });
  requests.forEach((r: any) => {
    excludeIds.add(r.fromUserId);
    excludeIds.add(r.toUserId);
  });

  // Find candidates: searching, not excluded, has at least 1 shared course
  const candidates = await prisma.partnerProfile.findMany({
    where: {
      isSearching: true,
      userId: { notIn: Array.from(excludeIds) },
      courseIds: { hasSome: myProfile.courseIds },
    },
    include: { user: { select: { id: true, nickname: true, avatarUrl: true } } },
  });

  // Get my habit profile for pace comparison
  const myHabitProfile = await prisma.studyHabitProfile.findUnique({ where: { userId } });

  // Get candidate habit profiles
  const candidateHabits = await prisma.studyHabitProfile.findMany({
    where: { userId: { in: candidates.map((c: any) => c.userId) } },
  });
  const habitMap = new Map(candidateHabits.map((h: any) => [h.userId, h]));

  // Score each candidate
  const scores: MatchScore[] = [];

  for (const candidate of candidates) {
    // Course overlap (0-30)
    const sharedCourses = myProfile.courseIds.filter((c: string) => candidate.courseIds.includes(c));
    const maxCourses = Math.max(myProfile.courseIds.length, candidate.courseIds.length, 1);
    const courseOverlap = Math.round(30 * (sharedCourses.length / maxCourses));

    // Schedule compatibility (0-25)
    const myHours = myProfile.availableHours;
    const theirHours = candidate.availableHours;
    const sharedHours = myHours.filter((h: number) => theirHours.includes(h));
    const maxHours = Math.max(myHours.length, theirHours.length, 1);
    const scheduleCompatibility = Math.round(25 * (sharedHours.length / maxHours));

    // Pace alignment (0-20)
    let paceAlignment = 10; // default if no habit data
    const theirHabit = habitMap.get(candidate.userId) as any;
    if (myHabitProfile && theirHabit) {
      const myWeekly = (myHabitProfile as any).weeklyStudyMinutes || 1;
      const theirWeekly = theirHabit.weeklyStudyMinutes || 1;
      const ratio = Math.min(myWeekly, theirWeekly) / Math.max(myWeekly, theirWeekly, 1);
      paceAlignment = Math.round(20 * ratio);
    }

    // Goal similarity (0-15)
    const myKeywords = myProfile.goalKeywords;
    const theirKeywords = candidate.goalKeywords;
    const sharedKeywords = myKeywords.filter((k: string) => theirKeywords.includes(k));
    const maxKeywords = Math.max(myKeywords.length, theirKeywords.length, 1);
    const goalSimilarity = Math.round(15 * (sharedKeywords.length / maxKeywords));

    // Activity recency (0-10)
    const daysSinceActive = Math.floor((Date.now() - new Date(candidate.lastActive).getTime()) / 86400000);
    const activityRecency = Math.round(10 * Math.max(0, 1 - daysSinceActive / 30));

    const totalScore = courseOverlap + scheduleCompatibility + paceAlignment + goalSimilarity + activityRecency;

    if (totalScore >= 30) {
      scores.push({
        userId: candidate.userId,
        nickname: candidate.user.nickname,
        avatarUrl: candidate.user.avatarUrl,
        bio: candidate.bio,
        totalScore,
        breakdown: { courseOverlap, scheduleCompatibility, paceAlignment, goalSimilarity, activityRecency },
        sharedCourses,
      });
    }
  }

  scores.sort((a, b) => b.totalScore - a.totalScore);
  return scores.slice(0, limit);
}
