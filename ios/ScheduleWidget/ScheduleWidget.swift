import SwiftUI
import WidgetKit

struct ScheduleEntry: TimelineEntry {
    let date: Date
    let feed: WidgetFeed?
    let connected: Bool
    let errorMessage: String?
}

struct ScheduleProvider: TimelineProvider {
    func placeholder(in context: Context) -> ScheduleEntry {
        ScheduleEntry(date: Date(), feed: Self.sampleFeed, connected: true, errorMessage: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (ScheduleEntry) -> Void) {
        if context.isPreview {
            completion(placeholder(in: context))
            return
        }
        Task {
            completion(await loadEntry(date: Date()))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ScheduleEntry>) -> Void) {
        Task {
            let now = Date()
            guard WidgetStore.token != nil else {
                let entry = ScheduleEntry(date: now, feed: nil, connected: false, errorMessage: "Нет общего токена. Проверь App Group.")
                completion(Timeline(entries: [entry], policy: .after(now.addingTimeInterval(30 * 60))))
                return
            }

            let feed: WidgetFeed?
            var errorMessage: String?
            do {
                feed = try await WidgetAPI.feed(for: now)
            } catch {
                feed = WidgetStore.cachedFeed()
                errorMessage = error.localizedDescription
            }

            guard let feed else {
                let entry = ScheduleEntry(date: now, feed: nil, connected: true, errorMessage: errorMessage ?? "Кэш пуст")
                completion(Timeline(entries: [entry], policy: .after(now.addingTimeInterval(10 * 60))))
                return
            }

            let moments = timelineMoments(feed: feed, now: now)
            let entries = moments.map { ScheduleEntry(date: $0, feed: feed, connected: true, errorMessage: errorMessage) }
            let refresh = nextMorning(after: now)
            completion(Timeline(entries: entries, policy: .after(refresh)))
        }
    }

    private func loadEntry(date: Date) async -> ScheduleEntry {
        guard WidgetStore.token != nil else {
            return ScheduleEntry(date: date, feed: nil, connected: false, errorMessage: "Нет общего токена. Проверь App Group.")
        }
        do {
            let feed = try await WidgetAPI.feed(for: date)
            return ScheduleEntry(date: date, feed: feed, connected: true, errorMessage: nil)
        } catch {
            return ScheduleEntry(date: date, feed: WidgetStore.cachedFeed(), connected: true, errorMessage: error.localizedDescription)
        }
    }

    private func timelineMoments(feed: WidgetFeed, now: Date) -> [Date] {
        var moments: [Date] = [now]
        for event in feed.events where event.status != "cancelled" {
            if let start = eventDate(event.start, base: now), start > now { moments.append(start) }
            if let end = eventDate(event.end, base: now), end > now { moments.append(end) }
        }
        return Array(Set(moments)).sorted()
    }

    private func eventDate(_ time: String, base: Date) -> Date? {
        let parts = time.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2 else { return nil }
        return Calendar.current.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: base)
    }

    private func nextMorning(after date: Date) -> Date {
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: date) ?? date.addingTimeInterval(86400)
        return Calendar.current.date(bySettingHour: 0, minute: 5, second: 0, of: tomorrow) ?? tomorrow
    }

    static let sampleFeed = WidgetFeed(
        profile: WidgetProfile(id: "preview", name: "Иван"),
        date: "2026-09-24",
        events: [
            WidgetEvent(id: "1", kind: "lesson", status: "normal", title: "Режиссура", subtitle: "Урбан А. М. · 214", start: "09:40", end: "11:10"),
            WidgetEvent(id: "2", kind: "individual", status: "normal", title: "Индивидуальное", subtitle: "Урбан А. М.", start: "14:40", end: "15:30"),
            WidgetEvent(id: "3", kind: "rehearsal", status: "normal", title: "Общий прогон", subtitle: "", start: "17:00", end: "19:00"),
        ],
        freeAt: "19:00",
        appearance: WidgetAppearance(theme: "dark", appAccentMode: "manual", appAccent: "blue", rehearsalAccent: "amber", individualAccent: "rose", seminarAccent: "violet"),
        generatedAt: "2026-09-24T08:00:00.000Z"
    )
}

struct DayState {
    let current: WidgetEvent?
    let upcoming: [WidgetEvent]
    let freeAt: String?

    init(entry: ScheduleEntry) {
        guard let feed = entry.feed else {
            current = nil
            upcoming = []
            freeAt = nil
            return
        }
        let active = feed.events.filter { $0.status != "cancelled" }
        current = active.first { event in
            guard let start = Self.minutes(event.start), let end = Self.minutes(event.end) else { return false }
            let now = Self.minutes(entry.date)
            return now >= start && now < end
        }
        let now = Self.minutes(entry.date)
        upcoming = active.filter { event in
            guard let start = Self.minutes(event.start) else { return false }
            return start > now
        }
        freeAt = feed.freeAt
    }

    private static func minutes(_ time: String) -> Int? {
        let parts = time.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2 else { return nil }
        return parts[0] * 60 + parts[1]
    }

    private static func minutes(_ date: Date) -> Int {
        let components = Calendar.current.dateComponents([.hour, .minute], from: date)
        return (components.hour ?? 0) * 60 + (components.minute ?? 0)
    }
}

struct ScheduleWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ScheduleEntry

    private var state: DayState { DayState(entry: entry) }
    private var primary: WidgetEvent? { state.current ?? state.upcoming.first }
    private var accent: Color {
        guard let feed = entry.feed else { return .accentColor }
        return presetColor(feed.appearance.appAccent)
    }

    var body: some View {
        Group {
            if !entry.connected {
                disconnected
            } else if entry.feed == nil {
                unavailable
            } else {
                switch family {
                case .systemMedium:
                    medium
                case .accessoryRectangular:
                    accessoryRectangular
                case .accessoryInline:
                    accessoryInline
                default:
                    small
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(for: .widget) {
            ZStack {
                Color(.systemBackground)
                if family == .systemSmall || family == .systemMedium {
                    LinearGradient(
                        colors: [accent.opacity(0.16), accent.opacity(0.045), Color.clear],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                }
            }
        }
        .widgetURL(WidgetEnvironment.scheduleURL)
    }

    private var small: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                statusLabel
                Spacer(minLength: 6)
                if let event = primary {
                    timePill(event)
                }
            }

            Spacer(minLength: 8)

            if let event = primary {
                eventIcon(event)
                    .padding(.bottom, 6)

                Text(event.title)
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .lineLimit(2)
                    .minimumScaleFactor(0.78)
                    .fixedSize(horizontal: false, vertical: true)

                if !event.subtitle.isEmpty {
                    Text(event.subtitle)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .padding(.top, 3)
                }
            } else {
                Image(systemName: "checkmark.circle.fill")
                    .font(.title3)
                    .foregroundStyle(accent)
                    .padding(.bottom, 6)

                Text("На сегодня всё")
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .lineLimit(2)

                Text("Можно отдыхать")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .padding(.top, 3)
            }

            Spacer(minLength: 8)

            if let freeAt = state.freeAt {
                HStack(spacing: 5) {
                    Image(systemName: "clock")
                    Text("Свободен в \(freeAt)")
                        .lineLimit(1)
                        .minimumScaleFactor(0.82)
                }
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
            }
        }
    }

    private var medium: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(accent)
                        .frame(width: 7, height: 7)
                    Text("214Р · Сегодня")
                        .font(.caption.weight(.semibold))
                }
                .foregroundStyle(.secondary)

                Spacer(minLength: 8)

                if let freeAt = state.freeAt {
                    Text("до \(freeAt)")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.secondary.opacity(0.08), in: Capsule())
                }
            }

            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 6) {
                    statusLabel

                    if let event = primary {
                        HStack(alignment: .center, spacing: 7) {
                            eventIcon(event)
                            Text(state.current == nil ? event.start : "\(event.start)–\(event.end)")
                                .font(.system(size: 18, weight: .bold, design: .rounded))
                                .foregroundStyle(color(for: event.kind))
                                .lineLimit(1)
                                .minimumScaleFactor(0.85)
                        }

                        Text(event.title)
                            .font(.system(size: 16, weight: .bold, design: .rounded))
                            .lineLimit(2)
                            .minimumScaleFactor(0.82)
                            .fixedSize(horizontal: false, vertical: true)

                        if !event.subtitle.isEmpty {
                            Text(event.subtitle)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                                .truncationMode(.tail)
                        }
                    } else {
                        Text("На сегодня всё")
                            .font(.system(size: 17, weight: .bold, design: .rounded))
                        Text("Больше событий нет")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }

                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

                Rectangle()
                    .fill(Color.secondary.opacity(0.14))
                    .frame(width: 1)
                    .padding(.vertical, 2)

                VStack(alignment: .leading, spacing: 7) {
                    Text("ДАЛЬШЕ")
                        .font(.system(size: 9, weight: .bold))
                        .tracking(0.7)
                        .foregroundStyle(.secondary)

                    let later = Array(state.upcoming.dropFirst(state.current == nil ? 1 : 0).prefix(2))
                    if later.isEmpty {
                        Text("Больше ничего")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    } else {
                        ForEach(later) { event in
                            compactEventRow(event)
                        }
                    }

                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
    }

    private var accessoryRectangular: some View {
        HStack(alignment: .center, spacing: 8) {
            if let event = primary {
                Image(systemName: iconName(for: event.kind))
                    .font(.headline)

                VStack(alignment: .leading, spacing: 1) {
                    Text(state.current == nil ? event.start : "до \(event.end)")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)

                    Text(event.title)
                        .font(.headline)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)

                    if !event.subtitle.isEmpty {
                        Text(event.subtitle)
                            .font(.caption2)
                            .lineLimit(1)
                            .foregroundStyle(.secondary)
                    }
                }
            } else {
                Image(systemName: "checkmark.circle.fill")
                VStack(alignment: .leading, spacing: 1) {
                    Text("214Р")
                        .font(.caption2.weight(.semibold))
                    Text("На сегодня всё")
                        .font(.headline)
                        .lineLimit(1)
                }
            }
        }
    }

    private var accessoryInline: some View {
        Group {
            if let event = primary {
                Label(
                    "\(state.current == nil ? event.start : "до \(event.end)") · \(event.title)",
                    systemImage: iconName(for: event.kind)
                )
            } else {
                Label("214Р · на сегодня всё", systemImage: "checkmark.circle")
            }
        }
    }

    private var statusLabel: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(state.current == nil ? Color.secondary : accent)
                .frame(width: 6, height: 6)

            Text(state.current == nil ? "ДАЛЬШЕ" : "СЕЙЧАС")
                .font(.system(size: 9, weight: .bold))
                .tracking(0.7)
        }
        .foregroundStyle(.secondary)
    }

    private func timePill(_ event: WidgetEvent) -> some View {
        Text(state.current == nil ? event.start : "до \(event.end)")
            .font(.caption2.weight(.bold))
            .monospacedDigit()
            .lineLimit(1)
            .padding(.horizontal, 7)
            .padding(.vertical, 4)
            .foregroundStyle(color(for: event.kind))
            .background(color(for: event.kind).opacity(0.12), in: Capsule())
    }

    private func eventIcon(_ event: WidgetEvent) -> some View {
        Image(systemName: iconName(for: event.kind))
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(color(for: event.kind))
            .frame(width: 27, height: 27)
            .background(color(for: event.kind).opacity(0.12), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    private func compactEventRow(_ event: WidgetEvent) -> some View {
        HStack(alignment: .top, spacing: 7) {
            Circle()
                .fill(color(for: event.kind))
                .frame(width: 6, height: 6)
                .padding(.top, 5)

            VStack(alignment: .leading, spacing: 1) {
                Text("\(event.start) · \(event.title)")
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)

                if !event.subtitle.isEmpty {
                    Text(event.subtitle)
                        .font(.system(size: 9))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
            }
        }
    }

    private var disconnected: some View {
        VStack(alignment: .leading, spacing: 7) {
            Image(systemName: "iphone.gen3")
                .font(.title3)
                .foregroundStyle(accent)

            Text("Подключи 214Р")
                .font(.headline)
                .lineLimit(2)

            Text("Открой приложение → Настройки → iOS-виджет")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(3)

            Spacer(minLength: 0)
        }
    }

    private var unavailable: some View {
        VStack(alignment: .leading, spacing: 7) {
            Image(systemName: "wifi.exclamationmark")
                .font(.title3)
                .foregroundStyle(.secondary)

            Text("Нет данных")
                .font(.headline)
                .lineLimit(1)

            Text(entry.errorMessage ?? "Обновим автоматически")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(3)
                .minimumScaleFactor(0.82)

            Spacer(minLength: 0)
        }
    }

    private func iconName(for kind: String) -> String {
        switch kind {
        case "rehearsal": return "music.note"
        case "individual": return "person.fill"
        default: return "book.closed.fill"
        }
    }

    private func color(for kind: String) -> Color {
        guard let feed = entry.feed else { return accent }
        switch kind {
        case "rehearsal":
            return presetColor(feed.appearance.rehearsalAccent, fallback: .orange)
        case "individual":
            return presetColor(feed.appearance.individualAccent, fallback: .red)
        default:
            return accent
        }
    }

    private func presetColor(_ preset: String, fallback: Color = .accentColor) -> Color {
        switch preset {
        case "mint": return Color(red: 0.47, green: 0.85, blue: 0.69)
        case "blue": return Color(red: 0.46, green: 0.68, blue: 0.97)
        case "violet": return Color(red: 0.67, green: 0.55, blue: 0.96)
        case "amber": return Color(red: 0.93, green: 0.72, blue: 0.38)
        case "rose": return Color(red: 0.93, green: 0.55, blue: 0.63)
        default: return fallback
        }
    }
}

struct ScheduleWidget: Widget {
    let kind = "schedule214.day"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ScheduleProvider()) { entry in
            ScheduleWidgetView(entry: entry)
        }
        .configurationDisplayName("214Р · Мой день")
        .description("Текущее событие, что дальше и во сколько освободишься.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}
