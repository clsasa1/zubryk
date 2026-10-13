/**
 * Ціхая сінхранізацыя з агульным рэйтынгам. Гульня працуе і без сервера:
 * усё спачатку ляжыць у localStorage, а сюды мы толькі ставім адзнаку «трэба адправіць».
 * Калі сервер недаступны — паспрабуем пазней (таймер, вяртанне анлайн, наступны візіт).
 */
import type { Best } from "./score";

export type SyncCourse = "be" | "ru";
export type SyncProfile = { id: string; name: string; age: number };

const QUEUE_KEY = "zubryk-sync-v1";
type Queue = { player?: boolean; courses?: Partial<Record<SyncCourse, boolean>> };

function apiBase(): string {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  return `${base}api/zb/`;
}

function readQueue(): Queue {
  try {
    return (JSON.parse(localStorage.getItem(QUEUE_KEY) || "{}") as Queue) || {};
  } catch {
    return {};
  }
}
function writeQueue(q: Queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {
    /* ignore */
  }
}

export function newPlayerId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function markPlayer() {
  const q = readQueue();
  q.player = true;
  writeQueue(q);
  schedule();
}
export function markCourse(course: SyncCourse) {
  const q = readQueue();
  q.courses = { ...q.courses, [course]: true };
  writeQueue(q);
  schedule();
}

type Source = { profile: () => SyncProfile | null; best: (course: SyncCourse) => Record<string, Best> };
let source: Source | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let failures = 0;

async function post(path: string, data: unknown): Promise<Response> {
  return fetch(apiBase() + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
    keepalive: true,
  });
}

async function flush() {
  timer = null;
  if (running || !source) return;
  const profile = source.profile();
  if (!profile) return;
  const q = readQueue();
  if (!q.player && !Object.values(q.courses ?? {}).some(Boolean)) return;
  running = true;
  try {
    // Рэгістрацыю адпраўляем заўсёды першай: прагрэс без гульца сервер не прыме.
    if (q.player || Object.values(q.courses ?? {}).some(Boolean)) {
      const res = await post("player", { id: profile.id, name: profile.name, age: profile.age });
      if (!res.ok) throw new Error(`player ${res.status}`);
      const q2 = readQueue();
      delete q2.player;
      writeQueue(q2);
    }
    for (const course of ["be", "ru"] as SyncCourse[]) {
      if (!readQueue().courses?.[course]) continue;
      const res = await post("progress", { id: profile.id, course, best: source.best(course) });
      if (!res.ok) throw new Error(`progress ${res.status}`);
      const q3 = readQueue();
      if (q3.courses) delete q3.courses[course];
      writeQueue(q3);
    }
    failures = 0;
  } catch {
    failures += 1;
    schedule(Math.min(5 * 60_000, 5_000 * 2 ** Math.min(failures, 6)));
  } finally {
    running = false;
  }
}

export function schedule(delay = 1500) {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), delay);
}

export function startSync(src: Source) {
  source = src;
  if (typeof window === "undefined") return;
  window.addEventListener("online", () => schedule(500));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
  schedule(800);
}

export type RatingRow = { place: number; name: string; points: number; passed: number; me?: boolean };
export type Rating = { levels: number; players: number; top: RatingRow[]; me: RatingRow | null };

export async function fetchRating(course: SyncCourse, id?: string): Promise<Rating> {
  const qs = new URLSearchParams({ course });
  if (id) qs.set("me", id);
  const res = await fetch(`${apiBase()}rating?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`rating ${res.status}`);
  return (await res.json()) as Rating;
}
