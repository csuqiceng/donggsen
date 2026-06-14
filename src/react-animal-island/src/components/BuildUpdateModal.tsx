import { Button, Modal } from 'animal-island-ui';

interface BuildUpdate {
  id: string;
  name: string;
  from: string;
  to: string;
}

export function BuildUpdateModal({ updates, onClose }: { updates: BuildUpdate[]; onClose: () => void }) {
  return (
    <Modal
      open={updates.length > 0}
      title="🏗 岛上有了新变化"
      typewriter={false}
      onClose={onClose}
      footer={<Button type="primary" onClick={onClose}>知道了</Button>}
    >
      {updates.map(update => (
        <div key={update.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <strong>{update.name}</strong>
          <span>{update.from} → {update.to}</span>
        </div>
      ))}
    </Modal>
  );
}
