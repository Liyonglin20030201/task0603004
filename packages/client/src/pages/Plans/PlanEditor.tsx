import { useState, useEffect } from 'react';
import { Form, Input, Button, DatePicker, Card, message, Select, Space, List, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getCourses } from '../../api/courses.api';
import { createPlan } from '../../api/plans.api';

const { RangePicker } = DatePicker;
const { Title } = Typography;

interface PlanItemDraft {
  key: string;
  title: string;
  scheduledDate: string;
}

export default function PlanEditor() {
  const [form] = Form.useForm();
  const [courses, setCourses] = useState<any[]>([]);
  const [items, setItems] = useState<PlanItemDraft[]>([]);
  const [itemTitle, setItemTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getCourses({ status: 'active' }).then(data => setCourses(data.items));
  }, []);

  const addItem = () => {
    if (!itemTitle.trim()) return;
    const dateRange = form.getFieldValue('dateRange');
    const startDate = dateRange?.[0];
    const existingDates = items.map(i => i.scheduledDate);

    // Auto-assign to next available date
    let date = startDate ? dayjs(startDate) : dayjs();
    while (existingDates.filter(d => d === date.format('YYYY-MM-DD')).length >= 3) {
      date = date.add(1, 'day');
    }

    setItems([...items, { key: Date.now().toString(), title: itemTitle.trim(), scheduledDate: date.format('YYYY-MM-DD') }]);
    setItemTitle('');
  };

  const removeItem = (key: string) => {
    setItems(items.filter(i => i.key !== key));
  };

  const handleSubmit = async (values: any) => {
    if (items.length === 0) {
      message.warning('请至少添加一个学习项目');
      return;
    }
    setSubmitting(true);
    try {
      await createPlan({
        courseId: values.courseId,
        title: values.title,
        startDate: values.dateRange[0].format('YYYY-MM-DD'),
        endDate: values.dateRange[1].format('YYYY-MM-DD'),
        items: items.map((item, index) => ({
          title: item.title,
          scheduledDate: item.scheduledDate,
          sortOrder: index,
        })),
      });
      message.success('计划创建成功');
      navigate('/plans');
    } catch (err: any) {
      message.error(err.response?.data?.error || '创建失败');
    }
    setSubmitting(false);
  };

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/plans')} style={{ marginBottom: 16 }}>返回</Button>
      <Card>
        <Title level={4}>新建学习计划</Title>
        <Form form={form} onFinish={handleSubmit} layout="vertical" style={{ maxWidth: 600 }}>
          <Form.Item name="courseId" label="关联课程" rules={[{ required: true, message: '请选择课程' }]}>
            <Select placeholder="选择课程" options={courses.map(c => ({ value: c.id, label: c.title }))} />
          </Form.Item>
          <Form.Item name="title" label="计划名称" rules={[{ required: true, message: '请输入计划名称' }]}>
            <Input placeholder="例如：第一章学习计划" />
          </Form.Item>
          <Form.Item name="dateRange" label="起止日期" rules={[{ required: true, message: '请选择日期范围' }]}>
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>

          <Card title="学习项目" size="small" style={{ marginBottom: 24 }}>
            <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
              <Input value={itemTitle} onChange={e => setItemTitle(e.target.value)} placeholder="输入学习项目名称" onPressEnter={addItem} />
              <Button type="primary" icon={<PlusOutlined />} onClick={addItem}>添加</Button>
            </Space.Compact>
            <List
              size="small"
              dataSource={items}
              renderItem={(item) => (
                <List.Item actions={[<Button type="link" danger icon={<DeleteOutlined />} onClick={() => removeItem(item.key)} />]}>
                  {item.title} <span style={{ color: '#999', marginLeft: 8 }}>{item.scheduledDate}</span>
                </List.Item>
              )}
              locale={{ emptyText: '暂未添加学习项目' }}
            />
          </Card>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} block>创建计划</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
