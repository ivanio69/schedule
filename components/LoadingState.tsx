type LoadingStateProps = {
  label?: string;
  detail?: string;
  screen?: boolean;
  compact?: boolean;
  className?: string;
};

export default function LoadingState({
  label = "Загружаем…",
  detail,
  screen = false,
  compact = false,
  className = "",
}: LoadingStateProps) {
  const classes = ["app-loading-state", screen ? "is-screen" : "", compact ? "is-compact" : "", className].filter(Boolean).join(" ");
  return <div className={classes} role="status" aria-live="polite" aria-busy="true">
    <span className="app-loading-spinner" aria-hidden="true"/>
    <div className="app-loading-copy">
      <strong>{label}</strong>
      {detail && <small>{detail}</small>}
    </div>
  </div>;
}
