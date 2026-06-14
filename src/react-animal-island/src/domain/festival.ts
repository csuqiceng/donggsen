export interface Festival {
  id: string;
  name: string;
  reward: string;
  text: string;
}

const FESTIVALS: Record<string, Festival> = {
  '01-01': { id: 'festival_new_year', name: '新年烟花', reward: 'nookMilesTicket', text: '新年登岛，码头送来一张里数券。' },
  '02-14': { id: 'festival_valentine', name: '心意巧克力', reward: 'bells', text: '今天的留言板适合放一颗心意。' },
  '10-31': { id: 'festival_halloween', name: '南瓜灯', reward: 'clay', text: '万圣夜的小基地多了一点装饰材料。' },
  '12-25': { id: 'festival_toy_day', name: '玩具日包裹', reward: 'starFragment', text: '玩具日包裹落到岛上。' },
};

export function getFestivalToday(date: Date): Festival | null {
  const md = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return FESTIVALS[md] || null;
}

export function applyFestivalBonus(
  festival: Festival | null,
  settled: boolean,
  discovered: string[],
): { discovery: string; reward: string } | null {
  if (!festival || !settled || discovered.includes(festival.id)) return null;
  return { discovery: festival.id, reward: festival.reward };
}
