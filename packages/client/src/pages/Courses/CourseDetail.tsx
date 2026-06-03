import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Typography, Descriptions, Progress, List, Tag, Button, Space, Spin } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { getCourse } from '../../api/courses.api';

const { Title } = Typography;

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      getCourse(id).then(setCourse).finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <Spin size="large" />;
  if (!course) return <div>课程不存在</div>;

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/courses')} style={{ marginBottom: 16 }}>返回</Button>
      <Card>
        <Title level={4}>{course.title}</Title>
        <Descriptions column={2}>
          <Descriptions.Item label="分类"><Tag>{course.category}</Tag></Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color={course.status === 'active' ? 'green' : 'default'}>{course.status}</Tag></Descriptions.Item>
          <Descriptions.Item label="描述">{course.description || '无'}</Descriptions.Item>
          <Descriptions.Item label="完成进度">
            <Progress percent={Math.round(course.progress.completionRate * 100)} size="small" />
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="关联学习计划" style={{ marginTop: 16 }}>
        <List
          dataSource={course.learningPlans || []}
          renderItem={(plan: any) => (
            <List.Item actions={[<Button type="link" onClick={() => navigate(`/plans/${plan.id}`)}>查看</Button>]}>
              <List.Item.Meta
                title={plan.title}
                description={`${plan.startDate?.slice(0, 10)} ~ ${plan.endDate?.slice(0, 10)} | 状态: ${plan.status}`}
              />
            </List.Item>
          )}
          locale={{ emptyText: '暂无学习计划' }}
        />
      </Card>
    </div>
  );
}
