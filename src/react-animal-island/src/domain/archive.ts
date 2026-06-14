import { AVATARS, DIFFICULTIES, ITEMS, PLAN_MODES } from './config';
import { flattenPlanDays, getAdjustedDay, getDayKey } from './training';
import type { DayState, LocalUserState, PlanDay, TrainingPlan } from './types';

type ArchiveView = 'today' | 'island' | 'bag' | 'collection' | 'gift' | 'coop' | string;

export interface ArchivePayload {
  version: 3;
  app: 'fitness-island';
  exportedAt: string;
  username: string;
  userAvatar: string;
  userMessage: string;
  currentDayIndex: number;
  dayStates: Record<string, DayState>;
  inventory: Record<string, number>;
  warehouseContribution: Record<string, number>;
  collection: LocalUserState['collection'];
  giftClaims: LocalUserState['giftClaims'];
  sharedGiftClaims: Record<string, unknown>;
  wishList: string[];
  wishFulfillments: Record<string, unknown>;
  sharedDecor: Record<string, unknown>;
  selectedDifficulty: LocalUserState['selectedDifficulty'];
  selectedPlanMode: LocalUserState['selectedPlanMode'];
  activeView: ArchiveView;
}

export interface ArchiveRow {
  index: number;
  weekIndex: number;
  dayInWeek: number;
  title: string;
  theme: string;
  minutes: number;
  status: 'done' | 'appeared' | 'rest' | 'missed' | 'pending';
}

export function createArchivePayload(state: LocalUserState, activeView: ArchiveView = 'today'): ArchivePayload {
  return {
    version: 3,
    app: 'fitness-island',
    exportedAt: new Date().toISOString(),
    username: state.username,
    userAvatar: state.avatar,
    userMessage: '',
    currentDayIndex: state.currentDayIndex,
    dayStates: cloneDayStates(state.dayStates),
    inventory: cleanCounts(state.inventory),
    warehouseContribution: cleanCounts(state.warehouseContribution),
    collection: {
      discovered: [...(state.collection.discovered || [])],
      completed: [...(state.collection.completed || [])],
    },
    giftClaims: { ...state.giftClaims },
    sharedGiftClaims: {},
    wishList: [],
    wishFulfillments: {},
    sharedDecor: {},
    selectedDifficulty: state.selectedDifficulty,
    selectedPlanMode: state.selectedPlanMode,
    activeView,
  };
}

export function applyArchivePayload(base: LocalUserState, payload: unknown, dayCount: number): LocalUserState {
  if (!payload || typeof payload !== 'object') throw new Error('存档格式不正确');
  const saved = payload as Partial<ArchivePayload> & Record<string, unknown>;
  const maxIndex = Math.max(0, dayCount - 1);
  const requestedIndex = Number.isInteger(saved.currentDayIndex) ? Number(saved.currentDayIndex) : base.currentDayIndex;
  const avatar = typeof saved.userAvatar === 'string' && AVATARS.some(item => item.id === saved.userAvatar) ? saved.userAvatar : base.avatar;

  return {
    ...base,
    avatar,
    currentDayIndex: Math.min(Math.max(0, requestedIndex), maxIndex),
    selectedDifficulty: isDifficulty(saved.selectedDifficulty) ? saved.selectedDifficulty : base.selectedDifficulty,
    selectedPlanMode: isPlanMode(saved.selectedPlanMode) ? saved.selectedPlanMode : base.selectedPlanMode,
    dayStates: normalizeDayStates(saved.dayStates),
    inventory: cleanCounts(saved.inventory),
    warehouseContribution: cleanCounts(saved.warehouseContribution),
    collection: {
      discovered: normalizeStringList((saved.collection as LocalUserState['collection'] | undefined)?.discovered, ['resident_services_tent']),
      completed: normalizeStringList((saved.collection as LocalUserState['collection'] | undefined)?.completed, []),
    },
    giftClaims: saved.giftClaims && typeof saved.giftClaims === 'object' ? saved.giftClaims as LocalUserState['giftClaims'] : {},
  };
}

export function createTrainingExportText(plan: TrainingPlan, state: LocalUserState): string {
  const lines = ['# 动森训练岛 - Agent 训练数据', ''];
  plan.weeks.forEach((week, weekIndex) => {
    lines.push(`## 第 ${weekIndex + 1} 周 · ${week.theme}`);
    if (week.signal) lines.push(`信号: ${week.signal}`);
    week.days.forEach((day, dayInWeek) => {
      const globalIndex = getGlobalIndex(plan, weekIndex, dayInWeek);
      const dayState = state.dayStates[getDayKey(globalIndex)] || {};
      const adjusted = getAdjustedDay(day, dayState.difficulty || state.selectedDifficulty);
      const checked = normalizeChecked(dayState.checked);
      const checkedCount = checked.filter(Boolean).length;
      const total = adjusted.exercises.length;
      const status = dayState.settled ? (checkedCount >= total ? '✓ 完成' : `◐ ${checkedCount}/${total}`) : dayState.rest ? '休息' : '○ 未完成';
      lines.push(`- Day ${dayInWeek + 1} ${day.title}: ${status} (${adjusted.minutes || day.minutes || 0}min)`);
      adjusted.exercises.forEach((exercise, exerciseIndex) => {
        lines.push(`  ${checked[exerciseIndex] ? '✓' : '○'} ${exercise[0]} | ${exercise[1]} | ${exercise[2] || ''}`);
      });
    });
    lines.push('');
  });
  return lines.join('\n');
}

export function createArchiveRows(plan: TrainingPlan, state: LocalUserState): ArchiveRow[] {
  const rows: ArchiveRow[] = [];
  plan.weeks.forEach((week, weekIndex) => {
    week.days.forEach((day, dayInWeek) => {
      const index = getGlobalIndex(plan, weekIndex, dayInWeek);
      const dayState = state.dayStates[getDayKey(index)] || {};
      const adjusted = getAdjustedDay(day, dayState.difficulty || state.selectedDifficulty);
      const checked = normalizeChecked(dayState.checked);
      const checkedCount = checked.filter(Boolean).length;
      const total = adjusted.exercises.length;
      let status: ArchiveRow['status'] = 'pending';
      if (dayState.settled && checkedCount >= total) status = 'done';
      else if (dayState.settled) status = 'appeared';
      else if (dayState.rest) status = 'rest';
      else if (index < state.currentDayIndex) status = 'missed';
      rows.push({
        index,
        weekIndex,
        dayInWeek,
        title: day.title,
        theme: week.theme,
        minutes: adjusted.minutes || day.minutes || 0,
        status,
      });
    });
  });
  return rows;
}

export function createDayDetail(day: PlanDay, dayState: DayState, state: LocalUserState) {
  const adjusted = getAdjustedDay(day, dayState.difficulty || state.selectedDifficulty);
  const checked = normalizeChecked(dayState.checked);
  const checkedCount = checked.filter(Boolean).length;
  const total = adjusted.exercises.length;
  let status = '未记录';
  if (dayState.rest) status = '今天休息';
  else if (dayState.settled && checkedCount >= total) status = '完整完成';
  else if (dayState.settled) status = `今天到这 ${checkedCount}/${total}`;
  const difficulty = DIFFICULTIES[dayState.difficulty || state.selectedDifficulty];
  const planMode = PLAN_MODES[dayState.planMode || state.selectedPlanMode];
  const rewards = (dayState.rewards || []).map(key => ITEMS[key]?.name || key).join('、') || '无';
  return {
    title: day.title,
    lines: [
      `状态：${status}`,
      `难度：${difficulty.label}`,
      `路线：${planMode.label}`,
      `分钟：${dayState.minutes || adjusted.minutes || 0}`,
      `奖励：${rewards}`,
      ...adjusted.exercises.map((exercise, index) => `${checked[index] ? '✓' : '○'} ${exercise[0]} · ${exercise[1]}`),
    ],
  };
}

export function getArchiveActiveView(payload: unknown): ArchiveView {
  if (payload && typeof payload === 'object' && typeof (payload as { activeView?: unknown }).activeView === 'string') {
    return (payload as { activeView: string }).activeView;
  }
  return 'today';
}

export function getDayByArchiveIndex(plan: TrainingPlan, index: number) {
  return flattenPlanDays(plan)[index] || null;
}

function cloneDayStates(dayStates: LocalUserState['dayStates']) {
  const out: Record<string, DayState> = {};
  Object.entries(dayStates || {}).forEach(([key, value]) => {
    out[key] = {
      ...value,
      checked: normalizeChecked(value.checked),
      rewards: [...(value.rewards || [])],
    };
  });
  return out;
}

function normalizeDayStates(value: unknown) {
  const out: Record<string, DayState> = {};
  if (!value || typeof value !== 'object') return out;
  Object.entries(value as Record<string, DayState>).forEach(([key, item]) => {
    if (!item || typeof item !== 'object') return;
    out[key] = {
      checked: normalizeChecked(item.checked),
      settled: Boolean(item.settled),
      rest: Boolean(item.rest || (item as DayState & { missed?: boolean }).missed),
      difficulty: isDifficulty(item.difficulty) ? item.difficulty : undefined,
      planMode: isPlanMode(item.planMode) ? item.planMode : undefined,
      rewards: Array.isArray(item.rewards) ? item.rewards.map(String) : [],
      minutes: Number(item.minutes || 0) || undefined,
      completedAt: Number(item.completedAt || (item as DayState & { settledAt?: number }).settledAt || 0) || undefined,
    };
  });
  return out;
}

function normalizeChecked(value: unknown): boolean[] {
  if (Array.isArray(value)) return value.map(Boolean);
  return [];
}

function cleanCounts(value: unknown) {
  const out: Record<string, number> = {};
  if (!value || typeof value !== 'object') return out;
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    if (!ITEMS[key]) return;
    const amount = Number(raw);
    if (Number.isFinite(amount) && amount > 0) out[key] = amount;
  });
  return out;
}

function normalizeStringList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  return value.map(String).filter(Boolean);
}

function isDifficulty(value: unknown): value is LocalUserState['selectedDifficulty'] {
  return value === 'easy' || value === 'standard' || value === 'challenge';
}

function isPlanMode(value: unknown): value is LocalUserState['selectedPlanMode'] {
  return value === 'recovery' || value === 'standard' || value === 'power';
}

function getGlobalIndex(plan: TrainingPlan, weekIndex: number, dayInWeek: number) {
  return plan.weeks.slice(0, weekIndex).reduce((sum, week) => sum + week.days.length, 0) + dayInWeek;
}
