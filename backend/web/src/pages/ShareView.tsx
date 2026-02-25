import { ExclamationCircleOutlined, EyeOutlined, FileSearchOutlined, HomeOutlined, UpOutlined } from '@ant-design/icons'
import { Anchor, Button, Drawer, Image, Input, Layout, message, Result, Spin, Typography } from 'antd'
import 'github-markdown-css/github-markdown-light.css'
import 'highlight.js/styles/github.css'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useParams } from 'react-router-dom'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import { getShare, ShareData } from '../api/share'
import './ShareПросмотр.css'

const { Content, Sider } = Layout
const { Title, Text } = Typography

interface TocNode {
  id: string
  text: string
  level: number
  children?: TocNode[]
}

function ShareПросмотр() {
  const { shareId } = useParams<{ shareId: string }>()
  const [loading, setЗагрузка... useState(true)
  const [error, setError] = useState<string | null>(null)
  const [share, setShare] = useState<ShareData | null>(null)
  const [requireПароль, setRequireПароль] = useState(false)
  const [password, setПароль] = useState('')
  const [passwordError, setПарольError] = useState('')
  const [tocVisible, setTocVisible] = useState(false)
  const [tocTree, setTocTree] = useState<TocNode[]>([])
  const [showBackTop, setShowBackTop] = useState(false)
  const [headerShrink, setHeaderShrink] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const loadShare = async (pwd?: string) => {
    if (!shareId) return

    setЗагрузка...ue)
    setError(null)
    setПарольError('')

    try {
      const response = await getShare(shareId, pwd)
      
      if (response.code === 0 && response.data) {
        setShare(response.data)
        setRequireПароль(false)
      } else {
        setError(response.msg || 'Ошибка загрузки')
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.msg || err.message || 'Ошибка загрузки'
      
      if (errorMsg.includes('Пароль required')) {
        setRequireПароль(true)
      } else if (errorMsg.includes('Invalid password')) {
        setПарольError('Неверный пароль')
      } else {
        setError(errorMsg)
      }
    } finally {
      setЗагрузка...lse)
    }
  }

  // Извлечение заголовков из DOM, исключая псевдозаголовки внутри блоков кода
  useEffect(() => {
    if (!share?.content) {
      setTocTree([])
      return
    }
    const root = contentRef.current
    if (!root) return

    const headingEls = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6')) as HTMLElement[]
    const nodes: TocNode[] = []
    const stack: TocNode[] = []
    const idCount: Record<string, number> = {}

    const slugify = (text: string) => {
      let slug = text.trim().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u4e00-\u9fa5-]/g, '')
      slug = slug.replace(/-+/g, '-')
      if (!slug) slug = 'section'
      if (idCount[slug] !== undefined) {
        idCount[slug] += 1
        slug = `${slug}-${idCount[slug]}`
      } else {
        idCount[slug] = 0
      }
      return slug
    }

    headingEls.forEach(el => {
      // исключениекодаБлоквнутризаголовка: еслипредковсуществует PRE  или  CODE（ и не являетсясамо по себеестькодаметка）
      if (el.closest('pre, code')) return
      const level = Number(el.tagНазвание.substring(1))
      const text = el.textContent?.trim() || ''
      if (!text) return
      // если rehypeSlug генерация id использование，иначегенерация
      let id = el.id
      if (!id) {
        id = slugify(text)
        el.id = id
      } else {
        // Обеспечение уникальности
        if (idCount[id] !== undefined) {
          idCount[id] += 1
          const newId = `${id}-${idCount[id]}`
          el.id = newId
          id = newId
        } else {
          idCount[id] = 0
        }
      }
      const node: TocNode = { id, text, level, children: [] }
      // Построение иерархии: поиск ближайшего родителя с уровнем < текущего
      while (stack.length && stack[stack.length - 1].level >= level) {
        stack.pop()
      }
      if (stack.length === 0) {
        nodes.push(node)
      } else {
        const parent = stack[stack.length - 1]
        parent.children = parent.children || []
        parent.children.push(node)
      }
      stack.push(node)
    })
    setTocTree(nodes)
  }, [share?.content])

  useEffect(() => {
    loadShare()
  }, [shareId])

  // Отслеживание прокрутки для отображения кнопки Наверх и сжатия заголовка
  useEffect(() => {
    let ticking = false
    let lastScrollY = 0
    
    const handleScroll = () => {
      const scrollY = window.scrollY
      
      // Добавление гистерезиса во избежание мерцания границ
      if (Math.abs(scrollY - lastScrollY) < 5) return
      
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setShowBackTop(scrollY > 300)
          // Использование большего порога для избежания дрожания
          setHeaderShrink(scrollY > 100)
          lastScrollY = scrollY
          ticking = false
        })
        ticking = true
      }
    }
    
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Добавление кнопки копирования для блоков кода
  useEffect(() => {
    if (!share?.content) return
    const root = contentRef.current
    if (!root) return

    const codeBlocks = root.querySelectorAll('pre')
    codeBlocks.forEach((pre) => {
      // Избежание дублирования
      if (pre.querySelector('.copy-code-btn')) return

      const wrapper = document.createElement('div')
      wrapper.classНазвание = 'code-block-wrapper'
      pre.parentNode?.insertBefore(wrapper, pre)
      wrapper.appendChild(pre)

      const copyBtn = document.createElement('button')
      copyBtn.classНазвание = 'copy-code-btn'
      copyBtn.innerHTML = '<svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor"><path d="M832 64H296c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h496v688c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8V96c0-17.7-14.3-32-32-32zM704 192H192c-17.7 0-32 14.3-32 32v530.7c0 8.5 3.4 16.6 9.4 22.6l173.3 173.3c2.2 2.2 4.7 4 7.4 5.5v1.9h4.2c3.5 1.3 7.2 2 11 2H704c17.7 0 32-14.3 32-32V224c0-17.7-14.3-32-32-32zM350 856.2L263.9 770H350v86.2zM664 888H414V746c0-22.1-17.9-40-40-40H232V264h432v624z"></path></svg>'
      copyBtn.title = 'Копировать code'
      
      copyBtn.addEventListener('click', async () => {
        const code = pre.querySelector('code')?.textContent || ''
        try {
          await navigator.clipboard.writeText(code)
          copyBtn.classList.add('copied')
          copyBtn.innerHTML = '<svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor"><path d="M912 190h-69.9c-9.8 0-19.1 4.5-25.1 12.2L404.7 724.5 207 474a32 32 0 00-25.1-12.2H112c-6.7 0-10.4 7.7-6.3 12.9l273.9 347c12.8 16.2 37.4 16.2 50.3 0l488.4-618.9c4.1-5.1.4-12.8-6.3-12.8z"></path></svg>'
          message.success('Скопировано')
          setTimeout(() => {
            copyBtn.classList.remove('copied')
            copyBtn.innerHTML = '<svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor"><path d="M832 64H296c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h496v688c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8V96c0-17.7-14.3-32-32-32zM704 192H192c-17.7 0-32 14.3-32 32v530.7c0 8.5 3.4 16.6 9.4 22.6l173.3 173.3c2.2 2.2 4.7 4 7.4 5.5v1.9h4.2c3.5 1.3 7.2 2 11 2H704c17.7 0 32-14.3 32-32V224c0-17.7-14.3-32-32-32zM350 856.2L263.9 770H350v86.2zM664 888H414V746c0-22.1-17.9-40-40-40H232V264h432v624z"></path></svg>'
          }, 2000)
        } catch (err) {
          message.error('Ошибка копирования')
        }
      })

      wrapper.appendChild(copyBtn)
    })
  }, [share?.content])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleПарольSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) {
      setПарольError('Введите пароль')
      return
    }
    loadShare(password)
  }

  // Преобразование элементов якоря
  const buildAnchorItems = (nodes: TocNode[]): any[] => {
    return nodes.map(n => ({
      key: n.id,
      href: `#${n.id}`,
      title: n.text,
      children: n.children && n.children.length > 0 ? buildAnchorItems(n.children) : undefined
    }))
  }
  const anchorItems = buildAnchorItems(tocTree)

  if (loading) {
    return (
      <div classНазвание="share-view-loading">
        <Spin size="large" tip="Загрузка..." />
      </div>
    )
  }

  if (requireПароль) {
    return (
      <div classНазвание="share-view-password">
        <div classНазвание="password-card">
          <Title level={3}>Для этой публикации требуется пароль</Title>
          <form onSubmit={handleПарольSubmit}>
            <Input.Пароль
              size="large"
              value={password}
              onChange={(e) => setПароль(e.target.value)}
              placeholder="Введите пароль доступа"
              status={passwordError ? 'error' : ''}
            />
            {passwordError && <Text type="danger">{passwordError}</Text>}
            <Button 
              type="primary" 
              htmlType="submit" 
              size="large" 
              block
              style={{ marginTop: '16px' }}
            >
              Просмотр
            </Button>
          </form>
        </div>
      </div>
    )
  }

  if (error) {
    const isNotFound = error.toLowerCase().includes('not found') || error.includes('не существует')
    
    return (
      <div classНазвание="share-view-error">
        <Result
          icon={isNotFound ? <FileSearchOutlined /> : <ExclamationCircleOutlined />}
          status={isNotFound ? '404' : 'error'}
          title={isNotFound ? 'Страница не найдена' : 'Ошибка загрузки'}
          subTitle={
            <div classНазвание="error-subtitle">
              <Text type="secondary">
                {isNotFound 
                  ? 'Извините, запрашиваемая страница не существует или срок ее действия истек' 
                  : error}
              </Text>
            </div>
          }
          extra={[
            <Button 
              type="primary" 
              icon={<HomeOutlined />}
              onClick={() => window.location.href = '/'}
              key="home"
            >
              Вернуться на главную
            </Button>,
            !isNotFound && (
              <Button 
                key="retry"
                onClick={() => loadShare()}
              >
                Повторить
              </Button>
            )
          ].filter(Boolean)}
        />
      </div>
    )
  }

  if (!share) {
    return (
      <div classНазвание="share-view-error">
        <Result
          icon={<FileSearchOutlined />}
          status="404"
          title="Страница не найдена"
          subTitle={
            <div classНазвание="error-subtitle">
              <Text type="secondary">
                Извините, запрашиваемая страница не существует или срок ее действия истек
              </Text>
            </div>
          }
          extra={[
            <Button 
              type="primary" 
              icon={<HomeOutlined />}
              onClick={() => window.location.href = '/'}
              key="home"
            >
              Вернуться на главную
            </Button>
          ]}
        />
      </div>
    )
  }

  return (
    <div classНазвание="share-view">
      <Layout>
        {/* Кнопка оглавления для мобильных */}
        {tocTree.length > 0 && (
          <Button
            classНазвание="mobile-toc-button"
            type="primary"
            onClick={() => setTocVisible(true)}
          >
            Содержание
          </Button>
        )}

        {/* Кнопка Наверх */}
        {showBackTop && (
          <Button
            classНазвание="back-to-top-button"
            type="primary"
            shape="circle"
            icon={<UpOutlined />}
            onClick={scrollToTop}
            title="Наверх"
          />
        )}

        {/* Выдвижное оглавление для мобильных */}
        <Drawer
          title="Содержание"
          placement="left"
          onClose={() => setTocVisible(false)}
          open={tocVisible}
          classНазвание="mobile-toc-drawer"
        >
          <Anchor
            affix={false}
            items={anchorItems}
            onClick={() => setTocVisible(false)}
          />
        </Drawer>

        <Layout classНазвание="share-layout">
          {/* Боковое оглавление для ПК */}
          {tocTree.length > 0 && (
            <Sider 
              width={250} 
              classНазвание="desktop-toc-sider"
              theme="light"
            >
              <div classНазвание="toc-wrapper">
                <Title level={5}>Содержание</Title>
                <Anchor
                  affix={false}
                  items={anchorItems}
                />
              </div>
            </Sider>
          )}

          <Content classНазвание="share-content-wrapper">
            <div classНазвание={`share-header ${headerShrink ? 'shrink' : ''}`}>
              <Title level={1}>{share.docTitle}</Title>
              <div classНазвание="share-meta">
                <Text type="secondary">
                  <EyeOutlined /> {share.viewCount} просмотров
                </Text>
                <Text type="secondary">
                  Создатьd: {new Date(share.createdAt).toLocaleString()}
                </Text>
                <Text type="secondary">
                  Истекает: {new Date(share.expireAt).toLocaleString()}
                </Text>
              </div>
            </div>
            
            <div ref={contentRef} classНазвание="markdown-body share-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeHighlight, rehypeSlug]}
                components={{
                  img: ({ src, alt }) => {
                    return (
                      <Image
                        src={src}
                        alt={alt}
                        preview={{
                          mask: 'Нажмите для просмотра',
                        }}
                        style={{ maxWidth: '100%', height: 'auto' }}
                      />
                    )
                  }
                }}
              >
                {share.content}
              </ReactMarkdown>
            </div>

            <div classНазвание="share-footer">
              <Text type="secondary">Работает на плагине SiYuan Share</Text>
            </div>
          </Content>
        </Layout>
      </Layout>
    </div>
  )
}

export default ShareПросмотр
