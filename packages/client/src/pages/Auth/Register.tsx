import { Form, Input, Button, Card, message, Typography } from 'antd';
import { UserOutlined, LockOutlined, SmileOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../../api/auth.api';
import { useAuthStore } from '../../stores/authStore';

const { Title } = Typography;

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const onFinish = async (values: { email: string; password: string; nickname: string }) => {
    try {
      const data = await register(values.email, values.password, values.nickname);
      setAuth(data.token, data.refreshToken, data.user);
      message.success('注册成功');
      navigate('/dashboard');
    } catch (err: any) {
      message.error(err.response?.data?.error || '注册失败');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 400 }}>
        <Title level={3} style={{ textAlign: 'center' }}>注册账号</Title>
        <Form onFinish={onFinish} size="large">
          <Form.Item name="nickname" rules={[{ required: true, message: '请输入昵称' }]}>
            <Input prefix={<SmileOutlined />} placeholder="昵称" />
          </Form.Item>
          <Form.Item name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
            <Input prefix={<UserOutlined />} placeholder="邮箱" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, min: 6, message: '密码至少6位' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item name="confirmPassword" dependencies={['password']} rules={[
            { required: true, message: '请确认密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) return Promise.resolve();
                return Promise.reject(new Error('两次密码不一致'));
              },
            }),
          ]}>
            <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>注册</Button>
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
            已有账号？<Link to="/login">去登录</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
}
