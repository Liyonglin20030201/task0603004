import { useState, useEffect } from 'react';
import { Card, Row, Col, Spin, Alert, Button, Tag, Statistic, List, message, Tabs } from 'antd';
import { ReloadOutlined, RiseOutlined, FallOutlined, MinusOutlined } from '@ant-design/icons';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { generatePredictions, getPredictions, getPredictionTrends, getAlerts, dismissAlert } from '../../api/predictions.api';

export default function PredictionDashboard() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [trends, setTrends] = useState<{ actual: any[]; predicted: any[] }>({ actual: [], predicted: [] });
  const [aiComment, setAiComment] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [preds, alertData, trendData] = await Promise.all([
        getPredictions(),
        getAlerts(false),
        getPredictionTrends(),
      ]);
      setPredictions(preds);
      setAlerts(alertData);
      setTrends(trendData);
      if (preds.length > 0 && preds[0].aiComment) {
        setAiComment(preds[0].aiComment);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generatePredictions();
      setAiComment(result.aiComment);
      message.success('预测生成完成');
      await loadData();
    } catch { message.error('生成失败'); }
    setGenerating(false);
  };

  const handleDismiss = async (id: string) => {
    await dismissAlert(id);
    setAlerts(alerts.filter(a => a.id !== id));
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  const studyTimePred = predictions.find(p => p.type === 'study_time' && p.horizonDays === 14);
  const engagementPred = predictions.find(p => p.type === 'engagement' && p.horizonDays === 14);
  const completionPred = predictions.find(p => p.type === 'completion_rate' && p.horizonDays === 14);

  const trendIcon = (trend?: string) => {
    if (trend === 'improving') return <RiseOutlined style={{ color: '#52c41a' }} />;
    if (trend === 'declining') return <FallOutlined style={{ color: '#ff4d4f' }} />;
    return <MinusOutlined style={{ color: '#faad14' }} />;
  };

  const trendLabel = (trend?: string) => {
    if (trend === 'improving') return <Tag color="green">上升趋势</Tag>;
    if (trend === 'declining') return <Tag color="red">下降趋势</Tag>;
    return <Tag color="orange">稳定</Tag>;
  };

  // Combine actual + predicted for chart
  const chartData = [
    ...trends.actual.map(d => ({ date: d.date.slice(5), actual: d.studyMinutes })),
    ...(studyTimePred?.predictions || []).map((p: any) => ({
      date: p.date.slice(5),
      predicted: p.value,
      confidenceLow: p.confidenceLow,
      confidenceHigh: p.confidenceHigh,
    })),
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>智能学习预测</h2>
        <Button type="primary" icon={<ReloadOutlined />} loading={generating} onClick={handleGenerate}>
          重新生成预测
        </Button>
      </div>

      {alerts.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {alerts.map(alert => (
            <Alert
              key={alert.id}
              message={alert.title}
              description={alert.description}
              type={alert.severity === 'critical' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info'}
              closable
              onClose={() => handleDismiss(alert.id)}
              style={{ marginBottom: 8 }}
            />
          ))}
        </div>
      )}

      {aiComment && (
        <Card size="small" style={{ marginBottom: 24, background: '#f6ffed' }}>
          <strong>AI 建议：</strong>{aiComment}
        </Card>
      )}

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="学习时长趋势"
              value={studyTimePred?.modelParams?.trend === 'improving' ? '上升' : studyTimePred?.modelParams?.trend === 'declining' ? '下降' : '稳定'}
              prefix={trendIcon(studyTimePred?.modelParams?.trend)}
            />
            {trendLabel(studyTimePred?.modelParams?.trend)}
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="参与度趋势"
              value={engagementPred?.modelParams?.trend === 'improving' ? '上升' : engagementPred?.modelParams?.trend === 'declining' ? '下降' : '稳定'}
              prefix={trendIcon(engagementPred?.modelParams?.trend)}
            />
            {trendLabel(engagementPred?.modelParams?.trend)}
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="完成率趋势"
              value={completionPred?.modelParams?.trend === 'improving' ? '上升' : completionPred?.modelParams?.trend === 'declining' ? '下降' : '稳定'}
              prefix={trendIcon(completionPred?.modelParams?.trend)}
            />
            {trendLabel(completionPred?.modelParams?.trend)}
          </Card>
        </Col>
      </Row>

      <Card title="学习时长预测（未来14天）" style={{ marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="confidenceHigh" stroke="none" fill="#1890ff" fillOpacity={0.1} />
            <Area type="monotone" dataKey="confidenceLow" stroke="none" fill="#fff" fillOpacity={1} />
            <Line type="monotone" dataKey="actual" stroke="#52c41a" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="predicted" stroke="#1890ff" strokeWidth={2} strokeDasharray="5 5" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ textAlign: 'center', color: '#999', fontSize: 12, marginTop: 8 }}>
          <span style={{ marginRight: 16 }}>—— 实际学习时长</span>
          <span style={{ marginRight: 16 }}>- - - 预测学习时长</span>
          <span>■ 80%置信区间</span>
        </div>
      </Card>

      <Card title="模型参数">
        <Row gutter={16}>
          {predictions.filter(p => p.horizonDays === 14).map(pred => (
            <Col span={8} key={`${pred.type}-${pred.horizonDays}`}>
              <Card size="small" title={{ study_time: '学习时长', engagement: '参与度', completion_rate: '完成率' }[pred.type as string] || pred.type}>
                <p>斜率: {pred.modelParams?.slope}</p>
                <p>R²: {pred.modelParams?.r2}</p>
                <p>趋势: {trendLabel(pred.modelParams?.trend)}</p>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
