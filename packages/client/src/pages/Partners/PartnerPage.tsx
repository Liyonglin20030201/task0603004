import { useState, useEffect } from 'react';
import { Card, Row, Col, Spin, Button, Tabs, List, Avatar, Tag, Progress, Modal, Input, message, Empty, Popconfirm, Statistic } from 'antd';
import { UserAddOutlined, HeartOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { getPartnerProfile, updatePartnerProfile, getMatches, sendPartnerRequest, getPartnerRequests, respondToRequest, getPartners, getPartnerProgress, removePartner } from '../../api/partners.api';
import { getCourses } from '../../api/courses.api';

export default function PartnerPage() {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [partnerProgress, setPartnerProgress] = useState<Record<string, any>>({});
  const [setupModal, setSetupModal] = useState(false);
  const [bio, setBio] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [profileData, matchData, partnerData, requestData, courseData] = await Promise.all([
        getPartnerProfile(),
        getMatches().catch(() => []),
        getPartners(),
        getPartnerRequests(),
        getCourses().then(r => r.items).catch(() => []),
      ]);
      setProfile(profileData);
      setMatches(matchData);
      setPartners(partnerData);
      setRequests(requestData);
      setCourses(courseData);

      for (const p of partnerData) {
        try {
          const progress = await getPartnerProgress(p.partner.id);
          setPartnerProgress(prev => ({ ...prev, [p.partner.id]: progress }));
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleSetupProfile = async () => {
    try {
      await updatePartnerProfile({
        isSearching: true,
        bio,
        courseIds: courses.map((c: any) => c.id),
        goalKeywords: [],
        availableHours: [9, 10, 14, 15, 20, 21],
      });
      message.success('伙伴资料已保存');
      setSetupModal(false);
      await loadData();
    } catch { message.error('保存失败'); }
  };

  const handleSendRequest = async (userId: string, score: number) => {
    try {
      await sendPartnerRequest(userId, '希望一起学习！', score);
      message.success('请求已发送');
      await loadData();
    } catch (e: any) {
      message.error(e?.response?.data?.error || '发送失败');
    }
  };

  const handleRespond = async (id: string, status: 'accepted' | 'rejected') => {
    try {
      await respondToRequest(id, status);
      message.success(status === 'accepted' ? '已接受' : '已拒绝');
      await loadData();
    } catch { message.error('操作失败'); }
  };

  const handleRemovePartner = async (userId: string) => {
    try {
      await removePartner(userId);
      message.success('已解除伙伴关系');
      await loadData();
    } catch { message.error('操作失败'); }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  const receivedRequests = requests.filter(r => r.toUser && r.status === 'pending');

  const items = [
    {
      key: 'matches',
      label: `推荐匹配 (${matches.length})`,
      children: (
        <div>
          {!profile && (
            <Card style={{ marginBottom: 16 }}>
              <Empty description="请先设置伙伴资料">
                <Button type="primary" onClick={() => setSetupModal(true)}>设置资料</Button>
              </Empty>
            </Card>
          )}
          {matches.length === 0 && profile && (
            <Empty description="暂无匹配的学习伙伴，稍后再试" />
          )}
          <Row gutter={16}>
            {matches.map(match => (
              <Col span={8} key={match.userId} style={{ marginBottom: 16 }}>
                <Card>
                  <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <Avatar size={64} src={match.avatarUrl}>{match.nickname?.[0]}</Avatar>
                    <h4 style={{ marginTop: 8, marginBottom: 4 }}>{match.nickname}</h4>
                    <Tag color="blue">匹配度 {match.totalScore}%</Tag>
                  </div>
                  {match.bio && <p style={{ color: '#666', fontSize: 12 }}>{match.bio}</p>}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>匹配详情</div>
                    <Progress percent={match.breakdown.courseOverlap} size="small" format={() => `课程 ${match.breakdown.courseOverlap}`} />
                    <Progress percent={match.breakdown.scheduleCompatibility} size="small" format={() => `时间 ${match.breakdown.scheduleCompatibility}`} />
                    <Progress percent={match.breakdown.paceAlignment} size="small" format={() => `节奏 ${match.breakdown.paceAlignment}`} />
                    <Progress percent={match.breakdown.goalSimilarity} size="small" format={() => `目标 ${match.breakdown.goalSimilarity}`} />
                  </div>
                  <Button type="primary" block icon={<UserAddOutlined />} onClick={() => handleSendRequest(match.userId, match.totalScore)}>
                    发送邀请
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      ),
    },
    {
      key: 'partners',
      label: `我的伙伴 (${partners.length})`,
      children: (
        <List
          dataSource={partners}
          locale={{ emptyText: '还没有学习伙伴' }}
          renderItem={(item: any) => {
            const progress = partnerProgress[item.partner.id];
            return (
              <List.Item
                actions={[
                  <Popconfirm title="确定解除伙伴关系？" onConfirm={() => handleRemovePartner(item.partner.id)}>
                    <Button size="small" danger>解除</Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Avatar src={item.partner.avatarUrl}>{item.partner.nickname?.[0]}</Avatar>}
                  title={item.partner.nickname}
                  description={`结伴学习自 ${new Date(item.startedAt).toLocaleDateString()}`}
                />
                {progress && (
                  <Row gutter={24}>
                    <Col><Statistic title="连续打卡" value={progress.currentStreak} suffix="天" /></Col>
                    <Col><Statistic title="本周打卡" value={progress.weeklyCheckIns} suffix="次" /></Col>
                    <Col><Statistic title="本周学习" value={progress.weeklyStudyMinutes} suffix="分钟" /></Col>
                  </Row>
                )}
              </List.Item>
            );
          }}
        />
      ),
    },
    {
      key: 'requests',
      label: `请求管理 (${receivedRequests.length})`,
      children: (
        <List
          dataSource={requests}
          locale={{ emptyText: '暂无请求' }}
          renderItem={(item: any) => {
            const isMine = item.fromUser && !item.toUser;
            const otherUser = item.fromUser || item.toUser;
            return (
              <List.Item
                actions={
                  item.status === 'pending' && item.toUser ? [
                    <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => handleRespond(item.id, 'accepted')}>接受</Button>,
                    <Button size="small" icon={<CloseOutlined />} onClick={() => handleRespond(item.id, 'rejected')}>拒绝</Button>,
                  ] : [<Tag>{item.status === 'accepted' ? '已接受' : item.status === 'rejected' ? '已拒绝' : '待回复'}</Tag>]
                }
              >
                <List.Item.Meta
                  avatar={<Avatar src={otherUser?.avatarUrl}>{otherUser?.nickname?.[0]}</Avatar>}
                  title={`${item.toUser ? '收到' : '发送给'} ${otherUser?.nickname}`}
                  description={
                    <span>
                      匹配度 {Math.round(item.score)}%
                      {item.message && ` · "${item.message}"`}
                    </span>
                  }
                />
              </List.Item>
            );
          }}
        />
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>学习伙伴</h2>
        {profile && (
          <Button icon={<HeartOutlined />} onClick={() => setSetupModal(true)}>编辑资料</Button>
        )}
      </div>

      <Tabs items={items} />

      <Modal
        title="设置伙伴资料"
        open={setupModal}
        onOk={handleSetupProfile}
        onCancel={() => setSetupModal(false)}
      >
        <p>简单介绍一下自己的学习情况：</p>
        <Input.TextArea
          value={bio}
          onChange={e => setBio(e.target.value)}
          placeholder="例如：在准备考研，主攻高数和英语，每天晚上8-10点学习"
          rows={3}
          maxLength={500}
        />
      </Modal>
    </div>
  );
}
