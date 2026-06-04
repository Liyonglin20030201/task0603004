import { useState, useEffect } from 'react';
import { Card, Row, Col, Spin, Button, Tag, Statistic, message, Empty, Timeline } from 'antd';
import { ThunderboltOutlined, ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { getHabitProfile, analyzeHabits, generateWeekSchedule, getSchedules, updateScheduleStatus } from '../../api/smartPlan.api';

const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const hourLabel = (h: number) => `${h}:00`;

export default function SmartPlanPage() {
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [profileData, scheduleData] = await Promise.all([
        getHabitProfile(),
        getSchedules(),
      ]);
      setProfile(profileData);
      setSchedules(scheduleData);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const result = await analyzeHabits();
      setProfile(result);
      message.success('习惯分析完成');
    } catch { message.error('分析失败'); }
    setAnalyzing(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateWeekSchedule();
      message.success('周计划生成完成');
      await loadData();
    } catch { message.error('生成失败'); }
    setGenerating(false);
  };

  const handleActivate = async (id: string) => {
    try {
      await updateScheduleStatus(id, 'active');
      message.success('已激活');
      await loadData();
    } catch { message.error('操作失败'); }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  const currentSchedule = schedules[0];
  const scheduleData = currentSchedule?.scheduleData as any;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>智能学习规划</h2>
        <div>
          <Button icon={<ThunderboltOutlined />} loading={analyzing} onClick={handleAnalyze} style={{ marginRight: 8 }}>
            分析学习习惯
          </Button>
          <Button type="primary" icon={<ReloadOutlined />} loading={generating} onClick={handleGenerate}>
            生成本周计划
          </Button>
        </div>
      </div>

      {profile && (
        <Card title="学习习惯画像" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic title="最佳学习时段" value={profile.bestHours?.map(hourLabel).join(', ') || '未分析'} />
            </Col>
            <Col span={6}>
              <Statistic title="偏好学习日" value={profile.bestDaysOfWeek?.map((d: number) => dayNames[d]).join(', ') || '未分析'} />
            </Col>
            <Col span={4}>
              <Statistic title="平均时长" value={profile.avgSessionMinutes} suffix="分钟/次" />
            </Col>
            <Col span={4}>
              <Statistic title="每周频率" value={profile.preferredFrequency} suffix="天/周" />
            </Col>
            <Col span={4}>
              <Statistic title="周学习量" value={profile.weeklyStudyMinutes} suffix="分钟" />
            </Col>
          </Row>
        </Card>
      )}

      {!profile && (
        <Card style={{ marginBottom: 24 }}>
          <Empty description="还未分析学习习惯，请点击上方「分析学习习惯」按钮" />
        </Card>
      )}

      {currentSchedule && (
        <Card
          title={
            <span>
              本周智能计划
              <Tag color={currentSchedule.status === 'active' ? 'green' : currentSchedule.status === 'draft' ? 'blue' : 'default'} style={{ marginLeft: 8 }}>
                {currentSchedule.status === 'active' ? '执行中' : currentSchedule.status === 'draft' ? '待确认' : currentSchedule.status}
              </Tag>
            </span>
          }
          extra={
            currentSchedule.status === 'draft' && (
              <Button type="primary" size="small" onClick={() => handleActivate(currentSchedule.id)}>
                确认执行
              </Button>
            )
          }
        >
          {currentSchedule.aiExplanation && (
            <div style={{ marginBottom: 16, padding: 12, background: '#f6ffed', borderRadius: 4 }}>
              <strong>AI 推荐理由：</strong>{currentSchedule.aiExplanation}
            </div>
          )}

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Statistic title="计划任务数" value={scheduleData?.itemsScheduled || 0} />
            </Col>
            <Col span={8}>
              <Statistic title="总学习时长" value={scheduleData?.totalMinutes || 0} suffix="分钟" />
            </Col>
            <Col span={8}>
              <Statistic title="学习天数" value={scheduleData?.days?.filter((d: any) => d.slots.length > 0).length || 0} suffix="天" />
            </Col>
          </Row>

          <Row gutter={8}>
            {scheduleData?.days?.map((day: any) => (
              <Col span={Math.floor(24 / 7)} key={day.date} style={{ minWidth: 140 }}>
                <Card
                  size="small"
                  title={<span>{dayNames[day.dayOfWeek]} <br /><small>{day.date.slice(5)}</small></span>}
                  style={{ marginBottom: 8, minHeight: 200 }}
                >
                  {day.slots.length === 0 ? (
                    <div style={{ color: '#999', textAlign: 'center', paddingTop: 20 }}>休息日</div>
                  ) : (
                    <Timeline
                      items={day.slots.map((slot: any) => ({
                        color: 'blue',
                        children: (
                          <div style={{ fontSize: 12 }}>
                            <div><ClockCircleOutlined /> {slot.hour}:00</div>
                            <div style={{ fontWeight: 500 }}>{slot.planItemTitle}</div>
                            <div style={{ color: '#999' }}>{slot.courseTitle} · {slot.durationMinutes}分钟</div>
                          </div>
                        ),
                      }))}
                    />
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {!currentSchedule && profile && (
        <Card>
          <Empty description="暂无计划，请点击「生成本周计划」" />
        </Card>
      )}
    </div>
  );
}
