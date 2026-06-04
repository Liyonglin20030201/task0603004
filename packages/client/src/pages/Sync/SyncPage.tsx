import { useState, useEffect } from 'react';
import { Card, Tag, Spin, Button, message, Switch, Alert } from 'antd';
import { CloudSyncOutlined, WifiOutlined, DisconnectOutlined } from '@ant-design/icons';
import { getSyncStatus } from '../../api/sync.api';

export default function SyncPage() {
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const deviceId = getDeviceId();
      const status = await getSyncStatus(deviceId);
      setSyncStatus(status);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { loadStatus(); }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>同步与离线</h2>
        <Tag color={isOnline ? 'green' : 'red'} icon={isOnline ? <WifiOutlined /> : <DisconnectOutlined />}>
          {isOnline ? '在线' : '离线模式'}
        </Tag>
      </div>

      {!isOnline && (
        <Alert
          message="当前处于离线模式"
          description="你的操作会保存在本地，待网络恢复后自动同步到云端。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card title="同步状态" style={{ marginBottom: 24 }}>
        <p><strong>设备ID：</strong>{getDeviceId()}</p>
        <p><strong>上次同步：</strong>{syncStatus?.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString() : '尚未同步'}</p>
        <p><strong>待处理冲突：</strong>{syncStatus?.pendingConflicts || 0} 个</p>
        <Button type="primary" icon={<CloudSyncOutlined />} onClick={() => { message.info('手动同步功能开发中'); }}>
          立即同步
        </Button>
      </Card>

      <Card title="离线功能说明">
        <ul style={{ paddingLeft: 20 }}>
          <li>支持离线记笔记、打卡、添加错题</li>
          <li>离线操作会在恢复网络后自动同步</li>
          <li>如遇编辑冲突，系统会提供手动解决方案</li>
          <li>建议在网络良好时定期手动同步</li>
        </ul>
      </Card>

      {syncStatus?.pendingConflicts > 0 && (
        <Card title="冲突列表" style={{ marginTop: 24 }}>
          <Alert
            message={`有 ${syncStatus.pendingConflicts} 个同步冲突需要解决`}
            description="这些冲突通常发生在多设备同时编辑同一内容时，请选择保留哪个版本。"
            type="warning"
            showIcon
          />
        </Card>
      )}
    </div>
  );
}

function getDeviceId(): string {
  let deviceId = localStorage.getItem('study_platform_device_id');
  if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem('study_platform_device_id', deviceId);
  }
  return deviceId;
}
