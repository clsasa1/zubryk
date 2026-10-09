import { isPass, LEVEL_LEN, type Best } from "./score";
import type { Level } from "./content";

export type PrizeTier = "small" | "medium" | "large";

export type Prize = {
  id: string;
  /** Сума ў беларускіх рублях. */
  amount: number;
  tier: PrizeTier;
  kind: "first" | "grade";
  grade: number | null;
  levelIds: string[];
};

/**
 * Прызы будуюцца з самых узроўняў: першы тур дае маленькі прыз,
 * кожны закрыты клас — наступны па памеры. Калі ў класе няма ўзроўняў,
 * прыз для яго проста не ствараецца.
 */
export function buildPrizes(levels: Level[]): Prize[] {
  const grades = [...new Set(levels.map((level) => level.grade))].sort((a, b) => a - b);
  const list: Prize[] = [];
  const first = levels[0];
  if (first) {
    list.push({
      id: "first",
      amount: 5,
      tier: "small",
      kind: "first",
      grade: null,
      levelIds: [first.id],
    });
  }
  grades.forEach((grade, i) => {
    list.push({
      id: `grade-${grade}`,
      amount: 10 + i * 5,
      tier: i < 1 ? "small" : i < 3 ? "medium" : "large",
      kind: "grade",
      grade,
      levelIds: levels.filter((level) => level.grade === grade).map((level) => level.id),
    });
  });
  return list;
}

export type PrizeProgress = {
  done: number;
  total: number;
  earned: boolean;
  pct: number;
};

/** Прыз зароблены, каб усе яго ўзроўні прайдзены. */
export function prizeProgress(
  prize: Prize,
  best: Record<string, Best>,
  lengths: Record<string, number>,
): PrizeProgress {
  const total = prize.levelIds.length;
  const done = prize.levelIds.filter((id) => isPass(best[id], lengths[id] ?? LEVEL_LEN)).length;
  return {
    done,
    total,
    earned: total > 0 && done === total,
    pct: total ? Math.round((done / total) * 100) : 0,
  };
}

export function prizesTotal(prizes: Prize[]): number {
  return prizes.reduce((sum, prize) => sum + prize.amount, 0);
}

export function prizesEarnedTotal(
  prizes: Prize[],
  best: Record<string, Best>,
  lengths: Record<string, number>,
): number {
  return prizes.reduce(
    (sum, prize) => (prizeProgress(prize, best, lengths).earned ? sum + prize.amount : sum),
    0,
  );
}
