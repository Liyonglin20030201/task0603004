import { useState, useEffect } from 'react';
import { Table, Button, Upload, Modal, Form, Input, Switch, Select, Space, Tag, message, Card, Tabs } from 'antd';
import { UploadOutlined, DownloadOutlined, DeleteOutlined, ShareAltOutlined, SearchOutlined } from '@ant-design/icons';
import { getResources, getPublicResources, uploadResource, updateResource, deleteResource, downloadResource } from '../../api/resources.api';
import { getMyGroups, shareItem } from '../../api/groups.api';

export default function ResourceList() {
  const [resources, setResources] = useState<any[]>([]);
  const [publicResources, setPublicResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [publicTotal, setPublicTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [publicPage, setPublicPage] = useState(1);
  const [editModal, setEditModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [searchText, setSearchText] = useState('');
  const [shareModal, setShareModal] = useState(false);
  const [shareResourceId, setShareResourceId] = useState('');
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [shareGroupId, setShareGroupId] = useState('');
  const [form] = Form.useForm();

  const fetchResources = async (p = page) => {
    setLoading(true);
    try {
      const res = await getResources({ page: p, pageSize: 10 });
      setResources(res.data.items);
      setTotal(res.data.total);
    } finally { setLoading(false); }
  };

  const fetchPublic = async (p = publicPage, search = searchText) => {
    setLoading(true);
    try {
      const res = await getPublicResources({ page: p, pageSize: 10, search: search || undefined });
      setPublicResources(res.data.items);
      setPublicTotal(res.data.total);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchResources(); fetchPublic(); }, []);

  const handleUpload = async (options: any) => {
    const formData = new FormData();
    formData.append('file', options.file);
    formData.append('title', options.file.name);
    formData.append('isPublic', 'false');
    try {
      await uploadResource(formData);
      message.success('上传成功');
      fetchResources();
      options.onSuccess();
    } catch (err: any) {
      message.error(err.response?.data?.error || '上传失败');
      options.onError(err);
    }
  };

  const handleDownload = async (record: any) => {
    try {
      const response = await downloadResource(record.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', record.fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch { message.error('下载失败'); }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除此资源？',
      onOk: async () => {
        await deleteResource(id);
        message.success('已删除');
        fetchResources();
      },
    });
  };

  const handleEdit = (record: any) => {
    setEditItem(record);
    form.setFieldsValue({ title: record.title, description: record.description, isPublic: record.isPublic });
    setEditModal(true);
  };

  const handleEditSave = async () => {
    const values = form.getFieldsValue();
    await updateResource(editItem.id, values);
    message.success('更新成功');
    setEditModal(false);
    fetchResources();
    fetchPublic();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleOpenShare = async (resourceId: string) => {
    setShareResourceId(resourceId);
    setShareGroupId('');
    try {
      const res = await getMyGroups();
      setMyGroups(res.data);
    } catch {}
    setShareModal(true);
  };

  const handleShare = async () => {
    if (!shareGroupId) { message.warning('请选择小组'); return; }
    try {
      await shareItem(shareGroupId, { itemType: 'resource', itemId: shareResourceId });
      message.success('已分享到小组');
      setShareModal(false);
    } catch (err: any) {
      message.error(err.response?.data?.error || '分享失败');
    }
  };

  const myColumns = [
    { title: '文件名', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: '大小', dataIndex: 'fileSize', key: 'fileSize', width: 100, render: formatSize },
    { title: '类型', dataIndex: 'mimeType', key: 'mimeType', width: 120, ellipsis: true },
    { title: '关联课程', key: 'course', width: 120, render: (_: any, r: any) => r.course?.title || '-' },
    { title: '下载量', dataIndex: 'downloads', key: 'downloads', width: 80 },
    { title: '公开', dataIndex: 'isPublic', key: 'isPublic', width: 60, render: (v: boolean) => v ? <Tag color="green">是</Tag> : <Tag>否</Tag> },
    {
      title: '操作', key: 'action', width: 220,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(r)} />
          <Button size="small" icon={<ShareAltOutlined />} onClick={() => handleOpenShare(r.id)} />
          <Button size="small" onClick={() => handleEdit(r)}>编辑</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)} />
        </Space>
      ),
    },
  ];

  const publicColumns = [
    { title: '文件名', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: '上传者', key: 'user', width: 100, render: (_: any, r: any) => r.user?.nickname || '-' },
    { title: '大小', dataIndex: 'fileSize', key: 'fileSize', width: 100, render: formatSize },
    { title: '关联课程', key: 'course', width: 120, render: (_: any, r: any) => r.course?.title || '-' },
    { title: '下载量', dataIndex: 'downloads', key: 'downloads', width: 80 },
    {
      title: '操作', key: 'action', width: 80,
      render: (_: any, r: any) => <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(r)}>下载</Button>,
    },
  ];

  return (
    <div>
      <Tabs defaultActiveKey="my" items={[
        {
          key: 'my', label: '我的资源',
          children: (
            <Card extra={<Upload customRequest={handleUpload} showUploadList={false}><Button icon={<UploadOutlined />} type="primary">上传资源</Button></Upload>}>
              <Table dataSource={resources} columns={myColumns} rowKey="id" loading={loading}
                pagination={{ current: page, total, pageSize: 10, onChange: (p) => { setPage(p); fetchResources(p); } }} />
            </Card>
          ),
        },
        {
          key: 'public', label: '公开资源',
          children: (
            <Card extra={<Input.Search placeholder="搜索资源" allowClear onSearch={(v) => { setSearchText(v); fetchPublic(1, v); }} style={{ width: 250 }} />}>
              <Table dataSource={publicResources} columns={publicColumns} rowKey="id" loading={loading}
                pagination={{ current: publicPage, total: publicTotal, pageSize: 10, onChange: (p) => { setPublicPage(p); fetchPublic(p); } }} />
            </Card>
          ),
        },
      ]} />

      <Modal title="编辑资源" open={editModal} onOk={handleEditSave} onCancel={() => setEditModal(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题"><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="isPublic" label="公开分享" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>

      <Modal title="分享到小组" open={shareModal} onOk={handleShare} onCancel={() => setShareModal(false)}>
        <Select
          placeholder="选择小组"
          value={shareGroupId || undefined}
          onChange={setShareGroupId}
          style={{ width: '100%' }}
          options={myGroups.map((g: any) => ({ value: g.id, label: g.name }))}
        />
      </Modal>
    </div>
  );
}
