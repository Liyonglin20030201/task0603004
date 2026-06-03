import { useState, useEffect } from 'react';
import { Card, Tabs, Table, Tag, Select, message, Typography } from 'antd';
import apiClient from '../../api/client';

const { Title } = Typography;

export default function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/users');
      setUsers(res.data.data?.items || []);
    } catch (err: any) {
      if (err.response?.status === 403) message.error('需要管理员权限');
      else message.error('获取用户列表失败');
    }
    setLoading(false);
  };

  const fetchConfigs = async () => {
    try {
      const res = await apiClient.get('/admin/configs');
      setConfigs(res.data.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchUsers(); fetchConfigs(); }, []);

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await apiClient.put(`/admin/users/${userId}/role`, { role });
      message.success('角色已更新');
      fetchUsers();
    } catch (err: any) { message.error(err.response?.data?.error || '操作失败'); }
  };

  const userColumns = [
    { title: '昵称', dataIndex: 'nickname', key: 'nickname' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    {
      title: '角色', dataIndex: 'role', key: 'role',
      render: (role: string, record: any) => (
        <Select value={role} size="small" style={{ width: 100 }}
          onChange={(v) => handleRoleChange(record.id, v)}
          options={[{ value: 'user', label: '普通用户' }, { value: 'admin', label: '管理员' }]}
        />
      ),
    },
    { title: '课程数', dataIndex: ['_count', 'courses'], key: 'courses' },
    { title: '计划数', dataIndex: ['_count', 'learningPlans'], key: 'plans' },
    { title: '打卡数', dataIndex: ['_count', 'checkIns'], key: 'checkIns' },
    { title: '注册时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleDateString() },
  ];

  const configColumns = [
    { title: '配置项', dataIndex: 'key', key: 'key' },
    { title: '值', dataIndex: 'value', key: 'value', render: (v: any) => JSON.stringify(v) },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => new Date(v).toLocaleString() },
  ];

  return (
    <div>
      <Title level={4}>后台配置</Title>
      <Tabs items={[
        {
          key: 'users', label: '用户管理',
          children: <Table columns={userColumns} dataSource={users} rowKey="id" loading={loading} />,
        },
        {
          key: 'configs', label: '系统配置',
          children: <Table columns={configColumns} dataSource={configs} rowKey="key" />,
        },
      ]} />
    </div>
  );
}
