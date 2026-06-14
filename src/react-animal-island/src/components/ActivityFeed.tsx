export function ActivityFeed({ items }: { items: string[] }) {
  if (!items.length) return <p className="muted">暂无活动。</p>;
  return (
    <div className="activity-feed">
      {items.map((item, index) => (
        <div key={`${item}-${index}`} className="activity-item" data-testid="activity-item">{item}</div>
      ))}
    </div>
  );
}
