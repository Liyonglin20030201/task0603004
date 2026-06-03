import { useState, useEffect } from 'react';
import { Table, Card, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { getWrongAnswers, createWrongAnswer, updateWrongAnswer, deleteWrongAnswer } from '../../api/wrongAnswers.api';
import { getCourses } from '../../api/courses.api';

export default function WrongAnswerList() {
  const [data, setData] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getWrongAnswers({ page });
      setData(res.items);
      setTotal(res.total);
    } catch { message.error('获取错题列表失败'); }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    getCourses({ status: 'active' }).then(d => setCourses(d.items));
  }, [page]);

  const handleCreate = async (values: any) => {
    try {
      await createWrongAnswer(values);
      message.success('添加成功');
      setModalOpen(false);
      form.resetFields();
      fetchData();
    } catch (err: any) { message.error(err.response?.data?.error || '添加失败'); }
  };

  const handleReview = async (record: any) => {
    try {
      await updateWrongAnswer(record.id, { reviewCount: record.reviewCount + 1 });
      message.success('已标记复习');
      fetchData();
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id: string) => {
    await deleteWrongAnswer(id);
    message.success('已删除');
    fetchData();
  };

  const columns = [
    { title: '题目', dataIndex: 'question', key: 'question', ellipsis: true, width: 200 },
    { title: '错误答案', dataIndex: 'wrongAnswer', key: 'wrongAnswer', ellipsis: true },
    { title: '正确答案', dataIndex: 'correctAnswer', key: 'correctAnswer', ellipsis: true },
    { title: '课程', dataIndex: ['course', 'title'], key: 'course' },
    { title: '标签', dataIndex: 'tags', key: 'tags', render: (tags: string[]) => tags?.map(t => <Tag key={t}>{t}</Tag>) },
    { title: '复习次数', dataIndex: 'reviewCount', key: 'reviewCount' },
    { title: '下次复习', dataIndex: 'nextReviewDate', key: 'nextReviewDate', render: (v: string) => v?.slice(0, 10) },
    {
      title: '操作', key: 'actions',
      render: (_: any, r: any) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleReview(r)}>标记复习</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 500 }}>错题本</span>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>添加错题</Button>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        pagination={{ current: page, total, onChange: setPage, pageSize: 20 }}
        scroll={{ x: 900 }}
      />

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
    </Card>
  );
}
