import { Table, type TableColumn } from 'animal-island-ui';
import { isOnline } from '../domain/leaderboard';

interface Participant {
  name: string;
  avatar?: string;
  settledDays: number;
  minutes: number;
  lastActive: number;
}

export function Leaderboard({ participants, now }: { participants: Participant[]; now: number }) {
  if (!participants.length) return <p className="muted">还没有岛民登岛。</p>;
  const sorted = [...participants].sort((a, b) => b.settledDays - a.settledDays || b.minutes - a.minutes);
  const columns: TableColumn[] = [
    { title: '排名', dataIndex: 'rank', width: 48, align: 'center' },
    { title: '岛民', dataIndex: 'name' },
    { title: '打卡', dataIndex: 'settled', align: 'right' },
    { title: '状态', dataIndex: 'online', align: 'center', render: value => (value ? '●在线' : '离线') },
  ];
  const dataSource = sorted.map((participant, index) => ({
    key: participant.name,
    rank: index + 1,
    name: participant.name,
    settled: `${participant.settledDays}天 · ${participant.minutes}分`,
    online: isOnline(participant.lastActive, now),
  }));
  return <Table columns={columns} dataSource={dataSource} rowKey="key" showHeader={false} />;
}
