import { useEffect, useMemo, useRef, useState } from "react";
import { CircleHelp, Gift, Sparkles, Trophy, Volume2, VolumeX } from "lucide-react";
import { fest } from "@/game/audio";
import { buzz } from "@/game/speech";
import { LEVELS, PRAISE, STAGES, shuffle, type Item, type Level } from "@/game/content";
import { RU_LEVELS, RU_PRAISE, RU_STAGES } from "@/game/content-ru";
import { BE, RU, type Copy } from "@/game/copy";
import {
  buildPrizes,
  prizeProgress,
  prizesEarnedTotal,
  prizesTotal,
  type Prize,
} from "@/game/prizes";
import {
  better,
  clock,
  isPass,
  needCorrect,
  LEVEL_LEN,
  pointsFor,
  standings,
  totals,
  type Best,
  type Player,
} from "@/game/score";

type Screen = "pick" | "name" | "home" | "rule" | "play" | "result" | "board" | "prizes";
type Stamp = { ms: number; ok: boolean };
type Miss = { index: number; item: Item };
type Bit = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  s: number;
  rot: number;
  vr: number;
  kind: "chip" | "note" | "mote";
};
type Save = { current: string; players: Player[] };
type CourseId = "be" | "ru";

const SAVE_KEYS: Record<CourseId, string> = {
  be: "zubryk-ladder-v1",
  ru: "zubryk-ladder-ru-v1",
};
const COURSE_KEY = "zubryk-course";
const PREF = "zubryk-prefs-v2";
const COLORS = ["#f0b429", "#4c74ff", "#fff6e8", "#ff8f6b", "#ffd1e8"];

function loadSave(key: string): Save {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "") as Save;
    if (!raw || !Array.isArray(raw.players)) return { current: "", players: [] };
    return raw;
  } catch {
    return { current: "", players: [] };
  }
}

function openCount(player: Player | undefined, levels: Level[]): number {
  if (!player) return 1;
  let count = 1;
  for (const level of levels) {
    if (!isPass(player.best[level.id], level.items.length)) break;
    count += 1;
  }
  return Math.min(count, levels.length);
}

export function ZubrykApp() {
  const [screen, setScreen] = useState<Screen>("pick");
  const [courseId, setCourseId] = useState<CourseId>("be");
  const [players, setPlayers] = useState<Player[]>([]);
  const [current, setCurrent] = useState("");
  const [draft, setDraft] = useState("");
  const [levelIndex, setLevelIndex] = useState(0);
  const [queue, setQueue] = useState<Item[]>([]);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [hype, setHype] = useState(0);
  const [misses, setMisses] = useState<Miss[]>([]);
  const [locked, setLocked] = useState(false);
  const [retry, setRetry] = useState(false);
  /** Реванш: играем только промахи, результат в рейтинг не пишется. */
  const [practice, setPractice] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  // Позы «oops» больше нет: на неудачной попытке маскот остаётся добрым.
  const [pose, setPose] = useState<"idle" | "cheer" | "dance">("idle");
  const [kick, setKick] = useState<"" | "kick" | "kick-big">("");
  const [flash, setFlash] = useState(false);
  const [slam, setSlam] = useState<string | null>(null);
  const [speech, setSpeech] = useState("Ну, пачалі!");
  const [floats, setFloats] = useState<{ id: number; text: string; x: string }[]>([]);
  const [help, setHelp] = useState(false);
  const [sound, setSound] = useState(true);
  const [motion, setMotion] = useState(true);
  const [note, setNote] = useState("");
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [runPoints, setRunPoints] = useState(0);
  const [isRecord, setIsRecord] = useState(false);
  const [passedRun, setPassedRun] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const [newPrize, setNewPrize] = useState<Prize | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bits = useRef<Bit[]>([]);
  const floatId = useRef(0);
  const correctRef = useRef(0);
  const pointsRef = useRef(0);
  const stampsRef = useRef<Stamp[]>([]);
  const startedRef = useRef(0);
  const hypeRef = useRef(0);
  const motionRef = useRef(true);
  const answerRef = useRef<(choice: number) => void>(() => {});
  // Таймер автоперехода: после неудачи игра едет дальше сама, но если ребёнок
  // успел ответить сам — таймер отменяется в nextStep.
  const stepTimer = useRef<number | null>(null);
  const skipSave = useRef(true);
  hypeRef.current = hype;
  motionRef.current = motion;

  const player = players.find((item) => item.name === current);
  const pack =
    courseId === "ru"
      ? { levels: RU_LEVELS, stages: RU_STAGES, praise: RU_PRAISE, t: RU }
      : { levels: LEVELS, stages: STAGES, praise: PRAISE, t: BE };
  const t: Copy = screen === "pick" ? RU : pack.t;
  const unlocked = openCount(player, pack.levels);
  const level: Level | undefined = pack.levels[levelIndex];
  // Длина уровней разная, поэтому рейтинг и «сколько нужно для прохода» считаем по факту.
  const levelLens = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of pack.levels) map[item.id] = item.items.length;
    return map;
  }, [pack.levels]);
  const firstLen = pack.levels[0]?.items.length ?? LEVEL_LEN;
  const firstNeed = needCorrect(firstLen);
  const board = standings(players, levelLens);
  const myPlace = board.findIndex((row) => row.player.name === current);
  // Прызы вычисляются из best[] — отдельного хранилища не нужно, прогресс уже сохранён.
  const prizeList = useMemo(() => buildPrizes(pack.levels), [pack.levels]);
  const bestOf = player?.best ?? {};
  const earnedSum = prizesEarnedTotal(prizeList, bestOf, levelLens);
  const allSum = prizesTotal(prizeList);
  // Какие призы уже были заработаны — для праздника в момент получения.
  const earnedIds = useMemo(
    () =>
      new Set(
        prizeList
          .filter((prize) => prizeProgress(prize, bestOf, levelLens).earned)
          .map((prize) => prize.id),
      ),
    [prizeList, bestOf, levelLens],
  );
  const earnedIdsRef = useRef<Set<string>>(new Set());
  // Пры загруззе гульца адзначаем ужо заработаныя прызы, каб старыя не
  // абвяшчаліся «новымі» пры наступнай перамоге.
  useEffect(() => {
    earnedIdsRef.current = earnedIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, courseId]);

  function selectCourse(id: CourseId) {
    const save = loadSave(SAVE_KEYS[id]);
    setCourseId(id);
    setPlayers(save.players);
    setCurrent(save.current);
    setNote("");
    setScreen(
      save.current && save.players.some((item) => item.name === save.current) ? "home" : "name",
    );
    localStorage.setItem(COURSE_KEY, id);
    document.documentElement.lang = id === "ru" ? "ru" : "be";
    fest.ensure();
    fest.tap();
  }

  useEffect(() => {
    const stored = localStorage.getItem(COURSE_KEY);
    const id: CourseId | null = stored === "ru" || stored === "be" ? stored : null;
    if (id) {
      const save = loadSave(SAVE_KEYS[id]);
      setCourseId(id);
      setPlayers(save.players);
      setCurrent(save.current);
      if (save.current && save.players.some((item) => item.name === save.current))
        setScreen("home");
      else setScreen("name");
      document.documentElement.lang = id === "ru" ? "ru" : "be";
    }
    try {
      const prefs = JSON.parse(localStorage.getItem(PREF) || "{}") as {
        sound?: boolean;
        motion?: boolean;
      };
      if (typeof prefs.sound === "boolean") setSound(prefs.sound);
      if (typeof prefs.motion === "boolean") setMotion(prefs.motion);
    } catch {
      /* ignore broken prefs */
    }
  }, []);

  useEffect(() => {
    fest.setMuted(!sound);
    localStorage.setItem(PREF, JSON.stringify({ sound, motion }));
  }, [sound, motion]);

  // Тревожная музыка живёт только внутри урока: любой выход — экран результата,
  // список уровней, смена предмета — глушит её, иначе она так и гудит дальше.
  useEffect(() => {
    if (screen !== "play") fest.stopMusic();
  }, [screen]);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    if (screen === "pick") return;
    localStorage.setItem(SAVE_KEYS[courseId], JSON.stringify({ current, players }));
  }, [current, players, courseId, screen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const fit = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    fit();
    window.addEventListener("resize", fit);
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      bits.current = bits.current.filter((bit) => bit.life > 0);
      if (
        motionRef.current &&
        bits.current.length < 28 + hypeRef.current * 4 &&
        Math.random() < 0.35
      ) {
        bits.current.push({
          x: Math.random() * canvas.width,
          y: canvas.height + 8,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -0.35 - Math.random() * 0.55,
          life: 180,
          max: 180,
          color: Math.random() > 0.5 ? "#ffe7ad" : "#fff6e8",
          s: 2 + Math.random() * 3,
          rot: 0,
          vr: 0,
          kind: "mote",
        });
      }
      for (const bit of bits.current) {
        bit.x += bit.vx;
        bit.y += bit.vy;
        if (bit.kind !== "mote") bit.vy += 0.16;
        bit.rot += bit.vr;
        bit.life -= 1;
        ctx.save();
        ctx.globalAlpha = Math.max(0, bit.life / bit.max);
        ctx.translate(bit.x, bit.y);
        ctx.rotate(bit.rot);
        ctx.fillStyle = bit.color;
        if (bit.kind === "note") {
          ctx.beginPath();
          ctx.ellipse(0, 0, bit.s * 0.45, bit.s * 0.3, -0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(bit.s * 0.32, -bit.s * 1.1, 2, bit.s * 1.1);
        } else if (bit.kind === "mote") {
          ctx.beginPath();
          ctx.arc(0, 0, bit.s, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-bit.s / 2, -bit.s / 4, bit.s, bit.s * 0.55);
        }
        ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
    };
  }, []);

  useEffect(() => {
    if (screen !== "play" || locked) return;
    const id = window.setInterval(() => setNowMs(performance.now()), 200);
    return () => window.clearInterval(id);
  }, [screen, locked, index]);

  function burst(power: number) {
    if (!motion) return;
    const canvas = canvasRef.current;
    const w = canvas?.width || window.innerWidth;
    const h = canvas?.height || window.innerHeight;
    const count = 18 + power * 8;
    for (let i = 0; i < count; i++) {
      bits.current.push({
        x: w * 0.5 + (Math.random() - 0.5) * 160,
        y: h * 0.42,
        vx: (Math.random() - 0.5) * (7 + power),
        vy: -Math.random() * (6 + power) - 2,
        life: 46 + Math.random() * 24,
        max: 70,
        color: COLORS[i % COLORS.length] ?? "#f0b429",
        s: 6 + Math.random() * 8,
        rot: Math.random() * 3,
        vr: (Math.random() - 0.5) * 0.3,
        kind: i % 3 === 0 ? "note" : "chip",
      });
    }
  }

  function praise(text: string) {
    const id = ++floatId.current;
    const x = `${30 + Math.random() * 40}%`;
    setFloats((list) => [...list.slice(-4), { id, text, x }]);
    window.setTimeout(() => setFloats((list) => list.filter((item) => item.id !== id)), 800);
  }

  function choosePlayer(name: string) {
    const clean = name.trim().replace(/\s+/g, " ").slice(0, 16);
    if (clean.length < 2) {
      setNote(t.shortName);
      return;
    }
    setNote("");
    setPlayers((list) =>
      list.some((item) => item.name === clean) ? list : [...list, { name: clean, best: {} }],
    );
    setCurrent(clean);
    setDraft("");
    setScreen("home");
    fest.ensure();
    fest.tap();
  }

  /** Запуск уровня. items — реванш: играем только те задания, где было трудно. */
  function begin(nextIndex: number, items?: Item[]) {
    const next = pack.levels[nextIndex];
    if (!next) return;
    // Реванш играет только по промахам; если список пуст — обычный полный уровень.
    const picked = items?.filter(Boolean);
    const pool = picked?.length ? picked : next.items;
    fest.ensure();
    fest.hello();
    fest.setLevel(1);
    correctRef.current = 0;
    pointsRef.current = 0;
    stampsRef.current = [];
    startedRef.current = performance.now();
    setQueue(shuffle(pool));
    setPractice(Boolean(picked?.length));
    setLevelIndex(nextIndex);
    setIndex(0);
    setCorrect(0);
    setHype(0);
    setMisses([]);
    setLocked(false);
    setPicked(null);
    setRetry(false);
    setHintShown(false);
    if (stepTimer.current !== null) {
      window.clearTimeout(stepTimer.current);
      stepTimer.current = null;
    }
    setPose("idle");
    setSpeech(t.go);
    setScreen("play");
  }

  function answer(choice: number) {
    const item = queue[index];
    if (!item || locked) return;
    const ms = Math.max(250, Math.round(performance.now() - startedRef.current));
    const ok = choice === item.answer;
    fest.ensure();
    fest.tap();
    setPicked(choice);
    // Время на вопрос считается от первого нажатия; «верно» в итоге означает, что
    // ребёнок в итоге разобрался, даже если первая попытка была неудачной.
    const stamp: Stamp = stampsRef.current[index] ?? { ms, ok };
    if (ok) stamp.ok = true;
    stampsRef.current[index] = stamp;
    if (ok) {
      setLocked(true);
      // Успех после неудачи засчитывается, но очками вдвое меньше: ребёнок
      // не должен чувствовать себя проигравшим из-за одной попытки.
      const gained = retry ? Math.max(40, Math.round(pointsFor(ms) / 2)) : pointsFor(ms);
      const nextHype = Math.min(8, Math.max(hype + 1, 1));
      correctRef.current += 1;
      pointsRef.current += gained;
      setHype(nextHype);
      setCorrect(correctRef.current);
      fest.setLevel(nextHype);
      fest.correct(nextHype);
      buzz(nextHype >= 6 ? "big" : "ok");
      setPose(nextHype >= 6 ? "dance" : "cheer");
      setKick(nextHype >= 4 ? "kick-big" : "kick");
      setFlash(true);
      burst(nextHype);
      const word = pack.praise[nextHype % pack.praise.length] ?? "Так!";
      setSpeech(word);
      praise(`+${gained}`);
      const stageHit = pack.stages[nextHype];
      if (stageHit && (nextHype === 2 || nextHype === 4 || nextHype === 6)) setSlam(stageHit.name);
      window.setTimeout(() => {
        setFlash(false);
        setKick("");
        setSlam(null);
      }, 700);
      window.setTimeout(() => nextStep(), 700);
      return;
    }
    // Ошибка — это не наказание. Первый раз показываем верный ответ, но
    // оставляем варианты нажимаемыми: ребёнок пробует ещё раз сам.
    fest.wrong();
    buzz("soft");
    setMisses((list) => (list.some((m) => m.index === index) ? list : [...list, { index, item }]));
    if (!retry) {
      setRetry(true);
      setSpeech(t.tryAgain);
      setKick("kick");
      window.setTimeout(() => setKick(""), 420);
      scheduleStep(6000);
      return;
    }
    // Второй раз — ответ показан, но темп не теряем: едем дальше сами.
    setLocked(true);
    scheduleStep(1900);
  }
  answerRef.current = answer;

  /** Плановая задержка до следующего вопроса: всегда сменяет предыдущий таймер. */
  function scheduleStep(delay: number) {
    if (stepTimer.current !== null) window.clearTimeout(stepTimer.current);
    stepTimer.current = window.setTimeout(() => {
      stepTimer.current = null;
      nextStep();
    }, delay);
  }

  function nextStep() {
    if (stepTimer.current !== null) {
      window.clearTimeout(stepTimer.current);
      stepTimer.current = null;
    }
    if (index + 1 >= queue.length) {
      finish();
      return;
    }
    setIndex((value) => value + 1);
    setLocked(false);
    setPicked(null);
    setRetry(false);
    setHintShown(false);
    startedRef.current = performance.now();
    setPose(hype >= 6 ? "dance" : "idle");
    setSpeech(hype >= 6 ? t.dance : t.more);
  }

  function finish() {
    const hits = correctRef.current;
    const pts = pointsRef.current;
    const taken = stampsRef.current;
    const ms = taken.reduce((sum, stamp) => sum + stamp.ms, 0);
    const row: Best = { points: pts, correct: hits, total: queue.length, ms };
    const okRun = isPass(row, queue.length);
    setCorrect(hits);
    setRunPoints(pts);
    setStamps(taken);
    setPassedRun(practice ? true : okRun);
    if (okRun && !practice) {
      fest.setLevel(8);
      fest.fanfare();
      setPose("dance");
      setSlam(t.fest);
      burst(10);
      setHype(8);
    }
    // Реванш — это тренировка, а не зачёт: в рейтинг он не пишется и приз не открывает.
    if (level && current && !practice) {
      // Складываем новую спробу ў той жа лепшы стан, які захаваецца ў localStorage,
      // і толькі пасля гэтага лічым, якія прызы адкрыліся менавіта цяпер.
      const before = player?.best ?? {};
      const prev = before[level.id];
      const nextBest = { ...before };
      if (better(row, prev)) nextBest[level.id] = row;
      const nowEarned = new Set(
        prizeList
          .filter((prize) => prizeProgress(prize, nextBest, levelLens).earned)
          .map((prize) => prize.id),
      );
      const fresh = prizeList.find(
        (prize) => nowEarned.has(prize.id) && !earnedIdsRef.current.has(prize.id),
      );
      earnedIdsRef.current = nowEarned;
      if (fresh) setNewPrize(fresh);
      setPlayers((list) =>
        list.map((item) => {
          if (item.name !== current) return item;
          return { ...item, best: nextBest };
        }),
      );
      setIsRecord(better(row, prev));
    }
    setScreen("result");
    setLocked(false);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (screen !== "play" || locked) return;
      const n = Number(event.key);
      if (n >= 1 && n <= 4) answerRef.current(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, locked]);

  const stage = pack.stages[Math.min(hype, pack.stages.length - 1)] ?? pack.stages[0];
  const item = queue[index];
  const liveSec = Math.max(0, Math.floor((nowMs - startedRef.current) / 1000));
  const runMs = stamps.reduce((sum, stamp) => sum + stamp.ms, 0);
  const mine = player ? totals(player, levelLens) : null;

  return (
    <div className={motion ? "shell" : "shell still"} data-hype={String(hype)}>
      <div className="sky" />
      <div className="wash" />
      <div className="lights" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} className="bulb" style={{ animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>
      <div className="flags" aria-hidden="true" />
      <canvas ref={canvasRef} className="juice" />
      <div className={flash ? "flash on" : "flash"} />
      <div className="dock">
        <img
          className={
            "mascot " +
            (pose === "cheer" ? "pop" : pose === "dance" ? "dance" : motion ? "bob" : "")
          }
          src={screen === "result" && passedRun ? "/art/dance.png" : `/art/${pose}.png`}
          alt="Дима"
        />
        {screen === "play" ? (
          <div className="bubble">
            {speech}
            <small>{stage?.line}</small>
          </div>
        ) : null}
      </div>
      {slam ? <div className="slam">{slam}</div> : null}
      {floats.map((float) => (
        <div key={float.id} className="float" style={{ ["--x" as string]: float.x }}>
          {float.text}
        </div>
      ))}

      <div className={`frame ${kick}`}>
        <header className="topbar">
          <div className="brand">
            <h1>Зубрик</h1>
            <p>{current && screen !== "pick" ? current : t.sub}</p>
          </div>
          <div className="grow" />
          {screen !== "name" && screen !== "pick" ? (
            <button className="icon" aria-label={t.rate} onClick={() => setScreen("board")}>
              <Trophy size={20} />
            </button>
          ) : null}
          <button
            className="icon"
            aria-pressed={sound}
            aria-label={t.sound}
            onClick={() => {
              setSound((value) => {
                const next = !value;
                fest.ensure();
                fest.setMuted(!next);
                if (next) fest.hello();
                return next;
              });
            }}
          >
            {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button
            className="icon"
            aria-pressed={motion}
            aria-label={t.motion}
            onClick={() => setMotion((value) => !value)}
          >
            <Sparkles size={20} />
          </button>
          <button className="icon" aria-label={t.how} onClick={() => setHelp(true)}>
            <CircleHelp size={20} />
          </button>
        </header>

        {note ? <p className="note">{note}</p> : null}

        {screen === "pick" ? (
          <section className="card">
            <div className="kicker">Зубрик</div>
            <h2 className="prompt">Что тренируем?</h2>
            <p className="hint">
              Одинаковая игра: уровни со 2 по 6 класс, очки за скорость и рейтинг.
            </p>
            <div className="stack">
              <button className="level" onClick={() => selectCourse("be")}>
                <span className="num">Б</span>
                <span className="level-copy">
                  <b>Беларуская мова</b>
                  <span className="ru">2–6 клас</span>
                </span>
              </button>
              <button className="level now" onClick={() => selectCourse("ru")}>
                <span className="num">Р</span>
                <span className="level-copy">
                  <b>Русский язык</b>
                  <span className="ru">2–6 класс</span>
                </span>
              </button>
            </div>
          </section>
        ) : null}

        {screen === "name" ? (
          <section className="card namebox">
            <div className="kicker">{t.player}</div>
            <h2 className="prompt">{t.askName}</h2>
            <p className="hint">{t.nameHint}</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                choosePlayer(draft);
              }}
            >
              <input
                value={draft}
                maxLength={16}
                autoComplete="nickname"
                placeholder={t.namePh}
                onChange={(event) => setDraft(event.target.value)}
              />
              <div className="row">
                <button className="btn gold" type="submit">
                  {t.play}
                </button>
              </div>
            </form>
            {players.length > 0 ? (
              <div className="stack">
                {players.map((item) => (
                  <button key={item.name} className="level" onClick={() => choosePlayer(item.name)}>
                    <b>{item.name}</b>
                    <span className="best">
                      {totals(item, levelLens).points} {t.pts}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="row">
              <button className="btn ghost" type="button" onClick={() => setScreen("pick")}>
                {t.switchCourse}
              </button>
            </div>
          </section>
        ) : null}

        {screen === "home" ? (
          <>
            <section className="lede">
              <strong>
                {current}, {t.hello}
              </strong>
              <p>{t.ladder(firstNeed, firstLen)}</p>
              <div className="row">
                <button className="btn gold" onClick={() => setScreen("board")}>
                  {t.rating}
                  {mine ? ` · ${mine.points}` : ""}
                </button>
                <button className="btn ghost" onClick={() => setScreen("prizes")}>
                  {t.prizes}
                  {earnedSum > 0 ? ` · ${earnedSum} ${t.rubles}` : ""}
                </button>
                <button className="btn ghost" onClick={() => setScreen("name")}>
                  {t.changeName}
                </button>
                <button className="btn ghost" onClick={() => setScreen("pick")}>
                  {t.switchCourse}
                </button>
              </div>
            </section>
            <div className="path">
              {pack.levels.map((item, i) => {
                const showHead = i === 0 || item.grade !== pack.levels[i - 1]?.grade;
                const best = player?.best[item.id];
                const done = isPass(best, item.items.length);
                const open = i < unlocked;
                const cls = done ? "level done" : open ? "level now" : "level locked";
                return (
                  <div key={item.id}>
                    {showHead ? (
                      <div className="grade">
                        {item.grade} {t.grade}
                      </div>
                    ) : null}
                    <button
                      className={cls}
                      onClick={() => {
                        fest.tap();
                        if (!open) {
                          setNote(t.lockedNote);
                          return;
                        }
                        setNote("");
                        setLevelIndex(i);
                        setScreen("rule");
                      }}
                    >
                      <span className="num">{i + 1}</span>
                      <span className="level-copy">
                        <b>{item.title}</b>
                        <span className="ru">{item.ru}</span>
                      </span>
                      <span className="best">
                        {done ? `${best?.points ?? 0}` : open ? t.open : t.closed}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        {screen === "rule" && level ? (
          <section className="card">
            <div className="kicker">
              {level.grade} {t.grade} · {t.levelOf} {levelIndex + 1}
            </div>
            <h2 className="prompt">{level.title}</h2>
            <p className="hint">{level.ru}</p>
            <p className="hint">{level.rule}</p>
            <div className="explain">{level.example}</div>
            <p className="hint">{t.pointsRule}</p>
            <div className="row">
              <button className="btn gold" onClick={() => begin(levelIndex)}>
                {t.start(level ? level.items.length : firstLen)}
              </button>
              <button className="btn ghost" onClick={() => setScreen("home")}>
                {t.back}
              </button>
            </div>
          </section>
        ) : null}

        {screen === "play" && item && level ? (
          <>
            <div className="playhead">
              <div className="dots">
                {queue.map((_, i) => {
                  const stamp = stampsRef.current[i];
                  const cls = stamp ? (stamp.ok ? "on" : "bad") : "";
                  return <i key={i} className={cls} />;
                })}
              </div>
              <div className="grow" />
              <div className="timepill">
                {liveSec} {t.sec}
              </div>
              <div className="stage-name">
                {pointsRef.current} {t.pts}
              </div>
            </div>
            <div className="lanterns" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className={i < hype ? "lantern on" : "lantern"} />
              ))}
            </div>
            <div className="card">
              <div className="kicker">
                {level.title} · {index + 1}/{queue.length}
              </div>
              <div className="prompt">{item.prompt}</div>
              <div className="askrow">
                <p className="hint">{item.hint ?? t.choose}</p>
                {!retry && !hintShown && item.explain ? (
                  <button
                    className="hintbtn"
                    onClick={() => {
                      setHintShown(true);
                      fest.tap();
                    }}
                  >
                    {t.hintBtn}
                  </button>
                ) : null}
              </div>
              {hintShown && !retry ? <div className="explain">{item.explain}</div> : null}
              <div className="choices">
                {item.choices.map((choice, i) => {
                  // После первой ошибки подсвечиваем ТОЛЬКО верный ответ: на
                  // неудачной попытке не должно быть и намёка на «помечено».
                  const show = locked || retry;
                  const cls = show && i === item.answer ? "choice correct" : "choice";
                  return (
                    <button
                      key={choice}
                      className={cls}
                      disabled={locked}
                      onClick={() => answer(i)}
                    >
                      <span className="n">{i + 1}</span>
                      {choice}
                    </button>
                  );
                })}
              </div>
              {locked && picked !== item.answer ? (
                <>
                  <div className="explain">{item.explain}</div>
                  <div className="row">
                    <button className="btn gold" onClick={() => nextStep()}>
                      {t.next}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </>
        ) : null}

        {screen === "result" && level ? (
          <section className="card">
            <div className="kicker">
              {practice ? t.practiced : passedRun ? t.passed : t.softFail}
            </div>
            {isRecord && passedRun && !practice ? (
              <div className="fest-banner">{t.record}</div>
            ) : null}
            <div className="score">{runPoints}</div>
            <p className="hint">
              {correct} {courseId === "ru" ? "из" : "з"} {queue.length} {t.summary} · {clock(runMs)}{" "}
              {courseId === "ru" ? "всего" : "разам"} ·{" "}
              {queue.length ? (runMs / queue.length / 1000).toFixed(1) : "0"} {t.sec}{" "}
              {courseId === "ru" ? "на вопрос" : "на пытанне"}
            </p>
            <p className="hint">
              {passedRun && myPlace >= 0
                ? `${t.place}: ${myPlace + 1} / ${board.length}.`
                : t.need(needCorrect(queue.length), queue.length)}
            </p>
            <div className="times">
              {stamps.map((stamp, i) => (
                <span key={i} className={stamp.ok ? "pill ok" : "pill bad"}>
                  {i + 1}. {(stamp.ms / 1000).toFixed(1)} {t.sec}
                </span>
              ))}
            </div>
            {misses.length > 0 && !practice ? (
              <div className="rematchbar">
                <button
                  className="btn gold wide"
                  onClick={() =>
                    begin(
                      levelIndex,
                      misses.map((m) => m.item),
                    )
                  }
                >
                  {t.rematch}
                </button>
                <p className="hint">{t.rematchNote}</p>
              </div>
            ) : null}
            {misses.length > 0 ? (
              <>
                <p className="hint learn">{t.learnMore}</p>
                {misses.map((miss) => (
                  <div key={`${miss.item.id}-${miss.index}`} className="miss">
                    <b>{miss.item.prompt}</b>
                    <div>
                      {miss.item.choices[miss.item.answer]} — {miss.item.explain}
                    </div>
                  </div>
                ))}
              </>
            ) : null}
            <div className="row">
              {passedRun && levelIndex + 1 < pack.levels.length ? (
                <button className="btn gold" onClick={() => begin(levelIndex + 1)}>
                  {t.nextLevel}
                </button>
              ) : (
                <button className="btn gold" onClick={() => begin(levelIndex)}>
                  {t.again}
                </button>
              )}
              <button
                className="btn ghost"
                onClick={() => {
                  setScreen("home");
                  setHype(0);
                  fest.stopMusic();
                  setPose("idle");
                }}
              >
                {t.toLevels}
              </button>
            </div>
          </section>
        ) : null}

        {screen === "board" ? (
          <section className="card">
            <div className="kicker">{t.board}</div>
            <h2 className="prompt">{t.who}</h2>
            <p className="hint">{t.boardHint}</p>
            {board.length === 0 ? <p className="hint">{t.empty}</p> : null}
            <div className="stack">
              {board.map((row, i) => (
                <div
                  key={row.player.name}
                  className={row.player.name === current ? "board-row me" : "board-row"}
                >
                  <span className="num">{i + 1}</span>
                  <span className="level-copy">
                    <b>{row.player.name}</b>
                    <span className="ru">
                      {row.correct} {t.right} ·{" "}
                      {row.avg ? `${(row.avg / 1000).toFixed(1)} ${t.sec}` : "—"} · {clock(row.ms)}{" "}
                      · {row.passed} {t.lvl}
                    </span>
                  </span>
                  <span className="best">{row.points}</span>
                </div>
              ))}
            </div>
            <div className="row">
              <button className="btn gold" onClick={() => setScreen(current ? "home" : "name")}>
                {t.back}
              </button>
            </div>
          </section>
        ) : null}
        {screen === "prizes" ? (
          <section className="card">
            <div className="kicker">{t.prizes}</div>
            <h2 className="prompt">{t.prizesWho}</h2>
            <p className="hint">{t.prizesHint}</p>
            <div className="prize-total">
              <span>
                {earnedSum} {t.rubles}
              </span>
              <span className="ru">
                {t.prizeTotal}: {allSum} {t.rubles}
              </span>
            </div>
            <div className="prizes">
              {prizeList.map((prize) => {
                const prog = prizeProgress(prize, bestOf, levelLens);
                return (
                  <div key={prize.id} className={prog.earned ? "prize got" : "prize"}>
                    <div className="prize-badge" data-tier={prize.tier}>
                      <Gift size={20} />
                      <b>{prize.amount}</b>
                      <small>{t.rubles}</small>
                    </div>
                    <div className="prize-copy">
                      <b>
                        {prize.kind === "first" ? t.prizeFirst : t.prizeGrade(prize.grade ?? 0)}
                      </b>
                      <span className="ru">
                        {prog.earned ? t.prizeEarned : t.prizeProgress(prog.done, prog.total)}
                      </span>
                      <span className="prize-bar">
                        <i style={{ width: `${prog.pct}%` }} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="row">
              <button className="btn gold" onClick={() => setScreen("home")}>
                {t.back}
              </button>
            </div>
          </section>
        ) : null}
      </div>

      {newPrize ? (
        <div className="sheet-back" onClick={() => setNewPrize(null)}>
          <div className="sheet prize-win" onClick={(event) => event.stopPropagation()}>
            <div className="prize-badge big" data-tier={newPrize.tier}>
              <Gift size={28} />
              <b>{newPrize.amount}</b>
              <small>{t.rubles}</small>
            </div>
            <h2>{t.prizeNew}</h2>
            <p>
              {newPrize.kind === "first" ? t.prizeFirst : t.prizeGrade(newPrize.grade ?? 0)} —{" "}
              {t.prizeOzon}
            </p>
            <div className="row">
              <button
                className="btn gold"
                onClick={() => {
                  setNewPrize(null);
                  setScreen("prizes");
                }}
              >
                {t.prizes}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {help ? (
        <div className="sheet-back" onClick={() => setHelp(false)}>
          <div className="sheet" onClick={(event) => event.stopPropagation()}>
            <h2>{t.helpTitle}</h2>
            <p>{t.helpP(firstNeed, firstLen)}</p>
            <ul>
              {t.help.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <button className="btn gold" onClick={() => setHelp(false)}>
              {t.ok}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
