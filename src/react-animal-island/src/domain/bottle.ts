export const BOTTLE_EXTRA_CLUES = [
  '稀有线索：标准完整完成几次后，仓库会补木材。',
  '稀有线索：挑战完整累计几次后，心愿会被码头记录。',
  '传说线索：夜里挑战完整完成，星星会记住你。',
  '传说线索：两个人同日挑战完整完成，码头会靠岸。',
];

export function revealExtraBottleClue(
  nookMilesTicket: number,
  currentDayIndex: number,
): { ok: boolean; consume?: string; discovery?: string; clue?: string; error?: string } {
  if (nookMilesTicket <= 0) return { ok: false, error: '里数券不足' };
  const remaining = nookMilesTicket - 1;
  const clue = BOTTLE_EXTRA_CLUES[(currentDayIndex + remaining) % BOTTLE_EXTRA_CLUES.length];
  return { ok: true, consume: 'nookMilesTicket', discovery: 'bottle_extra_clue', clue };
}
