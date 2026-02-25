import api from './index'

export interface ShareData {
  id: string
  docTitle: string
  content: string
  requirePassword: boolean
  expireAt: string
  viewCount: number
  createdAt: string
}

export interface ShareResponse {
  code: number
  msg: string
  data?: ShareData
}

export interface ShareListItem {
  id: string
  docId: string
  docTitle: string
  requirePassword: boolean
  expireAt: string
  isPublic: boolean
  viewCount: number
  createdAt: string
  shareUrl: string
}

export interface ShareListResponse {
  code: number
  msg: string
  data: {
    items: ShareListItem[]
    page: number
    size: number
    total: number
  }
}

/**
 * Получение содержимого публикации
 */
export const getShare = async (shareId: string, password?: string): Promise<ShareResponse> => {
  const params = password ? { password } : {}
  return api.get(`/api/s/${shareId}`, { params })
}

/**
 * Получение списка публикаций
 */
export const listShares = async (page = 1, size = 10): Promise<ShareListResponse> => {
  return api.get('/api/share/list', { params: { page, size } })
}

/**
 * Удаление публикации
 */
export const deleteShare = async (id: string): Promise<{ code: number; msg: string }> => {
  return api.delete(`/api/share/${id}`)
}
