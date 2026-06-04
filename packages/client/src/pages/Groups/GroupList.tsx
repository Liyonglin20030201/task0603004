import { useState, useEffect } from 'react';
import { Card, Button, List, Avatar, Tag, Modal, Form, Input, Select, Space, Tabs, message, Empty, InputNumber } from 'antd';
import { PlusOutlined, TeamOutlined, SearchOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getMyGroups, discoverGroups, createGroup, joinGroup } from '../../api/groups.api';

export default function GroupList() {
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [publicGroups, setPublicGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const fetchMyGroups = async () => {
    setLoading(true);
    try {
      const res = await getMyGroups();
      setMyGroups(res.data);
    } finally { setLoading(false); }
  };

  const fetchDiscover = async (search = searchText) => {
    try {
      const res = await discoverGroups({ search: search || undefined, pageSize: 20 });
      setPublicGroups(res.data.items);
    } catch {}
  };

  useEffect(() => { fetchMyGroups(); fetchDiscover(); }, []);

  const handleCreate = async () => {
    const values = await form.validateFields();
    await createGroup(values);
    message.success('小组创建成功');
    setCreateModal(false);
    form.resetFields();
    fetchMyGroups();
  };

  const handleJoin = async (groupId: string) => {
    try {
      await joinGroup(groupId);
      message.success('已加入小组');
      fetchMyGroups();
      fetchDiscover();
    } catch (err: any) {
      message.error(err.response?.data?.error || '加入失败');
    }
  };

  const policyLabel: Record<string, string> = { open: '公开', approval: '需审核', invite: '邀请制' };
  const roleLabel: Record<string, string> = { owner: '组长', admin: '管理员', member: '成员' };
  const roleColor: Record<string, string> = { owner: 'gold', admin: 'blue', member: 'default' };

  return (
    <div>
      <Tabs defaultActiveKey="my" items={[
        {
          key: 'my', label: '我的小组', icon: <TeamOutlined />,
          children: (
            <Card extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>创建小组</Button>}>
              {myGroups.length === 0 ? <Empty description="还没有加入任何小组" /> : (
                <List dataSource={myGroups} renderItem={(group: any) => (
                  <List.Item
                    actions={[<Button type="link" onClick={() => navigate(`/groups/${group.id}`)}>进入</Button>]}
                  >
                    <List.Item.Meta
                      avatar={<Avatar style={{ backgroundColor: '#1890ff' }} icon={<TeamOutlined />} />}
                      title={<Space>{group.name}<Tag color={roleColor[group.myRole]}>{roleLabel[group.myRole]}</Tag></Space>}
                      description={`${group._count?.members || 0} 人 · ${policyLabel[group.joinPolicy]} · ${group.description || '暂无描述'}`}
                    />
                  </List.Item>
                )} />
              )}
            </Card>
          ),
        },
        {
          key: 'discover', label: '发现小组', icon: <UsergroupAddOutlined />,
          children: (
            <Card extra={<Input.Search placeholder="搜索小组" allowClear onSearch={(v) => { setSearchText(v); fetchDiscover(v); }} style={{ width: 250 }} />}>
              {publicGroups.length === 0 ? <Empty description="没有可加入的小组" /> : (
                <List dataSource={publicGroups} renderItem={(group: any) => (
                  <List.Item actions={[<Button type="primary" size="small" onClick={() => handleJoin(group.id)}>加入</Button>]}>
                    <List.Item.Meta
                      avatar={<Avatar style={{ backgroundColor: '#52c41a' }} icon={<TeamOutlined />} />}
                      title={<Space>{group.name}<Tag>{policyLabel[group.joinPolicy]}</Tag></Space>}
                      description={`${group._count?.members || 0}/${group.maxMembers} 人 · 组长: ${group.owner?.nickname || '未知'}`}
                    />
                  </List.Item>
                )} />
              )}
            </Card>
          ),
        },
      ]} />

      <Modal title="创建学习小组" open={createModal} onOk={handleCreate} onCancel={() => setCreateModal(false)}>
        <Form form={form} layout="vertical" initialValues={{ joinPolicy: 'open', maxMembers: 20 }}>
          <Form.Item name="name" label="小组名称" rules={[{ required: true }]}><Input maxLength={50} /></Form.Item>
          <Form.Item name="description" label="小组描述"><Input.TextArea rows={3} maxLength={200} /></Form.Item>
          <Form.Item name="joinPolicy" label="加入方式">
            <Select options={[{ value: 'open', label: '公开（任何人可加入）' }, { value: 'approval', label: '审核（需组长同意）' }, { value: 'invite', label: '邀请制' }]} />
          </Form.Item>
          <Form.Item name="maxMembers" label="人数上限"><InputNumber min={2} max={100} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
