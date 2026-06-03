import { useState, useEffect } from 'react';
import { Card, List, Button, Tag, Typography, Badge, Empty, message, Space } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../api/stats.api';

const { Title } = Typography;

const typeColors: Record<string, string> = { reminder: 'blue', system: 'default', achievement: 'gold' };
const typeLabels: Record<string, string> = { reminder: '提醒', system: '系统', achievement: '成就' };

export default function Notifications() {
  const [data, setData] = useState<any>({ items: [], unreadCount: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await getNotifications();
      setData(res);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleRead = async (id: string) => {
    await markNotificationRead(id);
    fetchData();
  };

  const handleReadAll = async () => {
    await markAllNotificationsRead();
    message.success('已全部标为已读');
    fetchData();
  };

  return (
    <Card title={<Space><BellOutlined /><span>通知中心</span><Badge count={data.unreadCount} /></Space>}
      extra={data.unreadCount > 0 && <Button type="link" onClick={handleReadAll}>全部已读</Button>}
    >
      {(!data.items || data.items.length === 0) ? <Empty description="暂无通知" /> : (
        <List
          loading={loading}
          dataSource={data.items}
          renderItem={(item: any) => (
            <List.Item
              actions={[!item.read && <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleRead(item.id)}>标为已读</Button>]}
            >
              <List.Item.Meta
                title={<span style={{ fontWeight: item.read ? 'normal' : 'bold' }}><Tag color={typeColors[item.type]}>{typeLabels[item.type]}</Tag>{item.title}</span>}
                description={<span>{item.content} <span style={{ color: '#999', marginLeft: 8 }}>{new Date(item.createdAt).toLocaleString()}</span></span>}
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
