import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, List, Tag, Typography, Spin, Progress } from 'antd';
import {
  BookOutlined, FireOutlined, CheckCircleOutlined, ClockCircleOutlined,
  TrophyOutlined, RiseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getStatsOverview, getWeeklyReport } from '../../api/stats.api';
import { getPlans } from '../../api/plans.api';
import { getCheckIns } from '../../api/checkins.api';

const { Title, Text } = Typography;

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [todayItems, setTodayItems] = useState<any[]>([]);
  const [weeklyReport, setWeeklyReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      getStatsOverview(),
      getWeeklyReport(),
      getPlans({ status: 'active' }),
    ]).then(([statsData, weekly, plansData]) => {
      setStats(statsData);
      setWeeklyReport(weekly);
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

  return (
    <div>
      <Title level={4}>仪表盘</Title>

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} lg={4}>
          <Card><Statistic title="课程数" value={stats?.totalCourses || 0} prefix={<BookOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card><Statistic title="活跃计划" value={stats?.activePlans || 0} prefix={<ClockCircleOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card><Statistic title="连续打卡" value={stats?.currentStreak || 0} suffix="天" prefix={<FireOutlined style={{ color: '#ff4d4f' }} />} /></Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card><Statistic title="完成率" value={Math.round((stats?.completionRate || 0) * 100)} suffix="%" prefix={<RiseOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card><Statistic title="今日打卡" value={stats?.todayCheckins || 0} prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} /></Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card><Statistic title="总学习" value={stats?.totalStudyMinutes || 0} suffix="分钟" prefix={<TrophyOutlined />} /></Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="今日待办" extra={<a onClick={() => navigate('/checkin')}>去打卡</a>}>
            {todayItems.length === 0 ? (
              <Text type="secondary">今天没有待办任务，休息一下吧</Text>
            ) : (
              <List
                size="small"
                dataSource={todayItems.slice(0, 5)}
                renderItem={(item: any) => (
                  <List.Item>
                    <List.Item.Meta title={item.title} description={item.planTitle} />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="本周报告">
            {weeklyReport ? (
              <Row gutter={[8, 8]}>
                <Col span={12}><Statistic title="学习天数" value={weeklyReport.activeDays} suffix="/ 7" /></Col>
                <Col span={12}><Statistic title="学习时长" value={weeklyReport.totalStudyMinutes} suffix="分钟" /></Col>
                <Col span={12}><Statistic title="完成项目" value={weeklyReport.completedItems} /></Col>
                <Col span={12}><Statistic title="新增错题" value={weeklyReport.newWrongAnswers} /></Col>
              </Row>
            ) : <Text type="secondary">暂无数据</Text>}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
