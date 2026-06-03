import { useState, useEffect } from 'react';
import { Calendar, Card, Badge, Tag, Typography, Popover, List } from 'antd';
import dayjs from 'dayjs';
import { getCalendarEvents } from '../../api/stats.api';

const { Title } = Typography;

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
  checkin: '打卡',
};

export default function CalendarView() {
  const [events, setEvents] = useState<any[]>([]);
  const [currentMonth, setCurrentMonth] = useState(dayjs().format('YYYY-MM'));

  useEffect(() => {
    getCalendarEvents(currentMonth).then(setEvents).catch(() => {});
  }, [currentMonth]);

  const getEventsForDate = (date: dayjs.Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD');
    return events.filter(e => e.date === dateStr);
  };

  const dateCellRender = (date: dayjs.Dayjs) => {
    const dayEvents = getEventsForDate(date);
    if (dayEvents.length === 0) return null;

    const content = (
      <List size="small" dataSource={dayEvents} renderItem={(e: any) => (
        <List.Item><Tag color={typeColors[e.type]}>{typeLabels[e.type]}</Tag> {e.title}</List.Item>
      )} />
    );

    return (
      <Popover content={content} title={date.format('MM-DD')} trigger="hover">
        <div>
          {dayEvents.slice(0, 3).map((e: any, i: number) => (
            <Badge key={i} color={typeColors[e.type] === 'default' ? 'grey' : typeColors[e.type]} text={<span style={{ fontSize: 11 }}>{e.title?.slice(0, 6)}</span>} />
          ))}
          {dayEvents.length > 3 && <span style={{ fontSize: 11, color: '#999' }}>+{dayEvents.length - 3}...</span>}
        </div>
      </Popover>
    );
  };

  return (
    <Card>
      <Title level={4}>日历视图</Title>
      <Calendar
        cellRender={(current, info) => {
          if (info.type === 'date') return dateCellRender(current);
          return null;
        }}
        onPanelChange={(date) => setCurrentMonth(date.format('YYYY-MM'))}
      />
    </Card>
  );
}
