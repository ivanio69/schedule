import ActivityKit
import SwiftUI
import WidgetKit

private let classTint = Color(red: 0.42, green: 0.88, blue: 0.73)

struct ClassLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ClassActivityAttributes.self) { context in
            ClassActivityCard(state: context.state, expired: context.isStale)
                .activityBackgroundTint(Color(red: 0.06, green: 0.10, blue: 0.10))
                .activitySystemActionForegroundColor(.white)
                .widgetURL(URL(string: "schedule214://schedule"))
        } dynamicIsland: { context in
            let ended = context.isStale || context.state.ended
            let lesson = context.state.lesson
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(ended ? "Завершена" : "Сейчас пара", systemImage: ended ? "checkmark.circle.fill" : "graduationcap.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(classTint)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ClassCountdown(lesson: lesson, ended: ended)
                        .font(.headline.monospacedDigit())
                        .frame(width: 74, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(lesson.title).font(.headline).lineLimit(2)
                        if !lesson.subtitle.isEmpty {
                            Text(lesson.subtitle).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                        }
                        ClassProgress(lesson: lesson, ended: ended)
                    }
                    .padding(.bottom, 6)
                }
            } compactLeading: {
                Image(systemName: ended ? "checkmark.circle.fill" : "graduationcap.fill")
                    .foregroundStyle(classTint)
            } compactTrailing: {
                ClassCountdown(lesson: lesson, ended: ended)
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .foregroundStyle(classTint)
                    .frame(width: 48)
            } minimal: {
                Image(systemName: ended ? "checkmark" : "graduationcap.fill")
                    .foregroundStyle(classTint)
            }
            .keylineTint(classTint)
            .widgetURL(URL(string: "schedule214://schedule"))
        }
    }
}

private struct ClassActivityCard: View {
    let state: ClassActivityAttributes.ContentState
    let expired: Bool
    private var ended: Bool { expired || state.ended }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Label(ended ? "ПАРА ЗАВЕРШЕНА" : "СЕЙЧАС ПАРА", systemImage: ended ? "checkmark.circle.fill" : "graduationcap.fill")
                        .font(.system(size: 10, weight: .bold)).tracking(1)
                        .foregroundStyle(classTint)
                    Text(state.lesson.title)
                        .font(.system(size: 19, weight: .semibold, design: .rounded))
                        .lineLimit(2).minimumScaleFactor(0.85)
                    if !state.lesson.subtitle.isEmpty {
                        Text(state.lesson.subtitle)
                            .font(.caption).foregroundStyle(.white.opacity(0.65)).lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .trailing, spacing: 4) {
                    ClassCountdown(lesson: state.lesson, ended: ended)
                        .font(.system(size: 27, weight: .medium, design: .rounded).monospacedDigit())
                        .foregroundStyle(classTint)
                    Text(ended ? "можно выдохнуть" : "до конца")
                        .font(.system(size: 10)).foregroundStyle(.white.opacity(0.6))
                }
                .frame(width: 94, alignment: .trailing)
            }
            ClassProgress(lesson: state.lesson, ended: ended)
            HStack {
                Text(state.lesson.start, style: .time)
                Spacer()
                Text(state.lesson.end, style: .time)
            }
            .font(.system(size: 11, weight: .medium).monospacedDigit())
            .foregroundStyle(.white.opacity(0.65))
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 18).padding(.vertical, 14)
    }
}

private struct ClassCountdown: View {
    let lesson: ClassActivityLesson
    let ended: Bool
    var body: some View {
        if ended {
            Image(systemName: "checkmark")
        } else {
            // The OS renders this while the application is suspended; stops at zero.
            Text(timerInterval: lesson.interval, countsDown: true, showsHours: false)
                .monospacedDigit().minimumScaleFactor(0.8)
                .accessibilityLabel("До конца пары")
        }
    }
}

private struct ClassProgress: View {
    let lesson: ClassActivityLesson
    let ended: Bool
    var body: some View {
        Group {
            if ended {
                ProgressView(value: 1)
            } else {
                ProgressView(timerInterval: lesson.interval, countsDown: false)
            }
        }
        .labelsHidden().tint(classTint)
        .accessibilityLabel(ended ? "Пара завершена" : "Прогресс пары")
    }
}
