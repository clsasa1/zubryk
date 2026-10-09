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

/** Сколько верных ответов нужно, чтобы пройти уровень длиной len (та же доля, что 5 из 6). */
export function needCorrect(len: number): number {
  return Math.max(1, Math.round((len * NEED_CORRECT) / LEVEL_LEN));
}

export function pointsFor(ms: number): number {
  const sec = ms / 1000;
  const speed = Math.max(0, Math.round(80 - sec * 4));
  return 100 + speed;
}

export function isPass(row: Best | undefined, len: number = LEVEL_LEN): boolean {
  return !!row && row.total >= len && row.correct >= needCorrect(len);
}

/** lengths — длина каждого уровня по id; нужна, потому что в уровне разное число заданий. */
export function totals(player: Player, lengths?: Record<string, number>) {
  const rows = Object.entries(player.best);
  const points = rows.reduce((sum, [, row]) => sum + row.points, 0);
  const correct = rows.reduce((sum, [, row]) => sum + row.correct, 0);
  const total = rows.reduce((sum, [, row]) => sum + row.total, 0);
  const ms = rows.reduce((sum, [, row]) => sum + row.ms, 0);
  const passed = rows.filter(([id, row]) => isPass(row, lengths?.[id] ?? LEVEL_LEN)).length;
  return { points, correct, total, ms, avg: total ? ms / total : 0, passed };
}

export function standings(players: Player[], lengths?: Record<string, number>) {
  return players
    .map((player) => ({ player, ...totals(player, lengths) }))
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
