import { getAdjustedDay, getDayKey, getWeekStartIndex, getWeekdayLabel } from './training';
import type { DayState, Difficulty, TrainingPlan } from './types';

type Exercise = [string, string, string?];

export function normalizeExerciseCategory(exercise: Exercise): string {
  const tag = String(exercise?.[2] || '').trim();
  const name = String(exercise?.[0] || '').trim();
  const text = `${name} ${tag}`;
  if (/热身|踏步|慢走|散步|开合跳|高抬腿|扩胸|肩部环绕|手臂画圈/.test(text)) return '热身入口';
  if (/收尾|放松|拉伸|猫牛|坐姿前屈|鸽子|髋部|小腿|肩颈/.test(text)) return '收尾放松';
  if (/腿|下肢|单腿|深蹲|弓步|静蹲/.test(text)) return '腿部';
  if (/上身|俯卧撑|推/.test(text)) return '上身';
  if (/核心|腹|平板|侧桥|死虫|鸟狗|俄罗斯|自行车|登山者|抬腿/.test(text)) return '核心';
  if (/后侧|臀|超人/.test(text)) return '后侧';
  return tag || String(exercise?.[0] || '其他');
}

export interface WeeklyInsights {
  bestDay: { label: string; detail: string };
  weakest: { label: string; detail: string };
  nextAdvice: { label: string; detail: string };
}

export function getWeeklyReviewInsights(
  plan: TrainingPlan,
  weekIndex: number,
  dayStates: Record<string, DayState>,
  selectedDifficulty: Difficulty,
): WeeklyInsights {
  const week = plan.weeks[weekIndex];
  if (!week) return { bestDay: { label: '还没有记录', detail: '完成一次后会自动分析' }, weakest: { label: '暂无', detail: '记录更多动作后会出现趋势' }, nextAdvice: { label: '下周先守住出现，不急着加量', detail: '0% 完成率' } };
  const weekStart = getWeekStartIndex(plan, weekIndex);
  const dayStats: Array<{ label: string; checked: number; total: number; settled: boolean; missed: boolean; pct: number }> = [];
  const categoryStats: Record<string, { checked: number; total: number }> = {};
  let handledDays = 0;
  let totalChecked = 0;
  let totalExercises = 0;

  week.days.forEach((day, dayInWeek) => {
    const state = dayStates[getDayKey(weekStart + dayInWeek)] || {};
    if (!state.settled && !state.missed) return;
    handledDays += 1;
    const variantDay = getAdjustedDay(day, state.difficulty || selectedDifficulty);
    const exercises = (variantDay.exercises || []) as Exercise[];
    const checkedArr = Array.isArray(state.checked) ? state.checked : [];
    const checkedCount = state.settled ? checkedArr.filter(Boolean).length : 0;
    totalChecked += checkedCount;
    totalExercises += exercises.length;
    dayStats.push({
      label: `${getWeekdayLabel(dayInWeek)} · ${day.title}`,
      checked: checkedCount,
      total: exercises.length,
      settled: !!state.settled,
      missed: !!state.missed,
      pct: exercises.length ? checkedCount / exercises.length : 0,
    });
    exercises.forEach((exercise, index) => {
      const category = normalizeExerciseCategory(exercise);
      if (!categoryStats[category]) categoryStats[category] = { checked: 0, total: 0 };
      categoryStats[category].total += 1;
      if (state.settled && checkedArr[index]) categoryStats[category].checked += 1;
    });
  });

  const best = dayStats.filter(item => item.settled).sort((a, b) => b.pct - a.pct || b.checked - a.checked)[0];
  const weakestEntry = Object.entries(categoryStats)
    .filter(([, stat]) => stat.total > 0)
    .map(([name, stat]) => ({ name, ...stat, pct: stat.checked / stat.total }))
    .sort((a, b) => a.pct - b.pct || b.total - a.total)[0];
  const completionRate = totalExercises ? totalChecked / totalExercises : 0;

  const bestDay = best ? { label: best.label, detail: `${best.checked}/${best.total} 个动作` } : { label: '还没有记录', detail: '完成一次后会自动分析' };
  const weakest = weakestEntry ? { label: weakestEntry.name, detail: `${weakestEntry.checked}/${weakestEntry.total} 次完成` } : { label: '暂无', detail: '记录更多动作后会出现趋势' };

  let advice = '下周先守住出现，不急着加量';
  if (handledDays >= week.days.length && completionRate >= 0.85) advice = '下周可以尝试多一次挑战难度';
  else if (weakestEntry && weakestEntry.pct < 0.5) advice = `下周把“${weakestEntry.name}”降一点量，先做完`;
  else if (completionRate >= 0.65) advice = '下周保持标准难度，优先稳定完成';

  return { bestDay, weakest, nextAdvice: { label: advice, detail: `${Math.round(completionRate * 100)}% 完成率` } };
}
