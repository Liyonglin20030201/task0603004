import { useState, useEffect } from 'react';
import { Card, Button, Table, Tag, Progress, Modal, Form, Input, Select, DatePicker, Space, Tabs, message, Tooltip, Typography, List, Avatar } from 'antd';
import { PlusOutlined, AimOutlined, TrophyOutlined, ThunderboltOutlined, DeleteOutlined } from '@ant-design/icons';
import { getGoals, createGoal, updateGoal, deleteGoal, decomposeGoal, completeGoal, getMyBadges } from '../../api/goals.api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function GoalList() {
  const [goals, setGoals] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [createModal, setCreateModal] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [form] = Form.useForm();

  const fetchGoals = async (p = page) => {
    setLoading(true);
    try {
      const res = await getGoals({ page: p, pageSize: 10, type: typeFilter, status: statusFilter });
      setGoals(res.data.items);
      setTotal(res.data.total);
    } finally { setLoading(false); }
  };

  const fetchBadges = async () => {
    try {
      const res = await getMyBadges();
      setBadges(res.data);
    } catch {}
  };

  useEffect(() => { fetchGoals(); fetchBadges(); }, [typeFilter, statusFilter]);

  const handleCreate = async () => {
    const values = await form.validateFields();
    await createGoal({
      ...values,
      targetDate: values.targetDate?.format('YYYY-MM-DD'),
    });
    message.success('目标已创建');
    setCreateModal(false);
    form.resetFields();
    fetchGoals();
  };

  const handleComplete = async (id: string) => {
    Modal.confirm({
      title: '确认完成此目标？',
      onOk: async () => {
        await completeGoal(id);
        message.success('恭喜完成目标！');
        fetchGoals();
        fetchBadges();
      },
    });
  };

  const handleDecompose = async (id: string) => {
    message.loading('AI 正在分解目标...', 0);
    try {
      const res = await decomposeGoal(id);
      message.destroy();
      message.success('目标已分解为子目标');
      fetchGoals();
    } catch {
      message.destroy();
      message.error('分解失败');
    }
  };

  const handleAbandon = async (id: string) => {
    Modal.confirm({
      title: '确认放弃此目标？',
      onOk: async () => {
        await deleteGoal(id);
        message.success('目标已放弃');
        fetchGoals();
      },
    });
  };

  const statusColor: Record<string, string> = { active: 'blue', completed: 'green', abandoned: 'default' };
  const statusLabel: Record<string, string> = { active: '进行中', completed: '已完成', abandoned: '已放弃' };
  const typeLabel: Record<string, string> = { long_term: '长期', short_term: '短期' };

  const columns = [
    { title: '目标', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: '类型', dataIndex: 'type', key: 'type', width: 80, render: (v: string) => <Tag>{typeLabel[v]}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (v: string) => <Tag color={statusColor[v]}>{statusLabel[v]}</Tag> },
    { title: '进度', dataIndex: 'progress', key: 'progress', width: 150, render: (v: number) => <Progress percent={Math.round(v * 100)} size="small" /> },
    { title: '截止', dataIndex: 'targetDate', key: 'targetDate', width: 110, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-' },
    { title: '子目标', key: 'children', width: 70, render: (_: any, r: any) => r.children?.length || 0 },
    {
      title: '操作', key: 'action', width: 220,
      render: (_: any, r: any) => r.status === 'active' && (
        <Space>
          <Button size="small" type="primary" onClick={() => handleComplete(r.id)}>完成</Button>
          <Tooltip title="AI分解"><Button size="small" icon={<ThunderboltOutlined />} onClick={() => handleDecompose(r.id)} /></Tooltip>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleAbandon(r.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Tabs defaultActiveKey="goals" items={[
        {
          key: 'goals', label: '我的目标', icon: <AimOutlined />,
          children: (
            <>
              <Card extra={
                <Space>
                  <Select placeholder="类型" allowClear onChange={setTypeFilter} style={{ width: 100 }} options={[{ value: 'long_term', label: '长期' }, { value: 'short_term', label: '短期' }]} />
                  <Select placeholder="状态" allowClear onChange={setStatusFilter} style={{ width: 100 }} options={[{ value: 'active', label: '进行中' }, { value: 'completed', label: '已完成' }, { value: 'abandoned', label: '已放弃' }]} />
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>新建目标</Button>
                </Space>
              }>
                <Table dataSource={goals} columns={columns} rowKey="id" loading={loading}
                  pagination={{ current: page, total, pageSize: 10, onChange: (p) => { setPage(p); fetchGoals(p); } }} />
              </Card>
            </>
          ),
        },
        {
          key: 'badges', label: '我的徽章', icon: <TrophyOutlined />,
          children: (
            <Card>
              {badges.length === 0 ? (
                <Text type="secondary">还没有获得任何徽章，继续努力！</Text>
              ) : (
                <List dataSource={badges} renderItem={(item: any) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Avatar style={{ backgroundColor: '#1890ff' }}>{item.badge?.icon || '🏆'}</Avatar>}
                      title={item.badge?.name}
                      description={`${item.badge?.description} · 获得于 ${dayjs(item.earnedAt).format('YYYY-MM-DD')}`}
                    />
                  </List.Item>
                )} />
              )}
            </Card>
          ),
        },
      ]} />

      <Modal title="新建学习目标" open={createModal} onOk={handleCreate} onCancel={() => setCreateModal(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="目标标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="type" label="目标类型" rules={[{ required: true }]}>
            <Select options={[{ value: 'long_term', label: '长期目标' }, { value: 'short_term', label: '短期目标' }]} />
          </Form.Item>
          <Form.Item name="targetDate" label="截止日期"><DatePicker style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
