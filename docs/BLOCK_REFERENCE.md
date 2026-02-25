# Документация по реализации обработки ссылок на блоки

## Обзор

В плагине SiYuan Share реализована функция обработки ссылок на блоки (Block References). Она позволяет автоматически распознавать, анализировать и обрабатывать ссылки на блоки в документе при публикации, превращая их в кликабельные якорные ссылки.

## Возможности

1. **Автоматическое распознавание**: поддержка форматов `((blockId))` и `((blockId "отображаемый текст"))`.
2. **Рекурсивный анализ**: автоматический поиск вложенных ссылок внутри ссылаемых блоков.
3. **Сортировка зависимостей**: сортировка по количеству упоминаний (приоритет блокам с множественными ссылками).
4. **Обнаружение циклов**: предотвращение бесконечной рекурсии при циклических ссылках.
5. **Якорные ссылки**: замена ссылок на странице публикации на формат `[текст](#block-id)`.

## Архитектура реализации

### Фронтенд (TypeScript)

#### 1. Определения типов (`src/types.ts`)

```typescript
// Информация о ссылаемом блоке
export interface BlockReference {
    blockId: string;
    content: string;
    displayText?: string;
    refCount?: number;
}

// Контент документа со ссылками
export interface DocContentWithRefs {
    content: string;
    references: BlockReference[];
}
```

#### 2. Экстрактор ссылок (`src/utils/kramdown-parser.ts`)

```typescript
/**
 * Извлечение всех ID ссылок на блоки из документа
 */
export function extractBlockReferences(content: string): Array<{
    blockId: string;
    displayText?: string;
}>;
```

**Функционал**:
- Регулярное выражение для поиска: `/\(\(([0-9]{14,}-[0-9a-z]{7,})(?:\s+["']([^"']+)["'])?\)\)/g`
- Поддержка двух форматов:
  - `((20251108094416-arwps1t))` — без текста.
  - `((20251108094416-arwps1t 'привет'))` — с текстом.
- Автоматическое удаление дубликатов.

#### 3. Резолвер ссылок (`src/utils/block-reference-resolver.ts`)

```typescript
export class BlockReferenceResolver {
    constructor(options: { siyuanToken: string; maxDepth?: number });
    
    /**
     * Анализ контента документа и всех его ссылок
     */
    async resolveDocumentReferences(docContent: string): Promise<BlockReference[]>;
}
```

**Основной процесс**:
1. Извлечение прямых ссылок из документа.
2. Рекурсивное получение контента для каждой ссылки.
3. Поиск и обработка вложенных ссылок.
4. Обнаружение циклических ссылок (с использованием `Set` резолвинга).
5. Ограничение глубины рекурсии (по умолчанию 5 уровней).
6. Возврат списка, отсортированного по количеству упоминаний.

**Вызовы API**:
- `/api/block/getBlockKramdown` — получение содержимого блока в формате Kramdown.
- Авторизация через токен ядра SiYuan.

#### 4. Сервис публикации (`src/services/share-service.ts`)

```typescript
private async exportDocContentWithRefs(docId: string): Promise<{
    content: string;
    references: BlockReference[];
}>;
```

**Основные шаги**:
1. Получение Kramdown контента документа.
2. Анализ всех ссылок через `BlockReferenceResolver`.
3. Конвертация Kramdown в Markdown.
4. Возврат контента документа и списка ссылаемых блоков.

**Пример вызова**:
```typescript
const { content, references } = await this.exportDocContentWithRefs(docId);

// Формирование запроса к бэкенду
const payload = {
    docId,
    docTitle,
    content,
    references, // информация о ссылках
    // ... другие поля
};
```

### Бэкенд (Go)

#### 1. Модель данных (`models/share.go`)

```go
// Модель записи публикации Share
type Share struct {
    // ... другие поля
    Content    string `gorm:"type:text" json:"content"`
    References string `gorm:"type:text" json:"references"` // JSON-строка
}

// Информация о ссылаемом блоке
type BlockReference struct {
    BlockID     string `json:"blockId"`
    Content     string `json:"content"`
    DisplayText string `json:"displayText,omitempty"`
    RefCount    int    `json:"refCount,omitempty"`
}
```

#### 2. API создания публикации (`controllers/share.go`)

```go
type CreateShareRequest struct {
    // ... другие поля
    References []BlockReferenceReq `json:"references"`
}

type BlockReferenceReq struct {
    BlockID     string `json:"blockId"`
    Content     string `json:"content"`
    DisplayText string `json:"displayText,omitempty"`
    RefCount    int    `json:"refCount,omitempty"`
}
```

**Логика обработки**:
```go
// Сериализация ссылок в JSON
if len(req.References) > 0 {
    refsJSON, err := json.Marshal(req.References)
    if err != nil {
        return err
    }
    share.References = string(refsJSON)
}
```

#### 3. API просмотра публикации (`controllers/view.go`)

```go
// replaceBlockReferences заменяет ссылки в контенте на реальные якорные ссылки
func replaceBlockReferences(content string, refs []models.BlockReference, shareID string) string
```

**Логика замены**:
1. Создание мапы blockId → BlockReference.
2. Поиск ссылок через регулярное выражение.
3. Для каждой ссылки:
   - Поиск информации о блоке.
   - Определение текста (приоритет: текст из ссылки > текст из блока > первые 30 символов контента).
   - Замена на якорную ссылку: `[текст](#block-blockId)`.

**Регулярное выражение**:
```go
blockRefPattern := regexp.MustCompile(`\(\(([0-9]{14,}-[0-9a-z]{7,})(?:\s+["']([^"']+)["'])?\)\)`)
```

**Формат ссылок**:
- Якорь: `#block-{blockId}`
- Ссылка Markdown: `[текст](#block-{blockId})`

### Отображение во фронтенде (React)

Контент документа рендерится через `react-markdown`:
- Автоматическая обработка переходов по якорям.
- Плагин `rehype-slug` генерирует ID заголовков.
- Оглавление (TOC) взаимодействует с якорной навигацией.

## Пример использования

### Исходный контент документа

```markdown
# Заголовок

> Описание

((20251108094416-arwps1t 'привет'))

Текст со ссылкой на блок.
```

### Процесс обработки

1. **Фронтенд извлекает ссылку**:
   ```json
   [
     {
       "blockId": "20251108094416-arwps1t",
       "displayText": "привет"
     }
   ]
   ```

2. **Получение контента блока**:
   - Вызов `/api/block/getBlockKramdown`.
   - Рекурсивная обработка вложенных ссылок.
   
3. **Отправка на бэкенд**:
   ```json
   {
     "docId": "...",
     "content": "# Заголовок\n\n> Описание\n\n((20251108094416-arwps1t 'привет'))\n\nТекст со ссылкой на блок.",
     "references": [
       {
         "blockId": "20251108094416-arwps1t",
         "content": "Контент ссылаемого блока",
         "displayText": "привет",
         "refCount": 1
       }
     ]
   }
   ```

4. **Бэкенд заменяет ссылку**:
   ```markdown
   # Заголовок
   
   > Описание
   
   [привет](#block-20251108094416-arwps1t)
   
   Текст со ссылкой на блок.
   ```

5. **Рендеринг**:
   - Отображается как кликабельная ссылка.
   - При клике происходит переход к якорю `#block-20251108094416-arwps1t`.

## Параметры конфигурации

### Ограничение глубины рекурсии

```typescript
const resolver = new BlockReferenceResolver({
    siyuanToken: config.siyuanToken,
    maxDepth: 5, // по умолчанию 5 уровней
});
```

### Тайм-аут

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000); // 10 секунд
```

## Обработка ошибок

### Обнаружение циклических ссылок

```typescript
if (this.resolving.has(blockId)) {
    console.warn("Обнаружена циклическая ссылка, пропуск:", blockId);
    return null;
}
```

### Ссылаемый блок не найден

```go
if !exists {
    // Сохраняем отображаемый текст или используем текст по умолчанию
    if displayText != "" {
        return displayText
    }
    return "[ссылка]"
}
```

## Оптимизация производительности

1. **Параллельный анализ**: использование `Promise.all` для одновременного получения нескольких блоков.
2. **Кэширование**: сохранение проанализированных блоков в мапе `resolvedBlocks`.
3. **Дедупликация**: получение каждого блока только один раз с подсчетом количества ссылок.
4. **Сортировка**: блоки с большим количеством ссылок (`refCount`) отправляются первыми.

## База данных

Необходимо добавить поле `references` в таблицу `shares`:

```sql
ALTER TABLE shares ADD COLUMN references TEXT;
```

Или дождаться автоматической миграции GORM при следующем запуске.

---

**Дата реализации**: 08.11.2025  
**Версия**: v1.0.0  
**Статус**: ✅ Завершено
