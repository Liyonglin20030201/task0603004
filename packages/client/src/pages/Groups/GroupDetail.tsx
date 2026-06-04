import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Tabs, Button, List, Avatar, Tag, Space, Table, Typography, Modal, Form, Input, DatePicker, InputNumber, Select, Progress, message, Popconfirm, Empty } from 'antd';
import { TeamOutlined, TrophyOutlined, MessageOutlined, ShareAltOutlined, AimOutlined, DeleteOutlined, CrownOutlined, UserOutlined, DownloadOutlined } from '@ant-design/icons';
import { getGroup, leaveGroup, deleteGroup, getGroupCheckins, getLeaderboard, getGroupProgress, getSharedItems, getGroupGoals, createGroupGoal, getGroupMessages, sendGroupMessage } from '../../api/groups.api';
import { downloadResource } from '../../api/resources.api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<any>(null);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [sharedItems, setSharedItems] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [goalModal, setGoalModal] = useState(false);
  const [form] = Form.useForm();
  const msgEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<any>(null);

  const fetchGroup = async () => {
    if (!id) return;
    try {
      const res = await getGroup(id);
      setGroup(res.data);
    } catch { navigate('/groups'); }
  };

  const fetchCheckins = async () => { if (!id) return; try { const r = await getGroupCheckins(id); setCheckins(r.data); } catch {} };
  const fetchLeaderboard = async () => { if (!id) return; try { const r = await getLeaderboard(id); setLeaderboard(r.data); } catch {} };
  const fetchProgress = async () => { if (!id) return; try { const r = await getGroupProgress(id); setProgress(r.data); } catch {} };
  const fetchShared = async () => { if (!id) return; try { const r = await getSharedItems(id); setSharedItems(r.data); } catch {} };
  const fetchGoals = async () => { if (!id) return; try { const r = await getGroupGoals(id); setGoals(r.data); } catch {} };
  const fetchMessages = async () => {
    if (!id) return;
    try {
      const r = await getGroupMessages(id, { pageSize: 50 });
      setMessages(r.data.items);
      setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {}
  };

  useEffect(() => {
    fetchGroup();
    fetchCheckins();
    fetchLeaderboard();
    fetchProgress();
    fetchShared();
    fetchGoals();
    fetchMessages();

    pollRef.current = setInterval(fetchMessages, 30000);
    return () => clearInterval(pollRef.current);
  }, [id]);

  const handleLeave = async () => {
    await leaveGroup(id!);
    message.success('已退出小组');
    navigate('/groups');
  };

  const handleDelete = async () => {
    await deleteGroup(id!);
    message.success('小组已解散');
    navigate('/groups');
  };

  const handleSendMessage = async () => {
    if (!msgInput.trim()) return;
    await sendGroupMessage(id!, msgInput.trim());
    setMsgInput('');
    fetchMessages();
  };

  const handleCreateGoal = async () => {
    const values = await form.validateFields();
    await createGroupGoal(id!, { ...values, targetDate: values.targetDate?.format('YYYY-MM-DD') });
    message.success('小组目标已创建');
    setGoalModal(false);
    form.resetFields();
    fetchGoals();
  };

  const handleDownloadResource = async (resourceId: string, fileName: string) => {
    try {
      const res = await downloadResource(resourceId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('下载失败');
    }
  };

  if (!group) return null;

  const isAdmin = group.myRole === 'owner' || group.myRole === 'admin';
  const roleIcon: Record<string, any> = { owner: <CrownOutlined style={{ color: '#faad14' }} />, admin: <CrownOutlined style={{ color: '#1890ff' }} />, member: <UserOutlined /> };

  const leaderboardColumns = [
    { title: '#', key: 'rank', width: 50, render: (_: any, __: any, i: number) => i + 1 },
    { title: '成员', key: 'user', render: (_: any, r: any) => <Space><Avatar size="small">{r.nickname?.[0]}</Avatar>{r.nickname}</Space> },
    { title: '连续打卡', dataIndex: 'streak', key: 'streak', width: 90, render: (v: number) => `${v} 天` },
    { title: '本周学习', dataIndex: 'weeklyMinutes', key: 'weeklyMinutes', width: 100, render: (v: number) => `${v} 分钟` },
    { title: '本周打卡', dataIndex: 'weeklyCheckIns', key: 'weeklyCheckIns', width: 90, render: (v: number) => `${v} 次` },
  ];

  const progressColumns = [
    { title: '成员', dataIndex: 'nickname', key: 'nickname' },
    { title: '计划数', dataIndex: 'totalPlans', key: 'totalPlans', width: 80 },
    { title: '完成率', key: 'rate', width: 100, render: (_: any, r: any) => `${Math.round(r.completionRate * 100)}%` },
    { title: '已完成', dataIndex: 'completedItems', key: 'completedItems', width: 80 },
  ];

  return (
    <div>
      <Card title={<Space><TeamOutlined />{group.name}</Space>}
        extra={
          <Space>
            {group.myRole === 'owner' && <Popconfirm title="确认解散小组？" onConfirm={handleDelete}><Button danger>解散小组</Button></Popconfirm>}
            {group.myRole !== 'owner' && <Popconfirm title="确认退出小组？" onConfirm={handleLeave}><Button>退出小组</Button></Popconfirm>}
          </Space>
        }
      >
        <Text type="secondary">{group.description || '暂无描述'}</Text>
        <div style={{ marginTop: 8 }}>
          <Space wrap>
            {group.members?.map((m: any) => (
              <Tag key={m.userId} icon={roleIcon[m.role]}>{m.user.nickname}</Tag>
            ))}
          </Space>
        </div>
      </Card>

      <Tabs defaultActiveKey="leaderboard" style={{ marginTop: 16 }} items={[
        {
          key: 'leaderboard', label: '排行榜', icon: <TrophyOutlined />,
          children: <Card><Table dataSource={leaderboard} columns={leaderboardColumns} rowKey="userId" pagination={false} size="small" /></Card>,
        },
        {
          key: 'progress', label: '进度对比', icon: <ShareAltOutlined />,
          children: <Card><Table dataSource={progress} columns={progressColumns} rowKey="userId" pagination={false} size="small" /></Card>,
        },
        {
          key: 'checkins', label: '打卡动态',
          children: (
            <Card>
              {checkins.length === 0 ? <Empty description="暂无打卡记录" /> : (
                <List dataSource={checkins} renderItem={(item: any) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Avatar size="small">{item.user?.nickname?.[0]}</Avatar>}
                      title={`${item.user?.nickname} 完成了「${item.planItem?.title || '学习任务'}」`}
                      description={`${dayjs(item.createdAt).format('MM-DD HH:mm')} · ${item.durationMinutes || 30}分钟`}
                    />
                  </List.Item>
                )} />
              )}
            </Card>
          ),
        },
        {
          key: 'goals', label: '小组目标', icon: <AimOutlined />,
          children: (
            <Card extra={isAdmin && <Button size="small" type="primary" onClick={() => setGoalModal(true)}>新增目标</Button>}>
              {goals.length === 0 ? <Empty description="暂无小组目标" /> : (
                <List dataSource={goals} renderItem={(g: any) => (
                  <List.Item extra={g.targetType && <Progress type="circle" percent={Math.round((g.progress || 0) * 100)} size={48} />}>
                    <List.Item.Meta
                      title={<Space>{g.title}<Tag color={g.status === 'completed' ? 'green' : 'blue'}>{g.status === 'completed' ? '已完成' : '进行中'}</Tag></Space>}
                      description={`${g.description || ''}${g.targetDate ? ` · 截止: ${dayjs(g.targetDate).format('YYYY-MM-DD')}` : ''}${g.targetType ? ` · 目标: ${g.targetValue}${g.targetType === 'study_minutes' ? '分钟' : g.targetType === 'checkin_count' ? '次打卡' : '%完成率'}` : ''}`}
                    />
                  </List.Item>
                )} />
              )}
            </Card>
          ),
        },
        {
          key: 'shared', label: '共享资源',
          children: (
            <Card>
              {sharedItems.length === 0 ? <Empty description="暂无共享内容" /> : (
                <List dataSource={sharedItems} renderItem={(item: any) => (
                  <List.Item actions={item.itemType === 'resource' && item.detail ? [
                    <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownloadResource(item.itemId, item.detail.fileName)}>下载</Button>
                  ] : undefined}>
                    <List.Item.Meta
                      title={item.detail?.title || item.itemId}
                      description={`${item.itemType === 'course' ? '课程' : item.itemType === 'plan' ? '计划' : '资源'} · 由 ${item.user?.nickname} 分享于 ${dayjs(item.sharedAt).format('MM-DD')}${item.itemType === 'resource' && item.detail?.fileSize ? ` · ${(item.detail.fileSize / 1024 / 1024).toFixed(1)}MB` : ''}`}
                    />
                  </List.Item>
                )} />
              )}
            </Card>
          ),
        },
        {
          key: 'messages', label: '小组讨论', icon: <MessageOutlined />,
          children: (
            <Card>
              <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 16 }}>
                {messages.length === 0 ? <Empty description="暂无消息" /> : (
                  messages.map((msg: any) => (
                    <div key={msg.id} style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
                      <Avatar size="small">{msg.user?.nickname?.[0]}</Avatar>
                      <div>
                        <Text strong style={{ fontSize: 12 }}>{msg.user?.nickname}</Text>
                        <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>{dayjs(msg.createdAt).format('MM-DD HH:mm')}</Text>
                        <div>{msg.content}</div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={msgEndRef} />
              </div>
              <Space.Compact style={{ width: '100%' }}>
                <Input value={msgInput} onChange={(e) => setMsgInput(e.target.value)} placeholder="发送消息..."
                  onPressEnter={handleSendMessage} />
                <Button type="primary" onClick={handleSendMessage}>发送</Button>
              </Space.Compact>
            </Card>
          ),
        },
      ]} />

      <Modal title="创建小组目标" open={goalModal} onOk={handleCreateGoal} onCancel={() => setGoalModal(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="目标名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="targetType" label="目标类型">
            <Select allowClear placeholder="选择量化指标（可选）" options={[
              { value: 'checkin_count', label: '总打卡次数' },
              { value: 'study_minutes', label: '总学习分钟数' },
              { value: 'completion_rate', label: '平均完成率(%)' },
            ]} />
          </Form.Item>
          <Form.Item name="targetValue" label="目标值"><InputNumber min={1} style={{ width: '100%' }} placeholder="如：100次、500分钟、80%" /></Form.Item>
          <Form.Item name="targetDate" label="截止日期"><DatePicker style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
