import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import MainLayout from './components/Layout/MainLayout';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import DashboardPage from './pages/Dashboard/DashboardPage';
import CourseList from './pages/Courses/CourseList';
import CourseDetail from './pages/Courses/CourseDetail';
import PlanList from './pages/Plans/PlanList';
import PlanDetail from './pages/Plans/PlanDetail';
import PlanEditor from './pages/Plans/PlanEditor';
import DailyCheckIn from './pages/CheckIn/DailyCheckIn';
import WrongAnswerList from './pages/Notes/WrongAnswerList';
import NoteList from './pages/Notes/NoteList';
import ReviewSuggestions from './pages/AIReview/ReviewSuggestions';
import CalendarView from './pages/Calendar/CalendarView';
import Statistics from './pages/Stats/Statistics';
import Notifications from './pages/Notifications/Notifications';
import AdminPanel from './pages/Admin/AdminPanel';
import ResourceList from './pages/Resources/ResourceList';
import NotificationSettings from './pages/Settings/NotificationSettings';
import GoalList from './pages/Goals/GoalList';
import ReportList from './pages/Reports/ReportList';
import GroupList from './pages/Groups/GroupList';
import GroupDetail from './pages/Groups/GroupDetail';
import PredictionDashboard from './pages/Predictions/PredictionDashboard';
import SmartPlanPage from './pages/SmartPlan/SmartPlanPage';
import PartnerPage from './pages/Partners/PartnerPage';
import SyncPage from './pages/Sync/SyncPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/courses" element={<CourseList />} />
                <Route path="/courses/:id" element={<CourseDetail />} />
                <Route path="/plans" element={<PlanList />} />
                <Route path="/plans/new" element={<PlanEditor />} />
                <Route path="/plans/:id" element={<PlanDetail />} />
                <Route path="/checkin" element={<DailyCheckIn />} />
                <Route path="/wrong-answers" element={<WrongAnswerList />} />
                <Route path="/notes" element={<NoteList />} />
                <Route path="/ai-review" element={<ReviewSuggestions />} />
                <Route path="/calendar" element={<CalendarView />} />
                <Route path="/stats" element={<Statistics />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/resources" element={<ResourceList />} />
                <Route path="/settings/notifications" element={<NotificationSettings />} />
                <Route path="/goals" element={<GoalList />} />
                <Route path="/reports" element={<ReportList />} />
                <Route path="/groups" element={<GroupList />} />
                <Route path="/groups/:id" element={<GroupDetail />} />
                <Route path="/predictions" element={<PredictionDashboard />} />
                <Route path="/smart-plan" element={<SmartPlanPage />} />
                <Route path="/partners" element={<PartnerPage />} />
                <Route path="/sync" element={<SyncPage />} />
              </Routes>
            </MainLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
