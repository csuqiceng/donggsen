import { flattenPlanDays, getAdjustedDay } from './training';
import type { CountMap, DayState, TrainingPlan } from './types';

export function isOnline(lastActive: number, now: number): boolean {
  if (!lastActive) return false;
  return now - lastActive < 120000;
}

export function sumCounts(source: CountMap | undefined): number {
  return Object.values(source || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

export function countChecked(dayStates: Record<string, DayState> | undefined): number {
  let total = 0;
  Object.values(dayStates || {}).forEach(state => {
    if (state && Array.isArray(state.checked)) total += state.checked.filter(Boolean).length;
  });
  return total;
}

export function getUserTitle(opts: {
  dayStates: Record<string, DayState>;
  warehouseContribution?: CountMap;
  discovered: string[];
  plan: TrainingPlan;
}): string {
  const { dayStates, warehouseContribution, discovered, plan } = opts;
  const days = flattenPlanDays(plan);
  let settled = 0;
  let challengeFull = 0;
  Object.entries(dayStates || {}).forEach(([key, state]) => {
    if (!state || !state.settled || state.rest || state.missed) return;
    settled += 1;
    if (state.difficulty !== 'challenge') return;
    const index = Number(key.startsWith('day_') ? key.slice(4) : key);
    const day = days[index];
    if (!day) return;
    const adjusted = getAdjustedDay(day, 'challenge');
    const checked = Array.isArray(state.checked) ? state.checked.filter(Boolean).length : 0;
    if (checked >= adjusted.exercises.length) challengeFull += 1;
  });
  if (sumCounts(warehouseContribution) >= 20) return '建设代表';
  if (discovered.includes('same_day_checkin')) return '同日岛民';
  if (challengeFull >= 3) return '挑战岛民';
  if (settled >= 7) return '常驻岛民';
  if (settled >= 3) return '上岛新星';
  return '新岛民';
}
