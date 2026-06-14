import { describe, expect, it } from 'vitest';
import { revealExtraBottleClue } from './bottle';

describe('瓶中信额外线索', () => {
  it('里数券不足时拒绝', () => {
    expect(revealExtraBottleClue(0, 5)).toEqual({ ok: false, error: '里数券不足' });
  });

  it('消耗 1 里数券并登记 bottle_extra_clue 发现', () => {
    const result = revealExtraBottleClue(1, 0);
    expect(result.ok).toBe(true);
    expect(result.consume).toBe('nookMilesTicket');
    expect(result.discovery).toBe('bottle_extra_clue');
  });

  it('按 (当天 + 剩余券) % 4 选择线索', () => {
    // currentDayIndex 0, 券 1 → 剩余 0 → index 0
    expect(revealExtraBottleClue(1, 0).clue).toContain('标准完整完成');
    // currentDayIndex 1, 券 2 → 剩余 1 → index 2
    expect(revealExtraBottleClue(2, 1).clue).toContain('夜里挑战');
  });
});
