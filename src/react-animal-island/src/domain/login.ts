// 每日登录彩蛋：连续登录天数 + 里程碑奖励
// 里程碑命中 3/7/14/30 天时发放奖励，由 UI 弹出彩蛋。

const MILESTONES = [3, 7, 14, 30] as const;

// 各里程碑奖励（amount 随天数递增）
const REWARDS: Record<number, { item: string; amount: number; name: string }> = {
  3: { item: 'bells', amount: 50, name: '铃钱 50' },
  7: { item: 'bells', amount: 150, name: '铃钱 150' },
  14: { item: 'starFragment', amount: 1, name: '星星碎片 1' },
  30: { item: 'nookMilesTicket', amount: 1, name: '里数券 1' },
};

function diffDays(prev: string, today: string): number {
  const [py, pm, pd] = prev.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(py, pm - 1, pd)) / 86400000);
}

export interface LoginStreakInput {
  lastLoginDate?: string;
  loginStreak: number;
  todayKey: string;
}

export interface LoginStreakResult {
  lastLoginDate: string;
  loginStreak: number;
  justLoggedIn: boolean;
  milestone: number | null;
}

export function computeLoginStreak(input: LoginStreakInput): LoginStreakResult {
  const { todayKey } = input;
  const prev = input.lastLoginDate;
  let streak: number;
  if (!prev) {
    streak = 1;
  } else if (prev === todayKey) {
    streak = input.loginStreak || 1;
  } else {
    streak = diffDays(prev, todayKey) === 1 ? (input.loginStreak || 0) + 1 : 1;
  }
  const justLoggedIn = prev !== todayKey;
  const milestone = justLoggedIn && (MILESTONES as readonly number[]).includes(streak) ? streak : null;
  return { lastLoginDate: todayKey, loginStreak: streak, justLoggedIn, milestone };
}

export function getLoginReward(milestone: number): { item: string; amount: number; name: string } | null {
  return REWARDS[milestone] || null;
}
