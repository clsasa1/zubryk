/** Вибрация.
 *
 *  Озвучки вопросов больше нет: синтез речи ставит ударения не туда и сбивает
 *  ребёнка с толку, а читать его всё равно учит сама игра. Звук остался в
 *  отдельной галочке, микро-отклик на ответ — здесь, через вибрацию.
 */

type Kind = "ok" | "big" | "soft" | "nope";

/** Короткая отдача на правильный ответ. Несколько сильнее — когда эмоций больше. */
export function buzz(kind: Kind): void {
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