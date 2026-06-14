import type { WeeklyInsights } from './weekly';

export interface WeeklySettlementStatus {
  allowed: boolean;
  label: string;
  reason: string;
}

export function getWeeklyEventId(weekIndex: number, yearMonth: string): string {
  return `weekly_${weekIndex}_${yearMonth}`;
}

export function getWeeklySettlementStatus(opts: {
  todayWeekday: number; // 0=周一 ... 6=周日
  sundaySettled: boolean;
  sundayMissed: boolean;
  alreadySettled: boolean;
}): WeeklySettlementStatus {
  if (opts.alreadySettled) return { allowed: false, label: '本周已结算', reason: '这一周已经生成过结算公告。' };
  if (opts.todayWeekday !== 6) return { allowed: false, label: '周日完成后结算', reason: '周一到周六不能提前生成周结算。' };
  if (!opts.sundaySettled && !opts.sundayMissed) return { allowed: false, label: '先完成今天', reason: '周日需要先打卡或记录休息。' };
  return { allowed: true, label: '生成本周结算', reason: '周日已处理，可以生成完整周结算。' };
}

export function buildWeeklyEvent(opts: {
  weekIndex: number;
  yearMonth: string;
  weeklyCheckins: number;
  sameDay: number;
  warehouseTotal: number;
  insights: WeeklyInsights;
  now: number;
}) {
  return {
    id: getWeeklyEventId(opts.weekIndex, opts.yearMonth),
    type: 'weekly',
    title: `第 ${opts.weekIndex + 1} 周结算`,
    summary: `本周合计登岛 ${opts.weeklyCheckins} 次，同日 ${opts.sameDay} 次，仓库 ${opts.warehouseTotal} 份。最稳：${opts.insights.bestDay.label}；最弱：${opts.insights.weakest.label}；建议：${opts.insights.nextAdvice.label}`,
    createdAt: opts.now,
  };
}
