import axios from 'axios';

// Использование относительных путей в продакшене и полных URL из переменных окружения при разработке
const api = axios.create({
  baseURL: import.meta.env.DEV ? (import.meta.env.VITE_API_URL || 'http://localhost:8080') : '',
  timeout: 10000,
})

// Перехватчик запросов
api.interceptors.request.use(
  (config) => {
    // Автоматическое добавление сессионного токена (для дашборда/управления API)
    try {
      const token = localStorage.getItem('session_token')
      if (token) {
        config.headers = config.headers || {}
        ;(config.headers as any)['Authorization'] = `Bearer ${token}`
      }
    } catch {}
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Перехватчик ответов
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    return Promise.reject(error)
  }
)

export default api
