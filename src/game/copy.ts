export type Copy = {
  sub: string;
  player: string;
  askName: string;
  nameHint: string;
  namePh: string;
  play: string;
  hello: string;
  ladder: (need: number, len: number) => string;
  rating: string;
  changeName: string;
  switchCourse: string;
  lockedNote: string;
  shortName: string;
  grade: string;
  levelOf: string;
  open: string;
  closed: string;
  pointsRule: string;
  start: (len: number) => string;
  back: string;
  choose: string;
  next: string;
  sec: string;
  pts: string;
  passed: string;
  retry: string;
  record: string;
  summary: string;
  place: string;
  need: (need: number, len: number) => string;
  nextLevel: string;
  again: string;
  toLevels: string;
  board: string;
  who: string;
  boardHint: string;
  empty: string;
  right: string;
  lvl: string;
  helpTitle: string;
  helpP: (need: number, len: number) => string;
  help: [string, string, string, string];
  ok: string;
  go: string;
  almost: string;
  dance: string;
  more: string;
  fest: string;
  prizes: string;
  prizesWho: string;
  prizesHint: string;
  prizeFirst: string;
  prizeGrade: (grade: number) => string;
  prizeEarned: string;
  prizeLocked: string;
  prizeProgress: (done: number, total: number) => string;
  prizeTotal: string;
  prizeNew: string;
  prizeOzon: string;
  rubles: string;
  how: string;
  sound: string;
  motion: string;
  rate: string;
};

export const BE: Copy = {
  sub: "узроўні 2–6 клас",
  player: "Гулец",
  askName: "Як цябе завуць?",
  nameHint: "Імя трапіць у рэйтынг на гэтай прыладзе. Можна гуляць удваіх.",
  namePh: "Імя",
  play: "Гуляць",
  hello: "спачатку лёгкае, потым цяжэйшае.",
  ladder: (need, len) =>
    `З 2 класа да 6. Хуткі правільны адказ дае больш ачкоў. Каб адкрыць наступны ўзровень, трэба ${need} з ${len}.`,
  rating: "Рэйтынг",
  changeName: "Змяніць імя",
  switchCourse: "Іншы прадмет",
  lockedNote: "Спачатку прайдзі папярэдні ўзровень",
  shortName: "Імя — хаця б 2 літары",
  grade: "клас",
  levelOf: "узровень",
  open: "адкрыта",
  closed: "закрыта",
  pointsRule: "Правільны адказ — ад 100 да 180 ачкоў. Чым хутчэй, тым больш. Памылка — 0.",
  start: (len) => `Пачаць ${len} заданняў`,
  back: "Назад",
  choose: "Абяры адказ",
  next: "Далей",
  sec: "с",
  pts: "ачкоў",
  passed: "Узровень пройдзены",
  retry: "Яшчэ разок",
  record: "Новы рэкорд",
  summary: "правільна",
  place: "Месца ў рэйтынгу",
  need: (need, len) => `Трэба ${need} правільных з ${len}, каб адкрыць наступны ўзровень.`,
  nextLevel: "Наступны ўзровень",
  again: "Яшчэ раз",
  toLevels: "Да ўзроўняў",
  board: "Рэйтынг",
  who: "Хто вышэй",
  boardHint:
    "Ачкі — сума лепшых спроб. Хуткі правільны адказ даражэйшы. Пры роўных ачках вышэй той, у каго меншы час на пытанне.",
  empty: "Пакуль нікога няма. Напішы імя і прайдзі ўзровень.",
  right: "правільна",
  lvl: "узр.",
  helpTitle: "Як гуляць",
  helpP: (need, len) =>
    `Узроўні ідуць па чарзе: з 2 класа да 6. Наступны адкрываецца, калі ў папярэднім ${need} правільных з ${len}.`,
  help: [
    "Правільны адказ: 100 ачкоў плюс хуткасць, да 180.",
    "Памылка: 0 ачкоў. Час усё адно запісваецца.",
    "У рэйтынгу лічыцца лепшая спроба кожнага ўзроўню: ачкі, час на пытанне і агульны час.",
    "На камп’ютары — клавішы 1, 2, 3.",
  ],
  ok: "Зразумела",
  go: "Ну, пачалі!",
  prizes: "Прызы",
  prizesWho: "Прызы за прайдзеныя ўзроўні",
  prizesHint: "Прыз адкрываецца, калі прайдзены ўсе ўзроўні яго этапу. Кожны наступны — большы.",
  prizeFirst: "Першы тур",
  prizeGrade: (grade) => `${grade} клас`,
  prizeEarned: "Атрыманы",
  prizeLocked: "Яшчэ не зароблены",
  prizeProgress: (done, total) => `Зроблена ${done} з ${total}`,
  prizeTotal: "Усяго можна",
  prizeNew: "Новы прыз!",
  prizeOzon: "Прыз з Ozon",
  rubles: "бел. руб.",
  almost: "Амаль! Глядзі.",
  dance: "Танцуем!",
  more: "Яшчэ!",
  fest: "Купалле!",
  how: "Як гуляць",
  sound: "Гук",
  motion: "Рух",
  rate: "Рэйтынг",
};

export const RU: Copy = {
  sub: "уровни 2–6 класс",
  player: "Игрок",
  askName: "Как тебя зовут?",
  nameHint: "Имя попадёт в рейтинг на этом устройстве. Можно играть вдвоём.",
  namePh: "Имя",
  play: "Играть",
  hello: "сначала легко, потом сложнее.",
  ladder: (need, len) =>
    `Со 2 класса до 6. Быстрый правильный ответ даёт больше очков. Чтобы открыть следующий уровень, нужно ${need} из ${len}.`,
  rating: "Рейтинг",
  changeName: "Сменить имя",
  switchCourse: "Другой предмет",
  lockedNote: "Сначала пройди предыдущий уровень",
  shortName: "Имя — хотя бы 2 буквы",
  grade: "класс",
  levelOf: "уровень",
  open: "открыт",
  closed: "закрыт",
  pointsRule: "Правильный ответ — от 100 до 180 очков. Чем быстрее, тем больше. Ошибка — 0.",
  start: (len) => `Начать ${len} заданий`,
  back: "Назад",
  choose: "Выбери ответ",
  next: "Дальше",
  sec: "с",
  pts: "очков",
  passed: "Уровень пройден",
  retry: "Ещё разок",
  record: "Новый рекорд",
  summary: "правильно",
  place: "Место в рейтинге",
  need: (need, len) => `Нужно ${need} правильных из ${len}, чтобы открыть следующий уровень.`,
  nextLevel: "Следующий уровень",
  again: "Ещё раз",
  toLevels: "К уровням",
  board: "Рейтинг",
  who: "Кто выше",
  boardHint:
    "Очки — сумма лучших попыток. Быстрый правильный ответ дороже. При равных очках выше тот, у кого меньше время на вопрос.",
  empty: "Пока никого нет. Напиши имя и пройди уровень.",
  right: "правильно",
  lvl: "ур.",
  helpTitle: "Как играть",
  helpP: (need, len) =>
    `Уровни идут по очереди: со 2 класса до 6. Следующий открывается, когда в предыдущем ${need} правильных из ${len}.`,
  help: [
    "Правильный ответ: 100 очков плюс скорость, до 180.",
    "Ошибка: 0 очков. Время всё равно записывается.",
    "В рейтинге считается лучшая попытка каждого уровня: очки, время на вопрос и общее время.",
    "На компьютере — клавиши 1, 2, 3.",
  ],
  ok: "Понятно",
  go: "Ну, поехали!",
  prizes: "Призы",
  prizesWho: "Призы за пройденные уровни",
  prizesHint: "Приз открывается, когда пройдены все уровни его этапа. Каждый следующий — больше.",
  prizeFirst: "Первый тур",
  prizeGrade: (grade) => `${grade} класс`,
  prizeEarned: "Получен",
  prizeLocked: "Ещё не заработан",
  prizeProgress: (done, total) => `Сделано ${done} из ${total}`,
  prizeTotal: "Всего можно",
  prizeNew: "Новый приз!",
  prizeOzon: "Приз с Ozon",
  rubles: "бел. руб.",
  almost: "Почти! Смотри.",
  dance: "Танцуем!",
  more: "Ещё!",
  fest: "Салют!",
  how: "Как играть",
  sound: "Звук",
  motion: "Движение",
  rate: "Рейтинг",
};
