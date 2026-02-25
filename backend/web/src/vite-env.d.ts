/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  // Добавьте здесь дополнительные определения типов переменных окружения
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
