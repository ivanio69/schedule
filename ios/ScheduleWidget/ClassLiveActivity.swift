import ActivityKit
import SwiftUI
import WidgetKit

struct ClassLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ClassActivityAttributes.self) { context in
            let palette = ClassActivityPalette(appearance: context.state.lesson.appearance, date: context.state.lesson.start)
            ClassActivityCard(state: context.state, expired: context.isStale, palette: palette)
                .activityBackgroundTint(palette.surface)
                .activitySystemActionForegroundColor(palette.text)
                .widgetURL(URL(string: "schedule214://schedule"))
        } dynamicIsland: { context in
            let lesson = context.state.presentation(at: Date())
            let phase = lesson.phase(at: Date())
            // Dynamic Island has a system black background, including in light mode.
            let palette = ClassActivityPalette(appearance: lesson.appearance, date: lesson.start, forceDark: true)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(phase.heading)
                        .font(.system(size: 10, weight: .semibold)).tracking(0.8)
                        .foregroundStyle(palette.muted)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ClassActivityBadge(phase: phase, palette: palette)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ClassActivityDetails(lesson: lesson, phase: phase, palette: palette, compact: true)
                        .padding(.top, 4).padding(.bottom, 8)
                }
            } compactLeading: {
                Image(systemName: phase.symbol)
                    .foregroundStyle(palette.accent)
            } compactTrailing: {
                ClassCountdown(lesson: lesson, phase: phase)
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .foregroundStyle(palette.accent)
                    .frame(width: 64)
            } minimal: {
                Image(systemName: phase.symbol)
                    .foregroundStyle(palette.accent)
            }
            .keylineTint(palette.accent)
            .widgetURL(URL(string: "schedule214://schedule"))
        }
    }
}

private struct ClassActivityCard: View {
    let state: ClassActivityAttributes.ContentState
    let expired: Bool
    let palette: ClassActivityPalette
    private var lesson: ClassActivityLesson { state.presentation(at: Date()) }
    private var phase: ClassActivityLesson.Phase { lesson.phase(at: Date()) }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(phase.heading)
                    .font(.system(size: 10, weight: .semibold)).tracking(0.8)
                    .foregroundStyle(palette.muted)
                Spacer(minLength: 8)
                ClassActivityBadge(phase: phase, palette: palette)
            }
            ClassActivityDetails(lesson: lesson, phase: phase, palette: palette, compact: false)
        }
        .id(expired)
        .padding(.horizontal, 20).padding(.vertical, 14)
        .background {
            // Match dashboard-focus: diagonal tinted surface + upper-right glow.
            GeometryReader { geometry in
                LinearGradient(colors: [palette.raised, palette.surface], startPoint: .topLeading, endPoint: .bottomTrailing)
                    .overlay {
                        RadialGradient(colors: [palette.accent.opacity(0.18), .clear], center: .topTrailing,
                                       startRadius: 0, endRadius: max(geometry.size.width * 0.7, 1))
                    }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(palette.accent.opacity(0.28), lineWidth: 1)
        }
    }
}

private struct ClassActivityDetails: View {
    let lesson: ClassActivityLesson
    let phase: ClassActivityLesson.Phase
    let palette: ClassActivityPalette
    let compact: Bool

    private var title: String {
        switch phase {
        case .beforeClasses: return "Первая пара скоро"
        case .lesson: return lesson.title
        case .betweenClasses: return "Перерыв"
        case .dayFinished: return "Сегодня больше пар нет"
        case .nextStarted: return "Следующая пара началась"
        }
    }
    private var subtitle: String {
        switch phase {
        case .beforeClasses: return lesson.title
        case .lesson: return lesson.subtitle
        case .betweenClasses, .nextStarted: return lesson.nextClass.map { "Дальше · \($0.title)" } ?? "Открой расписание"
        case .dayFinished: return "Можно отдыхать"
        }
    }
    private var timerWidth: CGFloat {
        let interval = lesson.countdownInterval(for: phase)
        let long = interval.upperBound.timeIntervalSince(interval.lowerBound) > 3600
        return compact ? (long ? 116 : 104) : (long ? 144 : 126)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center, spacing: compact ? 12 : 16) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(title)
                        .font(.system(size: compact ? 18 : 21, weight: .semibold))
                        .tracking(-0.6)
                        .foregroundStyle(palette.text)
                        .lineLimit(2).minimumScaleFactor(0.85)
                        .fixedSize(horizontal: false, vertical: true)
                    if !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.system(size: 11))
                            .foregroundStyle(palette.secondary)
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                VStack(alignment: .trailing, spacing: 3) {
                    ClassCountdown(lesson: lesson, phase: phase)
                        .font(.system(size: compact ? 30 : 38, weight: .semibold, design: .rounded).monospacedDigit())
                        .tracking(-1.2)
                        .foregroundStyle(palette.text)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                    Text(phase.timerCaption)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(palette.secondary)
                }
                .frame(width: timerWidth, alignment: .trailing)
                .layoutPriority(1)
            }

            if phase == .lesson {
                ClassProgress(lesson: lesson, ended: false, tint: palette.accent, surface: palette.surface)
                    .padding(.top, 12)
                HStack {
                    Text(lesson.start, style: .time)
                    Spacer(minLength: 4)
                    if let pause = lesson.breakInterval {
                        HStack(spacing: 2) {
                            Text("перерыв")
                            Text(pause.lowerBound, style: .time)
                            Text("–")
                            Text(pause.upperBound, style: .time)
                        }
                        .lineLimit(1).minimumScaleFactor(0.85)
                    }
                    Spacer(minLength: 4)
                    Text(lesson.end, style: .time)
                }
                .font(.system(size: 9, weight: .medium).monospacedDigit())
                .foregroundStyle(palette.muted)
                .padding(.top, 3)
            } else if phase == .betweenClasses, let next = lesson.nextClass {
                HStack(spacing: 4) {
                    Text("Следующая пара в")
                    Text(next.start, style: .time)
                }
                .font(.system(size: 10, weight: .medium).monospacedDigit())
                .foregroundStyle(palette.muted)
                .padding(.top, 12)
            }

        }
    }
}

private struct ClassActivityBadge: View {
    let phase: ClassActivityLesson.Phase
    let palette: ClassActivityPalette

    var body: some View {
        Label(phase.badge, systemImage: phase.symbol)
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(palette.text)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(palette.accent.opacity(0.15), in: Capsule())
            .overlay { Capsule().strokeBorder(palette.accent.opacity(0.28), lineWidth: 1) }
    }
}

private extension ClassActivityLesson.Phase {
    var heading: String {
        switch self {
        case .beforeClasses: return "СЕГОДНЯ"
        case .lesson: return "СЕЙЧАС ИДЁТ"
        case .betweenClasses: return "СЕЙЧАС ПЕРЕРЫВ"
        case .dayFinished: return "НА СЕГОДНЯ ВСЁ"
        case .nextStarted: return "РАСПИСАНИЕ"
        }
    }
    var badge: String {
        switch self {
        case .beforeClasses: return "Скоро"
        case .lesson: return "Пара"
        case .betweenClasses: return "Перерыв"
        case .dayFinished, .nextStarted: return "Готово"
        }
    }
    var symbol: String {
        switch self {
        case .beforeClasses: return "clock.fill"
        case .lesson: return "graduationcap.fill"
        case .betweenClasses: return "pause.circle.fill"
        case .dayFinished, .nextStarted: return "checkmark.circle.fill"
        }
    }
    var timerCaption: String {
        switch self {
        case .beforeClasses: return "до начала"
        case .lesson: return "до конца"
        case .betweenClasses: return "до начала"
        case .dayFinished: return "на сегодня всё"
        case .nextStarted: return "началась"
        }
    }
}

private struct ClassCountdown: View {
    let lesson: ClassActivityLesson
    let phase: ClassActivityLesson.Phase
    var body: some View {
        if phase == .dayFinished || phase == .nextStarted {
            Image(systemName: "checkmark")
        } else {
            // showsHours adds H:MM:SS above one hour and returns to MM:SS below it.
            Text(timerInterval: lesson.countdownInterval(for: phase), countsDown: true, showsHours: true)
                .monospacedDigit().minimumScaleFactor(0.75).lineLimit(1)
                .multilineTextAlignment(.trailing)
                .accessibilityLabel(phase == .betweenClasses || phase == .beforeClasses ? "До начала следующей пары" : "До конца пары")
        }
    }
}

private struct ClassProgress: View {
    let lesson: ClassActivityLesson
    let ended: Bool
    let tint: Color
    let surface: Color
    var body: some View {
        Group {
            if ended {
                ProgressView(value: 1)
            } else {
                ProgressView(timerInterval: lesson.interval, countsDown: false)
            }
        }
        .progressViewStyle(.linear)
        .labelsHidden().tint(tint)
        .frame(height: 6)
        .overlay {
            if let pause = lesson.breakInterval {
                GeometryReader { geometry in
                    let duration = lesson.end.timeIntervalSince(lesson.start)
                    let offset = geometry.size.width * pause.lowerBound.timeIntervalSince(lesson.start) / duration
                    let width = geometry.size.width * pause.upperBound.timeIntervalSince(pause.lowerBound) / duration
                    // A fixed dashed slot marks minutes 40–45. The OS still animates
                    // progress across the full class while the app is suspended.
                    Rectangle().fill(surface)
                        .overlay {
                            Path { path in
                                path.move(to: CGPoint(x: 1, y: 3))
                                path.addLine(to: CGPoint(x: max(1, width - 1), y: 3))
                            }
                            .stroke(tint, style: StrokeStyle(lineWidth: 3, lineCap: .butt, dash: [2, 2]))
                        }
                        .frame(width: width, height: 6)
                        .offset(x: offset)
                }
                .accessibilityHidden(true)
            }
        }
        .accessibilityLabel(ended ? "Пара завершена" : "Прогресс пары")
        .accessibilityHint(lesson.breakInterval == nil ? "" : "Пятиминутный перерыв с сороковой до сорок пятой минуты отмечен штриховой линией")
    }
}

/// Matches the dashboard's base surfaces and accent presets in app/appearance.css.
private struct ClassActivityPalette {
    let accent: Color
    let surface: Color
    let raised: Color
    let text: Color
    let secondary: Color
    let muted: Color

    init(appearance: WidgetAppearance?, date: Date, forceDark: Bool = false) {
        let dark = forceDark || appearance?.theme != "light"
        var accentHex: UInt32
        if appearance?.appAccentMode == "time" {
            // Scheduled cards use their class's start time, not the scheduling time.
            switch Calendar.current.component(.hour, from: date) {
            case 6..<11: accentHex = 0xf2a06d
            case 11..<18: accentHex = 0x73c7f5
            case 18..<24: accentHex = 0xc77eaa
            default: accentHex = 0x48699f
            }
        } else {
            switch appearance?.appAccent {
            case "mint": accentHex = 0x79d9b0
            case "blue": accentHex = 0x76aef8
            case "violet": accentHex = 0xaa8df5
            case "amber": accentHex = 0xedb761
            case "rose": accentHex = 0xed8ca1
            default: accentHex = dark ? 0xf4f4f5 : 0x17171a
            }
        }
        accent = Self.color(accentHex)
        surface = Self.mix(dark ? 0x111114 : 0xffffff, accentHex, fraction: dark ? 0.09 : 0.04)
        // --surface-raised is tinted once, then dashboard-focus adds 12% accent.
        raised = Self.mix(dark ? 0x18181c : 0xf7f7f8, accentHex, fraction: dark ? 0.2256 : 0.1904)
        text = Self.mix(dark ? 0xf4f4f5 : 0x17171a, accentHex, fraction: dark ? 0.03 : 0.02)
        secondary = Self.mix(dark ? 0xc7c7cf : 0x44444c, accentHex, fraction: dark ? 0.07 : 0.05)
        muted = Self.mix(dark ? 0x93939d : 0x73737d, accentHex, fraction: dark ? 0.1 : 0.07)
    }

    private static func color(_ hex: UInt32) -> Color {
        mix(hex, hex, fraction: 0)
    }

    private static func mix(_ base: UInt32, _ tint: UInt32, fraction: Double) -> Color {
        func component(_ shift: UInt32) -> Double {
            let original = Double((base >> shift) & 0xff) / 255
            let accent = Double((tint >> shift) & 0xff) / 255
            return original * (1 - fraction) + accent * fraction
        }
        return Color(red: component(16), green: component(8), blue: component(0))
    }
}

#if DEBUG
private func previewState(theme: String, accent: String, ended: Bool = false) -> ClassActivityAttributes.ContentState {
    let appearance = WidgetAppearance(theme: theme, appAccentMode: "manual", appAccent: accent,
                                      rehearsalAccent: "default", individualAccent: "default", seminarAccent: "default")
    let lesson = ClassActivityLesson(id: "preview", profileID: "preview", title: "Режиссура театрализованных представлений",
                                     subtitle: "Урбан А. М. · ауд. 214", start: Date().addingTimeInterval(-1800),
                                     end: Date().addingTimeInterval(ended ? -60 : 5400), appearance: appearance)
    return ClassActivityAttributes.ContentState(lesson: lesson, ended: ended)
}

#Preview("Dashboard · Dark") {
    let state = previewState(theme: "dark", accent: "mint")
    ClassActivityCard(state: state, expired: false,
                      palette: ClassActivityPalette(appearance: state.lesson.appearance, date: state.lesson.start))
        .frame(width: 360).padding()
}

#Preview("Dashboard · Light") {
    let state = previewState(theme: "light", accent: "blue")
    ClassActivityCard(state: state, expired: false,
                      palette: ClassActivityPalette(appearance: state.lesson.appearance, date: state.lesson.start))
        .frame(width: 320).padding()
}

#Preview("Dashboard · Finished") {
    let state = previewState(theme: "dark", accent: "default", ended: true)
    ClassActivityCard(state: state, expired: true,
                      palette: ClassActivityPalette(appearance: state.lesson.appearance, date: state.lesson.start))
        .frame(width: 360).padding()
}
#endif

#if DEBUG
private func intermissionPreview() -> ClassActivityAttributes.ContentState {
    var lesson = previewState(theme: "dark", accent: "mint").lesson
    lesson = ClassActivityLesson(id: lesson.id, profileID: lesson.profileID, title: lesson.title,
                                 subtitle: lesson.subtitle, start: Date().addingTimeInterval(-6000),
                                 end: Date().addingTimeInterval(-600), appearance: lesson.appearance,
                                 nextClass: ClassActivityNext(title: "История театра", start: Date().addingTimeInterval(4500)),
                                 lastClassEnd: Date().addingTimeInterval(9900))
    return ClassActivityAttributes.ContentState(lesson: lesson)
}

#Preview("Dashboard · Between classes") {
    let state = intermissionPreview()
    ClassActivityCard(state: state, expired: true,
                      palette: ClassActivityPalette(appearance: state.lesson.appearance, date: state.lesson.start))
        .frame(width: 360).padding()
}
#endif
