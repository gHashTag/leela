/**
 * What the game says, as opposed to what the game teaches.
 *
 * `plansFor` has served the 72 plans in 22 languages since the first pass. The
 * sentences *around* them — "It is Anna's turn", "you owe a report", the help
 * text — were written in English inside `apps/bot`, so a room could be opened
 * in Russian, serve every plan in Russian, and instruct the player in English.
 * `room.language` reached `planFor` and nothing else.
 *
 * This is the catalogue those sentences now come from. Three properties matter
 * more than the translations themselves:
 *
 *   - **English is complete by construction.** `MessageKey` is derived from the
 *     English catalogue, so a key that has no English text is not a key.
 *   - **A missing translation falls back, it does not blank.** Coverage is
 *     reported by `messageCoverage`, not hidden.
 *   - **Plurals are the language's own.** Russian needs one/few/many and
 *     English needs two; a catalogue that offers `{one, other}` to Russian
 *     prints "5 плана". `Intl.PluralRules` decides, and `messageIssues` checks
 *     that every form the language declares is present.
 *
 * Only `en` and `ru` are complete. The other twenty fall back to English rather
 * than being machine-translated into sentences no one has read: the third pass
 * of this migration exists because 744 plan titles were machine-translated and
 * rotted unnoticed. A visible gap is worth more than an invisible guess.
 */

import { FALLBACK_LANGUAGE, type Language, resolveLanguage } from './index';

/** The plural forms a message can take. `other` is the only required one. */
export interface PluralForms {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export type Message = string | PluralForms;

/** Values interpolated into `{placeholders}`. */
export type MessageParams = Record<string, string | number>;

/**
 * The English catalogue, and the definition of what a message key is.
 *
 * Written out rather than assembled, because a key is a promise that some call
 * site depends on and a generated one cannot be found by searching for it.
 */
const EN = {
  // --- opening a table -------------------------------------------------------
  'table.opened':
    'A table is open. {host} is seated.\n' +
    'Up to {seats} may play — send /join.\n' +
    'When everyone is seated, {host} sends /start.',
  'join.started': 'This game has already begun.',
  'join.already': 'You are already seated. /start begins the game when everyone is.',
  'join.full': 'The table seats {seats}, and it is full.',
  'join.took': '{name} takes a seat. {count} at the table.',
  'start.already': 'Already playing.',
  'start.hostOnly': 'Only whoever opened the table may start it.',
  'start.begins':
    'The game begins. {name} goes first.\nA six puts you on the board — send /roll.',

  // --- playing ---------------------------------------------------------------
  'roll.notStarted': 'The table has not started yet — /start first.',
  'roll.over': 'This game is over. /new opens another table, /path shows what you wrote.',
  'roll.notYourTurn': "It is {name}'s turn.",
  'roll.reportRequired':
    'You are standing on {plan}. {title}.\n' +
    'Write what it brings up before you move on — send /report followed by your words.',
  'roll.cooldown': 'Not yet. Your next throw is in {wait}.',
  'roll.reached': '{name} reaches Cosmic Consciousness. 🕉',
  'roll.ended':
    'That is the game. /path shows what you wrote along the way; /new opens another table.',
  'roll.next': '{name} is next.',
  'roll.again': 'A six — throw again.',

  // --- a move, in words ------------------------------------------------------
  //
  // Entering the game is its own pair of sentences. A player waiting on the
  // win square is not short of room and has not moved from 68 — they are
  // waiting for a six, which is a rule they need told rather than a refusal.
  'move.enter': '{name} throws a six and enters the game on {to}.\n{to}. {title}',
  'move.needSix': '{name} throws {value}. It takes a six to enter the game.',
  'move.refused': '{name} throws {value}. Not enough room — the throw is refused.',
  'move.threeSixes':
    '{name} throws {value}. A third six — the run burns, back to {to}.\n{to}. {title}',
  'move.snake': '{name} throws {value}. A snake at {from} takes them to {to}.\n{to}. {title}',
  'move.arrow': '{name} throws {value}. An arrow at {from} takes them to {to}.\n{to}. {title}',
  'move.step': '{name} throws {value}. {from} → {to}.\n{to}. {title}',

  // --- reports ---------------------------------------------------------------
  'report.notSeated': 'You are not at this table.',
  'report.empty': 'Send /report followed by what the plan brings up.',
  'report.filed': '{name} has reported. You may throw.',

  // --- reading a plan --------------------------------------------------------
  'plan.which': 'Which plan? Send /plan followed by a number, 1 to 72.',
  'plan.range': 'The board runs from 1 to 72.',
  'plan.continues': '…continues. /plan {plan} again for the rest.',

  // --- the path --------------------------------------------------------------
  'path.absent': 'This bot is not keeping reports, so there is no path to show.',
  'path.empty': 'You have not written anything yet. /report on the plan you are standing on.',
  'path.heading': {
    one: 'Your path — {count} plan.',
    other: 'Your path — {count} plans.',
  },

  // --- the board -------------------------------------------------------------
  'board.legend': '🕉 68 · 🐍 snake · 🏹 arrow',
  'standings.finished': 'Cosmic Consciousness 🕉',
  'standings.done': 'finished 🕉',
  'standings.waiting': 'waiting for a six',
  'standings.plan': 'plan {plan}',
  'standings.owes': 'owes a report',

  // --- buttons ---------------------------------------------------------------
  'button.roll': '🎲 Roll',
  'button.plan': '📖 My plan',
  'button.board': '🗺 Board',
  'button.join': '🪑 Join',
  'button.start': '▶️ Start',

  // --- the transport speaking for itself -------------------------------------
  'chat.noTable': 'No table here yet. Send /new to open one.',
  'chat.running': 'A game is already running here. Finish it, or send /end.',
  'chat.tableOpen': 'A table is already open here. /join to sit, /start to begin, /end to clear it.',
  'chat.cleared': 'The table is cleared.',
  'chat.noTableShort': 'No table here yet. /new opens one.',
  'chat.noTableHelp': 'No table here yet. /new opens one, /help explains the rest.',
  'chat.unknown': 'I do not know that one. /help lists what I answer to.',
  'chat.hint': '/roll to throw, /board to see where everyone stands, /help for the rest.',
  'chat.private':
    'That answer is yours alone, and I cannot message you directly yet. ' +
    'Open a chat with me, send /start, then try {command} again.',

  // --- the mini app ----------------------------------------------------------
  //
  // Phrased in the second person and without a name: the mini app is one
  // player alone, where the bot is a table. The same sentence would be wrong
  // in both, so these are their own keys rather than shared ones.
  'app.waiting': 'Throw a six to enter the game',
  'app.entered': 'A six. You enter the game on {to}. {title}',
  'app.needSix': 'You threw {value}. It takes a six to enter the game.',
  'app.noRoom': 'You threw {value}. Not enough room — you stay on {to}.',
  'app.threeSixes': 'A third six. The run burns and you return to {to}. {title}',
  'app.won': 'You reach Cosmic Consciousness. 🕉',
  'app.snake': 'You threw {value}. A snake at {from} takes you to {to}. {title}',
  'app.arrow': 'You threw {value}. An arrow at {from} takes you to {to}. {title}',
  'app.step': 'You threw {value}. {from} → {to}. {title}',
  'app.unloadable': 'The plan texts could not be loaded. Reopening the app usually fixes it.',
  'app.boardLabel': 'The board, 72 plans',
  'app.opening': 'A six puts you on the board.',
  'app.roll': 'Roll',
  'app.read': 'Read this plan',
  'app.close': 'Close',

  // --- the companion ---------------------------------------------------------
  'companion.unavailable':
    'Sit with plan {plan} for now — the text is there to read, and ' +
    'the reflection is yours either way. The companion is unavailable.',

  // --- help ------------------------------------------------------------------
  help: [
    'Leela — the game of self-knowledge.',
    '',
    '/new — open a table',
    '/join — take a seat',
    '/start — begin (host only)',
    '/roll — throw the die',
    '/report <text> — reflect on the plan you stand on',
    '/plan [n] — read a plan',
    '/path — what you have written, and where',
    '/board — where everyone stands',
    '',
    'A six puts you on the board. Reaching 68 exactly wins.',
    'You cannot throw again until you have reported on where you are.',
  ].join('\n'),
} as const satisfies Record<string, Message>;

export type MessageKey = keyof typeof EN;

/**
 * Russian, the language the plans were written in.
 *
 * Terms follow the published app's own translation file rather than being
 * chosen fresh: план, отчёт, змея, кубик. A player who used `com.leelagame`
 * should recognise the vocabulary.
 *
 * Phrasing avoids gendered verbs — Russian marks gender in the past tense and
 * the bot does not know a player's, so "написал отчёт" would be wrong for half
 * the table. Hence "Отчёт от {name} принят".
 */
const RU: Partial<Record<MessageKey, Message>> = {
  'table.opened':
    'Стол открыт. {host} за столом.\n' +
    'Играть могут до {seats} человек — отправьте /join.\n' +
    'Когда все сядут, {host} отправляет /start.',
  'join.started': 'Эта игра уже началась.',
  'join.already': 'Вы уже за столом. /start начинает игру, когда все сядут.',
  'join.full': 'За столом {seats} мест, и они заняты.',
  'join.took': '{name} садится за стол. Игроков за столом: {count}.',
  'start.already': 'Игра уже идёт.',
  'start.hostOnly': 'Начать может только тот, кто открыл стол.',
  'start.begins':
    'Игра начинается. Первым ходит {name}.\nШестёрка выводит на доску — отправьте /roll.',

  'roll.notStarted': 'Стол ещё не начал игру — сначала /start.',
  'roll.over': 'Эта игра окончена. /new открывает новый стол, /path показывает написанное вами.',
  'roll.notYourTurn': 'Сейчас ходит {name}.',
  'roll.reportRequired':
    'Вы стоите на плане {plan}. {title}.\n' +
    'Напишите, что он в вас поднимает, прежде чем идти дальше — отправьте /report и свои слова.',
  'roll.cooldown': 'Пока нет. Следующий бросок через {wait}.',
  'roll.reached': '{name} достигает Космического Сознания. 🕉',
  'roll.ended':
    'Вот и вся игра. /path показывает написанное по пути; /new открывает новый стол.',
  'roll.next': 'Следующий ход — {name}.',
  'roll.again': 'Шестёрка — бросайте ещё раз.',

  'move.enter': '{name} бросает шестёрку и входит в игру на {to}.\n{to}. {title}',
  'move.needSix': '{name} бросает {value}. Войти в игру можно только с шестёрки.',
  'move.refused': '{name} бросает {value}. Не хватает места — бросок не проходит.',
  'move.threeSixes':
    '{name} бросает {value}. Третья шестёрка — серия сгорает, назад на {to}.\n{to}. {title}',
  'move.snake': '{name} бросает {value}. Змея на {from} уводит на {to}.\n{to}. {title}',
  'move.arrow': '{name} бросает {value}. Стрела на {from} поднимает на {to}.\n{to}. {title}',
  'move.step': '{name} бросает {value}. {from} → {to}.\n{to}. {title}',

  'report.notSeated': 'Вы не за этим столом.',
  'report.empty': 'Отправьте /report и то, что поднимает этот план.',
  'report.filed': 'Отчёт от {name} принят. Можно бросать.',

  'plan.which': 'Какой план? Отправьте /plan и число от 1 до 72.',
  'plan.range': 'Доска идёт от 1 до 72.',
  'plan.continues': '…продолжение. /plan {plan} ещё раз, чтобы прочесть остальное.',

  'path.absent': 'Этот бот не хранит отчёты, поэтому пути не показать.',
  'path.empty': 'Вы пока ничего не написали. /report на плане, где стоите.',
  'path.heading': {
    one: 'Ваш путь — {count} план.',
    few: 'Ваш путь — {count} плана.',
    many: 'Ваш путь — {count} планов.',
    other: 'Ваш путь — {count} плана.',
  },

  'board.legend': '🕉 68 · 🐍 змея · 🏹 стрела',
  'standings.finished': 'Космическое Сознание 🕉',
  'standings.done': 'финиш 🕉',
  'standings.waiting': 'ждёт шестёрку',
  'standings.plan': 'план {plan}',
  'standings.owes': 'отчёт не написан',

  'button.roll': '🎲 Бросок',
  'button.plan': '📖 Мой план',
  'button.board': '🗺 Доска',
  'button.join': '🪑 Сесть',
  'button.start': '▶️ Начать',

  'chat.noTable': 'Здесь ещё нет стола. Отправьте /new, чтобы открыть.',
  'chat.running': 'Здесь уже идёт игра. Закончите её или отправьте /end.',
  'chat.tableOpen': 'Здесь уже открыт стол. /join — сесть, /start — начать, /end — убрать стол.',
  'chat.cleared': 'Стол убран.',
  'chat.noTableShort': 'Здесь ещё нет стола. /new открывает.',
  'chat.noTableHelp': 'Здесь ещё нет стола. /new открывает, /help объясняет остальное.',
  'chat.unknown': 'Я такого не знаю. /help перечисляет, на что я отвечаю.',
  'chat.hint': '/roll — бросить кубик, /board — где все стоят, /help — остальное.',
  'chat.private':
    'Этот ответ только ваш, а написать вам напрямую я пока не могу. ' +
    'Откройте со мной чат, отправьте /start и повторите {command}.',

  'app.waiting': 'Бросьте шестёрку, чтобы войти в игру',
  'app.entered': 'Шестёрка. Вы входите в игру на {to}. {title}',
  'app.needSix': 'Выпало {value}. Войти в игру можно только с шестёрки.',
  'app.noRoom': 'Выпало {value}. Не хватает места — вы остаётесь на {to}.',
  'app.threeSixes': 'Третья шестёрка. Серия сгорает, и вы возвращаетесь на {to}. {title}',
  'app.won': 'Вы достигаете Космического Сознания. 🕉',
  'app.snake': 'Выпало {value}. Змея на {from} уводит вас на {to}. {title}',
  'app.arrow': 'Выпало {value}. Стрела на {from} поднимает вас на {to}. {title}',
  'app.step': 'Выпало {value}. {from} → {to}. {title}',
  'app.unloadable': 'Тексты планов не загрузились. Обычно помогает открыть приложение заново.',
  'app.boardLabel': 'Доска, 72 плана',
  'app.opening': 'Шестёрка выводит вас на доску.',
  'app.roll': 'Бросок',
  'app.read': 'Прочесть план',
  'app.close': 'Закрыть',

  'companion.unavailable':
    'Побудьте пока с планом {plan} — текст можно прочесть, и отражение ' +
    'всё равно ваше. Спутник сейчас недоступен.',

  help: [
    'Лила — игра самопознания.',
    '',
    '/new — открыть стол',
    '/join — сесть за стол',
    '/start — начать (только тот, кто открыл)',
    '/roll — бросить кубик',
    '/report <текст> — отчёт о плане, на котором стоите',
    '/plan [n] — прочесть план',
    '/path — что вы написали и где',
    '/board — где все стоят',
    '',
    'Шестёрка выводит на доску. Побеждает точное попадание на 68.',
    'Пока не написан отчёт о своём плане, бросать снова нельзя.',
  ].join('\n'),
};

/**
 * Every catalogue, by language.
 *
 * The twenty absent ones are not an oversight — see the note at the top of the
 * file. `messageCoverage` is how that is reported rather than assumed.
 */
const CATALOGUES: Partial<Record<Language, Partial<Record<MessageKey, Message>>>> = {
  en: EN,
  ru: RU,
};

/** `{name}` — deliberately narrow, so `{` in a plan's text is left alone. */
const PLACEHOLDER = /\{([a-z][a-z0-9]*)\}/gi;

/** The placeholder names a message expects, in order of first appearance. */
export function placeholdersIn(message: Message): string[] {
  const texts = typeof message === 'string' ? [message] : Object.values(message);
  const found = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(PLACEHOLDER)) found.add(match[1]);
  }
  return [...found];
}

/**
 * Choose a plural form the way the language does.
 *
 * `Intl.PluralRules` is in every runtime this monorepo targets. A language
 * whose form is absent falls back to `other`, which is the one form every
 * catalogue must carry.
 */
function pluralForm(forms: PluralForms, language: Language, count: number): string {
  const category = new Intl.PluralRules(language).select(count);
  return forms[category] ?? forms.other;
}

/**
 * A sentence, in the room's language.
 *
 * Falls back to English per key rather than per language, so a half-translated
 * catalogue is useful immediately instead of being all-or-nothing.
 *
 * A placeholder with no matching parameter is left visible. A missing name is a
 * defect to see in a test, not a reason to fail sending a message to a player
 * mid-game — and `messageIssues` plus the pseudo-language test in `apps/bot`
 * are where it is meant to be caught.
 */
export function messageFor(
  locale: string | Language | undefined | null,
  key: MessageKey,
  params: MessageParams = {},
): string {
  const language = resolveLanguage(typeof locale === 'string' ? locale : undefined);
  const message = CATALOGUES[language]?.[key] ?? EN[key];

  const count = typeof params.count === 'number' ? params.count : 0;
  const text = typeof message === 'string' ? message : pluralForm(message, language, count);

  return text.replace(PLACEHOLDER, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

export interface LanguageCoverage {
  language: Language;
  /** Keys this language carries itself. */
  translated: number;
  /** Keys in the catalogue altogether. */
  total: number;
  /** Keys served in English to a player who did not ask for English. */
  missing: MessageKey[];
}

/** What each language actually covers. Reported, so the gap is not invisible. */
export function messageCoverage(): LanguageCoverage[] {
  const keys = Object.keys(EN) as MessageKey[];

  return (Object.keys(CATALOGUES) as Language[]).map((language) => {
    const catalogue = CATALOGUES[language] ?? {};
    const missing = keys.filter((key) => catalogue[key] === undefined);
    return {
      language,
      translated: keys.length - missing.length,
      total: keys.length,
      missing,
    };
  });
}

export interface MessageIssue {
  language: Language;
  key: MessageKey;
  problem: string;
}

/**
 * Everything wrong with a catalogue that is not a matter of taste.
 *
 * Three kinds, all of which have shipped in real products:
 *
 *   - a placeholder the English text does not have, so it is never filled and
 *     the player reads `{plan}`;
 *   - a placeholder the English text has and the translation dropped, so the
 *     sentence names nobody;
 *   - a plural form the language requires and the catalogue does not offer, so
 *     Russian reads "5 плана".
 *
 * A test asserts this list is empty. That is a different assertion from one
 * that lists the mistakes already found.
 */
export function messageIssues(): MessageIssue[] {
  const issues: MessageIssue[] = [];
  const keys = Object.keys(EN) as MessageKey[];

  for (const language of Object.keys(CATALOGUES) as Language[]) {
    const catalogue = CATALOGUES[language] ?? {};
    const categories = new Intl.PluralRules(language).resolvedOptions().pluralCategories;

    for (const key of keys) {
      const translation = catalogue[key];
      if (translation === undefined) continue;

      const expected = placeholdersIn(EN[key]);
      const actual = placeholdersIn(translation);

      for (const name of actual) {
        if (!expected.includes(name)) {
          issues.push({ language, key, problem: `has a placeholder English lacks: {${name}}` });
        }
      }

      for (const name of expected) {
        if (!actual.includes(name)) {
          issues.push({ language, key, problem: `drops the placeholder {${name}}` });
        }
      }

      // Only plural messages are held to the language's plural forms; a
      // language that needs `few` does not need it for a sentence with no count.
      if (typeof EN[key] !== 'string') {
        const forms = typeof translation === 'string' ? null : translation;
        if (forms === null) {
          issues.push({ language, key, problem: 'is a single string where plural forms are needed' });
          continue;
        }
        for (const category of categories) {
          if (forms[category] === undefined) {
            issues.push({ language, key, problem: `has no ${category} form` });
          }
        }
      }
    }
  }

  return issues;
}

/** The catalogue itself, for tests and for a translator's tooling. */
export function englishCatalogue(): Record<MessageKey, Message> {
  return { ...EN };
}

/** Languages with a catalogue of their own, English first. */
export function translatedLanguages(): Language[] {
  const languages = Object.keys(CATALOGUES) as Language[];
  return [FALLBACK_LANGUAGE, ...languages.filter((l) => l !== FALLBACK_LANGUAGE)];
}
