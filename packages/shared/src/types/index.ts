// User types
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export interface User {
  id: string;
  email: string;
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
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  read: boolean;
  scheduledFor: string | null;
  createdAt: string;
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
