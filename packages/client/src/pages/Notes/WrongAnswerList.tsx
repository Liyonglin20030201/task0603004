import { useState, useEffect, useCallback } from 'react';
import { Table, Card, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm, Statistic, Row, Col, List, Typography, Badge, Progress } from 'antd';
import { PlusOutlined, DeleteOutlined, EyeOutlined, CheckCircleOutlined, ClockCircleOutlined, BookOutlined, WarningOutlined, ThunderboltOutlined, FrownOutlined, MehOutlined, SmileOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { getWrongAnswers, createWrongAnswer, updateWrongAnswer, deleteWrongAnswer, getDueWrongAnswers, reviewWrongAnswer, getWrongAnswerStats, WrongAnswerStats } from '../../api/wrongAnswers.api';
import { getCourses } from '../../api/courses.api';

const { Text, Paragraph } = Typography;

function getUrgencyColor(nextReviewDate: string | null): string {
  if (!nextReviewDate) return '#999';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reviewDate = new Date(nextReviewDate);
  reviewDate.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((reviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return '#ff4d4f';
  if (diffDays === 0) return '#fa8c16';
  return '#52c41a';
}

function getUrgencyLabel(nextReviewDate: string | null): string {
  if (!nextReviewDate) return '未安排';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reviewDate = new Date(nextReviewDate);
  reviewDate.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((reviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `逾期${Math.abs(diffDays)}天`;
  if (diffDays === 0) return '今日待复习';
  return `${diffDays}天后`;
}

const RATING_OPTIONS = [
  { quality: 1, label: '忘记了', desc: '重置间隔', icon: <CloseCircleOutlined />, color: '#ff4d4f', bg: '#fff2f0' },
  { quality: 3, label: '困难', desc: '1-3天后', icon: <FrownOutlined />, color: '#fa8c16', bg: '#fff7e6' },
  { quality: 4, label: '一般', desc: '7-14天后', icon: <MehOutlined />, color: '#1890ff', bg: '#e6f7ff' },
  { quality: 5, label: '简单', desc: '14-30天后', icon: <SmileOutlined />, color: '#52c41a', bg: '#f6ffed' },
];

export default function WrongAnswerList() {
  const [data, setData] = useState<any[]>([]);
  const [dueItems, setDueItems] = useState<any[]>([]);
  const [stats, setStats] = useState<WrongAnswerStats | null>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewItem, setReviewItem] = useState<any>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [form] = Form.useForm();

  const [sessionMode, setSessionMode] = useState(false);
  const [sessionItems, setSessionItems] = useState<any[]>([]);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [reviewedToday, setReviewedToday] = useState(0);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getWrongAnswers({ page });
      setData(res.items);
      setTotal(res.total);
    } catch { message.error('获取错题列表失败'); }
    setLoading(false);
  }, [page]);

  const fetchDueItems = useCallback(async () => {
    try {
      const items = await getDueWrongAnswers();
      setDueItems(items);
    } catch {}
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const s = await getWrongAnswerStats();
      setStats(s);
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    fetchDueItems();
    fetchStats();
    getCourses({ status: 'active' }).then(d => setCourses(d.items));
  }, [page, fetchData, fetchDueItems, fetchStats]);

  const handleCreate = async (values: any) => {
    try {
      await createWrongAnswer(values);
      message.success('添加成功');
      setModalOpen(false);
      form.resetFields();
      fetchData();
      fetchDueItems();
      fetchStats();
    } catch (err: any) { message.error(err.response?.data?.error || '添加失败'); }
  };

  const handleStartReview = (record: any) => {
    setReviewItem(record);
    setShowAnswer(false);
    setSelectedRating(null);
    setReviewModalOpen(true);
  };

  const handleStartSession = () => {
    if (dueItems.length === 0) return;
    setSessionMode(true);
    setSessionItems([...dueItems]);
    setSessionIndex(0);
    setReviewItem(dueItems[0]);
    setShowAnswer(false);
    setSelectedRating(null);
    setReviewModalOpen(true);
  };

  const handleSubmitReview = async (quality: number) => {
    if (!reviewItem) return;
    setSelectedRating(quality);

    setTimeout(async () => {
      try {
        await reviewWrongAnswer(reviewItem.id, quality);
        setReviewedToday(prev => prev + 1);

        // Immediately remove from due list
        setDueItems(prev => prev.filter(item => item.id !== reviewItem.id));

        if (sessionMode) {
          const nextIdx = sessionIndex + 1;
          if (nextIdx < sessionItems.length) {
            setSessionIndex(nextIdx);
            setReviewItem(sessionItems[nextIdx]);
            setShowAnswer(false);
            setSelectedRating(null);
          } else {
            setReviewModalOpen(false);
            setSessionMode(false);
            setReviewItem(null);
            message.success(`太棒了！本次复习完成 ${sessionItems.length} 道题`);
          }
        } else {
          setReviewModalOpen(false);
          setReviewItem(null);
        }

        fetchData();
        fetchDueItems();
        fetchStats();
      } catch {
        message.error('提交复习失败');
      }
      setSelectedRating(null);
    }, 300);
  };

  const handleDelete = async (id: string) => {
    await deleteWrongAnswer(id);
    message.success('已删除');
    fetchData();
    fetchDueItems();
    fetchStats();
  };

  const columns = [
    { title: '题目', dataIndex: 'question', key: 'question', ellipsis: true, width: 200 },
    { title: '错误答案', dataIndex: 'wrongAnswer', key: 'wrongAnswer', ellipsis: true },
    { title: '正确答案', dataIndex: 'correctAnswer', key: 'correctAnswer', ellipsis: true },
    { title: '课程', dataIndex: ['course', 'title'], key: 'course' },
    { title: '标签', dataIndex: 'tags', key: 'tags', render: (tags: string[]) => tags?.map(t => <Tag key={t}>{t}</Tag>) },
    { title: '复习次数', dataIndex: 'reviewCount', key: 'reviewCount' },
    {
      title: '复习状态', dataIndex: 'nextReviewDate', key: 'nextReviewDate',
      render: (v: string) => {
        const color = getUrgencyColor(v);
        const label = getUrgencyLabel(v);
        return <Tag color={color} style={{ color: color === '#52c41a' ? '#fff' : undefined }}>{label}</Tag>;
      },
    },
    {
      title: '操作', key: 'actions',
      render: (_: any, r: any) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleStartReview(r)} icon={<EyeOutlined />}>复习</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const reviewModalTitle = sessionMode
    ? `复习进度 ${sessionIndex + 1} / ${sessionItems.length}`
    : '复习错题';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {stats && (
        <Card size="small">
          <Row gutter={16}>
            <Col span={4}>
              <Statistic title="总错题" value={stats.total} prefix={<BookOutlined />} />
            </Col>
            <Col span={4}>
              <Statistic title="今日待复习" value={stats.dueToday} prefix={<ClockCircleOutlined />} valueStyle={{ color: stats.dueToday > 0 ? '#fa8c16' : undefined }} />
            </Col>
            <Col span={4}>
              <Statistic title="已掌握" value={stats.mastered} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
            </Col>
            <Col span={4}>
              <Statistic title="学习中" value={stats.learning} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#1890ff' }} />
            </Col>
            <Col span={4}>
              <Statistic title="新题目" value={stats.newItems} prefix={<WarningOutlined />} valueStyle={{ color: '#ff4d4f' }} />
            </Col>
            <Col span={4}>
              <Statistic title="今日已复习" value={reviewedToday} prefix={<ThunderboltOutlined />} valueStyle={{ color: '#722ed1' }} />
            </Col>
          </Row>
        </Card>
      )}

      {dueItems.length > 0 && (
        <Card
          title={<span><Badge count={dueItems.length} offset={[10, 0]}><span style={{ fontSize: 16, fontWeight: 500 }}>今日待复习</span></Badge></span>}
          size="small"
          style={{ borderColor: '#fa8c16', borderWidth: 2 }}
          extra={<Button type="primary" icon={<ThunderboltOutlined />} onClick={handleStartSession}>开始复习会话</Button>}
        >
          <List
            dataSource={dueItems.slice(0, 10)}
            renderItem={(item: any) => (
              <List.Item
                actions={[
                  <Button type="primary" size="small" onClick={() => handleStartReview(item)}>
                    开始复习
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag color={getUrgencyColor(item.nextReviewDate)} style={{ marginRight: 8 }}>
                        {getUrgencyLabel(item.nextReviewDate)}
                      </Tag>
                      <Text ellipsis style={{ maxWidth: 400 }}>{item.question}</Text>
                    </Space>
                  }
                  description={
                    <Space>
                      {item.course && <Tag>{item.course.title}</Tag>}
                      <Text type="secondary">已复习 {item.reviewCount} 次</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
            locale={{ emptyText: '暂无待复习项目' }}
          />
          {dueItems.length > 10 && (
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <Text type="secondary">还有 {dueItems.length - 10} 项待复习...</Text>
            </div>
          )}
        </Card>
      )}

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 500 }}>错题本</span>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>添加错题</Button>
        </div>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
          pagination={{ current: page, total, onChange: setPage, pageSize: 20 }}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal title="添加错题" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} okText="添加" width={600}>
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="courseId" label="课程" rules={[{ required: true, message: '请选择课程' }]}>
            <Select placeholder="选择课程" options={courses.map(c => ({ value: c.id, label: c.title }))} />
          </Form.Item>
          <Form.Item name="question" label="题目" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="输入题目内容" />
          </Form.Item>
          <Form.Item name="wrongAnswer" label="错误答案" rules={[{ required: true }]}>
            <Input placeholder="你的错误答案" />
          </Form.Item>
          <Form.Item name="correctAnswer" label="正确答案" rules={[{ required: true }]}>
            <Input placeholder="正确答案" />
          </Form.Item>
          <Form.Item name="explanation" label="解析">
            <Input.TextArea rows={2} placeholder="解题思路/解析（选填）" />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入标签后回车" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={reviewModalTitle}
        open={reviewModalOpen}
        onCancel={() => { setReviewModalOpen(false); setReviewItem(null); setSessionMode(false); }}
        footer={null}
        width={640}
      >
        {reviewItem && (
          <div>
            {sessionMode && (
              <Progress
                percent={Math.round(((sessionIndex) / sessionItems.length) * 100)}
                size="small"
                style={{ marginBottom: 16 }}
                strokeColor="#722ed1"
              />
            )}

            <Card style={{ marginBottom: 16, background: '#fafafa' }}>
              <Text strong style={{ fontSize: 16 }}>题目:</Text>
              <Paragraph style={{ marginTop: 8, fontSize: 15 }}>{reviewItem.question}</Paragraph>
              {reviewItem.tags?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {reviewItem.tags.map((t: string) => <Tag key={t}>{t}</Tag>)}
                </div>
              )}
            </Card>

            {!showAnswer ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <Button type="primary" size="large" onClick={() => setShowAnswer(true)} icon={<EyeOutlined />}>
                  显示答案
                </Button>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">先思考答案，再点击查看</Text>
                </div>
              </div>
            ) : (
              <>
                <Card style={{ marginBottom: 12, borderColor: '#ff4d4f' }}>
                  <Text type="danger" strong>你的错误答案:</Text>
                  <Paragraph style={{ marginTop: 4 }}>{reviewItem.wrongAnswer}</Paragraph>
                </Card>

                <Card style={{ marginBottom: 12, borderColor: '#52c41a' }}>
                  <Text style={{ color: '#52c41a' }} strong>正确答案:</Text>
                  <Paragraph style={{ marginTop: 4 }}>{reviewItem.correctAnswer}</Paragraph>
                </Card>

                {reviewItem.explanation && (
                  <Card style={{ marginBottom: 16, borderColor: '#1890ff' }}>
                    <Text style={{ color: '#1890ff' }} strong>解析:</Text>
                    <Paragraph style={{ marginTop: 4 }}>{reviewItem.explanation}</Paragraph>
                  </Card>
                )}

                <div style={{ padding: '16px 0', borderTop: '1px solid #f0f0f0' }}>
                  <Text strong style={{ display: 'block', marginBottom: 12, textAlign: 'center' }}>你对这道题的掌握程度如何？</Text>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {RATING_OPTIONS.map((opt) => (
                      <div
                        key={opt.quality}
                        onClick={() => handleSubmitReview(opt.quality)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: '16px 8px',
                          borderRadius: 8,
                          border: `2px solid ${selectedRating === opt.quality ? opt.color : '#f0f0f0'}`,
                          background: selectedRating === opt.quality ? opt.bg : '#fafafa',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          transform: selectedRating === opt.quality ? 'scale(1.05)' : 'scale(1)',
                        }}
                      >
                        <span style={{ fontSize: 24, color: opt.color }}>{opt.icon}</span>
                        <Text strong style={{ color: opt.color, marginTop: 8 }}>{opt.label}</Text>
                        <Text type="secondary" style={{ fontSize: 11, marginTop: 4 }}>{opt.desc}</Text>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
