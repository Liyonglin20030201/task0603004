import { useState, useEffect } from 'react';
import { Card, List, Button, Tag, Statistic, Row, Col, message, Typography, Empty, InputNumber, Input, Modal } from 'antd';
import { CheckCircleOutlined, FireOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { getCheckIns, createCheckIn, getStreak, deleteCheckIn } from '../../api/checkins.api';
import { getPlans } from '../../api/plans.api';

const { Title, Text } = Typography;

export default function DailyCheckIn() {
  const [todayItems, setTodayItems] = useState<any[]>([]);
  const [todayCheckIns, setTodayCheckIns] = useState<any[]>([]);
  const [streak, setStreak] = useState({ currentStreak: 0, longestStreak: 0 });
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [checkIns, streakData, plansData] = await Promise.all([
        getCheckIns({ date: today }),
        getStreak(),
        getPlans({ status: 'active' }),
      ]);
      setTodayCheckIns(checkIns || []);
      setStreak(streakData);

      // Collect today's pending items from all active plans
      const allItems: any[] = [];
      for (const plan of (plansData?.items || [])) {
        if (plan.items) {
          for (const item of plan.items) {
            if (item.scheduledDate?.slice(0, 10) === today && item.status === 'pending') {
              allItems.push({ ...item, planTitle: plan.title });
            }
          }
        }
      }
      setTodayItems(allItems);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCheckIn = async (planItemId: string) => {
    try {
      await createCheckIn({ planItemId });
      message.success('打卡成功！');
      fetchData();
    } catch (err: any) {
      if (err.response?.status === 409) {
        message.warning('今日已打卡该项目，请勿重复打卡');
      } else {
        message.error(err.response?.data?.error || '打卡失败');
      }
    }
  };

  const handleUndo = async (checkInId: string) => {
    Modal.confirm({
      title: '撤销打卡',
      content: '确定撤销今天的这条打卡记录？',
      onOk: async () => {
        try {
          await deleteCheckIn(checkInId);
          message.success('已撤销');
          fetchData();
        } catch (err: any) {
          message.error(err.response?.data?.error || '撤销失败');
        }
      },
    });
  };

  const checkedItemIds = new Set((todayCheckIns || []).map((c: any) => c.planItemId));

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic title="当前连续打卡" value={streak.currentStreak} suffix="天" prefix={<FireOutlined style={{ color: '#ff4d4f' }} />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="最长连续打卡" value={streak.longestStreak} suffix="天" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="今日已完成" value={todayCheckIns?.length || 0} suffix={`/ ${todayItems.length + (todayCheckIns?.length || 0)}`} prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} />
          </Card>
        </Col>
      </Row>

      <Card title={`今日待办 (${today})`} loading={loading}>
        {todayItems.length === 0 && (!todayCheckIns || todayCheckIns.length === 0) ? (
          <Empty description="今天没有待办学习项目" />
        ) : (
          <List
            dataSource={[...todayItems]}
            renderItem={(item: any) => (
              <List.Item
                actions={[
                  checkedItemIds.has(item.id)
                    ? <Tag color="green">已打卡</Tag>
                    : <Button type="primary" onClick={() => handleCheckIn(item.id)}>打卡</Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<ClockCircleOutlined style={{ fontSize: 20, color: checkedItemIds.has(item.id) ? '#52c41a' : '#1890ff' }} />}
                  title={item.title}
                  description={item.planTitle}
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {todayCheckIns && todayCheckIns.length > 0 && (
        <Card title="今日打卡记录" style={{ marginTop: 16 }}>
          <List
            dataSource={todayCheckIns}
            renderItem={(checkIn: any) => (
              <List.Item actions={[<Button type="link" danger size="small" onClick={() => handleUndo(checkIn.id)}>撤销</Button>]}>
                <List.Item.Meta
                  avatar={<CheckCircleOutlined style={{ fontSize: 20, color: '#52c41a' }} />}
                  title={checkIn.planItem?.title || '学习项目'}
                  description={`打卡时间: ${new Date(checkIn.createdAt).toLocaleTimeString()}`}
                />
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
}
