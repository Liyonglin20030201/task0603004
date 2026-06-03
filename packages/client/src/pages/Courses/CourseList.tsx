import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Space, message, Card, Progress } from 'antd';
import { PlusOutlined, EyeOutlined, InboxOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Course, CourseStatus } from '@study-platform/shared';
import { getCourses, createCourse, archiveCourse } from '../../api/courses.api';

const statusColors: Record<string, string> = {
  active: 'green',
  archived: 'default',
  completed: 'blue',
};

const statusLabels: Record<string, string> = {
  active: '进行中',
  archived: '已归档',
  completed: '已完成',
};

export default function CourseList() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const data = await getCourses({ status: statusFilter, page });
      setCourses(data.items);
      setTotal(data.total);
    } catch { message.error('获取课程失败'); }
    setLoading(false);
  };

  useEffect(() => { fetchCourses(); }, [statusFilter, page]);

  const handleCreate = async (values: any) => {
    try {
      await createCourse(values);
      message.success('课程创建成功');
      setModalOpen(false);
      form.resetFields();
      fetchCourses();
    } catch (err: any) {
      message.error(err.response?.data?.error || '创建失败');
    }
  };

  const handleArchive = async (id: string) => {
    Modal.confirm({
      title: '确认归档',
      content: '归档后课程数据将保留，但不再显示在活跃课程中。确定归档？',
      onOk: async () => {
        await archiveCourse(id);
        message.success('已归档');
        fetchCourses();
      },
    });
  };

  const columns = [
    { title: '课程名称', dataIndex: 'title', key: 'title' },
    { title: '分类', dataIndex: 'category', key: 'category', render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag>,
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleDateString() },
    {
      title: '操作', key: 'actions',
      render: (_: any, record: Course) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/courses/${record.id}`)}>查看</Button>
          {record.status === 'active' && (
            <Button type="link" danger icon={<InboxOutlined />} onClick={() => handleArchive(record.id)}>归档</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Space>
            <Select placeholder="筛选状态" allowClear style={{ width: 120 }} onChange={setStatusFilter}
              options={[{ value: 'active', label: '进行中' }, { value: 'archived', label: '已归档' }, { value: 'completed', label: '已完成' }]}
            />
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建课程</Button>
        </div>
        <Table columns={columns} dataSource={courses} rowKey="id" loading={loading}
          pagination={{ current: page, total, onChange: setPage, pageSize: 20 }}
        />
      </Card>

      <Modal title="新建课程" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} okText="创建">
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="title" label="课程名称" rules={[{ required: true, message: '请输入课程名称' }]}>
            <Input placeholder="例如：高等数学" />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select placeholder="选择分类" options={[
              { value: '数学', label: '数学' }, { value: '英语', label: '英语' },
              { value: '编程', label: '编程' }, { value: '其他', label: '其他' },
            ]} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="课程描述（选填）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
