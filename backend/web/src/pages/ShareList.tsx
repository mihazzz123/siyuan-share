import { ArrowLeftOutlined, КопироватьOutlined, УдалитьOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Card, message, Modal, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteShare, listShares, type ShareListItem } from '../api/share'

const { Title, Text } = Typography

function ShareList() {
  const navigate = useNavigate()
  const [shares, setShares] = useState<ShareListItem[]>([])
  const [loading, setЗагрузка... useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10

  const loadShares = async (currentPage = 1) => {
    setЗагрузка...ue)
    try {
      const res = await listShares(currentPage, pageSize)
      if (res.code === 0) {
        setShares(res.data.items || [])
        setTotal(res.data.total)
        setPage(currentPage)
      } else {
        message.error(res.msg || 'Ошибка загрузки')
      }
    } catch (e: any) {
      message.error(e.response?.data?.msg || e.message || 'Ошибка загрузки')
    } finally {
      setЗагрузка...lse)
    }
  }

  useEffect(() => {
    loadShares()
  }, [])

  const copyShareUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      message.success('Ссылка скопирована')
    }).catch(() => {
      message.error('Копировать failed')
    })
  }

  const handleУдалить = async (id: string, docTitle: string) => {
    Modal.confirm({
      title: 'Подтвердите удаление',
      content: `Вы уверены, что хотите удалить публикацию"${docTitle}"? Это действие нельзя отменить.`,
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          const res = await deleteShare(id)
          if (res.code === 0) {
            message.success('Успешно удалено')
            loadShares(page)
          } else {
            message.error(res.msg || 'Ошибка удаления')
          }
        } catch (e: any) {
          message.error(e.response?.data?.msg || e.message || 'Ошибка удаления')
        }
      }
    })
  }

  const isИстекла = (expireAt: string) => {
    return new Date(expireAt) <= new Date()
  }

  const columns: ColumnsType<ShareListItem> = [
    {
      title: 'Заголовок заметки',
      dataIndex: 'docTitle',
      key: 'docTitle',
      ellipsis: true,
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: 'статус',
      dataIndex: 'expireAt',
      key: 'status',
      width: 100,
      render: (expireAt: string) => (
        <Tag color={isИстекла(expireAt) ? 'default' : 'success'}>
          {isИстекла(expireAt) ? 'Истекла' : 'Активна'}
        </Tag>
      )
    },
    {
      title: 'Доступ',
      key: 'access',
      width: 120,
      render: (record: ShareListItem) => {
        if (record.requireПароль) {
          return <Tag color="orange">Защита паролем</Tag>
        }
        return record.isПубличная ? <Tag color="blue">Публичная</Tag> : <Tag>По ссылке</Tag>
      }
    },
    {
      title: 'Просмотрs',
      dataIndex: 'viewCount',
      key: 'viewCount',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.viewCount - b.viewCount,
    },
    {
      title: 'Время создания',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (time: string) => new Date(time).toLocaleString(),
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      title: 'Истекает',
      dataIndex: 'expireAt',
      key: 'expireAt',
      width: 180,
      render: (time: string) => new Date(time).toLocaleString(),
      sorter: (a, b) => new Date(a.expireAt).getTime() - new Date(b.expireAt).getTime(),
    },
    {
      title: 'Действия',
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (record: ShareListItem) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<КопироватьOutlined />}
            onClick={() => copyShareUrl(record.shareUrl)}
          >
            Копировать
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<УдалитьOutlined />}
            onClick={() => handleУдалить(record.id, record.docTitle)}
          >
            Удалить
          </Button>
        </Space>
      )
    }
  ]

  return (
    <div style={{ maxWidth: 1400, margin: '60px auto', padding: '0 24px' }}>
      <Card>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/dashboard')}
              >
                Вернуться в кабинет
              </Button>
              <Title level={3} style={{ margin: 0 }}>
                Управление публикациями
              </Title>
            </div>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => loadShares(page)}
              loading={loading}
            >
              Обновить
            </Button>
          </div>
        </div>

        <Table
          dataSource={shares}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            total: total,
            pageSize: pageSize,
            showSizeChanger: false,
            showTotal: (total) => `Всего ${total} записей`,
            onChange: loadShares
          }}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: (
              <div style={{ padding: '40px 0', color: 'rgba(0,0,0,0.25)' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                <div>Публикаций пока нет</div>
              </div>
            )
          }}
        />
      </Card>
    </div>
  )
}

export default ShareList
