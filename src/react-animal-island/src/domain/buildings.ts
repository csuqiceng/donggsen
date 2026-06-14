export interface BuildStage {
  name: string;
  stage: string;
  pct: number;
}

export function diffBuildStages(
  before: Record<string, BuildStage>,
  after: Record<string, BuildStage>,
): Array<{ id: string; name: string; from: string; to: string }> {
  return Object.entries(after)
    .filter(([id, next]) => {
      const prev = before[id];
      return prev && (prev.stage !== next.stage || (prev.pct < 100 && next.pct === 100));
    })
    .map(([id, next]) => ({ id, name: next.name, from: before[id].stage, to: next.stage }));
}

export function snapshotBuildStages(stages: Record<string, BuildStage>): Record<string, BuildStage> {
  return Object.fromEntries(Object.entries(stages).map(([id, value]) => [id, { ...value }]));
}
