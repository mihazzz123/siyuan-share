import { ApiOutlined, DashboardOutlined, LockOutlined, LogoutOutlined, MailOutlined, UserOutlined } from '@ant-design/icons'
import { Button, Card, Divider, Form, Input, Space, Tabs, Tag, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import api from '../api'
import './Home.css'

const { Title, Text, Paragraph } = Typography

interface HealthData {
  status: string
  ts: number
  userCount: number
  ginMode: string
  version: string
}

interface ApiResponse<T = any> {
  code: number
  msg: string
  data: T
}

interface LoginResponse { token: string; user: { id: string; username: string; email: string } }

function Home() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('status')
  const [sessionUser, setSessionUser] = useState<{ id: string; username: string; email: string } | null>(null)
  const [loadingAction, setLoadingAction] = useState(false)
  const [loginForm] = Form.useForm()
  const [registerForm] = Form.useForm()

  const loadHealth = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/health') as HealthData
      setHealth(res)
    } catch (e: any) {
      message.error('Не удалось подключиться к бэкенду')
    } finally {
      setLoading(false)
    }
  }

  const restoreSession = async () => {
    try {
      const res = await api.get('/api/user/me') as ApiResponse<any>
      if (res.code === 0) {
        setSessionUser(res.data)
        setActiveTab('status')
      }
    } catch {}
  }

  useEffect(() => {
    loadHealth()
    restoreSession()
  }, [])

  const handleRegister = async (values: any) => {
    setLoadingAction(true)
    try {
      const res = await api.post('/api/auth/register', values) as ApiResponse
      if (res.code === 0) {
        message.success('Регистрация успешна! Теперь войдите')
        registerForm.resetFields()
        setActiveTab('login')
      } else {
        message.error(res.msg || 'Ошибка регистрации')
      }
    } catch (e: any) {
      message.error(e.response?.data?.msg || e.message || 'Ошибка регистрации')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleLogin = async (values: any) => {
    setLoadingAction(true)
    try {
      const res = await api.post('/api/auth/login', values) as ApiResponse<LoginResponse>
      if (res.code === 0) {
        localStorage.setItem('session_token', res.data.token)
        setSessionUser(res.data.user)
        message.success(`С возвращением，${res.data.user.username}！`)
        loginForm.resetFields()
        setActiveTab('status')
      } else {
        message.error(res.msg || 'Ошибка входа')
      }
    } catch (e: any) {
      message.error(e.response?.data?.msg || e.message || 'Ошибка входа')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('session_token')
    setSessionUser(null)
    message.info('Выход выполнен')
  }

  const tabItems = [
    {
      key: 'status',
      label: 'Service статус',
      children: (
        <div style={{ padding: '24px 0' }}>
          {loading ? (
            <Text type="secondary">Загрузка...</Text>
          ) : health ? (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Title level={4} style={{ marginBottom: 16 }}>Running статус</Title>
                <Space size="middle" wrap>
                  <Tag color={health.status === 'ok' ? 'success' : 'error'} style={{ fontSize: 14, padding: '4px 12px' }}>
                    {health.status === 'ok' ? '✓ Running Активенly' : 'Ошибка'}
                  </Tag>
                  <Tag color="geekblue" style={{ fontSize: 14, padding: '4px 12px' }}>Версия: {health.version}</Tag>
                </Space>
              </div>
              <Divider style={{ margin: '16px 0' }} />
              {sessionUser ? (
                <Card size="small" style={{ background: '#f6f8fa', border: 'none' }}>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Text strong style={{ fontSize: 15 }}>
                      <UserOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                      Вы вошли как: {sessionUser.username}
                    </Text>
                    <Space size="middle">
                      <Button type="primary" icon={<DashboardOutlined />} href="/dashboard">
                        В кабинет
                      </Button>
                      <Button icon={<LogoutOutlined />} onClick={handleLogout}>Выйти</Button>
                    </Space>
                  </Space>
                </Card>
              ) : (
                <Card size="small" style={{ background: '#fff7e6', border: '1px solid #ffd666' }}>
                  <Paragraph style={{ margin: 0, color: '#ad6800' }}>
                    Вы не вошли. Используйте вкладки "Вход" или "Регистрация" для управления.
                  </Paragraph>
                </Card>
              )}
            </Space>
          ) : (
            <Text type="danger">подключения</Text>
          )}
        </div>
      )
    },
    {
      key: 'login',
      label: 'Вход',
      children: (
        <div style={{ padding: '24px 0', maxWidth: 400, margin: '0 auto' }}>
          <Title level={4} style={{ textAlign: 'center', marginBottom: 24 }}>С возвращением</Title>
          <Form form={loginForm} onFinish={handleLogin} layout="vertical" size="large">
            <Form.Item name="username" rules={[{ required: true, message: 'Введите имя пользователя' }]}>
              <Input prefix={<UserOutlined />} placeholder="Имя пользователя" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: 'Введите пароль' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Пароль" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loadingAction} size="large">
                Вход
              </Button>
            </Form.Item>
          </Form>
          <Paragraph style={{ textAlign: 'center', marginTop: 16, color: '#8c8c8c' }}>
            Нет аккаунта? <a onClick={() => setActiveTab('register')}>Зарегистрироваться</a>
          </Paragraph>
        </div>
      )
    },
    {
      key: 'register',
      label: 'Регистрация',
      children: (
        <div style={{ padding: '24px 0', maxWidth: 400, margin: '0 auto' }}>
          <Title level={4} style={{ textAlign: 'center', marginBottom: 24 }}>Создать Account</Title>
          <Form form={registerForm} onFinish={handleRegister} layout="vertical" size="large">
            <Form.Item name="username" rules={[{ required: true, message: 'Введите имя пользователя' }, { min: 3, message: 'Минимум 3 символа' }]}>
              <Input prefix={<UserOutlined />} placeholder="Имя пользователя" />
            </Form.Item>
            <Form.Item name="email" rules={[{ required: true, message: 'Введите Email' }, { type: 'email', message: 'Emailформатнекорректно' }]}>
              <Input prefix={<MailOutlined />} placeholder="Email" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: 'Введите пароль' }, { min: 6, message: 'Минимум 6 символов' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Пароль" />
            </Form.Item>
            <Form.Item
              name="password2"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Пожалуйста, подтвердите пароль' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('Пароли не совпадают'))
                  }
                })
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Подтвердите пароль" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loadingAction} size="large">
                Регистрация
              </Button>
            </Form.Item>
          </Form>
          <Paragraph style={{ textAlign: 'center', marginTop: 16, color: '#8c8c8c' }}>
            Уже есть аккаунт? <a onClick={() => setActiveTab('login')}>Войти сейчас</a>
          </Paragraph>
        </div>
      )
    }
  ]

  return (
    <div className="home-container">
      <div className="home-header">
        <Title level={2} style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>
          <ApiOutlined style={{ marginRight: 12, color: '#1890ff' }} />
          Сервис публикации SiYuan
        </Title>
        <Paragraph type="secondary" style={{ margin: '8px 0 0 0', fontSize: 15 }}>
          Безопасная и быстрая публикация ваших заметок
        </Paragraph>
      </div>

      <Card className="home-card" bordered={false}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={sessionUser ? tabItems.filter(item => item.key === 'status') : tabItems} size="large" />
      </Card>

      <Card className="usage-card" bordered={false} style={{ marginTop: 24 }}>
        <Title level={4} style={{ marginBottom: 16 }}>Инструкция</Title>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Paragraph style={{ margin: 0 }}>
            <Text strong>Доступ к ссылке: </Text> <Text code>/s/&lt;shareId&gt;</Text>
          </Paragraph>
          <Paragraph style={{ margin: 0 }}>
            <Text strong>API Token: </Text> После входа перейдите в дашборд для создания (для использования в плагине SiYuan)
          </Paragraph>
        </Space>
      </Card>
    </div>
  )
}

export default Home
