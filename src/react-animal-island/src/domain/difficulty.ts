import type { Difficulty } from './types';

type Ex = [string, string, string?];

export function isWarmupExercise(exercise: Ex): boolean {
  const text = `${exercise?.[0] || ''} ${exercise?.[2] || ''}`;
  return /热身|激活|踏步|慢走|散步|快走|启动|开合跳|高抬腿|扩胸|肩部环绕|手臂画圈/.test(text);
}

export function isCooldownExercise(exercise: Ex): boolean {
  const text = `${exercise?.[0] || ''} ${exercise?.[2] || ''}`;
  return /收尾|拉伸|放松|呼吸|舒展|猫牛|坐姿前屈|鸽子|髋部|小腿|肩颈/.test(text);
}

export function isLowPressureExercise(exercise: Ex): boolean {
  const text = `${exercise?.[0] || ''} ${exercise?.[1] || ''} ${exercise?.[2] || ''}`;
  return /拉伸|放松|激活|靠墙|猫牛|呼吸|踏步|慢走|散步|桥|鸟狗|死虫|臀桥|轻|平板|慢|舒展|热身|肩颈|髋部|小腿/.test(text);
}

export function easeExerciseDetail(detail: string): string {
  let text = String(detail || '');
  text = text
    .replace(/3\s*分钟/g, '60 秒')
    .replace(/2\s*分钟/g, '45 秒')
    .replace(/90\s*秒/g, '30 秒')
    .replace(/60\s*秒/g, '30 秒')
    .replace(/(\d+)\s*秒\s*[x×]\s*(\d+)/g, (_m, s: string) => `${Math.max(8, Math.round(Number(s) * 0.6))} 秒`)
    .replace(/30\s*秒/g, '15 秒')
    .replace(/25\s*秒/g, '12 秒')
    .replace(/20\s*秒/g, '10 秒')
    .replace(/15\s*秒/g, '8 秒')
    .replace(/每侧\s*(\d+)\s*(个|次)/g, (_m, n: string, unit: string) => `每侧 ${Math.max(4, Math.round(Number(n) * 0.55))} ${unit}`)
    .replace(/(\d+)\s*(个|次)\s*[x×]\s*\d+/g, (_m, n: string, unit: string) => `${Math.max(4, Math.round(Number(n) * 0.55))} ${unit}`)
    .replace(/15\s*个/g, '8 个')
    .replace(/12\s*个/g, '6 个')
    .replace(/10\s*个/g, '6 个')
    .replace(/8\s*个/g, '5 个')
    .replace(/12\s*次/g, '6 次')
    .replace(/10\s*次/g, '6 次')
    .replace(/8\s*次/g, '5 次');
  return text || '轻量完成';
}

export function challengeExerciseDetail(detail: string, exercise: Ex): string {
  if (isCooldownExercise(exercise)) return String(detail || '');
  let text = String(detail || '');
  const before = text;
  let matchedCompound = false;
  text = text.replace(/(\d+)\s*秒\s*[x×]\s*(\d+)/g, (_m, s: string, sets: string) => {
    matchedCompound = true;
    return `${Math.min(60, Number(s) + 10)} 秒 x ${Math.min(4, Number(sets) + 1)}`;
  });
  if (matchedCompound) return text || '挑战多 1 组';
  text = text.replace(/(\d+)\s*(个|次)\s*[x×]\s*(\d+)/g, (_m, n: string, unit: string, sets: string) => {
    matchedCompound = true;
    return `${Math.min(40, Number(n) + 4)} ${unit} x ${Math.min(4, Number(sets) + 1)}`;
  });
  if (matchedCompound) return text || '挑战多 1 组';
  text = text.replace(/每侧\s*(\d+)\s*(个|次)/g, (_m, n: string, unit: string) => `每侧 ${Math.min(30, Number(n) + 3)} ${unit}`);
  const rules: Array<[RegExp, string]> = [
    [/30\s*秒/g, '40 秒'],
    [/25\s*秒/g, '35 秒'],
    [/20\s*秒/g, '30 秒'],
    [/15\s*秒/g, '25 秒'],
    [/15\s*个/g, '18 个'],
    [/12\s*个/g, '16 个'],
    [/10\s*个/g, '14 个'],
    [/8\s*个/g, '12 个'],
    [/12\s*次/g, '16 次'],
    [/10\s*次/g, '14 次'],
    [/8\s*次/g, '12 次'],
  ];
  rules.forEach(([pattern, replacement]) => { text = text.replace(pattern, replacement); });
  if (before === text && !isWarmupExercise(exercise)) text = `${text} · 多 1 组`;
  return text || '挑战多 1 组';
}

export function tuneExercise(exercise: Ex, difficulty: 'easy' | 'challenge'): Ex {
  const next: Ex = [exercise[0], exercise[1], exercise[2]];
  next[1] = difficulty === 'easy' ? easeExerciseDetail(next[1]) : challengeExerciseDetail(next[1], exercise);
  next[2] = difficulty === 'easy' ? `轻松 · ${next[2] || '保连续'}` : `挑战 · ${next[2] || '小幅加量'}`;
  return next;
}

export function buildEasyExercises(exercises: Ex[]): Ex[] {
  if (!exercises.length) return [];
  if (exercises.length <= 2) return exercises.map(ex => tuneExercise(ex, 'easy'));
  const lowPressure = exercises.filter(isLowPressureExercise);
  const warmup = exercises.find(isWarmupExercise);
  const cooldown = exercises.find(isCooldownExercise);
  const picked: Ex[] = [];
  const add = (ex?: Ex) => { if (ex && !picked.includes(ex)) picked.push(ex); };
  add(warmup);
  add(cooldown);
  if (lowPressure.length) {
    lowPressure.slice(0, 2).forEach(add);
  }
  while (picked.length < 2 && picked.length < exercises.length) {
    add(exercises.find(ex => !picked.includes(ex)));
  }
  const trimmed = picked.slice(0, Math.min(3, exercises.length));
  return trimmed.sort((a, b) => exercises.indexOf(a) - exercises.indexOf(b)).map(ex => tuneExercise(ex, 'easy'));
}

export function getDifficultyExercises(exercises: Ex[], difficulty: Difficulty): Ex[] {
  const normalized: Ex[] = (exercises || []).map(ex => [ex[0], ex[1], ex[2]]);
  if (difficulty === 'standard') return normalized;
  if (difficulty === 'easy') return buildEasyExercises(normalized);
  if (difficulty === 'challenge') return normalized.map(ex => tuneExercise(ex, 'challenge'));
  return normalized;
}
