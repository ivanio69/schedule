"use client";

type LoadingStateProps = {
  label?: string;
  detail?: string;
  screen?: boolean;
  compact?: boolean;
  className?: string;
};

export default function LoadingState({
  label = "Загрузка",
  detail,
  screen = false,
  compact = false,
  className = "",
}: LoadingStateProps) {
  const classes = ["app-loading-state", screen ? "is-screen" : "", compact ? "is-compact" : "", className].filter(Boolean).join(" ");
  const accessibleLabel = detail ? `${label}. ${detail}` : label;

  return <div className={classes} role="status" aria-live="polite" aria-busy="true" aria-label={accessibleLabel} />;
}
