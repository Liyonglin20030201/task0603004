import { useState, useEffect } from 'react';
import { Card, Button, Select, Table, Tag, Typography, Space, Spin, Empty, message, Modal, DatePicker } from 'antd';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { getReports, getReport, generateReport, getLatestReports } from '../../api/reports.api';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

export default function ReportList() {
  const [reports, setReports] = useState<any[]>([]);
  const [currentReport, setCurrentReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [genModal, setGenModal] = useState(false);
  const [genPeriod, setGenPeriod] = useState('monthly');
  const [genDate, setGenDate] = useState<any>(null);

  const fetchReports = async (p = page) => {
    setLoading(true);
    try {
      const res = await getReports({ page: p, pageSize: 10 });
      setReports(res.data.items);
      setTotal(res.data.total);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchReports(); }, []);

  const handleGenerate = async () => {
    if (!genDate) { message.warning('请选择起始日期'); return; }
    setGenerating(true);
    try {
      const res = await generateReport({ period: genPeriod, periodStart: genDate.format('YYYY-MM-DD') });
      message.success(res.message || '报告开始生成');
      setGenModal(false);
      setTimeout(() => fetchReports(), 3000);
    } catch (err: any) {
      message.error(err.response?.data?.error || '生成失败');
    } finally { setGenerating(false); }
  };

  const handleViewReport = async (id: string) => {
    try {
      const res = await getReport(id);
      setCurrentReport(res.data);
    } catch { message.error('获取报告失败'); }
  };

  const statusMap: Record<string, { color: string; label: string }> = {
    pending: { color: 'default', label: '待生成' },
    generating: { color: 'processing', label: '生成中' },
    completed: { color: 'success', label: '已完成' },
    failed: { color: 'error', label: '失败' },
  };

  const periodLabel: Record<string, string> = { monthly: '月报', quarterly: '季报', yearly: '年报' };

  const columns = [
    { title: '类型', dataIndex: 'period', key: 'period', width: 80, render: (v: string) => <Tag>{periodLabel[v]}</Tag> },
    { title: '时间范围', key: 'range', render: (_: any, r: any) => `${dayjs(r.periodStart).format('YYYY-MM-DD')} ~ ${dayjs(r.periodEnd).format('YYYY-MM-DD')}` },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (v: string) => <Tag color={statusMap[v]?.color}>{statusMap[v]?.label}</Tag> },
    { title: '生成时间', dataIndex: 'generatedAt', key: 'generatedAt', width: 170, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
    {
      title: '操作', key: 'action', width: 100,
      render: (_: any, r: any) => r.status === 'completed' && <Button size="small" type="link" onClick={() => handleViewReport(r.id)}>查看</Button>,
    },
  ];

  return (
    <div>
      <Card
        title="深度分析报告"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setGenModal(true)}>生成报告</Button>}
      >
        <Table dataSource={reports} columns={columns} rowKey="id" loading={loading}
          pagination={{ current: page, total, pageSize: 10, onChange: (p) => { setPage(p); fetchReports(p); } }} />
      </Card>

      {currentReport && currentReport.reportData && (
        <Card title={`报告详情 - ${periodLabel[currentReport.period]} (${dayjs(currentReport.periodStart).format('YYYY-MM-DD')} ~ ${dayjs(currentReport.periodEnd).format('YYYY-MM-DD')})`} style={{ marginTop: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card type="inner" title="学习概览">
              <Space size="large" wrap>
                <div><Text type="secondary">总学习时间</Text><br /><Title level={4} style={{ margin: 0 }}>{currentReport.reportData.overview.totalStudyMinutes} 分钟</Title></div>
                <div><Text type="secondary">打卡次数</Text><br /><Title level={4} style={{ margin: 0 }}>{currentReport.reportData.overview.totalCheckIns} 次</Title></div>
                <div><Text type="secondary">活跃天数</Text><br /><Title level={4} style={{ margin: 0 }}>{currentReport.reportData.overview.activeDays} 天</Title></div>
                <div><Text type="secondary">日均学习</Text><br /><Title level={4} style={{ margin: 0 }}>{currentReport.reportData.overview.averageDailyMinutes} 分钟</Title></div>
              </Space>
            </Card>

            <Card type="inner" title="效率分析">
              <Text>最佳学习日：<Tag color="blue">{currentReport.reportData.efficiency.bestDayOfWeek}</Tag></Text>
              <Text style={{ marginLeft: 24 }}>平均每次学习：{currentReport.reportData.efficiency.averageSessionLength} 分钟</Text>
            </Card>

            {currentReport.reportData.trends && currentReport.reportData.trends.length > 0 && (
              <Card type="inner" title="学习趋势">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={currentReport.reportData.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="minutes" fill="#1890ff" name="学习分钟" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {currentReport.aiSummary && (
              <Card type="inner" title="AI 学习建议">
                <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{currentReport.aiSummary}</Paragraph>
              </Card>
            )}
          </Space>
        </Card>
      )}

      <Modal title="生成分析报告" open={genModal} onOk={handleGenerate} onCancel={() => setGenModal(false)} confirmLoading={generating}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select value={genPeriod} onChange={setGenPeriod} style={{ width: '100%' }}
            options={[{ value: 'monthly', label: '月度报告' }, { value: 'quarterly', label: '季度报告' }, { value: 'yearly', label: '年度报告' }]} />
          <DatePicker picker={genPeriod === 'yearly' ? 'year' : 'month'} value={genDate} onChange={setGenDate} style={{ width: '100%' }} placeholder="选择起始时间" />
        </Space>
      </Modal>
    </div>
  );
}
