/**
 * API агульнага рэйтынгу. Шлях працуе і з прэфіксам /zubryk (VPS), і без яго.
 *   POST /api/zb/player    {id, name, age}            — рэгістрацыя / абнаўленне
 *   POST /api/zb/progress  {id, course, best}          — лепшыя вынікі па ўзроўнях
 *   GET  /api/zb/rating?course=be&me=<id>              — топ (толькі імя і прагрэс)
 *   GET  /api/zb/admin?k=<ZUBRYK_ADMIN_TOKEN>          — поўная табліца для ўладальніка
 */
import { timingSafeEqual } from "node:crypto";
import {
  COURSES,
  LEVEL_COUNT,
  MAX_PLAYERS,
  cleanAge,
  cleanBest,
  cleanName,
  db,
  mergeBest,
  ranking,
  save,
  summary,
  validId,
  type CourseId,
} from "../zb/store";

interface ZbEvent {
  url: URL;
  req: Request | { method: string; headers: Headers; text?: () => Promise<string> };
}

const PREFIX_RE = /^(?:\/zubryk)?\/api\/zb\/([a-z]+)\/?$/;
const MAX_BODY = 32 * 1024;

// ---------- rate limit (у памяці, на IP) ----------
type Bucket = { n: number; reset: number };
const buckets = new Map<string, Bucket>();
function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    if (buckets.size > 20000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return false;
  }
  b.n += 1;
  return b.n > max;
}

function clientIp(event: ZbEvent): string {
  const h = event.req.headers;
  return (h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0] || "local").trim();
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

async function body(event: ZbEvent): Promise<Record<string, unknown> | null> {
  const len = Number(event.req.headers.get("content-length") || 0);
  if (len > MAX_BODY) return null;
  const req = event.req as Request;
  if (typeof req.text !== "function") return null;
  const text = await req.text();
  if (text.length > MAX_BODY) return null;
  try {
    const data = JSON.parse(text);
    return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function course(raw: unknown): CourseId | null {
  return raw === "be" || raw === "ru" ? raw : null;
}

function esc(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function tokenOk(given: string | null): boolean {
  const want = process.env.ZUBRYK_ADMIN_TOKEN?.trim();
  if (!want || want.length < 24 || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

function adminPage(): string {
  const players = Object.values(db().players).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", dateStyle: "short", timeStyle: "short" });
  const cell = (p: (typeof players)[number], c: CourseId) => {
    const s = summary(p, c);
    return s.points ? `${s.points} <small>(${s.passed}/${LEVEL_COUNT[c]} узр., ${s.correct} правільна)</small>` : "—";
  };
  const rows = players
    .map(
      (p, i) =>
        `<tr><td>${i + 1}</td><td>${esc(p.name)}</td><td>${p.age}</td><td>${fmt(p.createdAt)}</td><td>${fmt(p.lastSeen)}</td><td>${cell(p, "be")}</td><td>${cell(p, "ru")}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>Зубрик — игроки</title>
<style>body{font:15px/1.4 system-ui,sans-serif;margin:1rem;background:#1b1433;color:#fff6e8}table{border-collapse:collapse;width:100%}th,td{padding:.4rem .5rem;border-bottom:1px solid #ffffff22;text-align:left;vertical-align:top}th{position:sticky;top:0;background:#2a2050}small{opacity:.7}.wrap{overflow-x:auto}</style></head>
<body><h1>Зубрик — игроки (${players.length})</h1><p>Время — МСК. Сортировка: последняя активность.</p><div class="wrap"><table><thead><tr><th>#</th><th>Имя</th><th>Возраст</th><th>Регистрация</th><th>Активность</th><th>Беларуская мова</th><th>Русский язык</th></tr></thead><tbody>${rows || '<tr><td colspan="7">Пока никого</td></tr>'}</tbody></table></div></body></html>`;
}

export default async function zbApi(event: ZbEvent, next: () => unknown | Promise<unknown>): Promise<unknown> {
  const m = event.url.pathname.match(PREFIX_RE);
  if (!m) return next();
  const action = m[1];
  const method = (event.req.method ?? "GET").toUpperCase();
  const ip = clientIp(event);

  try {
    if (action === "admin" && method === "GET") {
      if (limited(`admin:${ip}`, 20, 60_000)) return json({ error: "slow down" }, 429);
      if (!tokenOk(event.url.searchParams.get("k"))) return new Response("Not found", { status: 404 });
      return new Response(adminPage(), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "x-robots-tag": "noindex",
          "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
        },
      });
    }

    if (action === "rating" && method === "GET") {
      if (limited(`read:${ip}`, 90, 60_000)) return json({ error: "slow down" }, 429);
      const c = course(event.url.searchParams.get("course"));
      if (!c) return json({ error: "bad course" }, 400);
      const me = event.url.searchParams.get("me");
      const list = ranking(c);
      const top = list.slice(0, 50).map((row, i) => ({
        place: i + 1,
        name: row.p.name,
        points: row.points,
        passed: row.passed,
        me: validId(me) && row.p.id === me,
      }));
      const myIndex = validId(me) ? list.findIndex((row) => row.p.id === me) : -1;
      const mine =
        myIndex >= 0
          ? { place: myIndex + 1, name: list[myIndex].p.name, points: list[myIndex].points, passed: list[myIndex].passed }
          : null;
      return json({ course: c, levels: LEVEL_COUNT[c], players: list.length, top, me: mine });
    }

    if ((action === "player" || action === "progress") && method === "POST") {
      if (limited(`write:${ip}`, 40, 60_000)) return json({ error: "slow down" }, 429);
      const data = await body(event);
      if (!data || !validId(data.id)) return json({ error: "bad request" }, 400);
      const store = db();
      let player = store.players[data.id];
      const now = new Date().toISOString();

      if (action === "player") {
        const name = cleanName(data.name);
        const age = cleanAge(data.age);
        if (!name || age === null) return json({ error: "bad name or age" }, 400);
        if (!player) {
          if (limited(`reg:${ip}`, 15, 60 * 60_000)) return json({ error: "slow down" }, 429);
          if (Object.keys(store.players).length >= MAX_PLAYERS) return json({ error: "full" }, 503);
          player = { id: data.id, name, age, createdAt: now, lastSeen: now, best: { be: {}, ru: {} } };
          store.players[data.id] = player;
        } else {
          player.name = name;
          player.age = age;
          player.lastSeen = now;
        }
        save();
        return json({ ok: true });
      }

      if (!player) return json({ error: "unknown player" }, 404);
      const c = course(data.course);
      if (!c) return json({ error: "bad course" }, 400);
      mergeBest(player, c, cleanBest(c, data.best));
      player.lastSeen = now;
      save();
      return json({ ok: true, ...summary(player, c) });
    }

    return json({ error: "not found" }, 404);
  } catch (error) {
    console.error("[zb] api error", error);
    return json({ error: "server error" }, 500);
  }
}

export { COURSES };
