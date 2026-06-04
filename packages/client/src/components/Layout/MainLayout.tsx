import { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Badge } from 'antd';
import {
  DashboardOutlined,
  BookOutlined,
  ScheduleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  BulbOutlined,
  CalendarOutlined,
  BarChartOutlined,
  BellOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  TeamOutlined,
  AimOutlined,
  LineChartOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/courses', icon: <BookOutlined />, label: '课程管理' },
  { key: '/plans', icon: <ScheduleOutlined />, label: '学习计划' },
  { key: '/goals', icon: <AimOutlined />, label: '学习目标' },
  { key: '/checkin', icon: <CheckCircleOutlined />, label: '每日打卡' },
  { key: '/groups', icon: <TeamOutlined />, label: '学习小组' },
  { key: '/wrong-answers', icon: <FileTextOutlined />, label: '错题本' },
  { key: '/notes', icon: <FileTextOutlined />, label: '笔记' },
  { key: '/resources', icon: <CloudUploadOutlined />, label: '资源平台' },
  { key: '/ai-review', icon: <BulbOutlined />, label: 'AI复习建议' },
  { key: '/reports', icon: <LineChartOutlined />, label: '分析报告' },
  { key: '/calendar', icon: <CalendarOutlined />, label: '日历视图' },
  { key: '/stats', icon: <BarChartOutlined />, label: '进度统计' },
  { key: '/notifications', icon: <BellOutlined />, label: '通知' },
  { key: '/settings/notifications', icon: <SettingOutlined />, label: '通知设置' },
  { key: '/admin', icon: <SettingOutlined />, label: '后台配置' },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const dropdownItems = [
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 32, margin: 16, textAlign: 'center', color: '#fff', fontWeight: 'bold', fontSize: collapsed ? 14 : 18 }}>
          {collapsed ? 'SP' : '学习平台'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
          <Badge count={0}>
            <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} onClick={() => navigate('/notifications')} />
          </Badge>
          <Dropdown menu={{ items: dropdownItems, onClick: ({ key }) => { if (key === 'logout') { logout(); navigate('/login'); } } }}>
            <span style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} style={{ marginRight: 8 }} />
              {user?.nickname}
            </span>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8, minHeight: 360 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
