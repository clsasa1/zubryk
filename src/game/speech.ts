/** Озвучка и вибрация.
 *
 *  Игра учит читать, поэтому вопрос произносится вслух: ребёнок, который ещё
 *  не читает бегло, не должен упираться в текст. Звук — уже отдельная галочка
 *  в настройках, поэтому голос здесь просто часть того же переключателя.
 */

type Lang = "be" | "ru";

let ready = false;
let warmed = false;

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis ?? null;
}

function warm() {
  const s = synth();
  if (!s || ready) return;
  ready = true;
  // Список голосов на некоторых платформах приходит асинхронно.
  s.addEventListener?.("voiceschanged", () => {
    /* сам список нужен только при выборе голоса */
  });
  if (!warmed) {
    warmed = true;
    try {
      s.getVoices();
    } catch {
      /* ignore */
    }
  }
}

function pickVoice(lang: Lang): SpeechSynthesisVoice | null {
  const s = synth();
  if (!s) return null;
  let voices: SpeechSynthesisVoice[] = [];
  try {
    voices = s.getVoices();
  } catch {
    return null;
  }
  if (!voices.length) return null;
  const exact = voices.find((v) => v.lang?.toLowerCase().startsWith(lang));
  return exact ?? voices.find((v) => v.lang?.toLowerCase().startsWith(lang)) ?? null;
}

/** Текст для озвучки: убираем типографику, чтобы голос не спотыкался на кавычках. */
function plain(text: string): string {
  return text
    .replace(/[«»„“"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

let last = "";

export function speak(
  text: string,
  opts: { lang?: Lang; rate?: number; pitch?: number } = {},
): void {
  const s = synth();
  const clean = plain(text);
  if (!s || !clean) return;
  warm();
  // Повтор того же вопроса подряд — не перебиваем, только коротко ждём конца.
  if (s.speaking && last === clean) {
    s.cancel();
  } else if (s.speaking) {
    s.cancel();
  }
  const utter = new SpeechSynthesisUtterance(clean);
  const lang = opts.lang ?? "ru";
  utter.lang = lang === "be" ? "be-BY" : "ru-RU";
  // Детям нужен неспешный темп и чуть более высокий голос.
  utter.rate = opts.rate ?? 0.88;
  utter.pitch = opts.pitch ?? 1.08;
  utter.volume = 0.95;
  const voice = pickVoice(lang);
  if (voice) utter.voice = voice;
  last = clean;
  try {
    s.speak(utter);
  } catch {
    /* голос не обязателен */
  }
}

export function stopSpeaking(): void {
  const s = synth();
  if (!s) return;
  try {
    s.cancel();
  } catch {
    /* ignore */
  }
}

/** Короткая отдача на правильный ответ. Несколько сильнее — когда эмоций больше. */
export function buzz(kind: "ok" | "big" | "soft" | "nope"): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    if (kind === "ok") navigator.vibrate(12);
    else if (kind === "big") navigator.vibrate([12, 40, 18]);
    // Мягкий отклик на неудачу: едва ощутимый, без «отрицания».
    else if (kind === "soft") navigator.vibrate(6);
    else navigator.vibrate([4, 30, 4]);
  } catch {
    /* ignore */
  }
}
