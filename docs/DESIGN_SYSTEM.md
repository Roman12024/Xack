# Дизайн-система · ИТ Школа Ростелеком CRM

Оформление выполнено по корпоративной дизайн-системе Ростелекома (2-е поколение, «Атомаро»),
тема **Rostelecom Light Theme** (есть тёмная). Референсы:

- design.rt.ru/gen2/designsystem/gettingStarted/intro — гайдлайны (палитра, типографика, иконки, отступы, токены)
- design.rt.ru/gen2/react-storybook — UI-kit для разработчиков
- rtkb.zion-lms.ru — образец продукта («ИТ Школа Ростелеком — Код будущего»)

## Где что лежит

| Артефакт | Файл |
|---|---|
| Токены и стили всех компонентов | `static/style.css` |
| Живая документация (мини-сторибук) | `static/design-system.html` → открывается по адресу `/design-system.html` |
| Интерфейс CRM | `static/index.html`, `static/app.js` |

## Архитектура токенов

1. **Primitives** (`:root`) — сырая палитра: `--rt-purple-50…900`, `--rt-ink-50…900`, статусные цвета, шрифты, отступы (шаг 4px), радиусы, тени.
2. **Semantic** (`[data-rt-theme="light"]` / `[data-rt-theme="dark"]`) — смысловые токены:
   фоны (`--rt-bg-page`, `--rt-bg-surface`), тексты (`--rt-text-primary/secondary/tertiary`),
   `--rt-primary` + hover/active, `--rt-border`, `--rt-focus-ring`.
3. **Компоненты** используют только семантические токены — переключение темы меняет только слой 2.

Ключевые значения: primary `#7700FF` (hover `#5A00C8`, active `#4A0090`),
текст `#101014` / `#5F5B6B` / `#8B8798`, border `#E3DDF0`, радиусы 6/8/12/16/pill,
шрифт RT Basis (fallback — системный sans-serif).

## Маппинг на Atomaro React (при миграции фронта)

| CRM (CSS-класс) | Atomaro React |
|---|---|
| `.btn .btn-primary` | `Button` |
| `input` / даты | `Input` / `InputDate` |
| `select` | `Select` / `Multiselect` |
| `.status-chip` / `.tag` | `Tag` |
| `.tab` | `SegmentedControl` / `Tabs` |
| `.modal` | `Drawer` / `Modal` |
| `.toast` | `Notifications` |
| иконки | `Icon` (Atomaro Icons) |

UI-kit поставляется в npm-скоупе `@design-system-rt`; тема подключается через
`ThemeProvider`, CSS-переменные — `cssVariables: Rostelecom Light Theme`.

## Брендинг

Фирменный градиент шапки и экрана входа (purple-900 → purple-700 → purple-600),
подпись «Код будущего» на экране входа — как в LMS ИТ Школы.
