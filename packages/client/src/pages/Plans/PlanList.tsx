import { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Space, Select, Progress, message } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getPlans } from '../../api/plans.api';

const statusColors: Record<string, string> = { active: 'green', paused: 'orange', completed: 'blue', delayed: 'red' };
const statusLabels: Record<string, string> = { active: '进行中', paused: '已暂停', completed: '已完成', delayed: '已延期' };

export default function PlanList() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const data = await getPlans({ status: statusFilter, page });
      setPlans(data.items);
      setTotal(data.total);
    } catch { message.error('获取计划列表失败'); }
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, [statusFilter, page]);

  const columns = [
    { title: '计划名称', dataIndex: 'title', key: 'title' },
    { title: '课程', dataIndex: ['course', 'title'], key: 'course' },
    {
      title: '进度', key: 'progress',
      render: (_: any, r: any) => <Progress percent={r.progress.total > 0 ? Math.round(r.progress.completed / r.progress.total * 100) : 0} size="small" />,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag>,
    },
    { title: '开始日期', dataIndex: 'startDate', key: 'startDate', render: (v: string) => v?.slice(0, 10) },
    { title: '结束日期', dataIndex: 'endDate', key: 'endDate', render: (v: string) => v?.slice(0, 10) },
    {
      title: '操作', key: 'actions',
      render: (_: any, r: any) => <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/plans/${r.id}`)}>查看</Button>,
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Select placeholder="筛选状态" allowClear style={{ width: 120 }} onChange={setStatusFilter}
          options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/plans/new')}>新建计划</Button>
      </div>
      <Table columns={columns} dataSource={plans} rowKey="id" loading={loading}
        pagination={{ current: page, total, onChange: setPage, pageSize: 20 }}
      />
    </Card>
  );
}
