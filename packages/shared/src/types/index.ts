// User types
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export interface User {
  id: string;
  email: string;
  phone?: string | null;
  nickname: string;
  avatarUrl: string | null;
  role: UserRole;
  timezone: string;
  createdAt: string;
}

// Course types
export enum CourseStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  COMPLETED = 'completed',
}

export interface Course {
  id: string;
  userId: string;
  title: string;
  category: string;
  description: string;
  status: CourseStatus;
  createdAt: string;
}

// Learning Plan types
export enum PlanStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  DELAYED = 'delayed',
}

export enum PlanItemStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
}

export interface LearningPlan {
  id: string;
  userId: string;
  courseId: string;
  title: string;
  startDate: string;
  endDate: string;
  status: PlanStatus;
  originalEndDate: string | null;
  createdAt: string;
}

export interface PlanItem {
  id: string;
  planId: string;
  title: string;
  scheduledDate: string;
  originalDate: string | null;
  sortOrder: number;
  status: PlanItemStatus;
}

// Check-in types
export interface CheckIn {
  id: string;
  userId: string;
  planItemId: string;
  checkInDate: string;
  durationMinutes: number | null;
  note: string | null;
  createdAt: string;
}

// Wrong Answer types
export interface WrongAnswer {
  id: string;
  userId: string;
  courseId: string;
  question: string;
  wrongAnswer: string;
  correctAnswer: string;
  explanation: string | null;
  tags: string[];
  reviewCount: number;
  nextReviewDate: string | null;
  createdAt: string;
}

// Note types
export interface Note {
  id: string;
  userId: string;
  courseId: string | null;
  planItemId: string | null;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
}

// AI Review types
export interface AIReviewSuggestion {
  id: string;
  userId: string;
  courseId: string | null;
  suggestionContent: ReviewPlan;
  generatedAt: string;
  accepted: boolean;
}

export interface ReviewPlan {
  days: ReviewDay[];
}

export interface ReviewDay {
  date: string;
  topics: string[];
  durationMinutes: number;
  priority: 'high' | 'medium' | 'low';
}

// Notification types
export enum NotificationType {
  REMINDER = 'reminder',
  SYSTEM = 'system',
  ACHIEVEMENT = 'achievement',
  GROUP = 'group',
  GOAL = 'goal',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  read: boolean;
  channel: string;
  scheduledFor: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  nickname: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}

// Stats types
export interface StatsOverview {
  totalCourses: number;
  activePlans: number;
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
  todayCheckins: number;
  totalStudyMinutes: number;
}

export interface DailyStats {
  date: string;
  checkIns: number;
  studyMinutes: number;
  itemsCompleted: number;
}

export interface CourseStats {
  courseId: string;
  courseTitle: string;
  status: CourseStatus;
  totalItems: number;
  completedItems: number;
  completionRate: number;
}

// Resource types
export interface Resource {
  id: string;
  userId: string;
  title: string;
  description: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  courseId: string | null;
  planId: string | null;
  downloads: number;
  isPublic: boolean;
  createdAt: string;
}

// Learning Goal types
export enum GoalType {
  LONG_TERM = 'long_term',
  SHORT_TERM = 'short_term',
}

export enum GoalStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
}

export interface LearningGoal {
  id: string;
  userId: string;
  title: string;
  description: string;
  type: GoalType;
  status: GoalStatus;
  targetDate: string | null;
  progress: number;
  parentId: string | null;
  courseId: string | null;
  createdAt: string;
  children?: LearningGoal[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: Record<string, any>;
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  goalId: string | null;
  earnedAt: string;
  badge?: Badge;
}

// Analysis Report types
export enum ReportPeriod {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

export enum ReportStatus {
  PENDING = 'pending',
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface AnalysisReport {
  id: string;
  userId: string;
  period: ReportPeriod;
  periodStart: string;
  periodEnd: string;
  status: ReportStatus;
  reportData: ReportData | null;
  aiSummary: string | null;
  generatedAt: string | null;
  createdAt: string;
}

export interface ReportData {
  overview: {
    totalStudyMinutes: number;
    totalCheckIns: number;
    activeDays: number;
    completedItems: number;
    averageDailyMinutes: number;
  };
  efficiency: {
    bestDayOfWeek: string;
    averageSessionLength: number;
  };
  knowledge: {
    courseProgress: Array<{ courseId: string; title: string; completionRate: number }>;
    wrongAnswerTrend: { total: number; mastered: number; newThisPeriod: number };
  };
  trends: Array<{ date: string; minutes: number; items: number }>;
}

// Study Group types
export enum GroupRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

export enum GroupJoinPolicy {
  OPEN = 'open',
  APPROVAL = 'approval',
  INVITE = 'invite',
}

export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  joinPolicy: GroupJoinPolicy;
  maxMembers: number;
  createdAt: string;
  myRole?: GroupRole | null;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: GroupRole;
  joinedAt: string;
  user?: { id: string; nickname: string; avatarUrl: string | null };
}

export interface GroupSharedItem {
  id: string;
  groupId: string;
  userId: string;
  itemType: 'course' | 'plan';
  itemId: string;
  sharedAt: string;
}

export interface GroupGoal {
  id: string;
  groupId: string;
  title: string;
  description: string;
  targetDate: string | null;
  status: GoalStatus;
  createdAt: string;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  userId: string;
  content: string;
  createdAt: string;
  user?: { id: string; nickname: string; avatarUrl: string | null };
}

export interface LeaderboardEntry {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  role: GroupRole;
  weeklyMinutes: number;
  weeklyCheckIns: number;
  streak: number;
  score: number;
}

// ===== Prediction Types =====

export enum PredictionType {
  COMPLETION_RATE = 'completion_rate',
  STUDY_TIME = 'study_time',
  ENGAGEMENT = 'engagement',
  RETENTION = 'retention',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export interface PredictionPoint {
  date: string;
  value: number;
  confidenceLow: number;
  confidenceHigh: number;
}

export interface LearningPrediction {
  id: string;
  userId: string;
  type: PredictionType;
  horizonDays: number;
  predictions: PredictionPoint[];
  modelParams: {
    slope: number;
    intercept: number;
    r2: number;
    trend: 'improving' | 'stable' | 'declining';
  };
  aiComment: string | null;
  createdAt: string;
}

export interface LearningAlert {
  id: string;
  userId: string;
  severity: AlertSeverity;
  alertType: string;
  title: string;
  description: string;
  dismissed: boolean;
  triggerData: Record<string, any> | null;
  createdAt: string;
}

// ===== Smart Plan Types =====

export enum SmartPlanStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
}

export interface StudyHabitProfile {
  id: string;
  userId: string;
  bestHours: number[];
  bestDaysOfWeek: number[];
  avgSessionMinutes: number;
  preferredFrequency: number;
  peakProductivityHour: number;
  weeklyStudyMinutes: number;
  analysisData: {
    hourDistribution: Record<number, number>;
    dayDistribution: Record<number, number>;
    sessionLengths: number[];
  } | null;
  lastUpdated: string;
}

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

export interface SmartSchedule {
  id: string;
  userId: string;
  weekStart: string;
  status: SmartPlanStatus;
  scheduleData: { days: DaySchedule[]; totalMinutes: number; itemsScheduled: number };
  adjustments: any[] | null;
  aiExplanation: string | null;
  createdAt: string;
}

// ===== Sync Types =====

export interface SyncPushItem {
  action: 'create' | 'update' | 'delete';
  entityType: 'note' | 'checkin' | 'wrong_answer';
  entityId?: string;
  payload: Record<string, any>;
  clientVersion?: number;
  clientTimestamp: string;
}

export interface SyncResult {
  entityId: string;
  status: 'synced' | 'conflict' | 'error';
  serverVersion?: number;
  serverData?: any;
  error?: string;
}

export interface SyncPullResponse {
  notes: Note[];
  checkIns: CheckIn[];
  wrongAnswers: WrongAnswer[];
  serverTime: string;
}

// ===== Partner Types =====

export enum PartnerRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export interface PartnerProfile {
  id: string;
  userId: string;
  isSearching: boolean;
  bio: string;
  courseIds: string[];
  goalKeywords: string[];
  availableHours: number[];
  studyPreferences: Record<string, any> | null;
  lastActive: string;
}

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

export interface PartnerRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: PartnerRequestStatus;
  message: string | null;
  score: number;
  createdAt: string;
  fromUser?: { id: string; nickname: string; avatarUrl: string | null };
  toUser?: { id: string; nickname: string; avatarUrl: string | null };
}

export interface Partnership {
  partnershipId: string;
  partner: { id: string; nickname: string; avatarUrl: string | null };
  startedAt: string;
}

export interface PartnerProgress {
  currentStreak: number;
  weeklyCheckIns: number;
  weeklyStudyMinutes: number;
}
