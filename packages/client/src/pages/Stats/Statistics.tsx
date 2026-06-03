import { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Switch, Typography, Spin, Table, Progress } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';
import { getDailyStats, getCourseStats } from '../../api/stats.api';

const { RangePicker } = DatePicker;
const { Title } = Typography;

export default function Statistics() {
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [courseData, setCourseData] = useState<any[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[string, string]>([
    dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getDailyStats(dateRange[0], dateRange[1]),
      getCourseStats(includeArchived),
    ]).then(([daily, courses]) => {
      setDailyData(daily || []);
      setCourseData(courses || []);
    }).finally(() => setLoading(false));
  }, [dateRange, includeArchived]);

  const courseColumns = [
    { title: '课程', dataIndex: 'courseTitle', key: 'courseTitle' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => s === 'archived' ? '已归档' : '进行中' },
    { title: '总项目', dataIndex: 'totalItems', key: 'totalItems' },
    { title: '已完成', dataIndex: 'completedItems', key: 'completedItems' },
    { title: '完成率', key: 'completionRate', render: (_: any, r: any) => <Progress percent={Math.round(r.completionRate * 100)} size="small" /> },
  ];

  if (loading) return <Spin size="large" style={{ display: 'block', marginTop: 100 }} />;

  return (
    <div>
      <Title level={4}>进度统计</Title>

      <Card title="每日学习趋势" style={{ marginBottom: 16 }}
        extra={<RangePicker value={[dayjs(dateRange[0]), dayjs(dateRange[1])]} onChange={(dates) => {
          if (dates) setDateRange([dates[0]!.format('YYYY-MM-DD'), dates[1]!.format('YYYY-MM-DD')]);
        }} />}
      >
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="studyMinutes" fill="#1890ff" name="学习分钟" />
            <Bar dataKey="itemsCompleted" fill="#52c41a" name="完成项目" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="打卡趋势" style={{ marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="checkIns" stroke="#722ed1" name="打卡次数" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title="课程进度对比"
        extra={<span>包含归档课程: <Switch checked={includeArchived} onChange={setIncludeArchived} /></span>}
      >
        <Table columns={courseColumns} dataSource={courseData} rowKey="courseId" pagination={false} />
      </Card>
    </div>
  );
}
