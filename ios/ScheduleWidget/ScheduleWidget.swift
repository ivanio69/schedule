import SwiftUI
import WidgetKit

struct ScheduleEntry: TimelineEntry {
    let date: Date
    let feed: WidgetFeed?
    let connected: Bool
}

struct ScheduleProvider: TimelineProvider {
    func placeholder(in context: Context) -> ScheduleEntry {
        ScheduleEntry(date: Date(), feed: Self.sampleFeed, connected: true)
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
                let entry = ScheduleEntry(date: now, feed: nil, connected: false)
                completion(Timeline(entries: [entry], policy: .after(now.addingTimeInterval(30 * 60))))
                return
            }

            let feed: WidgetFeed?
            do {
                feed = try await WidgetAPI.feed(for: now)
            } catch {
                feed = WidgetStore.cachedFeed()
            }

            guard let feed else {
                let entry = ScheduleEntry(date: now, feed: nil, connected: true)
                completion(Timeline(entries: [entry], policy: .after(now.addingTimeInterval(20 * 60))))
                return
            }

            let moments = timelineMoments(feed: feed, now: now)
            let entries = moments.map { ScheduleEntry(date: $0, feed: feed, connected: true) }
            let refresh = nextMorning(after: now)
            completion(Timeline(entries: entries, policy: .after(refresh)))
        }
    }

    private func loadEntry(date: Date) async -> ScheduleEntry {
        guard WidgetStore.token != nil else {
            return ScheduleEntry(date: date, feed: nil, connected: false)
        }
        if let feed = try? await WidgetAPI.feed(for: date) {
            return ScheduleEntry(date: date, feed: feed, connected: true)
        }
        return ScheduleEntry(date: date, feed: WidgetStore.cachedFeed(), connected: true)
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
        .containerBackground(for: .widget) {
            Color(.systemBackground)
        }
        .widgetURL(WidgetEnvironment.scheduleURL)
    }

    private var state: DayState { DayState(entry: entry) }

    private var primary: WidgetEvent? {
        state.current ?? state.upcoming.first
    }

    private var small: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(state.current == nil ? "ДАЛЬШЕ" : "СЕЙЧАС")
                .font(.caption2.weight(.bold))
                .foregroundStyle(.secondary)

            if let event = primary {
                Text(event.title)
                    .font(.headline)
                    .lineLimit(2)
                Text(state.current == nil ? event.start : "до \(event.end)")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(color(for: event.kind))
                if !event.subtitle.isEmpty {
                    Text(event.subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            } else {
                Text("На сегодня всё")
                    .font(.headline)
                Text("Свободен")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 0)

            if let freeAt = state.freeAt {
                Text("Свободен в \(freeAt)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var medium: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text(state.current == nil ? "ДАЛЬШЕ" : "СЕЙЧАС")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.secondary)
                if let event = primary {
                    Text(event.title)
                        .font(.headline)
                        .lineLimit(2)
                    Text(state.current == nil ? event.start : "до \(event.end)")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(color(for: event.kind))
                    Text(event.subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                } else {
                    Text("На сегодня всё")
                        .font(.headline)
                }
                Spacer()
                if let freeAt = state.freeAt {
                    Text("Свободен в \(freeAt)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Divider()

            VStack(alignment: .leading, spacing: 8) {
                Text("ПОТОМ")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.secondary)
                let later = Array(state.upcoming.dropFirst(state.current == nil ? 1 : 0).prefix(2))
                if later.isEmpty {
                    Text("Больше событий нет")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(later) { event in
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(event.start) · \(event.title)")
                                .font(.caption.weight(.semibold))
                                .lineLimit(1)
                            if !event.subtitle.isEmpty {
                                Text(event.subtitle)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                        }
                    }
                }
                Spacer()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var accessoryRectangular: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let event = primary {
                Text(state.current == nil ? event.start : "до \(event.end)")
                    .font(.caption.weight(.semibold))
                Text(event.title)
                    .font(.headline)
                    .lineLimit(1)
                if !event.subtitle.isEmpty {
                    Text(event.subtitle)
                        .font(.caption2)
                        .lineLimit(1)
                }
            } else {
                Text("214Р")
                    .font(.caption.weight(.semibold))
                Text("На сегодня всё")
                    .font(.headline)
            }
        }
    }

    private var accessoryInline: some View {
        Group {
            if let event = primary {
                Text("\(state.current == nil ? event.start : "до \(event.end)") · \(event.title)")
            } else {
                Text("214Р · на сегодня всё")
            }
        }
    }

    private var disconnected: some View {
        VStack(alignment: .leading, spacing: 5) {
            Image(systemName: "iphone.gen3")
            Text("Подключи 214Р")
                .font(.headline)
            Text("Настройки → iOS-виджет")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    private var unavailable: some View {
        VStack(alignment: .leading, spacing: 5) {
            Image(systemName: "wifi.exclamationmark")
            Text("Нет данных")
                .font(.headline)
            Text("Обновим автоматически")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    private func color(for kind: String) -> Color {
        switch kind {
        case "rehearsal": return .orange
        case "individual": return .red
        default: return .accentColor
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
        .contentMarginsDisabled()
    }
}
