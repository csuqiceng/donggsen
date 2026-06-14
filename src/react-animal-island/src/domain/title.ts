export interface TitleContext {
  settledDays: number;
  challengeFull: number;
  warehouseTotal: number;
  discovered: string[];
}

export function getUserTitle(ctx: TitleContext): string {
  if (ctx.warehouseTotal >= 20) return '建设代表';
  if (ctx.discovered.includes('same_day_checkin')) return '同日岛民';
  if (ctx.challengeFull >= 3) return '挑战岛民';
  if (ctx.settledDays >= 7) return '常驻岛民';
  if (ctx.settledDays >= 3) return '上岛新星';
  return '新岛民';
}
