import { AVATARS, DIFFICULTIES } from './config';
import { getDifficultyExercises } from './difficulty';
import { chooseRewards, computeMaterialCount, computeRewardScore, rewardCounts, warehouseCounts } from './rewards';
import type { DayState, LocalUserState, PlanDay, TrainingPlan } from './types';

export function createClientId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createInitialState(username: '哥哥' | '乖宝'): LocalUserState {
  return {
    clientId: createClientId(),
    username,
    avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)]?.id || 'rosie',
    syncVersion: 0,
    currentDayIndex: 0,
    selectedDifficulty: 'standard',
    selectedPlanMode: 'standard',
    dayStates: {},
    inventory: {},
    warehouseContribution: {},
    collection: { discovered: ['resident_services_tent'], completed: [] },
    giftClaims: {},
  };
}

export function flattenPlanDays(plan: TrainingPlan): PlanDay[] {
  return plan.weeks.flatMap((week, weekIndex) => week.days.map((day, dayInWeek) => ({
    ...day,
    weekIndex,
    weekTheme: week.theme,
    weekSignal: week.signal,
    dayInWeek,
  })));
}

export function getDayKey(index: number): string {
  return `day_${index}`;
}

export function getDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayWeekdayIndex(date = new Date()): number {
  return (date.getDay() + 6) % 7;
}

export function getWeekdayLabel(dayIndex = getTodayWeekdayIndex()): string {
  return ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][dayIndex] || '今天';
}

export function formatTodayDate(date = new Date()): string {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日 ${getWeekdayLabel(getTodayWeekdayIndex(date))}`;
}

export function getWeekStartIndex(plan: TrainingPlan, weekIndex: number): number {
  return plan.weeks.slice(0, weekIndex).reduce((sum, week) => sum + week.days.length, 0);
}

export function getAvailableDayIndex(plan: TrainingPlan, state: LocalUserState, date = new Date()): number {
  const days = flattenPlanDays(plan);
  const max = Math.max(0, days.length - 1);
  const clamp = (index: number) => Math.max(0, Math.min(Number.isInteger(index) ? index : 0, max));
  const todayKey = getDateKey(date);
  const datedIndex = days.findIndex((_, index) => {
    const dayState = getStoredDayState(state.dayStates, index);
    return (dayState.settled && dayState.settledDate === todayKey) || ((dayState.rest || dayState.missed) && dayState.missedDate === todayKey);
  });
  if (datedIndex >= 0) return clamp(datedIndex);

  const currentWeekIndex = getCurrentTrainingWeekIndex(plan, state);
  const weekStart = getWeekStartIndex(plan, currentWeekIndex);
  const weekEnd = weekStart + (plan.weeks[currentWeekIndex]?.days.length || 1) - 1;
  return clamp(Math.min(weekStart + getTodayWeekdayIndex(date), weekEnd));
}

export function ensureDayState(source: LocalUserState, dayKey: string, taskCount: number): DayState {
  const existing = source.dayStates[dayKey] || {};
  const checked = Array.from({ length: taskCount }, (_, index) => Boolean(existing.checked?.[index]));
  return { ...existing, checked };
}

export function toggleTask(source: LocalUserState, dayKey: string, taskIndex: number, taskCount: number): LocalUserState {
  const dayState = ensureDayState(source, dayKey, taskCount);
  const checked = [...(dayState.checked || [])];
  checked[taskIndex] = !checked[taskIndex];
  return {
    ...source,
    dayStates: {
      ...source.dayStates,
      [dayKey]: { ...dayState, checked, rest: false },
    },
  };
}

export function getAdjustedDay(day: PlanDay, difficulty: LocalUserState['selectedDifficulty']): PlanDay {
  const diff = DIFFICULTIES[difficulty];
  const exercises = getDifficultyExercises(day.exercises, difficulty);
  const baseMinutes = day.minutes || day.exercises.length * 3;
  const minutes = Math.max(3, Math.round(baseMinutes * diff.minutesFactor + diff.bonus * 2));
  return { ...day, minutes, exercises, summary: difficulty === 'standard' ? day.summary : `${diff.label} · ${diff.hint}` };
}

export function settleToday(source: LocalUserState, dayKey: string, day: PlanDay): LocalUserState {
  const taskCount = day.exercises.length;
  const dayState = ensureDayState(source, dayKey, taskCount);
  const checkedCount = dayState.checked?.filter(Boolean).length || 0;
  const difficulty = source.selectedDifficulty;
  const fullDone = checkedCount >= taskCount;
  const score = computeRewardScore(difficulty, checkedCount);
  const materialCount = checkedCount > 0 ? computeMaterialCount(difficulty, fullDone) : 0;
  const rewards = materialCount > 0 ? chooseRewards(difficulty, materialCount, source.currentDayIndex, day) : [];
  const inventory = addCounts({ ...source.inventory }, rewardCounts(rewards, score));
  const warehouseContribution = addCounts({ ...source.warehouseContribution }, warehouseCounts(rewards));
  const discovered = new Set(source.collection.discovered);
  rewards.forEach(item => discovered.add(item));
  return {
    ...source,
    inventory,
    warehouseContribution,
    currentDayIndex: source.currentDayIndex,
    collection: { ...source.collection, discovered: [...discovered] },
    dayStates: {
      ...source.dayStates,
      [dayKey]: {
        ...dayState,
        settled: true,
        done: checkedCount === taskCount,
        rest: false,
        completedAt: Date.now(),
        settledDate: getDateKey(),
        difficulty: source.selectedDifficulty,
        planMode: source.selectedPlanMode,
        rewards,
        minutes: day.minutes,
      },
    },
  };
}

export function restToday(source: LocalUserState, dayKey: string, taskCount: number): LocalUserState {
  return {
    ...source,
    dayStates: {
      ...source.dayStates,
      [dayKey]: {
        ...ensureDayState(source, dayKey, taskCount),
        checked: Array.from({ length: taskCount }, () => false),
        rest: true,
        missed: true,
        settled: true,
        done: false,
        completedAt: Date.now(),
        missedDate: getDateKey(),
      },
    },
  };
}

function getCurrentTrainingWeekIndex(plan: TrainingPlan, state: LocalUserState): number {
  for (let weekIndex = 0; weekIndex < plan.weeks.length; weekIndex += 1) {
    const week = plan.weeks[weekIndex];
    const start = getWeekStartIndex(plan, weekIndex);
    const complete = week.days.every((_, dayIndex) => {
      const dayState = getStoredDayState(state.dayStates, start + dayIndex);
      return Boolean(dayState.settled || dayState.rest || dayState.missed);
    });
    if (!complete) return weekIndex;
  }
  return Math.max(0, plan.weeks.length - 1);
}

function getStoredDayState(states: LocalUserState['dayStates'], index: number): DayState {
  return states[getDayKey(index)] || states[String(index)] || {};
}

function addCounts(target: Record<string, number>, delta: Record<string, number>): Record<string, number> {
  Object.entries(delta).forEach(([key, value]) => {
    target[key] = (target[key] || 0) + (Number(value) || 0);
  });
  return target;
}

export function countSettledDays(state: LocalUserState): number {
  return Object.values(state.dayStates).filter(day => day.settled && !day.rest).length;
}

export function countMinutes(state: LocalUserState): number {
  return Object.values(state.dayStates).reduce((sum, day) => sum + (day.settled && !day.rest ? Number(day.minutes || 0) : 0), 0);
}

export function calcStreak(dayStates: Record<string, DayState>, dayCount: number): number {
  let streak = 0;
  for (let i = dayCount - 1; i >= 0; i -= 1) {
    const state = dayStates[getDayKey(i)] || dayStates[String(i)];
    if (state?.settled) streak += 1;
    else if (!state?.missed) break;
  }
  return streak;
}

export function hasSettledToday(dayStates: Record<string, DayState>, todayKey = getDateKey()): boolean {
  return Object.values(dayStates).some(state => state?.settled && state.settledDate === todayKey);
}

export function canCheckInDay(index: number, plan: TrainingPlan, state: LocalUserState, date = new Date()): boolean {
  if (hasSettledToday(state.dayStates, getDateKey(date))) return false;
  const available = getAvailableDayIndex(plan, state, date);
  const dayState = state.dayStates[getDayKey(index)] || state.dayStates[String(index)];
  return index === available && !dayState?.settled && !dayState?.missed;
}

export function isLockedDay(index: number, plan: TrainingPlan, state: LocalUserState, date = new Date()): boolean {
  return index > getAvailableDayIndex(plan, state, date);
}
