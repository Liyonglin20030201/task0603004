import { useState, useEffect } from 'react';
import { Card, List, Button, Modal, Form, Input, Select, Tag, Space, message, Empty, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getNotes, createNote, updateNote, deleteNote } from '../../api/notes.api';
import { getCourses } from '../../api/courses.api';

export default function NoteList() {
  const [notes, setNotes] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [searchText, setSearchText] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [form] = Form.useForm();

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const res = await getNotes({ search: searchText || undefined, page });
      setNotes(res.items);
      setTotal(res.total);
    } catch { message.error('获取笔记失败'); }
    setLoading(false);
  };

  useEffect(() => { fetchNotes(); }, [page, searchText]);
  useEffect(() => { getCourses({ status: 'active' }).then(d => setCourses(d.items)); }, []);

  const handleSubmit = async (values: any) => {
    try {
      if (editingNote) {
        await updateNote(editingNote.id, values);
        message.success('更新成功');
      } else {
        await createNote(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      setEditingNote(null);
      form.resetFields();
      fetchNotes();
    } catch (err: any) { message.error(err.response?.data?.error || '操作失败'); }
  };

  const handleEdit = (note: any) => {
    setEditingNote(note);
    form.setFieldsValue(note);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteNote(id);
    message.success('已删除');
    fetchNotes();
  };

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Input.Search placeholder="搜索笔记..." allowClear style={{ width: 300 }} onSearch={setSearchText} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingNote(null); form.resetFields(); setModalOpen(true); }}>新建笔记</Button>
        </div>

        {notes.length === 0 ? <Empty description="暂无笔记" /> : (
          <List
            grid={{ gutter: 16, xs: 1, sm: 2, lg: 3 }}
            dataSource={notes}
            pagination={{ current: page, total, onChange: setPage, pageSize: 20 }}
            renderItem={(note: any) => (
              <List.Item>
                <Card
                  size="small"
                  title={note.title}
                  extra={
                    <Space>
                      <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(note)} />
                      <Popconfirm title="确定删除？" onConfirm={() => handleDelete(note.id)}>
                        <Button type="link" danger size="small" icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  }
                >
                  <p style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>
                    {note.content?.slice(0, 100) || '无内容'}
                  </p>
                  <div>
                    {note.course && <Tag color="blue">{note.course.title}</Tag>}
                    {note.tags?.map((t: string) => <Tag key={t}>{t}</Tag>)}
                  </div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </div>
                </Card>
              </List.Item>
            )}
          />
        )}
      </Card>

      <Modal title={editingNote ? '编辑笔记' : '新建笔记'} open={modalOpen} onCancel={() => { setModalOpen(false); setEditingNote(null); }} onOk={() => form.submit()} okText={editingNote ? '更新' : '创建'} width={600}>
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="笔记标题" />
          </Form.Item>
          <Form.Item name="content" label="内容">
            <Input.TextArea rows={6} placeholder="支持 Markdown 格式..." />
          </Form.Item>
          <Form.Item name="courseId" label="关联课程">
            <Select placeholder="选择课程（选填）" allowClear options={courses.map(c => ({ value: c.id, label: c.title }))} />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入标签后回车" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
