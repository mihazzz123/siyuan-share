import { ApiOutlined, КопироватьOutlined, УдалитьOutlined, HomeOutlined, PlusOutlined, ReloadOutlined, ShareAltOutlined, UserOutlined } from '@ant-design/icons'
import { Button, Card, Divider, Form, Input, message, Modal, Space, Table, Tag, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

const { Title, Text, Paragraph } = Typography

interface ApiResp<T = any> { code: number; msg: string; data: T }
interface TokenItem { id: string; name: string; revoked: boolean; createdAt: string; lastUsedAt?: string }

function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [tokens, setTokens] = useState<TokenItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string>('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newTokenData, setNewTokenData] = useState<{ name: string; token: string } | null>(null)
  const [form] = Form.useForm()

  const loadAll = async () => {
    setLoading(true)
    try {
      const me = await api.get('/api/user/me') as ApiResp<any>
      if (me.code === 0) setUser(me.data)
      const list = await api.get('/api/token/list') as ApiResp<{ items: TokenItem[] }>
      if (list.code === 0) setTokens(list.data.items || [])
    } catch (e: any) {
      message.error(e.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const createToken = async (values: any) => {
    setActionLoading('create')
    try {
      const res = await api.post('/api/token/create', values) as ApiResp<any>
      if (res.code === 0) {
        setNewTokenData({ name: res.data.name, token: res.data.token })
        message.success('Token успешно создан')
        form.resetFields()
        setCreateModalOpen(false)
        loadAll()
      } else {
        message.error(res.msg || 'Ошибка создания')
      }
    } catch (e: any) {
      message.error(e.response?.data?.msg || e.message || 'Ошибка создания')
    } finally {
      setActionLoading('')
    }
  }

  const refreshToken = async (id: string, name: string) => {
    setActionLoading(id)
    try {
      const res = await api.post(`/api/token/refresh/${id}`, {}) as ApiResp<any>
      if (res.code === 0) {
        setNewTokenData({ name, token: res.data.token })
        message.success('Token обновлен')
        loadAll()
      } else {
        message.error(res.msg || 'Ошибка обновления')
      }
    } catch (e: any) {
      message.error(e.response?.data?.msg || e.message || 'Ошибка обновления')
    } finally {
      setActionLoading('')
    }
  }

  const revokeToken = async (id: string) => {
    Modal.confirm({
      title: 'Подтвердите отзыв',
      content: 'После отзыва этот Token станет недействительным. Вам нужно будет обновить его или создать новый.',
      okText: 'Подтвердите отзыв',
      cancelText: 'Отмена',
      okType: 'danger',
      onOk: async () => {
        setActionLoading(id)
        try {
          const res = await api.post(`/api/token/revoke/${id}`, {}) as ApiResp<any>
          if (res.code === 0) {
            message.success('Token отозван')
            loadAll()
          } else {
            message.error(res.msg || 'Ошибка отзыва')
          }
        } catch (e: any) {
          message.error(e.response?.data?.msg || e.message || 'Ошибка отзыва')
        } finally {
          setActionLoading('')
        }
      }
    })
  }

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token)
    message.success('Token скопирован в буфер обмена')
  }

  const columns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: 'статус',
      dataIndex: 'revoked',
      key: 'revoked',
      render: (revoked: boolean) => (
        <Tag color={revoked ? 'default' : 'success'}>
          {revoked ? 'Отозватьd' : 'Активен'}
        </Tag>
      )
    },
    {
      title: 'Дата создания',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (time: string) => new Date(time).toLocaleString('ru-RU')
    },
    {
      title: 'Последнее использование',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      render: (time?: string) => time ? new Date(time).toLocaleString('ru-RU') : '-'
    },
    {
      title: 'Действие',
      key: 'action',
      render: (_: any, record: TokenItem) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<ReloadOutlined />}
            disabled={record.revoked || actionLoading === record.id}
            loading={actionLoading === record.id}
            onClick={() => refreshToken(record.id, record.name)}
          >
            Обновить
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<УдалитьOutlined />}
            disabled={record.revoked || actionLoading === record.id}
            onClick={() => revokeToken(record.id)}
          >
            Отозвать
          </Button>
        </Space>
      )
    }
  ]

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: '60px auto', padding: '0 24px', textAlign: 'center' }}>
        <Text type="secondary">Загрузка...</Text>
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{ maxWidth: 1200, margin: '60px auto', padding: '0 24px', textAlign: 'center' }}>
        <Card>
          <Space direction="vertical" size="large">
            <Text type="secondary">Вы не вошли или сессия истекла</Text>
            <Button type="primary" href="/">На главную</Button>
          </Space>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '60px auto', padding: '0 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <Space size="middle" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Title level={2} style={{ margin: 0 }}>
            <ApiOutlined style={{ marginRight: 12, color: '#1890ff' }} />
            Личный кабинет
          </Title>
          <Space>
            <Button icon={<ShareAltOutlined />} onClick={() => navigate('/shares')}>
              Управление ссылками
            </Button>
            <Button icon={<HomeOutlined />} href="/">На главную</Button>
          </Space>
        </Space>
      </div>

      <Card
        title={
          <Space>
            <UserOutlined />
            <span>Информация об аккаунте</span>
          </Space>
        }
        bordered={false}
        style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.04)' }}
      >
        <Space direction="vertical" size="small">
          <Text><Text strong>Имя пользователя: </Text>{user.username}</Text>
          <Text><Text strong>Email: </Text>{user.email}</Text>
          <Text type="secondary"><Text strong>Дата создания：</Text>{new Date(user.createdAt).toLocaleString('ru-RU')}</Text>
        </Space>
      </Card>

      <Card
        title={
          <Space>
            <ApiOutlined />
            <span>Управление API Token</span>
          </Space>
        }
        bordered={false}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            Создать новый Token
          </Button>
        }
        style={{ borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.04)' }}
      >
        <Table
          dataSource={tokens}
          columns={columns}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: 'Токенов пока нет' }}
        />
        <Divider />
        <Paragraph type="secondary" style={{ margin: 0 }}>
          <Text strong>Совет: </Text>Используйте любой созданный здесь Token в плагине SiYuan для управления публикациями.
        </Paragraph>
      </Card>

      <Modal
        title="Создать новый Token"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false)
          form.resetFields()
        }}
        footer={null}
      >
        <Form form={form} onFinish={createToken} layout="vertical">
          <Form.Item
            name="name"
            label="Название токена"
            rules={[{ required: true, message: 'Введите название токена' }]}
          >
            <Input placeholder="Например: Плагин на ноутбуке" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={actionLoading === 'create'}>
                Создать
              </Button>
              <Button onClick={() => {
                setCreateModalOpen(false)
                form.resetFields()
              }}>
                Отмена
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Token создан"
        open={!!newTokenData}
        onCancel={() => setNewTokenData(null)}
        footer={[
          <Button key="copy" type="primary" icon={<КопироватьOutlined />} onClick={() => copyToken(newTokenData!.token)}>
            Копировать Token
          </Button>,
          <Button key="close" onClick={() => setNewTokenData(null)}>
            Я сохранил
          </Button>
        ]}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Paragraph>
            <Text strong>Название：</Text>{newTokenData?.name}
          </Paragraph>
          <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
            <Text code style={{ fontSize: 13, wordBreak: 'break-all' }}>
              {newTokenData?.token}
            </Text>
          </div>
          <Paragraph type="danger" style={{ margin: 0 }}>
            <Text strong>Важное примечание: </Text>Этот Token отображается только один раз. Пожалуйста, скопируйте его прямо сейчас. После закрытия окна увидеть его снова будет невозможно.
          </Paragraph>
        </Space>
      </Modal>
    </div>
  )
}

export default Dashboard
