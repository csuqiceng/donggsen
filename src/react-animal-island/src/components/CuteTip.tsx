export function CuteTip({ text, icon = '🍃' }: { text: string; icon?: string }) {
  if (!text) return null;
  return (
    <div className="cute-tip" role="status" aria-live="polite">
      <span className="cute-tip-icon" aria-hidden="true">{icon}</span>
      <span className="cute-tip-text">{text}</span>
    </div>
  );
}
