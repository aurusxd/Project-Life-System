# tech.md — Push-up Counter (Telegram Mini App)

v1 — 2026-08-31 — первая версия ядра.
v1.1 — 2026-08-31 — добавлены: тулинг линта/формата, `camera/stream.ts`, детали экрана проверки риска (п.6), конфиг сборки.

## 1. Проект

Telegram Mini App, которое считает отжимания в реальном времени через камеру телефона с помощью MediaPipe Pose Landmarker. Целевая платформа — iPhone, клиент Telegram iOS. Один пользователь, без бэкенда, без аккаунтов.

Флоу: пользователь открывает мини-апп из бота → даёт доступ к камере → кладёт телефон так, чтобы в кадр попадало всё тело → делает отжимания → приложение считает повторения и показывает счётчик.

## 2. Стек

- SvelteKit, `adapter-static` (приложение полностью клиентское, бэкенд не нужен)
- TypeScript
- `@mediapipe/tasks-vision` (Pose Landmarker, модель `pose_landmarker_lite`, WASM + GPU delegate)
- Telegram WebApp JS SDK (`window.Telegram.WebApp`)
- Хостинг: любой статический (Vercel/GitHub Pages), HTTPS обязателен для Telegram и для `getUserMedia`; настройки деплоя на Vercel зафиксированы в `vercel.json` (framework null, output `build`, SPA-rewrite на `index.html`)
- Тулинг качества: ESLint (`eslint`, `typescript-eslint`, `eslint-plugin-svelte`) + Prettier (`prettier-plugin-svelte`), тайпчек — `svelte-check`

Бэкенд, БД, очереди, авторизация — не нужны. Вся история сессий хранится в `localStorage`.

### 2.1. Конфигурация сборки

- вся конфигурация SvelteKit живёт в `vite.config.ts` (опции передаются в `sveltekit({ ... })`); отдельный `svelte.config.js` не используется — при наличии опций в Vite-конфиге SvelteKit его игнорирует
- режим SPA: `adapter-static` с `fallback: 'index.html'`, в `src/routes/+layout.ts` — `export const ssr = false` и `export const prerender = false` (единственный HTML-шелл выдаёт fallback)
- скрипты: `npm run dev`, `npm run build`, `npm run check` (тайпчек), `npm run lint`, `npm run format`

## 3. Структура папок

```
src/
  routes/
    +layout.svelte
    +layout.ts            # ssr = false, prerender = false (SPA)
    +page.svelte          # единственный экран приложения
  lib/
    camera/
      stream.ts            # getUserMedia (задняя камера), остановка потока, проба на чёрный кадр
    pose/
      detector.ts          # инициализация PoseLandmarker, детект по кадрам
      repCounter.ts         # state machine подсчёта повторений
      angles.ts             # вычисление угла в локте по landmarks
    telegram/
      webapp.ts             # обёртка над Telegram.WebApp (ready, expand, theme, openLink)
    storage/
      sessions.ts            # чтение/запись истории в localStorage
    components/
      CameraView.svelte      # видео + canvas overlay со скелетом
      Counter.svelte         # текущий счётчик, старт/стоп
      SetupGuide.svelte      # инструкция по позиционированию телефона
static/
  models/
    pose_landmarker_lite.task
```

## 4. Логика подсчёта отжиманий

Источник данных — 33 landmark-точки MediaPipe на кадр.

Угол в локте считается по трём точкам: плечо → локоть → запястье (`angles.ts`, обе стороны, берётся видимая сторона с более высоким `visibility score`).

State machine (`repCounter.ts`):

- состояние `UP`: угол в локте > 155°
- состояние `DOWN`: угол в локте < 95°
- переход `UP → DOWN → UP` = одно повторение, засчитывается в момент возврата в `UP`
- минимальный интервал между повторениями 400 мс — защита от дребезга на шумных кадрах
- если между `DOWN` и `UP` прошло больше 5 секунд без движения — сброс промежуточного состояния, повторение не засчитывается

Пороги (155°/95°/400мс) вынесены в константы в начале файла, подбираются вручную по факту тестирования на реальных отжиманиях.

## 5. Камера и позиционирование

Используется задняя камера (`facingMode: "environment"`). Телефон кладётся на пол горизонтально сбоку от пользователя так, чтобы в кадр попадало тело целиком в профиль.

`SetupGuide.svelte` показывает статичную схему правильной установки телефона перед стартом, без автоматической проверки корректности кадра в v1.

`CameraView.svelte` рисует overlay скелета поверх видео (наглядно, что модель видит тело) — упрощает отладку и даёт пользователю обратную связь.

## 6. Известный риск: камера в Telegram iOS WebView

Доступ к камере через `getUserMedia` внутри Telegram WebView на iOS ведёт себя нестабильно — есть подтверждённые случаи, когда поток возвращается чёрным экраном при том, что тот же код в обычном Safari работает штатно (issue tma.js #748). Это блокирующий риск для всего проекта, проверяется в первую очередь, до написания логики подсчёта.

План проверки (день 1): минимальный SvelteKit-роут с `<video>` + `getUserMedia`, задеплоенный на HTTPS, открыть как Telegram Mini App на реальном iPhone. Если поток чёрный — фолбэк: кнопка «Открыть в Safari» (`Telegram.WebApp.openLink` с текущим URL), приложение работает вне WebView.

Детали реализации проверки:

- экран проверки живёт на `/` в стадии 1 и показывает: видео с задней камеры, статус потока, диагностику (Telegram platform/version, `userAgent`, разрешение и `facingMode` реального трека)
- «чёрный кадр» определяется автоматически: кадр видео рисуется в offscreen-canvas уменьшенного размера, считается средняя яркость по выборке пикселей; если за серию проб средняя яркость ниже порога — поток считается чёрным
- пороги пробы (`BLACK_LUMA_THRESHOLD`, число проб, интервал) — константы в `camera/stream.ts`
- при чёрном потоке или ошибке `getUserMedia` показывается кнопка «Открыть в Safari» через `Telegram.WebApp.openLink(location.href)`
- диагностика доступна для копирования текстом — чтобы результат проверки с реального iPhone можно было перенести в репозиторий

## 7. Что НЕ входит в v1

- бэкенд, БД, синхронизация между устройствами
- аккаунты, авторизация
- лидерборды, соцфункции
- другие упражнения кроме отжиманий
- запись видео
- автоматическая проверка корректности положения камеры
- поддержка Android (не тестируется, может работать случайно)

## 8. Definition of Done

- линт и тайпчек проходят
- `npm run build` проходит без ошибок
- проверено на реальном iPhone внутри Telegram (не в обычном Safari)
- счётчик не даёт ложных срабатываний на 10 подряд отжиманиях в тесте руками

## 9. Стадии

1. Skeleton: SvelteKit + adapter-static, деплой на HTTPS, регистрация мини-аппа в BotFather, проверка риска из п.6
2. Интеграция Pose Landmarker: детект по видеопотоку, overlay скелета
3. Логика подсчёта: `angles.ts` + `repCounter.ts`, ручная калибровка порогов
4. UI: `SetupGuide`, `Counter`, старт/стоп, история сессий в `localStorage`
5. Полировка: Telegram theme (`Telegram.WebApp.themeParams`), обработка ошибок камеры, деплой

## 10. Конвенции кода

- комментарии и коммиты на английском, код и переменные на английском
- формат коммита: Conventional Commits, `type(scope): summary`, `type` из `feat|fix|refactor|chore|docs`
- один коммит — один осмысленный шаг
- без закомментированного кода в финальных коммитах
