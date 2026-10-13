/**
 * Агульны рэйтынг: маленькае сервернае сховішча ў JSON-файле.
 * Файл ляжыць па-за каталогам дэплою (ZUBRYK_DATA_DIR, па змаўчанні /var/lib/zubryk),
 * таму zero-downtime дэплой яго не кранае. Запіс атамарны: tmp + rename.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { LEVELS } from "../../src/game/content";
import { RU_LEVELS } from "../../src/game/content-ru";
import { better, isPass, type Best } from "../../src/game/score";

export type CourseId = "be" | "ru";
export const COURSES: CourseId[] = ["be", "ru"];

export type StoredPlayer = {
  id: string;
  name: string;
  age: number;
  createdAt: string;
  lastSeen: string;
  best: Record<CourseId, Record<string, Best>>;
};

type Db = { version: 1; players: Record<string, StoredPlayer> };

export const MAX_PLAYERS = 5000;

const LENS: Record<CourseId, Record<string, number>> = { be: {}, ru: {} };
for (const lvl of LEVELS) LENS.be[lvl.id] = lvl.items.length;
for (const lvl of RU_LEVELS) LENS.ru[lvl.id] = lvl.items.length;
export const LEVEL_COUNT: Record<CourseId, number> = { be: LEVELS.length, ru: RU_LEVELS.length };

function dataDir(): string {
  const env = process.env.ZUBRYK_DATA_DIR?.trim();
  if (env) return env;
  return process.env.NODE_ENV === "production" ? "/var/lib/zubryk" : join(process.cwd(), ".data");
}

const g = globalThis as typeof globalThis & { __zbDb__?: Db; __zbTimer__?: ReturnType<typeof setTimeout> };

function file(): string {
  return join(dataDir(), "rating.json");
}

export function db(): Db {
  if (g.__zbDb__) return g.__zbDb__;
  let loaded: Db = { version: 1, players: {} };
  try {
    if (existsSync(file())) {
      const raw = JSON.parse(readFileSync(file(), "utf8")) as Db;
      if (raw && typeof raw.players === "object") loaded = raw;
    }
  } catch (error) {
    console.error("[zb] cannot read rating.json, starting empty in memory (file kept)", error);
    // Не перазапісваем пашкоджаны файл: захоўваем копію.
    try {
      renameSync(file(), `${file()}.broken-${Date.now()}`);
    } catch {
      /* ignore */
    }
  }
  g.__zbDb__ = loaded;
  return loaded;
}

function flush() {
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  const tmp = `${file()}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(db()), { mode: 0o600 });
  renameSync(tmp, file());
}

// Пры спыненні працэсу (рэстарт пры дэплоі) дапісваем адкладзенае.
if (!(globalThis as { __zbExitHook__?: boolean }).__zbExitHook__) {
  (globalThis as { __zbExitHook__?: boolean }).__zbExitHook__ = true;
  process.once("exit", () => {
    if (g.__zbTimer__ && g.__zbDb__) {
      try {
        flush();
      } catch {
        /* ignore */
      }
    }
  });
}

export function save() {
  if (g.__zbTimer__) return;
  g.__zbTimer__ = setTimeout(() => {
    g.__zbTimer__ = undefined;
    try {
      flush();
    } catch (error) {
      console.error("[zb] save failed", error);
    }
  }, 300);
}

// ---------- validation ----------

const ID_RE = /^[a-f0-9-]{16,40}$/i;
export function validId(id: unknown): id is string {
  return typeof id === "string" && ID_RE.test(id);
}

/** Імя: без кіруючых сімвалаў і HTML-дужак, 1–30 знакаў. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/[<>&"'`]/g, "")
    .trim()
    .replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 30) return null;
  return name;
}

export function cleanAge(raw: unknown): number | null {
  const age = typeof raw === "string" ? Number(raw) : raw;
  if (typeof age !== "number" || !Number.isInteger(age) || age < 5 || age > 99) return null;
  return age;
}

function int(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;
}

/** Пакідае толькі вядомыя ўзроўні і праўдападобныя лічбы. */
export function cleanBest(course: CourseId, raw: unknown): Record<string, Best> {
  const out: Record<string, Best> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, row] of Object.entries(raw as Record<string, unknown>)) {
    const len = LENS[course][id];
    if (!len || !row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const total = int(r.total, 0, len);
    const correct = int(r.correct, 0, len);
    const points = int(r.points, 0, len * 200);
    const ms = int(r.ms, 0, 3_600_000);
    if (total === null || correct === null || points === null || ms === null || correct > total) continue;
    out[id] = { total, correct, points, ms };
  }
  return out;
}

export function mergeBest(player: StoredPlayer, course: CourseId, incoming: Record<string, Best>): boolean {
  const mine = (player.best[course] ??= {});
  let changed = false;
  for (const [id, row] of Object.entries(incoming)) {
    if (better(row, mine[id])) {
      mine[id] = row;
      changed = true;
    }
  }
  return changed;
}

export function summary(player: StoredPlayer, course: CourseId) {
  const rows = Object.entries(player.best[course] ?? {});
  const points = rows.reduce((sum, [, row]) => sum + row.points, 0);
  const correct = rows.reduce((sum, [, row]) => sum + row.correct, 0);
  const total = rows.reduce((sum, [, row]) => sum + row.total, 0);
  const ms = rows.reduce((sum, [, row]) => sum + row.ms, 0);
  const passed = rows.filter(([id, row]) => isPass(row, LENS[course][id])).length;
  return { points, correct, passed, avg: total ? ms / total : 0 };
}

export function ranking(course: CourseId) {
  return Object.values(db().players)
    .map((p) => ({ p, ...summary(p, course) }))
    .filter((row) => row.points > 0)
    .sort((a, b) => b.points - a.points || a.avg - b.avg || b.correct - a.correct || a.p.createdAt.localeCompare(b.p.createdAt));
}
