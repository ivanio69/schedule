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
            let ended = context.isStale || context.state.ended
            let lesson = context.state.lesson
            // Dynamic Island has a system black background, including in light mode.
            let palette = ClassActivityPalette(appearance: lesson.appearance, date: lesson.start, forceDark: true)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(ended ? "ПАРА ЗАВЕРШЕНА" : "СЕЙЧАС ИДЁТ")
                        .font(.system(size: 10, weight: .semibold)).tracking(0.8)
                        .foregroundStyle(palette.muted)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ClassActivityBadge(ended: ended, palette: palette)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ClassActivityDetails(lesson: lesson, ended: ended, palette: palette, compact: true)
                        .padding(.top, 4).padding(.bottom, 8)
                }
            } compactLeading: {
                Image(systemName: ended ? "checkmark.circle.fill" : "graduationcap.fill")
                    .foregroundStyle(palette.accent)
            } compactTrailing: {
                ClassCountdown(lesson: lesson, ended: ended)
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .foregroundStyle(palette.accent)
                    .frame(width: 48)
            } minimal: {
                Image(systemName: ended ? "checkmark" : "graduationcap.fill")
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
    private var ended: Bool { expired || state.ended }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(ended ? "ПАРА ЗАВЕРШЕНА" : "СЕЙЧАС ИДЁТ")
                    .font(.system(size: 10, weight: .semibold)).tracking(0.8)
                    .foregroundStyle(palette.muted)
                Spacer(minLength: 8)
                ClassActivityBadge(ended: ended, palette: palette)
            }
            ClassActivityDetails(lesson: state.lesson, ended: ended, palette: palette, compact: false)
        }
        .padding(.horizontal, 20).padding(.vertical, 12)
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
    let ended: Bool
    let palette: ClassActivityPalette
    let compact: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(lesson.title)
                .font(.system(size: compact ? 20 : 22, weight: .semibold))
                .tracking(-0.7)
                .foregroundStyle(palette.text)
                .lineLimit(1).minimumScaleFactor(0.85)
                .frame(maxWidth: .infinity, alignment: .leading)
            if !lesson.subtitle.isEmpty {
                Text(lesson.subtitle)
                    .font(.system(size: compact ? 12 : 11))
                    .foregroundStyle(palette.secondary)
                    .lineLimit(1)
                    .padding(.top, 3)
            }
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                if ended {
                    Text("Пара завершена")
                        .font(.system(size: 20, weight: .semibold))
                } else {
                    Text("до конца")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(palette.secondary)
                    ClassCountdown(lesson: lesson, ended: false)
                        .font(.system(size: compact ? 30 : 36, weight: .semibold).monospacedDigit())
                        .tracking(-1)
                        .frame(width: compact ? 116 : 136, alignment: .leading)
                }
            }
            .foregroundStyle(palette.text)
            .padding(.top, 6)

            ClassProgress(lesson: lesson, ended: ended, tint: palette.accent, surface: palette.surface)
                .padding(.top, 6)
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
        }
    }
}

private struct ClassActivityBadge: View {
    let ended: Bool
    let palette: ClassActivityPalette

    var body: some View {
        Label(ended ? "Готово" : "Пара", systemImage: ended ? "checkmark" : "graduationcap.fill")
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(palette.text)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(palette.accent.opacity(0.15), in: Capsule())
            .overlay { Capsule().strokeBorder(palette.accent.opacity(0.28), lineWidth: 1) }
    }
}

private struct ClassCountdown: View {
    let lesson: ClassActivityLesson
    let ended: Bool
    var body: some View {
        if ended {
            Image(systemName: "checkmark")
        } else {
            // System-rendered while suspended. No TimelineView or app timer required.
            Text(timerInterval: lesson.interval, countsDown: true, showsHours: false)
                .monospacedDigit().minimumScaleFactor(0.8)
                .multilineTextAlignment(.leading)
                .accessibilityLabel("До конца пары")
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
                                     end: Date().addingTimeInterval(3600), appearance: appearance)
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
