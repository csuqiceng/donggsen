interface BuildUpdate {
  id: string;
  name: string;
  from: string;
  to: string;
}

export function BuildUpdateModal({ updates, onClose }: { updates: BuildUpdate[]; onClose: () => void }) {
  if (!updates.length) return null;
  return (
    <div className="build-update modal-mask" role="dialog" aria-label="建筑升级通知">
      <div className="build-update-panel">
        <div className="build-update-title">🏗 岛上有了新变化</div>
        <ul className="build-update-list">
          {updates.map(update => (
            <li key={update.id}>
              <strong>{update.name}</strong>
              <span>{update.from} → {update.to}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="build-update-close" onClick={onClose}>知道了</button>
      </div>
    </div>
  );
}
