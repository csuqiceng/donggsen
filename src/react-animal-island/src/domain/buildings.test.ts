import { describe, expect, it } from 'vitest';
import { diffBuildStages, type BuildStage } from './buildings';

describe('建筑阶段对比', () => {
  it('找出阶段变化或新建成的建筑', () => {
    const before: Record<string, BuildStage> = {
      storage: { name: '收纳仓库', stage: '建设中', pct: 50 },
      museum: { name: '博物馆', stage: '搭架', pct: 80 },
    };
    const after: Record<string, BuildStage> = {
      storage: { name: '收纳仓库', stage: '建成', pct: 100 },
      museum: { name: '博物馆', stage: '搭架', pct: 80 },
    };
    expect(diffBuildStages(before, after)).toEqual([{ id: 'storage', name: '收纳仓库', from: '建设中', to: '建成' }]);
  });

  it('阶段与百分比均无变化返回空', () => {
    const snap: Record<string, BuildStage> = { storage: { name: '收纳仓库', stage: '建设中', pct: 50 } };
    expect(diffBuildStages(snap, snap)).toEqual([]);
  });
});
