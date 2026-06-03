import { useState, useEffect } from 'react';
import { Calendar, Card, Badge, Tag, Typography, Modal, List, Row, Col, Statistic, Space, Button, Empty } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getCalendarEvents } from '../../api/stats.api';
import { createCheckIn } from '../../api/checkins.api';
import { message } from 'antd';

const { Title, Text } = Typography;

const typeColors: Record<string, string> = {
  completed: 'green',
  planned: 'blue',
  skipped: 'default',
  checkin: 'purple',
};

const typeLabels: Record<string, string> = {
  completed: '已完成',
  planned: '待完成',
  skipped: '已跳过',
  checkin: '打卡记录',
};

const typeIcons: Record<string, React.ReactNode> = {
  completed: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  planned: <ClockCircleOutlined style={{ color: '#1890ff' }} />,
  skipped: <ExclamationCircleOutlined style={{ color: '#999' }} />,
  checkin: <CheckCircleOutlined style={{ color: '#722ed1' }} />,
};

export default function CalendarView() {
  const [events, setEvents] = useState<any[]>([]);
  const [currentMonth, setCurrentMonth] = useState(dayjs().format('YYYY-MM'));
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [monthStats, setMonthStats] = useState({ completed: 0, planned: 0, checkins: 0, skipped: 0 });

  const fetchEvents = () => {
    getCalendarEvents(currentMonth).then(data => {
      setEvents(data || []);
      const stats = { completed: 0, planned: 0, checkins: 0, skipped: 0 };
      (data || []).forEach((e: any) => {
        if (e.type === 'completed') stats.completed++;
        else if (e.type === 'planned') stats.planned++;
        else if (e.type === 'checkin') stats.checkins++;
        else if (e.type === 'skipped') stats.skipped++;
      });
      setMonthStats(stats);
    }).catch(() => {});
  };

  useEffect(() => { fetchEvents(); }, [currentMonth]);

  const getEventsForDate = (date: dayjs.Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD');
    return events.filter(e => e.date === dateStr);
  };

  const handleDateSelect = (date: dayjs.Dayjs) => {
    const dayEvents = getEventsForDate(date);
    if (dayEvents.length > 0) {
      setSelectedDate(date);
      setDetailOpen(true);
    }
  };

  const dateCellRender = (date: dayjs.Dayjs) => {
    const dayEvents = getEventsForDate(date);
    if (dayEvents.length === 0) return null;

    const completed = dayEvents.filter(e => e.type === 'completed' || e.type === 'checkin').length;
    const planned = dayEvents.filter(e => e.type === 'planned').length;
    const isToday = date.format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD');

    return (
      <div
        style={{
          cursor: 'pointer',
          padding: 2,
          borderRadius: 4,
          background: isToday ? '#e6f7ff' : undefined,
        }}
      >
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {dayEvents.slice(0, 3).map((e: any, i: number) => (
            <Badge
              key={i}
              color={typeColors[e.type] === 'default' ? 'grey' : typeColors[e.type]}
              text={<span style={{ fontSize: 10 }}>{e.title?.slice(0, 5)}</span>}
            />
          ))}
        </div>
        {dayEvents.length > 3 && (
          <span style={{ fontSize: 10, color: '#999' }}>+{dayEvents.length - 3} 更多</span>
        )}
        {completed > 0 && planned === 0 && (
          <div style={{ fontSize: 10, color: '#52c41a', fontWeight: 500 }}>全部完成</div>
        )}
      </div>
    );
  };

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <div>
      {/* Monthly Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="本月完成" value={monthStats.completed} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="待完成" value={monthStats.planned} valueStyle={{ color: '#1890ff' }} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="打卡次数" value={monthStats.checkins} valueStyle={{ color: '#722ed1' }} prefix={<CalendarOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="已跳过" value={monthStats.skipped} valueStyle={{ color: '#999' }} prefix={<ExclamationCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      {/* Calendar */}
      <Card>
        <Title level={4}><CalendarOutlined style={{ marginRight: 8 }} />日历视图</Title>
        <Calendar
          cellRender={(current, info) => {
            if (info.type === 'date') return dateCellRender(current);
            return null;
          }}
          onPanelChange={(date) => setCurrentMonth(date.format('YYYY-MM'))}
          onSelect={handleDateSelect}
        />
      </Card>

      {/* Date Detail Modal */}
      <Modal
        title={
          <Space>
            <CalendarOutlined />
            <span>{selectedDate?.format('YYYY年MM月DD日')} 学习详情</span>
          </Space>
        }
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>}
        width={600}
      >
        {selectedEvents.length === 0 ? (
          <Empty description="当日无学习记录" />
        ) : (
          <List
            dataSource={selectedEvents}
            renderItem={(event: any) => (
              <List.Item>
                <List.Item.Meta
                  avatar={typeIcons[event.type]}
                  title={
                    <Space>
                      <span>{event.title}</span>
                      <Tag color={typeColors[event.type]}>{typeLabels[event.type]}</Tag>
                    </Space>
                  }
                  description={
                    <div>
                      {event.planTitle && <div>计划: {event.planTitle}</div>}
                      {event.courseName && <div>课程: {event.courseName}</div>}
                      {event.durationMinutes && <div>学习时长: {event.durationMinutes} 分钟</div>}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}

        {/* Summary */}
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#f5f5f5', borderRadius: 8 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Text type="secondary">已完成: </Text>
              <Text strong style={{ color: '#52c41a' }}>
                {selectedEvents.filter(e => e.type === 'completed' || e.type === 'checkin').length}
              </Text>
            </Col>
            <Col span={8}>
              <Text type="secondary">待完成: </Text>
              <Text strong style={{ color: '#1890ff' }}>
                {selectedEvents.filter(e => e.type === 'planned').length}
              </Text>
            </Col>
            <Col span={8}>
              <Text type="secondary">已跳过: </Text>
              <Text strong>{selectedEvents.filter(e => e.type === 'skipped').length}</Text>
            </Col>
          </Row>
        </div>
      </Modal>
    </div>
  );
}
