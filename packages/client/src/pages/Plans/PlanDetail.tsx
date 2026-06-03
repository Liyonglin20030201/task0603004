import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Typography, List, Tag, Button, Space, Progress, message, Modal, Spin, Timeline } from 'antd';
import { ArrowLeftOutlined, ExclamationCircleOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { getPlan, delayPlan } from '../../api/plans.api';
import { createCheckIn } from '../../api/checkins.api';

const { Title, Text } = Typography;

export default function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchPlan = async () => {
    if (!id) return;
    try {
      const data = await getPlan(id);
      setPlan(data);
    } catch { message.error('获取计划失败'); }
    setLoading(false);
  };

  useEffect(() => { fetchPlan(); }, [id]);

  const handleDelay = () => {
    Modal.confirm({
      title: '确认延期',
      icon: <ExclamationCircleOutlined />,
      content: '将把所有逾期未完成的项目标记为跳过，并将后续项目顺延。确定延期？',
      onOk: async () => {
        try {
          const res = await delayPlan(id!);
          message.success(res.message || '延期成功');
          fetchPlan();
        } catch (err: any) {
          message.error(err.response?.data?.error || '延期失败');
        }
      },
    });
  };

  const handleCheckIn = async (planItemId: string) => {
    try {
      await createCheckIn({ planItemId });
      message.success('打卡成功');
      fetchPlan();
    } catch (err: any) {
      message.error(err.response?.data?.error || '打卡失败');
    }
  };

  if (loading) return <Spin size="large" />;
  if (!plan) return <div>计划不存在</div>;

  const totalItems = plan.items.length;
  const completedItems = plan.items.filter((i: any) => i.status === 'completed').length;

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/plans')} style={{ marginBottom: 16 }}>返回</Button>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>{plan.title}</Title>
            <Text type="secondary">{plan.course?.title} | {plan.startDate?.slice(0, 10)} ~ {plan.endDate?.slice(0, 10)}</Text>
          </div>
          <Space>
            <Tag color={plan.status === 'delayed' ? 'red' : 'green'}>{plan.status}</Tag>
            {plan.originalEndDate && plan.originalEndDate !== plan.endDate && (
              <Text type="secondary">原定结束: {plan.originalEndDate?.slice(0, 10)}</Text>
            )}
          </Space>
        </div>
        <Progress percent={totalItems > 0 ? Math.round(completedItems / totalItems * 100) : 0} style={{ marginTop: 16 }} />
        <div style={{ marginTop: 12 }}>
          <Button danger onClick={handleDelay}>处理延期</Button>
        </div>
      </Card>

      <Card title="学习项目" style={{ marginTop: 16 }}>
        <List
          dataSource={plan.items}
          renderItem={(item: any) => {
            const today = new Date().toISOString().slice(0, 10);
            const isToday = item.scheduledDate?.slice(0, 10) === today;
            const isOverdue = item.status === 'pending' && item.scheduledDate?.slice(0, 10) < today;
            return (
              <List.Item
                actions={[
                  item.status === 'pending' && (
                    <Button type="primary" size="small" onClick={() => handleCheckIn(item.id)}>打卡</Button>
                  ),
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  avatar={
                    item.status === 'completed' ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} /> :
                    item.status === 'skipped' ? <ClockCircleOutlined style={{ color: '#999', fontSize: 20 }} /> :
                    <ClockCircleOutlined style={{ color: isOverdue ? '#ff4d4f' : '#1890ff', fontSize: 20 }} />
                  }
                  title={<span style={{ color: isOverdue ? '#ff4d4f' : undefined }}>{item.title} {isToday && <Tag color="blue">今日</Tag>}</span>}
                  description={`计划日期: ${item.scheduledDate?.slice(0, 10)}${item.originalDate && item.originalDate !== item.scheduledDate ? ` (原定: ${item.originalDate?.slice(0, 10)})` : ''}`}
                />
                <Tag color={item.status === 'completed' ? 'green' : item.status === 'skipped' ? 'default' : isOverdue ? 'red' : 'blue'}>
                  {item.status === 'completed' ? '已完成' : item.status === 'skipped' ? '已跳过' : isOverdue ? '逾期' : '待完成'}
                </Tag>
              </List.Item>
            );
          }}
        />
      </Card>
    </div>
  );
}
