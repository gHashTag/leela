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

import { FALLBACK_LANGUAGE, type Language, resolveLanguage } from './language';

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
  /**
   * The end, with the last account still owed.
   *
   * `classic` asks for a report on 68 — the square a whole game is played to
   * reach was, for a while, the one arrival nobody was ever asked to write
   * about, and a pass went into making that account possible. Having made it
   * possible, the closing line pointed at `/path` and `/new` and not at
   * `/report`. Every other arrival is met with the words that discharge it —
   * *write what it brings up before you move on, send /report followed by your
   * words* — and this one was met with a sentence about looking back.
   *
   * The standings above it do say *owes a report*, in a list. An obligation
   * named in a parenthesis, in the same breath as *that is the game*, is an
   * obligation nobody will read as one.
   */
  'roll.endedOwing':
    'That is the game — and the square it was played to reach is still to be ' +
    'written about. Send /report followed by your words, and then /path shows ' +
    'the whole of it.',
  'roll.next': '{name} is next.',
  'roll.again': 'A six — throw again.',
  /**
   * The six that has to wait for an account.
   *
   * `roll.again` was announced whenever the six kept the turn, and a six that
   * moves a player onto a new square also leaves them owing a report — which
   * is **every entering six**, the first one of every game. So the bot said
   * *A six — throw again*, and refused the next throw with *write what it
   * brings up before you move on*: two sentences in a row, contradicting each
   * other, on the most-travelled path in the game.
   */
  'roll.againAfter': 'A six — and another throw, once you have written about this plan.',

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
  // A player who has not entered stands on no square. The bot used to take the
  // report anyway and file it against 68 — Cosmic Consciousness — so somebody
  // who had never thrown a six ended up with an account of the winning square
  // in the record the game exists to produce.
  'report.notOnBoard':
    'You are not on the board yet. A six puts you there, and then there is a plan to write about.',
  // One account per arrival, which is what the published app files and what the
  // deployed contract requires before each roll. A second one about the same
  // visit would make the square look like one the player returned to.
  'report.already': 'You have already written about {plan}. The next report belongs to the next square.',
  'report.tooShort':
    'A report is a reflection, not a line to open the gate — {count} characters at least.',
  'report.filed': '{name} has reported. You may throw.',
  // "You may throw" was said unconditionally, including to a player who had
  // just reached Cosmic Consciousness — one line after the bot announced the
  // game was over — and to a player reporting while somebody else held the
  // turn. A sentence has to be true of the player it is about.
  'report.filedDone': '{name} has reported. Their game is complete. 🕉',
  'report.filedTurn': "{name} has reported. It is {holder}'s turn.",
  'report.filedWait': '{name} has reported. Their next throw is in {wait}.',

  // --- reading a plan --------------------------------------------------------
  'plan.which': 'Which plan? Send /plan followed by a number, 1 to 72.',
  'plan.range': 'The board runs from 1 to 72.',
  // Numbered, because "again" returned the same page: one plan text in eight
  // is over the limit a chat can carry, and the rest of it was unreachable
  // under an instruction saying how to reach it.
  'plan.continues': '…continues. /plan {plan} {next} for page {next} of {pages}.',
  'rules.title': 'The rules of the game. /rules followed by a number opens one.',
  'rules.which': 'Which chapter? /rules followed by a number, 1 to {count}.',
  'rules.continues': '…continues. /rules {chapter} {next} for page {next} of {pages}.',
  'rules.none': 'The rules are not written down in this language yet.',
  'writer.left': '{count} characters left.',
  'writer.full': 'This is as long as a report can be kept here.',
  'writer.pathFull': 'Your path is full: saving this drops the oldest entry. Save a copy first.',
  'ask.what': 'Ask what? /ask followed by your question about the plan you stand on.',
  'ask.notSeated': 'Take a seat first — /join.',
  // The companion answers from the text of the square you are standing on, and
  // a player who has not entered is standing on none. Asked before the first
  // six, the bot used to say they were on plan 68 — Cosmic Consciousness — so
  // the answer rested on the wrong square entirely.
  // The question the game is played to answer. The bot had nowhere to keep one,
  // so the companion — which reads every report — had never been told what the
  // reports were answering.
  'intention.ask': 'What are you playing for? Send /intention followed by your answer.',
  'intention.yours': 'You are playing to answer this:\n{text}\n\n/intention followed by something else changes it.',
  'intention.none': 'You have not said what you are playing for. /intention followed by your answer.',
  'intention.set': 'Held. Everything you write is an answer to it now.',
  'intention.tooShort': 'A little more than that — two characters at least.',
  'intention.notKept': 'This bot is not keeping anything, so there is nowhere to hold a question.',
  'ask.notOnBoard':
    'You are not on the board yet, so there is no plan to ask about. A six puts you there; /rules opens the book meanwhile.',
  'ask.silent': 'The companion is not answering just now. Your question is not lost; ask again later.',

  // --- the path --------------------------------------------------------------
  'path.absent': 'This bot is not keeping reports, so there is no path to show.',
  'path.empty': 'You have not written anything yet. /report on the plan you are standing on.',
  'path.heading': {
    one: 'Your path — {count} plan.',
    other: 'Your path — {count} plans.',
  },

  // --- the squares that came back ---------------------------------------------
  // A path is everything, oldest first, and says nothing about what recurred.
  // Leela's teaching is the recurrence, and both surfaces held it unread.
  'returns.none':
    'No square has come back yet. When one does, /returns puts what you wrote side by side.',
  'returns.heading': {
    one: '{count} square has come back to you.',
    other: '{count} squares have come back to you.',
  },
  'returns.times': {
    one: '{plan}. {title} — {count} time',
    other: '{plan}. {title} — {count} times',
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
  // A turn that could not be kept is a turn that did not happen. Said out loud,
  // because the alternative was silence — and silence is indistinguishable from
  // a broken bot, which is how this one first looked.
  'chat.notKept': 'I could not keep that. Nothing has moved — send it again in a moment.',

  'chat.noTable': 'No table here yet. Send /new to open one.',
  'chat.running': 'A game is already running here. Finish it, or send /end.',
  'chat.tableOpen': 'A table is already open here. /join to sit, /start to begin, /end to clear it.',
  'chat.cleared': 'The table is cleared.',
  /**
   * `/end` used to answer this to anybody who typed it, in a group as well as
   * in a private chat, and to answer it whether or not there was a table. Two
   * sentences replace one: a game in progress belongs to the people sitting at
   * it, and clearing nothing is not clearing something.
   */
  'chat.endNotYours': 'This table is being played. Only somebody sitting at it may clear it.',
  'chat.noTableShort': 'No table here yet. /new opens one.',
  'chat.noTableHelp': 'No table here yet. /new opens one, /help explains the rest.',
  'chat.unknown': 'I do not know that one. /help lists what I answer to.',
  'chat.hint': '/roll to throw, /board to see where everyone stands, /help for the rest.',
  'chat.private':
    'That answer is yours alone, and I cannot message you directly yet. ' +
    'Open a chat with me, send /start, then try {command} again.',

  // A path arriving as a file from the mini app. One-way and manual, and the
  // only bridge between the two surfaces that needs no server.
  'file.took': {
    one: 'Took in {count} plan from your file. /path shows the whole of it.',
    other: 'Took in {count} plans from your file. /path shows the whole of it.',
  },
  'file.nothingNew': 'Nothing in that file is new to me.',
  'file.unreadable': 'That is not a path written by Leela. Save one from the mini app.',
  // Not the same fact, and it used to be said with the same sentence: a
  // download that failed blamed the player's file, which was fine, and sent
  // them to save it again for the same answer.
  'file.notFetched': 'I could not fetch that file. Nothing has changed — send it again in a moment.',
  // Said while their own words are still a scroll above. The throw stands —
  // they wrote it, and a full database is not their doing — but the account
  // itself was lost, and it used to be lost under "you may throw".
  'report.notKept': 'Your throw stands, but I could not keep what you wrote. Copy it somewhere before it scrolls away.',
  // The floor. Said when nothing more precise is known — which is better than
  // the silence it replaces, and honest about not knowing.
  'chat.wentWrong': 'Something went wrong handling that. Try it again in a moment.',
  'file.tooBig': 'That file is too large to be a path.',
  'file.notKept': 'This bot is not keeping reports, so there is nowhere to put a path.',
  'file.saved': {
    one: 'Your path — {count} plan. Keep it somewhere that outlives this chat.',
    other: 'Your path — {count} plans. Keep it somewhere that outlives this chat.',
  },
  'file.nothingToSave': 'You have not written anything to save yet.',

  // One square, sent as words rather than as a file. A file is a path; this is
  // the thing people actually pass on.
  'square.took': 'Taken in on {plan}, dated today — a shared square carries no date.',
  'square.had': 'You already have that one, word for word.',
  'square.unreadable':
    'That does not read as a square. Send the whole of it after /take — heading and all.',
  'square.notKept': 'This bot is not keeping reports, so there is nowhere to put a square.',

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
  // The published app's own two header buttons: `:information_source:` opens
  // the rules book, `:books:` opens all 72 plans. See GameScreen's Header.
  'app.rules': 'Rules of the game',
  'app.plans': 'All 72 plans',
  /**
   * The book's own chrome, which had none.
   *
   * `apps/docs` generates 1,784 pages in twenty-two languages and said **no
   * catalogue key at all**: a Russian reader met Russian plan text under an
   * English heading, with English links to the contents, the legal documents
   * and the game. It was the only surface that spoke none of this.
   */
  'app.play': 'Play',
  'app.contents': 'Contents',
  'app.legal': 'Legal',
  'app.policy': 'Privacy policy',
  'app.terms': 'Terms of use',
  /** The language picker's name, for a screen reader. */
  'app.language': 'Language',
  /**
   * The book's subtitle, and the description a search result shows.
   *
   * `{count}` rather than a second 72 written down, and a **plural**, because
   * Russian agrees with a count: written flat it read *Игра самопознания — 72
   * планов*, the genitive plural for a number ending in five. Seventy-two takes
   * the few form, and `Intl.PluralRules` is what decides.
   */
  'app.book': {
    one: 'The game of self-knowledge — {count} plan',
    other: 'The game of self-knowledge — {count} plans',
  },
  'app.restart': 'Start over',
  'app.restarted': 'A new game. Throw a six to enter it.',
  'app.opening': 'A six puts you on the board.',
  // Coming back to a game already in progress. The opening line was written
  // into the page once and never revised, so a player standing on 30 with six
  // squares behind them was greeted with the instruction for somebody who has
  // never entered.
  'app.standing': 'You are on {plan}. {title}',
  // Reading a square you have stood on before. Leela's teaching is that you
  // come back, and what you said last time is the measure of what has changed.
  'app.borrowed': 'in English — this chapter is missing from your book',
  'app.cameBack': 'Came back to you',
  // A square arriving as words. The path has had a file since the twelfth pass;
  // a square could be shared and never received.
  'app.paste': 'Paste a square',
  // The phone's one field takes either — `takeSquare` first, `takeIn` after,
  // because a square is a message and a path is a file, and the format tells
  // them apart rather than asking the player which they have. Neither
  // `app.paste` nor `app.pathImport` says that, and using the nearer of the two
  // would be the fifth time in this repository that a sentence named the wrong
  // thing because it was the one already written.
  'app.pasteEither': 'Paste a square or a whole path',
  'app.pasteAsk': 'Paste a square somebody sent you',
  'app.pasteTake': 'Take it in',
  'app.pasteHint': 'One square, as it was shared: the number, the title, and what was written.',
  'app.pasteUnreadable': 'That does not read as a square. Paste the whole of it, heading and all.',
  // Dated today on purpose, and said so: a shared square carries no time, and
  // inventing one would put it in the wrong place in a path.
  'app.pasteTook': 'Taken in on {plan}, dated today — a shared square carries no date.',
  'app.pasteHad': 'You already have that one, word for word.',
  'app.wroteHere': 'What you wrote here before',
  'app.wroteOnce': 'What you wrote here',
  'app.returns': {
    one: 'stood here {count} time',
    other: 'stood here {count} times',
  },
  // And the end of it, which is a state and not a moment: the app announced
  // the win as it happened and then, on the next load, went back to telling
  // the winner how to enter.
  'app.finished': 'You reached Cosmic Consciousness. The game is complete. 🕉',
  'app.roll': 'Roll',
  'app.read': 'Read this plan',

  // The report gate. The rule the deployed contract enforces and the published
  // app carried as `isReported`: write about the plan you are standing on
  // before throwing again.
  'app.reportNeeded': 'Write what this plan brings up before you throw again.',
  'app.reportWrite': 'Write a report',
  'app.reportPlaceholder': 'What does this plan bring up?',
  'app.reportSave': 'Save',
  'app.reportSaved': 'Written. You may throw.',
  // The same sentence the bot used to say to a winner. The last report of a
  // game is the one on Cosmic Consciousness, and being told to throw again
  // while the die is dimmed is the app describing a game the player is not in.
  'app.reportSavedDone': 'Written. The game is complete. 🕉',
  // The account was taken and could not be stored. Said rather than swallowed:
  // it used to answer "Written. You may throw." and the writing was gone by the
  // next load, with nothing to say it had ever existed.
  'app.reportUnkept':
    'Written, and this browser will not keep it — save a copy from “My path” before you close the tab.',
  /**
   * The same fact on a device that is not a browser.
   *
   * The phone said the sentence above, which names a browser, a tab and a
   * screen it does not have: `apps/mobile` shows what was written about the
   * square being stood on and has no path view at all. So the one thing it
   * said at the one moment a player needed a true instruction was impossible
   * on three counts. Share is what that surface has.
   */
  'app.notKept':
    'Written, and this phone will not keep it — send yourself a copy with Share.',
  /**
   * And the question, which nothing said anything about.
   *
   * The device write that keeps it had its answer discarded, while the check
   * that decided what to say was on the session's own `Map`, which cannot fail.
   * So a player answered what they are playing for, the disk refused, and they
   * were told it was held — and asked again at the next launch.
   */
  'app.intentionNotKept':
    'Held for this game, and this phone will not keep it — you may be asked again next time.',
  // The table itself could not be stored. Said once, not on every throw: the
  // game plays on in a window that keeps nothing, and used to describe every
  // snake and arrow as though the board would still be there tomorrow.
  'app.gameUnkept':
    'This browser will not keep the game — the board will be as it was when you come back.',
  'app.reportSavedTurn': 'Written. Player {seat} throws next.',
  'app.reportEmpty': 'A report is something written. Nothing was.',
  'app.seatTurn': 'Player {seat}',
  // Whose throw the sentence is about. At a table the header has already moved
  // on to the next player by the time it is read, so "you threw four" reads as
  // the wrong person's throw.
  'app.seatSaid': 'Player {seat} — {said}',
  'app.share': 'Share',
  // The mini app has everything the companion is given except the companion:
  // it is a static page, and a model needs a key. Telegram's own bridge carries
  // the square to the bot, which has one.
  'app.ask': 'Ask the companion',
  // Telegram's hand-over is capped at 4096 *bytes*, and a Cyrillic or Devanagari
  // character costs two or three. So the boundary is not where the writing box
  // says it is, and crossing it did nothing at all — no error, no reply, not
  // even the app closing, which is the only sign the hand-over worked.
  'app.askTooLong':
    'Too long to hand over. About {over} characters have to go in this alphabet — or save it and share the square instead.',
  'app.shareCopied': 'Copied. Paste it wherever you like.',
  'app.shareRefused': 'This browser will not share or copy. The text is in the box.',
  'app.players': 'Players',
  'app.playersAsk': 'How many are playing from this device?',
  'app.playersSet': 'Seated {count}. Player 1 throws first.',
  'app.intention': 'What are you playing for?',
  'app.intentionHint': 'A sentence is enough. It is the question the game answers.',
  'app.intentionShort': 'Two characters at least — say something you mean.',
  'app.intentionSaved': 'Held. Throw a six to begin.',
  'app.intentionChange': 'Change it',
  'app.intentionYours': 'You are playing for:',
  'app.path': 'My path',
  'app.pathEmpty': 'You have not written anything yet.',
  'app.pathCount': {
    one: 'Your path — {count} plan.',
    other: 'Your path — {count} plans.',
  },
  'app.pathLocal':
    'These stay on this device. The bot keeps them for a table, and shares them there.',
  'app.pathExport': 'Save a copy',
  // Named when there is more than one seat. A file is one player's path, and a
  // button that does not say whose saves the wrong one silently.
  'app.pathExportSeat': 'Save Player {seat}’s copy',
  'app.pathEveryone': 'The paths at this table',
  'app.pathImport': 'Bring one back',
  /**
   * And whose it comes back into.
   *
   * The path view shows a section per seat, and its footer has three doors into
   * and out of a journal. Two of them name the seat — *Save Player 1's copy*,
   * and *Player 3 · Paste a square somebody sent you* — and this one said only
   * *Bring one back*, while merging a whole path, and the question it was
   * written under, into whichever seat happened to hold the turn.
   */
  'app.pathImportSeat': 'Bring one back for Player {seat}',
  'app.pathExported': 'Saved, and a readable copy is on the clipboard.',
  'app.pathImported': {
    one: '{count} plan brought back.',
    other: '{count} plans brought back.',
  },
  /**
   * What the bound cost. Said beside the count, never instead of it: a player
   * brought accounts in *and* lost older ones, and both are true.
   */
  'app.pathImportedCapped': {
    one: '{count} of your oldest accounts no longer fits and is gone.',
    other: '{count} of your oldest accounts no longer fit and are gone.',
  },
  'app.pathImportedNothing': 'Nothing new in that file.',
  'app.pathUnreadable': 'That file is not a path this app wrote.',
  'app.close': 'Close',

  // --- the companion ---------------------------------------------------------
  'companion.unavailable':
    'Sit with plan {plan} for now — the text is there to read, and ' +
    'the reflection is yours either way. The companion is unavailable.',

  // --- help ------------------------------------------------------------------
  // The menu Telegram shows behind the `/` button. Short by necessity: it is a
  // list of one-liners in a popover, not documentation, and Telegram refuses a
  // description over 256 characters — refusing the whole menu, not the entry.
  'menu.new': 'Open a table',
  'menu.join': 'Take a seat',
  'menu.start': 'Begin the game (host only)',
  'menu.roll': 'Throw the die',
  'menu.intention': 'Say what you are playing for',
  'menu.report': 'Reflect on the square you stand on',
  'menu.plan': 'Read a plan',
  'menu.rules': 'The rules of the game, in chapters',
  'menu.ask': 'Ask the companion about where you stand',
  'menu.path': 'What you have written, and where',
  'menu.returns': 'The squares that came back',
  'menu.take': 'Take in a square somebody sent you',
  'menu.save': 'Your path, as a file to keep',
  'menu.board': 'Where everyone stands',
  'menu.end': 'Clear the table',
  'menu.help': 'What this bot can do',

  help: [
    'Leela — the game of self-knowledge.',
    '',
    '/new — open a table',
    '/join — take a seat',
    '/start — begin (host only)',
    '/roll — throw the die',
    '/intention <text> — what you are playing for, which the companion is told',
    '/report <text> — reflect on the plan you stand on',
    '/plan [n] — read a plan',
    '/rules [n] — the rules of the game, in chapters',
    '/ask <question> — ask the companion about where you stand',
    '/path — what you have written, and where',
    '/returns — the squares that came back, and what you said each time',
    '/take <square> — take in a square somebody sent you',
    '/save — the same, as a file you can keep',
    '/board — where everyone stands',
    '/end — clear the table',
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
  'roll.endedOwing':
    'Вот и вся игра — и о квадрате, ради которого она игралась, ещё не написано. ' +
    'Отправьте /report и свои слова, а потом /path покажет всё целиком.',
  'roll.next': 'Следующий ход — {name}.',
  'roll.again': 'Шестёрка — бросайте ещё раз.',
  'roll.againAfter': 'Шестёрка — и ещё один бросок, когда напишете об этом плане.',

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
  'report.notOnBoard':
    'Вы ещё не на доске. Шестёрка выводит вас туда — тогда и появится план, о котором писать.',
  'report.already': 'Вы уже написали о плане {plan}. Следующий отчёт — о следующей клетке.',
  'report.tooShort':
    'Отчёт — это размышление, а не строчка, чтобы открыть ворота: хотя бы {count} символов.',
  'report.filed': 'Отчёт от {name} принят. Можно бросать.',
  'report.filedDone': 'Отчёт от {name} принят. Игра завершена. 🕉',
  'report.filedTurn': 'Отчёт от {name} принят. Сейчас ход {holder}.',
  'report.filedWait': 'Отчёт от {name} принят. Следующий бросок через {wait}.',

  'plan.which': 'Какой план? Отправьте /plan и число от 1 до 72.',
  'plan.range': 'Доска идёт от 1 до 72.',
  'plan.continues': '…продолжение. /plan {plan} {next} — страница {next} из {pages}.',
  'rules.title': 'Правила игры. /rules и число открывает главу.',
  'rules.which': 'Какая глава? /rules и число от 1 до {count}.',
  'rules.continues': '…продолжение. /rules {chapter} {next} — страница {next} из {pages}.',
  'rules.none': 'Правила на этом языке ещё не записаны.',
  'writer.left': 'Осталось символов: {count}.',
  'writer.full': 'Длиннее отчёт здесь сохранить нельзя.',
  'writer.pathFull': 'Путь заполнен: это сохранение вытеснит самую старую запись. Сначала сохраните копию.',
  'ask.what': 'Спросить о чём? /ask и ваш вопрос о плане, на котором стоите.',
  'ask.notSeated': 'Сначала сядьте за стол — /join.',
  'intention.ask': 'Ради чего вы играете? Отправьте /intention и ваш ответ.',
  'intention.yours': 'Вы играете, чтобы ответить на это:\n{text}\n\n/intention с другим текстом меняет вопрос.',
  'intention.none': 'Вы не сказали, ради чего играете. /intention и ваш ответ.',
  'intention.set': 'Принято. Теперь всё, что вы пишете, — ответ на это.',
  'intention.tooShort': 'Чуть больше — хотя бы два символа.',
  'intention.notKept': 'Этот бот ничего не хранит, поэтому держать вопрос негде.',
  'ask.notOnBoard':
    'Вы ещё не на доске, и спрашивать пока не о чем. Шестёрка выведет вас туда; а пока /rules открывает книгу.',
  'ask.silent': 'Спутник сейчас не отвечает. Вопрос не потерян — спросите позже.',

  'path.absent': 'Этот бот не хранит отчёты, поэтому пути не показать.',
  'path.empty': 'Вы пока ничего не написали. /report на плане, где стоите.',
  'path.heading': {
    one: 'Ваш путь — {count} план.',
    few: 'Ваш путь — {count} плана.',
    many: 'Ваш путь — {count} планов.',
    other: 'Ваш путь — {count} плана.',
  },

  'returns.none':
    'Пока ни одна клетка не вернулась. Когда вернётся, /returns покажет написанное рядом.',
  'returns.heading': {
    one: 'К вам вернулась {count} клетка.',
    few: 'К вам вернулись {count} клетки.',
    many: 'К вам вернулось {count} клеток.',
    other: 'К вам вернулись {count} клетки.',
  },
  'returns.times': {
    one: '{plan}. {title} — {count} раз',
    few: '{plan}. {title} — {count} раза',
    many: '{plan}. {title} — {count} раз',
    other: '{plan}. {title} — {count} раза',
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

  'chat.notKept': 'Не удалось сохранить. Ничего не сдвинулось — отправьте ещё раз через мгновение.',

  'chat.noTable': 'Здесь ещё нет стола. Отправьте /new, чтобы открыть.',
  'chat.running': 'Здесь уже идёт игра. Закончите её или отправьте /end.',
  'chat.tableOpen': 'Здесь уже открыт стол. /join — сесть, /start — начать, /end — убрать стол.',
  'chat.cleared': 'Стол убран.',
  'chat.endNotYours': 'За этим столом идёт игра. Убрать его может только тот, кто за ним сидит.',
  'chat.noTableShort': 'Здесь ещё нет стола. /new открывает.',
  'chat.noTableHelp': 'Здесь ещё нет стола. /new открывает, /help объясняет остальное.',
  'chat.unknown': 'Я такого не знаю. /help перечисляет, на что я отвечаю.',
  'chat.hint': '/roll — бросить кубик, /board — где все стоят, /help — остальное.',
  'chat.private':
    'Этот ответ только ваш, а написать вам напрямую я пока не могу. ' +
    'Откройте со мной чат, отправьте /start и повторите {command}.',

  'file.took': {
    one: 'Принял {count} план из вашего файла. /path покажет весь путь.',
    few: 'Принял {count} плана из вашего файла. /path покажет весь путь.',
    many: 'Принял {count} планов из вашего файла. /path покажет весь путь.',
    other: 'Принял {count} плана из вашего файла. /path покажет весь путь.',
  },
  'file.nothingNew': 'В этом файле нет ничего нового для меня.',
  'file.unreadable': 'Это не путь, записанный Лилой. Сохраните его в мини-приложении.',
  'file.notFetched': 'Не удалось получить файл. Ничего не изменилось — отправьте ещё раз через мгновение.',
  'report.notKept': 'Бросок засчитан, но записанное сохранить не удалось. Скопируйте его, пока оно не ушло вверх.',
  'chat.wentWrong': 'Что-то пошло не так при обработке. Попробуйте ещё раз через мгновение.',
  'file.tooBig': 'Этот файл слишком велик, чтобы быть путём.',
  'file.notKept': 'Этот бот не хранит отчёты, поэтому путь положить некуда.',
  'file.saved': {
    one: 'Ваш путь — {count} план. Держите там, где переживёт этот чат.',
    few: 'Ваш путь — {count} плана. Держите там, где переживёт этот чат.',
    many: 'Ваш путь — {count} планов. Держите там, где переживёт этот чат.',
    other: 'Ваш путь — {count} плана. Держите там, где переживёт этот чат.',
  },
  'file.nothingToSave': 'Вы пока ничего не написали, чтобы сохранять.',

  'square.took': 'Принято на плане {plan}, датировано сегодняшним днём — у клетки нет своей даты.',
  'square.had': 'Такая у вас уже есть, слово в слово.',
  'square.unreadable':
    'Это не читается как клетка. Пришлите её целиком после /take — вместе с заголовком.',
  'square.notKept': 'Этот бот не хранит отчёты, поэтому класть клетку некуда.',

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
  'app.rules': 'Правила игры',
  'app.plans': 'Все 72 плана',
  'app.play': 'Играть',
  'app.contents': 'Оглавление',
  'app.legal': 'Правовые документы',
  'app.policy': 'Политика конфиденциальности',
  'app.terms': 'Условия использования',
  'app.language': 'Язык',
  'app.book': {
    one: 'Игра самопознания — {count} план',
    few: 'Игра самопознания — {count} плана',
    many: 'Игра самопознания — {count} планов',
    other: 'Игра самопознания — {count} плана',
  },
  'app.restart': 'Начать заново',
  'app.restarted': 'Новая игра. Бросьте шестёрку, чтобы войти в неё.',
  'app.opening': 'Шестёрка выводит вас на доску.',
  'app.standing': 'Вы на {plan}. {title}',
  'app.borrowed': 'по-английски — этой главы нет в вашей книге',
  'app.cameBack': 'Вернулось к вам',
  'app.paste': 'Вставить клетку',
  'app.pasteEither': 'Вставьте клетку или весь путь',
  'app.pasteAsk': 'Вставьте клетку, которую вам прислали',
  'app.pasteTake': 'Принять',
  'app.pasteHint': 'Одна клетка, как её прислали: номер, название и что было написано.',
  'app.pasteUnreadable': 'Это не читается как клетка. Вставьте её целиком, вместе с заголовком.',
  'app.pasteTook': 'Принято на плане {plan}, датировано сегодняшним днём — у клетки нет своей даты.',
  'app.pasteHad': 'Такая у вас уже есть, слово в слово.',
  'app.wroteHere': 'Что вы писали здесь раньше',
  'app.wroteOnce': 'Что вы здесь написали',
  'app.returns': {
    one: 'были здесь {count} раз',
    few: 'были здесь {count} раза',
    many: 'были здесь {count} раз',
    other: 'были здесь {count} раза',
  },
  'app.finished': 'Вы достигли Космического Сознания. Игра завершена. 🕉',
  'app.roll': 'Бросок',
  'app.read': 'Прочесть план',

  'app.reportNeeded': 'Напишите, что поднимает этот план, прежде чем бросать снова.',
  'app.reportWrite': 'Написать отчёт',
  'app.reportPlaceholder': 'Что поднимает этот план?',
  'app.reportSave': 'Сохранить',
  'app.reportSaved': 'Записано. Можно бросать.',
  'app.reportSavedDone': 'Записано. Игра завершена. 🕉',
  'app.reportUnkept':
    'Записано, но этот браузер не сохранит — заберите копию в «Моём пути», прежде чем закрыть вкладку.',
  'app.notKept':
    'Записано, но этот телефон не сохранит — отправьте себе копию через «Поделиться».',
  'app.intentionNotKept':
    'Принято на эту игру, но этот телефон не сохранит — в следующий раз вопрос могут задать снова.',
  'app.gameUnkept':
    'Этот браузер не сохранит игру — доска будет такой, какой вы её оставили в прошлый раз.',
  'app.reportSavedTurn': 'Записано. Ход игрока {seat}.',
  'app.reportEmpty': 'Отчёт — это то, что написано. Здесь не написано ничего.',
  'app.seatTurn': 'Игрок {seat}',
  'app.seatSaid': 'Игрок {seat} — {said}',
  'app.share': 'Поделиться',
  'app.ask': 'Спросить спутника',
  'app.askTooLong':
    'Слишком длинно для передачи. В этом алфавите нужно убрать примерно {over} знаков — или сохранить и поделиться клеткой.',
  'app.shareCopied': 'Скопировано. Вставьте куда угодно.',
  'app.shareRefused': 'Этот браузер не делится и не копирует. Текст остался в поле.',
  'app.players': 'Игроки',
  'app.playersAsk': 'Сколько человек играет с этого устройства?',
  'app.playersSet': 'Сели: {count}. Первым бросает игрок 1.',
  'app.intention': 'Ради чего вы играете?',
  'app.intentionHint': 'Хватит одной фразы. Это вопрос, на который игра отвечает.',
  'app.intentionShort': 'Хотя бы два символа — скажите то, что имеете в виду.',
  'app.intentionSaved': 'Принято. Бросьте шестёрку, чтобы начать.',
  'app.intentionChange': 'Изменить',
  'app.intentionYours': 'Вы играете ради:',
  'app.path': 'Мой путь',
  'app.pathEmpty': 'Вы пока ничего не написали.',
  'app.pathCount': {
    one: 'Ваш путь — {count} план.',
    few: 'Ваш путь — {count} плана.',
    many: 'Ваш путь — {count} планов.',
    other: 'Ваш путь — {count} плана.',
  },
  'app.pathLocal':
    'Они остаются на этом устройстве. Бот хранит их для стола и делится ими там.',
  'app.pathExport': 'Сохранить копию',
  'app.pathExportSeat': 'Сохранить копию игрока {seat}',
  'app.pathEveryone': 'Пути за этим столом',
  'app.pathImport': 'Вернуть из файла',
  'app.pathImportSeat': 'Вернуть из файла для игрока {seat}',
  'app.pathExported': 'Сохранено, а читаемая копия — в буфере обмена.',
  'app.pathImported': {
    one: 'Возвращён {count} план.',
    few: 'Возвращено {count} плана.',
    many: 'Возвращено {count} планов.',
    other: 'Возвращено {count} плана.',
  },
  'app.pathImportedCapped': {
    one: '{count} самая старая запись больше не помещается и удалена.',
    few: '{count} самые старые записи больше не помещаются и удалены.',
    many: '{count} самых старых записей больше не помещаются и удалены.',
    other: '{count} самых старых записей больше не помещаются и удалены.',
  },
  'app.pathImportedNothing': 'В этом файле нет ничего нового.',
  'app.pathUnreadable': 'Это не путь, записанный этим приложением.',
  'app.close': 'Закрыть',

  'companion.unavailable':
    'Побудьте пока с планом {plan} — текст можно прочесть, и отражение ' +
    'всё равно ваше. Спутник сейчас недоступен.',

  'menu.new': 'Открыть стол',
  'menu.join': 'Занять место',
  'menu.start': 'Начать игру (только ведущий)',
  'menu.roll': 'Бросить кубик',
  'menu.intention': 'Сказать, ради чего вы играете',
  'menu.report': 'Написать о клетке, на которой стоите',
  'menu.plan': 'Прочитать план',
  'menu.rules': 'Правила игры, по главам',
  'menu.ask': 'Спросить спутника о том, где вы стоите',
  'menu.path': 'Что вы написали и где',
  'menu.returns': 'Клетки, которые вернулись',
  'menu.take': 'Принять клетку, которую вам прислали',
  'menu.save': 'Ваш путь — файлом, который можно сохранить',
  'menu.board': 'Кто где стоит',
  'menu.end': 'Закрыть стол',
  'menu.help': 'Что умеет этот бот',

  help: [
    'Лила — игра самопознания.',
    '',
    '/new — открыть стол',
    '/join — сесть за стол',
    '/start — начать (только тот, кто открыл)',
    '/roll — бросить кубик',
    '/intention <текст> — ради чего вы играете; спутник об этом знает',
    '/report <текст> — отчёт о плане, на котором стоите',
    '/plan [n] — прочесть план',
    '/rules [n] — правила игры, по главам',
    '/ask <вопрос> — спросить спутника о том, где вы стоите',
    '/path — что вы написали и где',
    '/returns — клетки, которые вернулись, и что вы говорили каждый раз',
    '/take <клетка> — принять клетку, которую вам прислали',
    '/save — то же самое файлом, который можно забрать',
    '/board — где все стоят',
    '/end — убрать стол',
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
