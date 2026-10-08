import { useEffect, useRef, useState } from "react";
import { CircleHelp, Sparkles, Trophy, Volume2, VolumeX } from "lucide-react";
import { fest } from "@/game/audio";
import { LEVELS, PRAISE, STAGES, shuffle, type Item, type Level } from "@/game/content";
import {
  better,
  clock,
  isPass,
  pointsFor,
  standings,
  totals,
  type Best,
  type Player,
  NEED_CORRECT,
} from "@/game/score";

type Screen = "name" | "home" | "rule" | "play" | "result" | "board";
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

const SAVE = "zubryk-ladder-v1";
const PREF = "zubryk-prefs-v2";
const COLORS = ["#f0b429", "#4c74ff", "#fff6e8", "#ff8f6b", "#ffd1e8"];

function loadSave(): Save {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE) || "") as Save;
    if (!raw || !Array.isArray(raw.players)) return { current: "", players: [] };
    return raw;
  } catch {
    return { current: "", players: [] };
  }
}

function openCount(player: Player | undefined): number {
  if (!player) return 1;
  let count = 1;
  for (const level of LEVELS) {
    if (!isPass(player.best[level.id])) break;
    count += 1;
  }
  return Math.min(count, LEVELS.length);
}

export function ZubrykApp() {
  const [screen, setScreen] = useState<Screen>("name");
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
  const [picked, setPicked] = useState<number | null>(null);
  const [pose, setPose] = useState<"idle" | "cheer" | "dance" | "oops">("idle");
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
  const skipSave = useRef(true);
  hypeRef.current = hype;
  motionRef.current = motion;

  const player = players.find((item) => item.name === current);
  const unlocked = openCount(player);
  const level: Level | undefined = LEVELS[levelIndex];
  const board = standings(players);
  const myPlace = board.findIndex((row) => row.player.name === current);

  useEffect(() => {
    const save = loadSave();
    setPlayers(save.players);
    setCurrent(save.current);
    if (save.current && save.players.some((item) => item.name === save.current)) setScreen("home");
    try {
      const prefs = JSON.parse(localStorage.getItem(PREF) || "{}") as { sound?: boolean; motion?: boolean };
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

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    localStorage.setItem(SAVE, JSON.stringify({ current, players }));
  }, [current, players]);

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
      if (motionRef.current && bits.current.length < 28 + hypeRef.current * 4 && Math.random() < 0.35) {
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
      setNote("Імя — хаця б 2 літары");
      return;
    }
    setNote("");
    setPlayers((list) => (list.some((item) => item.name === clean) ? list : [...list, { name: clean, best: {} }]));
    setCurrent(clean);
    setDraft("");
    setScreen("home");
    fest.ensure();
    fest.tap();
  }

  function begin(nextIndex: number) {
    const next = LEVELS[nextIndex];
    if (!next) return;
    fest.ensure();
    fest.hello();
    fest.setLevel(1);
    correctRef.current = 0;
    pointsRef.current = 0;
    stampsRef.current = [];
    startedRef.current = performance.now();
    setQueue(shuffle(next.items));
    setLevelIndex(nextIndex);
    setIndex(0);
    setCorrect(0);
    setHype(0);
    setMisses([]);
    setLocked(false);
    setPicked(null);
    setPose("idle");
    setSpeech("Ну, пачалі!");
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
    setLocked(true);
    stampsRef.current = [...stampsRef.current, { ms, ok }];
    if (ok) {
      const gained = pointsFor(ms);
      const nextHype = Math.min(8, Math.max(hype + 1, 1));
      correctRef.current += 1;
      pointsRef.current += gained;
      setHype(nextHype);
      setCorrect(correctRef.current);
      fest.setLevel(nextHype);
      fest.correct(nextHype);
      setPose(nextHype >= 6 ? "dance" : "cheer");
      setKick(nextHype >= 4 ? "kick-big" : "kick");
      setFlash(true);
      burst(nextHype);
      const word = PRAISE[nextHype % PRAISE.length] ?? "Так!";
      setSpeech(word);
      praise(`+${gained}`);
      const stage = STAGES[nextHype];
      if (stage && (nextHype === 2 || nextHype === 4 || nextHype === 6)) setSlam(stage.name);
      window.setTimeout(() => {
        setFlash(false);
        setKick("");
        setSlam(null);
      }, 700);
      window.setTimeout(() => nextStep(), 720);
    } else {
      fest.wrong();
      setPose("oops");
      setSpeech("Амаль! Глядзі.");
      setMisses((list) => [...list, { index, item }]);
      setKick("kick");
      window.setTimeout(() => setKick(""), 420);
    }
  }
  answerRef.current = answer;

  function nextStep() {
    if (index + 1 >= queue.length) {
      finish();
      return;
    }
    setIndex((value) => value + 1);
    setLocked(false);
    setPicked(null);
    startedRef.current = performance.now();
    setPose(hype >= 6 ? "dance" : "idle");
    setSpeech(hype >= 6 ? "Танцуем!" : "Яшчэ!");
  }

  function finish() {
    const hits = correctRef.current;
    const pts = pointsRef.current;
    const taken = stampsRef.current;
    const ms = taken.reduce((sum, stamp) => sum + stamp.ms, 0);
    const row: Best = { points: pts, correct: hits, total: queue.length, ms };
    const okRun = hits >= NEED_CORRECT;
    setCorrect(hits);
    setRunPoints(pts);
    setStamps(taken);
    setPassedRun(okRun);
    if (okRun) {
      fest.setLevel(8);
      fest.fanfare();
      setPose("dance");
      setSlam("Купалле!");
      burst(10);
      setHype(8);
    }
    if (level && current) {
      setPlayers((list) =>
        list.map((item) => {
          if (item.name !== current) return item;
          const prev = item.best[level.id];
          if (!better(row, prev)) return item;
          return { ...item, best: { ...item.best, [level.id]: row } };
        }),
      );
      const prev = player?.best[level.id];
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

  const stage = STAGES[Math.min(hype, STAGES.length - 1)] ?? STAGES[0];
  const item = queue[index];
  const liveSec = Math.max(0, Math.floor((nowMs - startedRef.current) / 1000));
  const runMs = stamps.reduce((sum, stamp) => sum + stamp.ms, 0);
  const mine = player ? totals(player) : null;

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
            (pose === "cheer" ? "pop" : pose === "dance" ? "dance" : pose === "oops" ? "oops" : motion ? "bob" : "")
          }
          src={screen === "result" && passedRun ? "/art/dance.png" : `/art/${pose}.png`}
          alt="Зубрык"
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
            <h1>Зубрык</h1>
            <p>{current ? current : "узроўні 2–6 клас"}</p>
          </div>
          <div className="grow" />
          {screen !== "name" ? (
            <button className="icon" aria-label="Рэйтынг" onClick={() => setScreen("board")}>
              <Trophy size={20} />
            </button>
          ) : null}
          <button
            className="icon"
            aria-pressed={sound}
            aria-label="Гук"
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
          <button className="icon" aria-pressed={motion} aria-label="Рух" onClick={() => setMotion((value) => !value)}>
            <Sparkles size={20} />
          </button>
          <button className="icon" aria-label="Як гуляць" onClick={() => setHelp(true)}>
            <CircleHelp size={20} />
          </button>
        </header>

        {note ? <p className="note">{note}</p> : null}

        {screen === "name" ? (
          <section className="card namebox">
            <div className="kicker">Гулец</div>
            <h2 className="prompt">Як цябе завуць?</h2>
            <p className="hint">Імя трапіць у рэйтынг на гэтай прыладзе. Можна гуляць удваіх.</p>
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
                placeholder="Імя"
                onChange={(event) => setDraft(event.target.value)}
              />
              <div className="row">
                <button className="btn gold" type="submit">
                  Гуляць
                </button>
              </div>
            </form>
            {players.length > 0 ? (
              <div className="stack">
                {players.map((item) => (
                  <button key={item.name} className="level" onClick={() => choosePlayer(item.name)}>
                    <b>{item.name}</b>
                    <span className="best">{totals(item).points} ачкоў</span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {screen === "home" ? (
          <>
            <section className="lede">
              <strong>
                {current}, спачатку лёгкае, потым цяжэйшае.
              </strong>
              <p>З 2 класа да 6. Хуткі правільны адказ дае больш ачкоў. Каб адкрыць наступны ўзровень, трэба {NEED_CORRECT} з 6.</p>
              <div className="row">
                <button className="btn gold" onClick={() => setScreen("board")}>
                  Рэйтынг{mine ? ` · ${mine.points}` : ""}
                </button>
                <button className="btn ghost" onClick={() => setScreen("name")}>
                  Змяніць імя
                </button>
              </div>
            </section>
            <div className="path">
              {LEVELS.map((item, i) => {
                const showHead = i === 0 || item.grade !== LEVELS[i - 1]?.grade;
                const best = player?.best[item.id];
                const done = isPass(best);
                const open = i < unlocked;
                const cls = done ? "level done" : open ? "level now" : "level locked";
                return (
                  <div key={item.id}>
                    {showHead ? <div className="grade">{item.grade} клас</div> : null}
                    <button
                      className={cls}
                      onClick={() => {
                        fest.tap();
                        if (!open) {
                          setNote("Спачатку прайдзі папярэдні ўзровень");
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
                      <span className="best">{done ? `${best?.points ?? 0}` : open ? "адкрыта" : "закрыта"}</span>
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
              {level.grade} клас · узровень {levelIndex + 1}
            </div>
            <h2 className="prompt">{level.title}</h2>
            <p className="hint">{level.ru}</p>
            <p className="hint">{level.rule}</p>
            <div className="explain">{level.example}</div>
            <p className="hint">Правільны адказ — ад 100 да 180 ачкоў. Чым хутчэй, тым больш. Памылка — 0.</p>
            <div className="row">
              <button className="btn gold" onClick={() => begin(levelIndex)}>
                Пачаць 6 заданняў
              </button>
              <button className="btn ghost" onClick={() => setScreen("home")}>
                Назад
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
              <div className="timepill">{liveSec} с</div>
              <div className="stage-name">{pointsRef.current} ачкоў</div>
            </div>
            <div className="lanterns" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className={i < hype ? "lantern on" : "lantern"} />
              ))}
            </div>
            <div className="card">
              <div className="kicker">
                {level.title} · {index + 1}/6
              </div>
              <div className="prompt">{item.prompt}</div>
              <p className="hint">{item.hint ?? "Абяры адказ"}</p>
              <div className="choices">
                {item.choices.map((choice, i) => {
                  const show = locked;
                  const cls =
                    show && i === item.answer ? "choice correct" : show && i === picked ? "choice wrong" : "choice";
                  return (
                    <button key={choice} className={cls} disabled={locked} onClick={() => answer(i)}>
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
                      Далей
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </>
        ) : null}

        {screen === "result" && level ? (
          <section className="card">
            <div className="kicker">{passedRun ? "Узровень пройдзены" : "Яшчэ разок"}</div>
            {isRecord && passedRun ? <div className="fest-banner">Новы рэкорд</div> : null}
            <div className="score">{runPoints}</div>
            <p className="hint">
              {correct} з {queue.length} правільна · {clock(runMs)} разам ·{" "}
              {queue.length ? (runMs / queue.length / 1000).toFixed(1) : "0"} с на пытанне
            </p>
            <p className="hint">
              {passedRun && myPlace >= 0
                ? `Месца ў рэйтынгу: ${myPlace + 1} з ${board.length}.`
                : `Трэба ${NEED_CORRECT} правільных з 6, каб адкрыць наступны ўзровень.`}
            </p>
            <div className="times">
              {stamps.map((stamp, i) => (
                <span key={i} className={stamp.ok ? "pill ok" : "pill bad"}>
                  {i + 1}. {(stamp.ms / 1000).toFixed(1)} с
                </span>
              ))}
            </div>
            {misses.map((miss) => (
              <div key={`${miss.item.id}-${miss.index}`} className="miss">
                <b>{miss.item.prompt}</b>
                <div>
                  {miss.item.choices[miss.item.answer]} — {miss.item.explain}
                </div>
              </div>
            ))}
            <div className="row">
              {passedRun && levelIndex + 1 < LEVELS.length ? (
                <button className="btn gold" onClick={() => begin(levelIndex + 1)}>
                  Наступны ўзровень
                </button>
              ) : (
                <button className="btn gold" onClick={() => begin(levelIndex)}>
                  Яшчэ раз
                </button>
              )}
              <button
                className="btn ghost"
                onClick={() => {
                  setScreen("home");
                  setHype(0);
                  fest.setLevel(0);
                  setPose("idle");
                }}
              >
                Да ўзроўняў
              </button>
            </div>
          </section>
        ) : null}

        {screen === "board" ? (
          <section className="card">
            <div className="kicker">Рэйтынг</div>
            <h2 className="prompt">Хто вышэй</h2>
            <p className="hint">
              Ачкі — сума лепшых спроб. Хуткі правільны адказ даражэйшы. Пры роўных ачках вышэй той, у каго меншы час на пытанне.
            </p>
            {board.length === 0 ? <p className="hint">Пакуль нікога няма. Напішы імя і прайдзі ўзровень.</p> : null}
            <div className="stack">
              {board.map((row, i) => (
                <div key={row.player.name} className={row.player.name === current ? "board-row me" : "board-row"}>
                  <span className="num">{i + 1}</span>
                  <span className="level-copy">
                    <b>{row.player.name}</b>
                    <span className="ru">
                      {row.correct} правільна · {row.avg ? `${(row.avg / 1000).toFixed(1)} с` : "—"} · {clock(row.ms)} ·{" "}
                      {row.passed} узр.
                    </span>
                  </span>
                  <span className="best">{row.points}</span>
                </div>
              ))}
            </div>
            <div className="row">
              <button className="btn gold" onClick={() => setScreen(current ? "home" : "name")}>
                Назад
              </button>
            </div>
          </section>
        ) : null}
      </div>

      {help ? (
        <div className="sheet-back" onClick={() => setHelp(false)}>
          <div className="sheet" onClick={(event) => event.stopPropagation()}>
            <h2>Як гуляць</h2>
            <p>Узроўні ідуць па чарзе: з 2 класа да 6. Наступны адкрываецца, калі ў папярэднім 5 правільных з 6.</p>
            <ul>
              <li>Правільны адказ: 100 ачкоў плюс хуткасць, да 180.</li>
              <li>Памылка: 0 ачкоў. Час усё адно запісваецца.</li>
              <li>У рэйтынгу лічыцца лепшая спроба кожнага ўзроўню: ачкі, час на пытанне і агульны час.</li>
              <li>На камп’ютары — клавішы 1, 2, 3.</li>
            </ul>
            <button className="btn gold" onClick={() => setHelp(false)}>
              Зразумела
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
