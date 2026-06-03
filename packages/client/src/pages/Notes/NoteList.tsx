import { useState, useEffect, useRef } from 'react';
import { Card, List, Button, Modal, Form, Input, Select, Tag, Space, message, Empty, Popconfirm, Drawer, Typography, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExpandOutlined, FileTextOutlined } from '@ant-design/icons';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { getNotes, createNote, updateNote, deleteNote } from '../../api/notes.api';
import { getCourses } from '../../api/courses.api';

const { Title, Text } = Typography;

const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    ['blockquote', 'code-block'],
    ['link', 'image'],
    [{ 'indent': '-1' }, { 'indent': '+1' }],
    [{ 'align': [] }],
    ['clean'],
  ],
};

const quillFormats = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'background', 'list', 'bullet',
  'blockquote', 'code-block', 'link', 'image',
  'indent', 'align',
];

export default function NoteList() {
  const [notes, setNotes] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [searchText, setSearchText] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [editorContent, setEditorContent] = useState('');
  const [viewNote, setViewNote] = useState<any>(null);
  const [viewOpen, setViewOpen] = useState(false);
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

  const openEditor = (note?: any) => {
    if (note) {
      setEditingNote(note);
      form.setFieldsValue({ title: note.title, courseId: note.courseId, tags: note.tags });
      setEditorContent(note.content || '');
    } else {
      setEditingNote(null);
      form.resetFields();
      setEditorContent('');
    }
    setDrawerOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = { ...values, content: editorContent };

      if (editingNote) {
        await updateNote(editingNote.id, data);
        message.success('更新成功');
      } else {
        await createNote(data);
        message.success('创建成功');
      }
      setDrawerOpen(false);
      setEditingNote(null);
      form.resetFields();
      setEditorContent('');
      fetchNotes();
    } catch (err: any) {
      if (err.response) message.error(err.response?.data?.error || '操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    await deleteNote(id);
    message.success('已删除');
    fetchNotes();
  };

  const handleView = (note: any) => {
    setViewNote(note);
    setViewOpen(true);
  };

  const stripHtml = (html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Input.Search placeholder="搜索笔记..." allowClear style={{ width: 300 }} onSearch={setSearchText} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>新建笔记</Button>
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
                  title={<span><FileTextOutlined style={{ marginRight: 8 }} />{note.title}</span>}
                  hoverable
                  onClick={() => handleView(note)}
                  extra={
                    <Space onClick={(e) => e.stopPropagation()}>
                      <Button type="link" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); openEditor(note); }} />
                      <Popconfirm title="确定删除？" onConfirm={() => handleDelete(note.id)}>
                        <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                      </Popconfirm>
                    </Space>
                  }
                >
                  <p style={{ color: '#666', fontSize: 12, marginBottom: 8, height: 40, overflow: 'hidden' }}>
                    {stripHtml(note.content || '').slice(0, 80) || '无内容'}
                  </p>
                  <div>
                    {note.course && <Tag color="blue">{note.course.title}</Tag>}
                    {note.tags?.slice(0, 3).map((t: string) => <Tag key={t}>{t}</Tag>)}
                    {note.tags?.length > 3 && <Tag>+{note.tags.length - 3}</Tag>}
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

      {/* Rich Text Editor Drawer */}
      <Drawer
        title={editingNote ? '编辑笔记' : '新建笔记'}
        placement="right"
        width={720}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" onClick={handleSubmit}>{editingNote ? '更新' : '创建'}</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="笔记标题" size="large" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="courseId" label="关联课程" style={{ flex: 1 }}>
              <Select placeholder="选择课程（选填）" allowClear options={courses.map(c => ({ value: c.id, label: c.title }))} />
            </Form.Item>
            <Form.Item name="tags" label="标签" style={{ flex: 1 }}>
              <Select mode="tags" placeholder="输入标签后回车" />
            </Form.Item>
          </div>
        </Form>
        <div style={{ marginTop: 8 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>内容</label>
          <ReactQuill
            theme="snow"
            value={editorContent}
            onChange={setEditorContent}
            modules={quillModules}
            formats={quillFormats}
            style={{ height: 400, marginBottom: 50 }}
            placeholder="开始编写笔记内容..."
          />
        </div>
      </Drawer>

      {/* View Note Modal */}
      <Modal
        title={viewNote?.title}
        open={viewOpen}
        onCancel={() => setViewOpen(false)}
        footer={[
          <Button key="edit" type="primary" onClick={() => { setViewOpen(false); openEditor(viewNote); }}>编辑</Button>,
          <Button key="close" onClick={() => setViewOpen(false)}>关闭</Button>,
        ]}
        width={700}
      >
        {viewNote && (
          <div>
            <div style={{ marginBottom: 12 }}>
              {viewNote.course && <Tag color="blue">{viewNote.course.title}</Tag>}
              {viewNote.tags?.map((t: string) => <Tag key={t}>{t}</Tag>)}
              <Text type="secondary" style={{ marginLeft: 8 }}>
                更新于 {new Date(viewNote.updatedAt).toLocaleString()}
              </Text>
            </div>
            <Divider />
            <div
              className="note-content"
              dangerouslySetInnerHTML={{ __html: viewNote.content || '<p>无内容</p>' }}
              style={{ minHeight: 200, lineHeight: 1.8 }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
