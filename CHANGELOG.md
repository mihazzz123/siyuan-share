# 0.4.3 (09.11.2025)

## Новое
- В конфигурацию S3 добавлено поле `provider` с возможностью выбора `aws` или `oss`. Используются соответственно AWS Signature V4 и упрощенная подпись Alibaba Cloud OSS HMAC-SHA1.
- При возникновении ошибки `network-error` в мобильном приложении или при прямой загрузке реализован автоматический откат к использованию прокси-сервера ядра SiYuan (`/api/network/forwardProxy`). Это решает проблемы с CORS и сетевыми ограничениями в некоторых средах.

## Оптимизация
- Загрузка через `forwardProxy` теперь использует блочное кодирование Base64, что снижает пиковое потребление памяти и риск переполнения стека вызовов при обработке больших файлов.
- Логи ошибок загрузки теперь четко разделяют причины сетевых ошибок прямой передачи и ошибок проксирования.
- В панель настроек добавлен выпадающий список выбора провайдера хранилища.

## Инструкция по использованию
1. Для использования Alibaba Cloud OSS: выберите провайдера «Alibaba Cloud OSS (HMAC-SHA1)» в настройках, укажите эндпоинт (например, `oss-cn-beijing.aliyuncs.com`) и имя бакета.
2. Если прямая загрузка в мобильном приложении не удалась, автоматически активируется загрузка через прокси. Убедитесь, что в настройках указан верный токен ядра SiYuan.
3. Чтобы вернуться к старому поведению (без прокси): временно переключите провайдера на `aws` и убедитесь, что сеть поддерживает прямую передачу.

## Резервный план
- Если загрузка через прокси недоступна в текущей версии ядра, можно временно закомментировать логику вызова `uploadViaForwardProxy` в файле `s3-upload.ts`.
- При обнаружении несовместимости подписи OSS временно выберите `aws` и используйте совместимый шлюз (например, AWS S3 или MinIO).

# История изменений

## v1.1.0 09.11.2025

### Новые функции
* **Загрузка через вставку (Paste Upload)**: добавлена функция автоматической загрузки файлов из буфера обмена в S3 (функционал фотохостинга).
  - Автоматическая загрузка: изображения, видео, аудио и другие файлы загружаются в S3 сразу при вставке в редактор.
  - Замена ссылок: после загрузки автоматически генерируется ссылка Markdown и вставляется в редактор.
  - Пакетная загрузка: поддержка вставки нескольких файлов одновременно.
  - Дедупликация: автоматическая проверка по хеш-сумме для предотвращения повторной загрузки.
  - Управление ресурсами: возможность просмотра и удаления ресурсов, загруженных через вставку.
  - Настройка: добавлен параметр «Включить загрузку при вставке».
  - Поддерживаемые типы: изображения, видео, аудио, PDF, текст, Markdown, ZIP и др.
  - Локализация: полные переводы на русский, английский и китайский языки.

### Технические улучшения
* Создан сервис `PasteUploadService` для обработки логики вставки.
* Оптимизировано вычисление хеша в сервисе S3.
* Улучшен менеджер записей ресурсов (поддержка меток для вставленных файлов).
* Реализовано динамическое включение/выключение функции вставки.
* Улучшена обработка ошибок и уведомления пользователей.

### Обновление документации
* Добавлена полная документация по функции загрузки через вставку (`docs/PASTE_UPLOAD.md`).

---

## v1.0.0 08.11.2025

### Новые функции
* **Управление статическими ресурсами**: добавлена возможность просмотра и управления ресурсами, загруженными в S3.
  - Список ресурсов: единый интерфейс для всех загруженных файлов.
  - Поиск по имени: фильтрация и поиск в реальном времени.
  - Фильтр по документам: поиск ресурсов, принадлежащих конкретной заметке.
  - Предпросмотр: поддержка просмотра изображений, видео, аудио и других типов файлов.
  - Копирование ссылок: быстрое копирование URL-адреса ресурса S3.
  - Статистика: отображение общего количества и объема ресурсов.

### Технические улучшения
* Добавлен компонент `AssetListView` для интерфейса управления ресурсами.
* Оптимизирована логика фильтрации и производительность.
* Добавлены стили для диалога предпросмотра.

---

## v0.4.2 26.08.2025
* [Обновление ESLint до 9.33.0](https://github.com/siyuan-note/plugin-sample/issues/30)
* [Перенос `addTopBar` и `addStatusBar` из жизненного цикла `onload` в `onLayoutReady`](https://github.com/siyuan-note/siyuan/issues/15455)

## v0.4.1 22.07.2025
* [Добавлена функция плагина `saveLayout`](https://github.com/siyuan-note/siyuan/issues/15308)

## v0.4.0 08.04.2025
* [Добавлена функция плагина `openAttributePanel`](https://github.com/siyuan-note/siyuan/issues/14276)

## v0.3.9 04.03.2025
* [Добавлен параметр `nodeElement` в `protyleSlash.callback`](https://github.com/siyuan-note/siyuan/issues/14036)

## v0.3.8 11.02.2025
* [Добавлена утилита плагина `openSetting`](https://github.com/siyuan-note/siyuan/pull/13761)
* [Добавлен метод плагина `updateProtyleToolbar`](https://github.com/siyuan-note/plugin-sample/issues/24)

## v0.3.7 05.11.2024
* [Добавлена утилита плагина `platformUtils`](https://github.com/siyuan-note/siyuan/issues/12930)
* [Добавлена функция плагина `getAllEditor`](https://github.com/siyuan-note/siyuan/issues/12884)
* [Добавлена функция плагина `getModelByDockType`](https://github.com/siyuan-note/siyuan/issues/11782)
* [Замена `any` в IProtyle на соответствующие типы](https://github.com/siyuan-note/petal/issues/34)
* [Добавлен атрибут `data-id` к кнопке меню](https://github.com/siyuan-note/plugin-sample/pull/20)

## v0.3.6 27.09.2024
* [Добавлены события шины `opened-notebook` и `closed-notebook`](https://github.com/siyuan-note/siyuan/issues/11974)
* [Обновление braces с 3.0.2 до 3.0.3](https://github.com/siyuan-note/plugin-sample/pull/16)

## v0.3.5 30.04.2024
* [Добавлен параметр `direction` в метод плагина `Setting.addItem`](https://github.com/siyuan-note/siyuan/issues/11183)

## v0.3.4 20.02.2024
* [Добавлено событие шины `click-flashcard-action`](https://github.com/siyuan-note/siyuan/issues/10318)

## v0.3.3 24.01.2024
* Обновлен класс иконки дока

## v0.3.2 09.01.2024
* [Добавлен параметр плагина `protyleOptions`](https://github.com/siyuan-note/siyuan/issues/10090)
* [Добавлен API плагина `uninstall`](https://github.com/siyuan-note/siyuan/issues/10063)
* [Добавлен метод плагина `updateCards`](https://github.com/siyuan-note/siyuan/issues/10065)
* [Добавлена функция плагина `lockScreen`](https://github.com/siyuan-note/siyuan/issues/10063)
* [Добавлено событие шины `lock-screen`](https://github.com/siyuan-note/siyuan/pull/9967)
* [Добавлено событие шины `open-menu-inbox`](https://github.com/siyuan-note/siyuan/pull/9967)

## v0.3.1 06.12.2023
* [Поддержка `Dock Plugin` и `Command Palette` в мобильной версии](https://github.com/siyuan-note/siyuan/issues/9926)

## v0.3.0 05.12.2023
* Обновление SiYuan до 0.9.0
* Поддержка новых платформ

## v0.2.9 28.11.2023
* [Добавлен метод плагина `openMobileFileById`](https://github.com/siyuan-note/siyuan/issues/9738)

## v0.2.8 15.11.2023
* [Исправлена ошибка активации `resize` после открепления дока](https://github.com/siyuan-note/siyuan/issues/9640)

## v0.2.7 31.10.2023
* [Экспорт констант `Constants` в плагин](https://github.com/siyuan-note/siyuan/issues/9555)
* [Добавлен параметр `app.appId`](https://github.com/siyuan-note/siyuan/issues/9538)
* [Добавлено событие шины `switch-protyle`](https://github.com/siyuan-note/siyuan/issues/9454)

## v0.2.6 24.10.2023
* [Устарело событие `loaded-protyle`, используйте `loaded-protyle-static`](https://github.com/siyuan-note/siyuan/issues/9468)

## v0.2.5 10.10.2023
* [Добавлено событие шины `open-menu-doctree`](https://github.com/siyuan-note/siyuan/issues/9351)

## v0.2.4 19.09.2023
* Поддержка использования в Windows
* [Добавлена функция плагина `transaction`](https://github.com/siyuan-note/siyuan/issues/9172)

## v0.2.3 05.09.2023
* [Добавлены `openWindow` и `command.globalCallback`](https://github.com/siyuan-note/siyuan/issues/9032)

## v0.2.2 29.08.2023
* [Добавлено событие шины `destroy-protyle`](https://github.com/siyuan-note/siyuan/issues/9033)
* [Добавлено событие шины `loaded-protyle-dynamic`](https://github.com/siyuan-note/siyuan/issues/9021)

## v0.2.1 21.08.2023
* [Добавлен метод `getOpenedTab`](https://github.com/siyuan-note/siyuan/issues/9002)
* [Изменение `custom.fn` => `custom.id` в `openTab`](https://github.com/siyuan-note/siyuan/issues/8944)

## v0.2.0 15.08.2023
* [Добавлены события `open-siyuan-url-plugin` и `open-siyuan-url-block`](https://github.com/siyuan-note/siyuan/pull/8927)

## v0.1.12 01.08.2023
* Обновление SiYuan до 0.7.9

## v0.1.11
* [Добавлена шина событий `input-search`](https://github.com/siyuan-note/siyuan/issues/8725)

## v0.1.10
* [Добавлен пример `bind this` для eventBus](https://github.com/siyuan-note/siyuan/issues/8668)
* [Добавлено событие `open-menu-breadcrumbmore`](https://github.com/siyuan-note/siyuan/issues/8666)

## v0.1.9
* [Добавлены события `open-menu-xxx`](https://github.com/siyuan-note/siyuan/issues/8617)

## v0.1.8
* [Добавлен `protyleSlash` в плагин](https://github.com/siyuan-note/siyuan/issues/8599)
* [Добавлен API плагина `protyle`](https://github.com/siyuan-note/siyuan/issues/8445)

## v0.1.7
* Поддержка сборки JS и JSON

## v0.1.6
* Добавлен пример `fetchPost`
