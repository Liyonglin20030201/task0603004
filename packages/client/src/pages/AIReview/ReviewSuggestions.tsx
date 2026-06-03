import { useState, useEffect } from 'react';
import { Card, Button, Select, List, Tag, Typography, message, Spin, Empty, Collapse, Space } from 'antd';
import { BulbOutlined, CheckOutlined, RobotOutlined } from '@ant-design/icons';
import { generateReview, getSuggestions, acceptSuggestion } from '../../api/ai.api';
import { getCourses } from '../../api/courses.api';

const { Title, Text, Paragraph } = Typography;

const priorityColors = { high: 'red', medium: 'orange', low: 'green' };
const priorityLabels = { high: '高', medium: '中', low: '低' };

export default function ReviewSuggestions() {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string | undefined>();
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchSuggestions = async () => {
    try {
      const data = await getSuggestions();
      setSuggestions(data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    fetchSuggestions();
    getCourses({ status: 'active' }).then(d => setCourses(d.items));
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateReview(selectedCourse);
      message.success('AI复习建议已生成');
      fetchSuggestions();
    } catch (err: any) {
      message.error(err.response?.data?.error || '生成失败，请确保已配置AI API密钥');
    }
    setGenerating(false);
  };

  const handleAccept = async (id: string) => {
    try {
      await acceptSuggestion(id);
      message.success('已采纳建议并创建复习计划');
      fetchSuggestions();
    } catch (err: any) {
      message.error(err.response?.data?.error || '操作失败');
    }
  };

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Title level={4} style={{ margin: 0 }}><BulbOutlined /> AI复习建议</Title>
          <Space>
            <Select placeholder="选择课程（可选）" allowClear style={{ width: 200 }} onChange={setSelectedCourse}
              options={courses.map(c => ({ value: c.id, label: c.title }))}
            />
            <Button type="primary" icon={<RobotOutlined />} loading={generating} onClick={handleGenerate}>
              生成复习建议
            </Button>
          </Space>
        </div>
        <Text type="secondary">AI将根据你的错题记录、学习进度和薄弱环节，生成个性化的7天复习计划。</Text>
      </Card>

      <div style={{ marginTop: 16 }}>
        {loading ? <Spin /> : suggestions.length === 0 ? (
          <Card><Empty description="暂无AI建议，点击上方按钮生成" /></Card>
        ) : (
          suggestions.map((suggestion: any) => {
            const content = suggestion.suggestionContent;
            return (
              <Card key={suggestion.id} style={{ marginBottom: 16 }}
                title={
                  <Space>
                    <RobotOutlined />
                    <span>复习建议 - {new Date(suggestion.generatedAt).toLocaleDateString()}</span>
                    {suggestion.course && <Tag color="blue">{suggestion.course.title}</Tag>}
                    {suggestion.accepted && <Tag color="green">已采纳</Tag>}
                  </Space>
                }
                extra={!suggestion.accepted && (
                  <Button type="primary" icon={<CheckOutlined />} onClick={() => handleAccept(suggestion.id)}>
                    采纳建议
                  </Button>
                )}
              >
                {content?.summary && <Paragraph type="secondary">{content.summary}</Paragraph>}
                <List
                  size="small"
                  dataSource={content?.days || []}
                  renderItem={(day: any, idx: number) => (
                    <List.Item>
                      <List.Item.Meta
                        title={<span>第{idx + 1}天 ({day.date}) <Tag color={(priorityColors as any)[day.priority]}>{(priorityLabels as any)[day.priority]}优先级</Tag></span>}
                        description={
                          <Space direction="vertical" size={0}>
                            <span>主题: {day.topics?.join(', ')}</span>
                            <span>建议时长: {day.durationMinutes}分钟</span>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
