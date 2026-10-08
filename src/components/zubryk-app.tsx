import { useEffect, useRef, useState } from "react";
import { CircleHelp, Sparkles, Volume2, VolumeX } from "lucide-react";
import { fest } from "@/game/audio";
import { PRAISE, SKILLS, STAGES, shuffle, skillById, type Item } from "@/game/content";

type Screen = "home" | "rule" | "play" | "result";
type Progress = Record<string, { best: number; plays: number }>;
type Queued = Item & { skillId: string };
type Miss = { index: number; item: Queued };
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

const SAVE = "zubryk-grade3-v2";
const PREF = "zubryk-prefs-v2";
const COLORS = ["#f0b429", "#4c74ff", "#fff6e8", "#ff8f6b", "#ffd1e8"];

function loadProgress(): Progress {
  try {
    return JSON.parse(localStorage.getItem(SAVE) || "{}") as Progress;
  } catch {
    return {};
  }
}

export function ZubrykApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [skillId, setSkillId] = useState<string | null>(null);
  const [mix, setMix] = useState(false);
  const [queue, setQueue] = useState<Queued[]>([]);
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
  const [speech, setSpeech] = useState("Ну давай!");
  const [floats, setFloats] = useState<{ id: number; text: string; x: string }[]>([]);
  const [help, setHelp] = useState(false);
  const [sound, setSound] = useState(true);
  const [motion, setMotion] = useState(true);
  const [progress, setProgress] = useState<Progress>({});
  const [pct, setPct] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bits = useRef<Bit[]>([]);
  const floatId = useRef(0);
  const correctRef = useRef(0);
  const hypeRef = useRef(0);
  const motionRef = useRef(true);
  hypeRef.current = hype;
  motionRef.current = motion;

  useEffect(() => {
    setProgress(loadProgress());
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
      bits.current = bits.current.filter((b) => b.life > 0);
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
      for (const b of bits.current) {
        b.x += b.vx;
        b.y += b.vy;
        if (b.kind !== "mote") b.vy += 0.16;
        b.rot += b.vr;
        b.life -= 1;
        ctx.save();
        ctx.globalAlpha = Math.max(0, b.life / b.max);
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.fillStyle = b.color;
        if (b.kind === "note") {
          ctx.beginPath();
          ctx.ellipse(0, 0, b.s * 0.45, b.s * 0.3, -0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(b.s * 0.32, -b.s * 1.1, 2, b.s * 1.1);
        } else if (b.kind === "mote") {
          ctx.beginPath();
          ctx.arc(0, 0, b.s, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s * 0.55);
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

  function burst(power: number) {
    if (!motion) return;
    const canvas = canvasRef.current;
    const w = canvas?.width || window.innerWidth;
    const h = canvas?.height || window.innerHeight;
    const count = 18 + power * 8;
    for (let i = 0; i < count; i++) {
      const note = i % 3 === 0;
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
        kind: note ? "note" : "chip",
      });
    }
  }

  function praise(text: string) {
    const id = ++floatId.current;
    const x = `${30 + Math.random() * 40}%`;
    setFloats((list) => [...list.slice(-4), { id, text, x }]);
    window.setTimeout(() => setFloats((list) => list.filter((f) => f.id !== id)), 800);
  }

  function begin(items: Queued[], nextSkill: string | null, isMix: boolean) {
    fest.ensure();
    fest.hello();
    fest.setLevel(1);
    correctRef.current = 0;
    setQueue(shuffle(items).slice(0, 8));
    setIndex(0);
    setCorrect(0);
    setHype(0);
    setMisses([]);
    setLocked(false);
    setPicked(null);
    setPose("idle");
    setSpeech("Ну давай!");
    setSkillId(nextSkill);
    setMix(isMix);
    setScreen("play");
  }

  function openSkill(id: string) {
    fest.ensure();
    fest.tap();
    setSkillId(id);
    setMix(false);
    setScreen("rule");
    setHype(0);
    fest.setLevel(0);
  }

  function startMix() {
    const all = SKILLS.flatMap((s) => s.items.map((it) => ({ ...it, skillId: s.id })));
    begin(all, null, true);
  }

  function startWeak() {
    const weak = SKILLS.filter((s) => (progress[s.id]?.best ?? 0) < 80);
    const pool = (weak.length ? weak : SKILLS).flatMap((s) => s.items.map((it) => ({ ...it, skillId: s.id })));
    begin(pool, null, true);
  }

  function answer(choice: number) {
    if (locked || screen !== "play") return;
    const item = queue[index];
    if (!item || choice < 0 || choice >= item.choices.length) return;
    fest.ensure();
    fest.tap();
    setLocked(true);
    setPicked(choice);
    const ok = choice === item.answer;
    if (ok) {
      const next = Math.max(hype + 1, 1);
      correctRef.current += 1;
      setHype(next);
      setCorrect(correctRef.current);
      fest.setLevel(next);
      fest.correct(next);
      setPose(next >= 6 ? "dance" : "cheer");
      setKick(next >= 6 ? "kick-big" : "kick");
      setFlash(true);
      burst(next);
      const word = PRAISE[next % PRAISE.length] ?? "Так!";
      setSpeech(word);
      praise(word);
      const stage = STAGES[next];
      if (stage && (next === 2 || next === 4 || next === 6 || next === 8)) setSlam(stage.name);
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

  function nextStep() {
    if (index + 1 >= queue.length) {
      finish();
      return;
    }
    setIndex((n) => n + 1);
    setLocked(false);
    setPicked(null);
    setPose(hype >= 6 ? "dance" : "idle");
    setSpeech(hype >= 6 ? "Танцуем!" : "Яшчэ!");
  }

  function finish() {
    const total = queue.length || 1;
    const hits = correctRef.current;
    const score = Math.round((100 * hits) / total);
    setPct(score);
    setCorrect(hits);
    if (!mix && skillId) {
      const prev = progress[skillId] ?? { best: 0, plays: 0 };
      const next = { best: Math.max(prev.best, score), plays: prev.plays + 1 };
      const merged = { ...progress, [skillId]: next };
      setProgress(merged);
      localStorage.setItem(SAVE, JSON.stringify(merged));
    }
    if (score >= 80) {
      fest.setLevel(8);
      fest.fanfare();
      setPose("dance");
      setSlam("Купалле!");
      burst(10);
      setHype(8);
    }
    setScreen("result");
    setLocked(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screen !== "play" || locked) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 4) answer(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const stage = STAGES[Math.min(hype, STAGES.length - 1)] ?? STAGES[0];
  const item = queue[index];
  const skill = item ? skillById(item.skillId) : skillId ? skillById(skillId) : undefined;

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
          src={
            screen === "result"
              ? pct >= 80
                ? "/art/dance.png"
                : "/art/oops.png"
              : `/art/${pose}.png`
          }
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
      {floats.map((f) => (
        <div key={f.id} className="float" style={{ ["--x" as string]: f.x }}>
          {f.text}
        </div>
      ))}

      <div className={`frame ${kick}`}>
        <header className="topbar">
          <div className="brand">
            <h1>Зубрык</h1>
            <p>граматыка · 3 клас</p>
          </div>
          <div className="grow" />
          <button
            className="icon"
            aria-pressed={sound}
            aria-label="Гук"
            onClick={() => {
              setSound((v) => {
                const next = !v;
                fest.ensure();
                fest.setMuted(!next);
                if (next) fest.hello();
                return next;
              });
            }}
          >
            {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button className="icon" aria-pressed={motion} aria-label="Рух" onClick={() => setMotion((v) => !v)}>
            <Sparkles size={20} />
          </button>
          <button className="icon" aria-label="Як гуляць" onClick={() => setHelp(true)}>
            <CircleHelp size={20} />
          </button>
        </header>

        {screen === "home" ? (
          <>
            <section className="hero">
              <div className="lede">
                <strong>Кожны верны адказ падымае свята.</strong>
                <p>
                  Агеньчыкі, музыка і карагод нарастаюць. Памылка не гасіць свята і не заканчвае гульню.
                </p>
                <div className="row">
                  <button className="btn gold" onClick={startMix}>
                    Мікс усіх тэм
                  </button>
                  <button className="btn ghost" onClick={startWeak}>
                    Толькі слабыя
                  </button>
                </div>
              </div>
            </section>
            <div className="grid">
              {SKILLS.map((s) => {
                const best = progress[s.id]?.best ?? 0;
                return (
                  <button key={s.id} className="skill" onClick={() => openSkill(s.id)}>
                    <span className="ru">{s.ru}</span>
                    <b>{s.title}</b>
                    <span className="best">{best ? `лепшае ${best}%` : "яшчэ не гуляў"}</span>
                    <div className="meter">
                      <i style={{ ["--fill" as string]: `${best}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {screen === "rule" && skill ? (
          <section className="hero">
            <div className="card">
              <div className="kicker">{skill.ru}</div>
              <h2 className="prompt">{skill.title}</h2>
              <p className="hint">{skill.rule}</p>
              <div className="explain">{skill.example}</div>
              <div className="row">
                <button
                  className="btn gold"
                  onClick={() => begin(skill.items.map((it) => ({ ...it, skillId: skill.id })), skill.id, false)}
                >
                  Пачаць 8 заданняў
                </button>
                <button className="btn ghost" onClick={() => setScreen("home")}>
                  Назад
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {screen === "play" && item ? (
          <>
            <div className="playhead">
              <div className="dots">
                {queue.map((_, i) => {
                  const bad = misses.some((m) => m.index === i);
                  const on = i < index && !bad;
                  return <i key={i} className={bad ? "bad" : on ? "on" : ""} />;
                })}
              </div>
              <div className="grow" />
              <div className="stage-name">{stage?.name}</div>
            </div>
            <div className="lanterns" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className={i < hype ? "lantern on" : "lantern"} />
              ))}
            </div>
            <div className="card">
              <div className="kicker">{skill?.title}</div>
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

        {screen === "result" ? (
          <section className="card">
            <div className="kicker">{pct >= 80 ? "Свята" : "Гатова"}</div>
            {pct >= 80 ? <div className="fest-banner">Купалле!</div> : null}
            <div className="score">
              {correct} / {queue.length}
            </div>
            <p className="hint">
              {pct >= 80
                ? "Амаль усё чыста. Зубрык запаліў усё поле."
                : "Свята не згасла. Ніжэй толькі тое, што варта паўтарыць."}
            </p>
            {misses.map((m) => (
              <div key={`${m.item.id}-${m.index}`} className="miss">
                <b>{m.item.prompt}</b>
                <div>
                  {m.item.choices[m.item.answer]} — {m.item.explain}
                </div>
              </div>
            ))}
            <div className="row">
              <button
                className="btn gold"
                onClick={() => {
                  if (mix) startMix();
                  else if (skillId) {
                    const s = skillById(skillId);
                    if (s) begin(s.items.map((it) => ({ ...it, skillId: s.id })), s.id, false);
                  }
                }}
              >
                Яшчэ раз
              </button>
              <button
                className="btn ghost"
                onClick={() => {
                  setScreen("home");
                  setHype(0);
                  fest.setLevel(0);
                  setPose("idle");
                }}
              >
                Да тэм
              </button>
            </div>
          </section>
        ) : null}
      </div>

      {help ? (
        <div className="sheet-back" onClick={() => setHelp(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>Як гуляць</h2>
            <p>
              Верны адказ адразу дадае агеньчык, слой музыкі і святочны выбух. Памылка не здымае агеньчыкі:
              Зубрык паказвае правіла, і можна ісці далей.
            </p>
            <ul>
              <li>8 заданняў. Лепшы вынік застаецца на гэтай прыладзе.</li>
              <li>На камп’ютары — клавішы 1, 2, 3.</li>
              <li>Кнопка іскраў выключае рух, калі мільгае.</li>
            </ul>
            <p>Гэта дрыл для 3 класа: склады, у/ў, апостраф, мяккі знак, вялікая літара, род, лік, прыметнік і «не» з дзеясловам.</p>
            <button className="btn gold" onClick={() => setHelp(false)}>
              Зразумела
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
