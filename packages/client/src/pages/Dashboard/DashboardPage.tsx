import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, List, Tag, Typography, Spin, Progress, Button, Space, Alert, Timeline, Divider } from 'antd';
import {
  BookOutlined, FireOutlined, CheckCircleOutlined, ClockCircleOutlined,
  TrophyOutlined, RiseOutlined, BulbOutlined, ExclamationCircleOutlined,
  ArrowRightOutlined, CalendarOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getStatsOverview, getWeeklyReport, getCourseStats } from '../../api/stats.api';
import { getPlans } from '../../api/plans.api';
import { getDueWrongAnswers, getWrongAnswerStats } from '../../api/wrongAnswers.api';

const { Title, Text } = Typography;

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [todayItems, setTodayItems] = useState<any[]>([]);
  const [weeklyReport, setWeeklyReport] = useState<any>(null);
  const [courseStats, setCourseStats] = useState<any[]>([]);
  const [dueReviews, setDueReviews] = useState<any[]>([]);
  const [reviewStats, setReviewStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      getStatsOverview().catch(() => null),
      getWeeklyReport().catch(() => null),
      getPlans({ status: 'active' }).catch(() => ({ items: [] })),
      getCourseStats(false).catch(() => []),
      getDueWrongAnswers().catch(() => []),
      getWrongAnswerStats().catch(() => null),
    ]).then(([statsData, weekly, plansData, courses, due, rStats]) => {
      setStats(statsData);
      setWeeklyReport(weekly);
      setCourseStats((courses || []).slice(0, 5));
      setDueReviews((due || []).slice(0, 5));
      setReviewStats(rStats);

      const today = new Date().toISOString().slice(0, 10);
      const items: any[] = [];
      for (const plan of (plansData?.items || [])) {
        if (plan.items) {
          for (const item of plan.items) {
            if (item.scheduledDate?.slice(0, 10) === today && item.status === 'pending') {
              items.push({ ...item, planTitle: plan.title });
            }
          }
        }
      }
      setTodayItems(items);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', marginTop: 100 }} />;

  const hasOverdueReviews = dueReviews.length > 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>仪表盘</Title>
        <Text type="secondary">{new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
      </div>

      {/* Alert for overdue reviews */}
      {hasOverdueReviews && (
        <Alert
          type="warning"
          showIcon
          icon={<BulbOutlined />}
          message={`你有 ${reviewStats?.dueToday || dueReviews.length} 道错题待复习`}
          action={<Button size="small" type="primary" onClick={() => navigate('/wrong-answers')}>去复习</Button>}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Stats Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} lg={4}>
          <Card hoverable onClick={() => navigate('/courses')}>
            <Statistic title="课程数" value={stats?.totalCourses || 0} prefix={<BookOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card hoverable onClick={() => navigate('/plans')}>
            <Statistic title="活跃计划" value={stats?.activePlans || 0} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card hoverable onClick={() => navigate('/checkin')}>
            <Statistic title="连续打卡" value={stats?.currentStreak || 0} suffix="天" prefix={<FireOutlined style={{ color: '#ff4d4f' }} />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card hoverable onClick={() => navigate('/stats')}>
            <Statistic title="完成率" value={Math.round((stats?.completionRate || 0) * 100)} suffix="%" prefix={<RiseOutlined style={{ color: '#52c41a' }} />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card hoverable onClick={() => navigate('/checkin')}>
            <Statistic title="今日打卡" value={stats?.todayCheckins || 0} prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card hoverable onClick={() => navigate('/stats')}>
            <Statistic title="总学习" value={stats?.totalStudyMinutes || 0} suffix="分钟" prefix={<TrophyOutlined style={{ color: '#faad14' }} />} />
          </Card>
        </Col>
      </Row>

      {/* Main Content Row */}
      <Row gutter={16} style={{ marginTop: 24 }}>
        {/* Today's Tasks */}
        <Col xs={24} lg={12}>
          <Card
            title={<span><CalendarOutlined style={{ marginRight: 8 }} />今日待办</span>}
            extra={<Button type="link" onClick={() => navigate('/checkin')}>去打卡 <ArrowRightOutlined /></Button>}
          >
            {todayItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <CheckCircleOutlined style={{ fontSize: 40, color: '#52c41a' }} />
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">今天没有待办任务，休息一下吧！</Text>
                </div>
              </div>
            ) : (
              <List
                size="small"
                dataSource={todayItems.slice(0, 6)}
                renderItem={(item: any) => (
                  <List.Item actions={[<Button type="link" size="small" onClick={() => navigate('/checkin')}>打卡</Button>]}>
                    <List.Item.Meta
                      avatar={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
                      title={item.title}
                      description={item.planTitle}
                    />
                  </List.Item>
                )}
                footer={todayItems.length > 6 && <Text type="secondary">还有 {todayItems.length - 6} 项...</Text>}
              />
            )}
          </Card>
        </Col>

        {/* Weekly Report */}
        <Col xs={24} lg={12}>
          <Card title={<span><TrophyOutlined style={{ marginRight: 8 }} />本周报告</span>} extra={<Button type="link" onClick={() => navigate('/stats')}>详情</Button>}>
            {weeklyReport ? (
              <div>
                <Row gutter={[16, 16]}>
                  <Col span={12}><Statistic title="学习天数" value={weeklyReport.activeDays} suffix="/ 7" valueStyle={{ fontSize: 20 }} /></Col>
                  <Col span={12}><Statistic title="学习时长" value={weeklyReport.totalStudyMinutes} suffix="分钟" valueStyle={{ fontSize: 20 }} /></Col>
                  <Col span={12}><Statistic title="完成项目" value={weeklyReport.completedItems} valueStyle={{ fontSize: 20 }} /></Col>
                  <Col span={12}><Statistic title="新增错题" value={weeklyReport.newWrongAnswers} valueStyle={{ fontSize: 20 }} /></Col>
                </Row>
                <Divider style={{ margin: '12px 0' }} />
                <Progress
                  percent={Math.round(weeklyReport.activeDays / 7 * 100)}
                  format={() => `${weeklyReport.activeDays}/7 天`}
                  status={weeklyReport.activeDays >= 5 ? 'success' : 'active'}
                />
              </div>
            ) : <Text type="secondary">暂无数据</Text>}
          </Card>
        </Col>
      </Row>

      {/* Bottom Row */}
      <Row gutter={16} style={{ marginTop: 16 }}>
        {/* Course Progress */}
        <Col xs={24} lg={12}>
          <Card title={<span><BookOutlined style={{ marginRight: 8 }} />课程进度</span>} extra={<Button type="link" onClick={() => navigate('/courses')}>全部</Button>}>
            {courseStats.length === 0 ? (
              <Text type="secondary">暂无课程</Text>
            ) : (
              <List
                size="small"
                dataSource={courseStats}
                renderItem={(course: any) => (
                  <List.Item>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text>{course.courseTitle}</Text>
                        <Text type="secondary">{course.completedItems}/{course.totalItems}</Text>
                      </div>
                      <Progress percent={Math.round(course.completionRate * 100)} size="small" showInfo={false} />
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* Due Reviews */}
        <Col xs={24} lg={12}>
          <Card
            title={<span><ExclamationCircleOutlined style={{ marginRight: 8, color: '#faad14' }} />待复习错题</span>}
            extra={<Button type="link" onClick={() => navigate('/wrong-answers')}>全部</Button>}
          >
            {dueReviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <CheckCircleOutlined style={{ fontSize: 32, color: '#52c41a' }} />
                <div style={{ marginTop: 8 }}><Text type="secondary">暂无待复习错题</Text></div>
              </div>
            ) : (
              <List
                size="small"
                dataSource={dueReviews}
                renderItem={(item: any) => (
                  <List.Item>
                    <List.Item.Meta
                      title={<Text ellipsis style={{ maxWidth: 300 }}>{item.question}</Text>}
                      description={
                        <Space>
                          {item.course && <Tag size="small" color="blue">{item.course.title}</Tag>}
                          {item.tags?.slice(0, 2).map((t: string) => <Tag key={t} size="small">{t}</Tag>)}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
            {reviewStats && (
              <div style={{ marginTop: 8, padding: '8px 0', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-around' }}>
                <Text type="secondary">总计 <Text strong>{reviewStats.total}</Text></Text>
                <Text type="secondary">已掌握 <Text strong style={{ color: '#52c41a' }}>{reviewStats.mastered}</Text></Text>
                <Text type="secondary">学习中 <Text strong style={{ color: '#1890ff' }}>{reviewStats.learning}</Text></Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
