export type Best = {
  points: number;
  correct: number;
  total: number;
  ms: number;
};

export type Player = {
  name: string;
  best: Record<string, Best>;
};

export const NEED_CORRECT = 5;
export const LEVEL_LEN = 6;

export function pointsFor(ms: number): number {
  const sec = ms / 1000;
  const speed = Math.max(0, Math.round(80 - sec * 4));
  return 100 + speed;
}

export function isPass(row: Best | undefined): boolean {
  return !!row && row.total >= LEVEL_LEN && row.correct >= NEED_CORRECT;
}

export function totals(player: Player) {
  const rows = Object.values(player.best);
  const points = rows.reduce((sum, row) => sum + row.points, 0);
  const correct = rows.reduce((sum, row) => sum + row.correct, 0);
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const ms = rows.reduce((sum, row) => sum + row.ms, 0);
  const passed = rows.filter((row) => isPass(row)).length;
  return { points, correct, total, ms, avg: total ? ms / total : 0, passed };
}

export function standings(players: Player[]) {
  return players
    .map((player) => ({ player, ...totals(player) }))
    .sort((a, b) => b.points - a.points || a.avg - b.avg || b.correct - a.correct);
}

export function clock(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(sec / 60);
  return `${min}:${String(sec % 60).padStart(2, "0")}`;
}

export function better(next: Best, prev: Best | undefined): boolean {
  if (!prev) return true;
  if (next.points !== prev.points) return next.points > prev.points;
  return next.ms < prev.ms;
}
