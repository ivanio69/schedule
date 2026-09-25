# Schedule 214Р — iOS companion + WidgetKit

Это минимальная нативная оболочка для системного iOS-виджета. Основное приложение остаётся Next.js/PWA.

## Preview API

Пока PR #81 не смержен, companion и WidgetKit направлены на preview alias ветки:

`https://schedule-git-feature-ios-widget-ivanio.vercel.app`

После merge этот адрес нужно вернуть на production URL.

## Что уже есть

- приложение сразу открывает существующий веб-интерфейс внутри WKWebView;
- авторизация и настройки выполняются прямо внутри iOS-приложения;
- сопряжение с текущим веб-профилем через одноразовый deep link, который WKWebView перехватывает внутри приложения;
- отдельный read-only widget token вместо personId;
- Small и Medium Home Screen widgets;
- Lock Screen варианты accessoryRectangular и accessoryInline;
- timeline на начало и конец событий без сетевого запроса каждую минуту;
- кэш последней успешной сводки в App Group;
- переход из companion-приложения в основное расписание.

## Запуск

1. Установи Xcode 16+ и XcodeGen.
2. В терминале:

   \`\`\`bash
   cd ios
   xcodegen generate
   open Schedule214.xcodeproj
   \`\`\`

3. В Xcode выбери свою Development Team для targets \`Schedule214\` и \`ScheduleWidget\`.
4. Если Apple Developer Portal не позволяет App Group \`group.com.schedule214.shared\`, замени его одинаково в:
   - \`Schedule214/Schedule214.entitlements\`
   - \`ScheduleWidget/ScheduleWidget.entitlements\`
   - \`Shared/WidgetEnvironment.swift\`
5. Запусти приложение на iPhone — оно сразу откроет веб-интерфейс на странице настроек.
6. Войди в профиль прямо внутри приложения и нажми **Приложение → iOS-виджет → Подключить iPhone**.
7. WKWebView перехватит deep link и передаст одноразовый код нативной части без перехода в Safari.
8. После успешного подключения добавь виджет «214Р · Мой день» через системную галерею виджетов.

## Перед TestFlight/App Store

Нужно добавить production App Icon, выбрать окончательные bundle identifiers / App Group и настроить signing. Серверная часть уже использует production URL; при необходимости API URL можно заменить в \`Shared/WidgetEnvironment.swift\`.
