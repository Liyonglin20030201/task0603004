import { useState, useEffect } from 'react';
import { Card, Tabs, Table, Tag, Select, message, Typography, Button, Modal, Form, Input, InputNumber, Switch, Space, Popconfirm, Statistic, Row, Col, Descriptions } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined, UserOutlined, DatabaseOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';

const { Title, Text } = Typography;

// Default system parameter definitions
const SYSTEM_PARAMS = [
  { key: 'max_courses_per_user', label: '每用户最大课程数', type: 'number', default: 50 },
  { key: 'max_plans_per_course', label: '每课程最大计划数', type: 'number', default: 20 },
  { key: 'max_items_per_plan', label: '每计划最大项目数', type: 'number', default: 100 },
  { key: 'check_in_reminder_time', label: '打卡提醒时间(小时)', type: 'number', default: 9 },
  { key: 'overdue_notification_enabled', label: '逾期通知开关', type: 'boolean', default: true },
  { key: 'ai_review_enabled', label: 'AI复习建议开关', type: 'boolean', default: true },
  { key: 'ai_review_max_daily', label: 'AI建议每日上限', type: 'number', default: 5 },
  { key: 'streak_reset_hours', label: '连续打卡重置时间(小时)', type: 'number', default: 24 },
  { key: 'spaced_repetition_algorithm', label: '间隔重复算法', type: 'string', default: 'SM-2' },
  { key: 'site_maintenance_mode', label: '维护模式', type: 'boolean', default: false },
  { key: 'site_announcement', label: '系统公告', type: 'string', default: '' },
];

export default function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [customConfigModal, setCustomConfigModal] = useState(false);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [configForm] = Form.useForm();
  const [customForm] = Form.useForm();

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

  const fetchSystemStats = async () => {
    try {
      const res = await apiClient.get('/admin/users');
      const userCount = res.data.data?.total || 0;
      setSystemStats({ userCount });
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchUsers(); fetchConfigs(); fetchSystemStats(); }, []);

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await apiClient.put(`/admin/users/${userId}/role`, { role });
      message.success('角色已更新');
      fetchUsers();
    } catch (err: any) { message.error(err.response?.data?.error || '操作失败'); }
  };

  const handleEditConfig = (record: any) => {
    setEditingConfig(record);
    const paramDef = SYSTEM_PARAMS.find(p => p.key === record.key);
    configForm.setFieldsValue({
      key: record.key,
      value: typeof record.value === 'object' ? JSON.stringify(record.value) : record.value,
    });
    setConfigModalOpen(true);
  };

  const handleSaveConfig = async () => {
    try {
      const values = configForm.getFieldsValue();
      const paramDef = SYSTEM_PARAMS.find(p => p.key === values.key);
      let value = values.value;

      if (paramDef?.type === 'number') value = Number(value);
      if (paramDef?.type === 'boolean') value = Boolean(value);

      await apiClient.put(`/admin/configs/${values.key}`, { value });
      message.success('配置已更新');
      setConfigModalOpen(false);
      fetchConfigs();
    } catch (err: any) { message.error(err.response?.data?.error || '保存失败'); }
  };

  const handleAddCustomConfig = async () => {
    try {
      const values = await customForm.validateFields();
      let parsedValue: any = values.value;
      try { parsedValue = JSON.parse(values.value); } catch { /* keep as string */ }

      await apiClient.put(`/admin/configs/${values.key}`, { value: parsedValue });
      message.success('配置项已添加');
      setCustomConfigModal(false);
      customForm.resetFields();
      fetchConfigs();
    } catch (err: any) {
      if (err.response) message.error(err.response?.data?.error || '添加失败');
    }
  };

  const handleInitDefaults = async () => {
    try {
      for (const param of SYSTEM_PARAMS) {
        const existing = configs.find(c => c.key === param.key);
        if (!existing) {
          await apiClient.put(`/admin/configs/${param.key}`, { value: param.default });
        }
      }
      message.success('默认配置已初始化');
      fetchConfigs();
    } catch (err: any) { message.error('初始化失败'); }
  };

  const getConfigValue = (key: string) => {
    const config = configs.find(c => c.key === key);
    if (config) return config.value;
    const def = SYSTEM_PARAMS.find(p => p.key === key);
    return def?.default;
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

  const handleDeleteConfig = async (key: string) => {
    try {
      await apiClient.delete(`/admin/configs/${key}`);
      message.success('配置项已删除');
      fetchConfigs();
    } catch (err: any) {
      message.error(err.response?.data?.error || '删除失败');
    }
  };

  const configColumns = [
    {
      title: '配置项', dataIndex: 'key', key: 'key',
      render: (key: string) => {
        const def = SYSTEM_PARAMS.find(p => p.key === key);
        return (
          <div>
            <Text strong>{key}</Text>
            {def && <div style={{ fontSize: 12, color: '#666' }}>{def.label}</div>}
          </div>
        );
      },
    },
    {
      title: '当前值', dataIndex: 'value', key: 'value',
      render: (v: any, record: any) => {
        const def = SYSTEM_PARAMS.find(p => p.key === record.key);
        if (def?.type === 'boolean') return <Tag color={v ? 'green' : 'default'}>{v ? '开启' : '关闭'}</Tag>;
        if (typeof v === 'object') return <code>{JSON.stringify(v)}</code>;
        return <Text>{String(v)}</Text>;
      },
    },
    {
      title: '类型', key: 'type',
      render: (_: any, record: any) => {
        const def = SYSTEM_PARAMS.find(p => p.key === record.key);
        return <Tag>{def?.type || typeof record.value}</Tag>;
      },
    },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    {
      title: '操作', key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditConfig(record)}>编辑</Button>
          {record.updatedAt && (
            <Popconfirm title="确认删除此配置项？" onConfirm={() => handleDeleteConfig(record.key)} okText="删除" cancelText="取消">
              <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // Merge system params with DB configs for display
  const displayConfigs = SYSTEM_PARAMS.map(param => {
    const existing = configs.find(c => c.key === param.key);
    return existing || { key: param.key, value: param.default, updatedAt: null };
  });
  // Also include custom configs not in SYSTEM_PARAMS
  const customConfigs = configs.filter(c => !SYSTEM_PARAMS.find(p => p.key === c.key));
  const allConfigs = [...displayConfigs, ...customConfigs];

  return (
    <div>
      <Title level={4}><SettingOutlined style={{ marginRight: 8 }} />后台配置</Title>

      <Tabs items={[
        {
          key: 'overview', label: '系统概览', icon: <DatabaseOutlined />,
          children: (
            <div>
              <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={6}>
                  <Card><Statistic title="注册用户数" value={systemStats?.userCount || users.length} prefix={<UserOutlined />} /></Card>
                </Col>
                <Col span={6}>
                  <Card><Statistic title="系统配置项" value={allConfigs.length} prefix={<SettingOutlined />} /></Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic title="维护模式" value={getConfigValue('site_maintenance_mode') ? '开启' : '关闭'}
                      valueStyle={{ color: getConfigValue('site_maintenance_mode') ? '#ff4d4f' : '#52c41a' }} />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic title="AI功能" value={getConfigValue('ai_review_enabled') ? '开启' : '关闭'}
                      valueStyle={{ color: getConfigValue('ai_review_enabled') ? '#52c41a' : '#999' }} />
                  </Card>
                </Col>
              </Row>
              {getConfigValue('site_announcement') && (
                <Card title="当前系统公告" size="small" style={{ marginBottom: 16 }}>
                  <Text>{getConfigValue('site_announcement')}</Text>
                </Card>
              )}
            </div>
          ),
        },
        {
          key: 'users', label: '用户管理', icon: <UserOutlined />,
          children: <Table columns={userColumns} dataSource={users} rowKey="id" loading={loading} />,
        },
        {
          key: 'configs', label: '系统参数', icon: <SettingOutlined />,
          children: (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <Space>
                  <Button onClick={handleInitDefaults}>初始化默认配置</Button>
                </Space>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { customForm.resetFields(); setCustomConfigModal(true); }}>
                  添加自定义配置
                </Button>
              </div>
              <Table columns={configColumns} dataSource={allConfigs} rowKey="key" pagination={false} />
            </div>
          ),
        },
      ]} />

      {/* Edit Config Modal */}
      <Modal title="编辑系统参数" open={configModalOpen} onCancel={() => setConfigModalOpen(false)} onOk={handleSaveConfig} okText="保存">
        <Form form={configForm} layout="vertical">
          <Form.Item name="key" label="配置项">
            <Input disabled />
          </Form.Item>
          <Form.Item name="value" label="值" rules={[{ required: true, message: '请输入值' }]}>
            {(() => {
              const def = SYSTEM_PARAMS.find(p => p.key === editingConfig?.key);
              if (def?.type === 'boolean') return <Select options={[{ value: true, label: '开启' }, { value: false, label: '关闭' }]} />;
              if (def?.type === 'number') return <InputNumber style={{ width: '100%' }} />;
              return <Input.TextArea rows={3} />;
            })()}
          </Form.Item>
          {editingConfig && (
            <div style={{ color: '#666', fontSize: 12 }}>
              {SYSTEM_PARAMS.find(p => p.key === editingConfig.key)?.label || '自定义配置项'}
            </div>
          )}
        </Form>
      </Modal>

      {/* Add Custom Config Modal */}
      <Modal title="添加自定义配置" open={customConfigModal} onCancel={() => setCustomConfigModal(false)} onOk={handleAddCustomConfig} okText="添加">
        <Form form={customForm} layout="vertical">
          <Form.Item name="key" label="配置键名" rules={[
            { required: true, message: '请输入配置键名' },
            { pattern: /^[a-z][a-z0-9_]*$/, message: '只允许小写字母、数字和下划线' },
          ]}>
            <Input placeholder="例如: custom_setting_name" />
          </Form.Item>
          <Form.Item name="value" label="配置值" rules={[{ required: true, message: '请输入值' }]}>
            <Input.TextArea rows={3} placeholder="字符串值，或 JSON 格式（如 123, true, {&quot;key&quot;:&quot;val&quot;}）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
