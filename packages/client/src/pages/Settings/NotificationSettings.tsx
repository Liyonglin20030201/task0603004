import { useState, useEffect } from 'react';
import { Card, Table, Switch, Button, message, Space, Typography, Input } from 'antd';
import { MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { getNotificationPreferences, updateNotificationPreferences, sendTestEmail, getPhone, updatePhone, sendTestSms } from '../../api/notificationPreferences.api';

const { Title, Text } = Typography;

const NOTIFICATION_TYPES = [
  { key: 'reminder', label: '学习提醒' },
  { key: 'system', label: '系统通知' },
  { key: 'achievement', label: '成就通知' },
  { key: 'group', label: '小组动态' },
  { key: 'goal', label: '目标提醒' },
];

const CHANNELS = [
  { key: 'in_app', label: '站内通知' },
  { key: 'email', label: '邮件通知' },
  { key: 'sms', label: '短信通知' },
];

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);

  useEffect(() => { fetchPreferences(); fetchPhone(); }, []);

  const fetchPreferences = async () => {
    setLoading(true);
    try {
      const res = await getNotificationPreferences();
      const map: Record<string, Record<string, boolean>> = {};
      for (const type of NOTIFICATION_TYPES) {
        map[type.key] = {};
        for (const ch of CHANNELS) {
          map[type.key][ch.key] = ch.key === 'in_app';
        }
      }
      for (const pref of res.data) {
        if (!map[pref.type]) map[pref.type] = {};
        map[pref.type][pref.channel] = pref.enabled;
      }
      setPreferences(map);
    } finally { setLoading(false); }
  };

  const fetchPhone = async () => {
    try {
      const res = await getPhone();
      setPhone(res.data.phone || '');
    } catch {}
  };

  const handleToggle = (type: string, channel: string, checked: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [type]: { ...prev[type], [channel]: checked },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const prefs: Array<{ type: string; channel: string; enabled: boolean }> = [];
      for (const type of NOTIFICATION_TYPES) {
        for (const ch of CHANNELS) {
          prefs.push({ type: type.key, channel: ch.key, enabled: preferences[type.key]?.[ch.key] ?? false });
        }
      }
      await updateNotificationPreferences(prefs);
      message.success('设置已保存');
    } catch { message.error('保存失败'); }
    finally { setSaving(false); }
  };

  const handleTestEmail = async () => {
    try {
      const res = await sendTestEmail();
      if (res.success) { message.success('测试邮件已发送，请查收'); }
      else { message.warning(res.error || '发送失败'); }
    } catch { message.error('发送失败'); }
  };

  const handleSavePhone = async () => {
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      message.error('请输入正确的11位手机号');
      return;
    }
    setPhoneSaving(true);
    try {
      await updatePhone(phone);
      message.success('手机号已保存');
    } catch (err: any) {
      message.error(err.response?.data?.error || '保存失败');
    } finally { setPhoneSaving(false); }
  };

  const handleTestSms = async () => {
    if (!phone) { message.warning('请先设置手机号'); return; }
    try {
      const res = await sendTestSms();
      if (res.success) { message.success('测试短信已发送'); }
      else { message.warning(res.error || '发送失败'); }
    } catch { message.error('发送失败'); }
  };

  const columns = [
    { title: '通知类型', dataIndex: 'label', key: 'label', width: 150 },
    ...CHANNELS.map(ch => ({
      title: ch.label,
      key: ch.key,
      width: 120,
      render: (_: any, record: any) => (
        <Switch
          checked={preferences[record.key]?.[ch.key] ?? false}
          onChange={(checked) => handleToggle(record.key, ch.key, checked)}
          disabled={ch.key === 'in_app' || (ch.key === 'sms' && !phone)}
        />
      ),
    })),
  ];

  return (
    <div>
      <Title level={4}>通知设置</Title>
      <Text type="secondary">管理各类通知的推送渠道。站内通知始终开启。</Text>

      <Card title="手机号设置" style={{ marginTop: 16 }}>
        <Space>
          <Input
            prefix={<PhoneOutlined />}
            placeholder="请输入手机号"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ width: 200 }}
            maxLength={11}
          />
          <Button onClick={handleSavePhone} loading={phoneSaving}>保存手机号</Button>
          <Button icon={<PhoneOutlined />} onClick={handleTestSms}>发送测试短信</Button>
        </Space>
        <div style={{ marginTop: 8 }}>
          <Text type="secondary">设置手机号后，开启短信通知即可接收学习提醒短信。</Text>
        </div>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Table
          dataSource={NOTIFICATION_TYPES}
          columns={columns}
          rowKey="key"
          loading={loading}
          pagination={false}
          size="middle"
        />
        <Space style={{ marginTop: 16 }}>
          <Button type="primary" onClick={handleSave} loading={saving}>保存设置</Button>
          <Button icon={<MailOutlined />} onClick={handleTestEmail}>发送测试邮件</Button>
        </Space>
      </Card>
    </div>
  );
}
