/**
 * The screen.
 *
 * It draws what `src/game.ts` was handed and asks it what may happen; it
 * decides nothing about the game itself. The board's layout comes from
 * `BOARD_ROWS` in the engine — eight rows of nine, counted from the bottom and
 * alternating direction — because a board drawn by hand is another copy of the
 * board.
 */

import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BOARD_ROWS, countsAsReport } from '@leela/engine';
import { bookFor, describeMove, messageFor, planFor, resolveLanguage,
  directionOf,
} from '@leela/content';
import {
  fileReport,
  isOver,
  startOver,
  mayThrow,
  newGame,
  owesAnAccount,
  standingOn,
  throwDie,
  type Game,
  squareToRead,
} from './game';
import { PALETTE } from './palette';
import {
  DRAFT_KEY,
  EMPTY_PATH,
  NOTHING_WRITTEN,
  askingFor,
  mayChangeIntention,
  draftFor,
  draftOn,
  keepDraft,
  loadKeptDraft,
  isIntention,
  pathOf,
  keep,
  INTENTION_KEY,
  loadIntention,
  loadKeptIntention,
  keepIntention,
  loadKept,
  saveIntention,
  shareName,
  shareSquare,
  takeAccount,
  takeIn,
  takeSquare,
  toShare,
  writingsOn,
  type Draft,
  type Journal,
  type Store,
} from './journal';
import { MAX_INTENTION_CHARS, MAX_REPORT_CHARS, writerHint } from '@leela/journal';
import { deviceKeeper, deviceLocale } from './device';
import { GAME_KEY, carryOver, keepGame, loadKeptGame } from './game-store';
import { PUBLISHED_KEY, inheritedGame } from './inherited';
import { HANDLE, squareHandle } from './handles';

/**
 * The reader's language, asked of the phone once.
 *
 * This said `resolveLanguage(undefined)` — a literal, so the fallback was the
 * answer and every player on earth was handed English. A phone knows what
 * language it is in; the bot asks Telegram, the mini app asks the browser, and
 * the app this replaces asked `RNLocalize`. Only this one declared.
 *
 * Once, at module scope, beside the keepers: the language of a phone does not
 * change while somebody is looking at a board.
 */
const READER_LANGUAGE = resolveLanguage(deviceLocale());

/**
 * The session's own copy of the path.
 *
 * Drawn from, and written to on every account. The device's store is behind it
 * — `deviceKeeper` — and this is what makes the screen answer instantly while
 * the disk answers when it can.
 */
const forTheSession = (): Store => {
  const held = new Map<string, string>();
  return { getItem: (key) => held.get(key) ?? null, setItem: (key, value) => void held.set(key, value) };
};

/** The device's store, made once, one per thing kept. */
const keeper = deviceKeeper();
const gameKeeper = deviceKeeper(GAME_KEY);

/** Where the published app keeps the game this one is succeeding. */
const inheritedKeeper = deviceKeeper(PUBLISHED_KEY);
const intentionKeeper = deviceKeeper(INTENTION_KEY);
const draftKeeper = deviceKeeper(DRAFT_KEY);

/** A game's die is seeded once, and the seed is what a player carries away. */
const startingSeed = () => Math.floor(Math.random() * 1_000_000);

export default function App() {
  const [game, setGame] = useState<Game>(() => newGame(startingSeed()));
  const [store] = useState<Store>(forTheSession);
  const [journal, setJournal] = useState<Journal>(EMPTY_PATH);
  const [draft, setDraft] = useState<Draft>(NOTHING_WRITTEN);
  const [said, setSaid] = useState<string | null>(null);

  /**
   * Add a sentence to the status line without erasing one already there.
   *
   * The two things read at startup can both come back short, and they answer at
   * whatever speed the disk answers. A plain `setSaid` would have the second to
   * arrive silence the first, which is the defect twice over.
   */
  const alsoSay = (line: string) =>
    setSaid((now) => (now === null || now === '' ? line : now.includes(line) ? now : `${now} ${line}`));
  const [intention, setIntention] = useState('');
  const [asking, setAsking] = useState('');
  const [pasted, setPasted] = useState('');
  const [changing, setChanging] = useState(false);
  const [reading, setReading] = useState(false);
  const [walking, setWalking] = useState(false);

  // The path from the last time the app was open. Read once, and never allowed
  // to land on top of something written since: a player who starts writing
  // before a slow disk answers must not have their words replaced by what was
  // there yesterday.
  // What they are playing for, from the last time. The published app will not
  // show the board without one; neither will this.
  useEffect(() => {
    // The session's copy first, so the screen answers at once, and then the
    // device's — which is the one that survives a launch. Never allowed to land
    // on an answer given since: somebody typing before a slow disk replies must
    // not have their question replaced by yesterday's.
    setIntention(loadIntention(store));
    let stale = false;
    void loadKeptIntention(intentionKeeper).then((kept) => {
      if (kept !== '' && !stale) setIntention((now) => (now === '' ? kept : now));
    });
    return () => {
      stale = true;
    };
  }, [store]);

  useEffect(() => {
    let stale = false;
    void loadKept(keeper).then((kept) => {
      if (stale) return;
      setJournal((now) => (now === EMPTY_PATH ? kept.journal : now));

      // Entries that were on the disk and are not on the screen. Said, because
      // a path that came back three accounts short looks exactly like a path
      // three accounts were never written into.
      if (kept.dropped > 0) {
        alsoSay(messageFor(language, 'app.pathPartlyRead', { count: kept.dropped }));
      }
    });
    return () => {
      stale = true;
    };
  }, []);

  /**
   * The board, from the last time.
   *
   * This app kept a year of writing and lost where the player was standing on
   * every launch. Read once and never allowed to land on a game already in
   * progress, for the reason the journal is not: somebody who begins throwing
   * before a slow disk answers must not be pulled back to yesterday.
   */
  useEffect(() => {
    let stale = false;
    void loadKeptGame(gameKeeper).then((kept) => {
      if (stale) return;
      if (kept.game !== null) {
        setGame((now) => (now.rollsTaken === 0 ? (kept.game as Game) : now));
        return;
      }

      // A file that could not be read is not the same as no file, and the
      // screen used to treat them alike: begin again, say nothing. That is the
      // player coming back to the waiting square with their own writing intact
      // underneath it, about squares they are no longer standing on.
      if (kept.unreadable) {
        alsoSay(messageFor(language, 'app.gameNotRead'));
        return;
      }

      // Nothing of ours on this phone — said, not merely not heard. A device
      // that did not answer in five seconds knows something this app does not,
      // and adopting the published app's game over it would put the old board
      // on the screen and write it over the real one at the next throw.
      if (!kept.answered) return;

      // There may still be a game here: this app installs over the published
      // one, into the same store, and until now read nothing of what was
      // there. See `inherited.ts`.
      void inheritedKeeper.read().then((raw) => {
        if (stale) return;
        const found = inheritedGame(raw);
        if (!found) return;

        setGame((now) => (now.rollsTaken === 0 ? carryOver(now, found.state) : now));
        alsoSay(messageFor(language, 'app.gameInherited', { plan: found.state.loka }));
        if (found.others > 0) {
          alsoSay(messageFor(language, 'app.othersInherited', { count: found.others }));
        }
      });
    });
    return () => {
      stale = true;
    };
  }, []);

  /**
   * And the sentence being written, from the last time.
   *
   * Read once, and never allowed to land on top of something typed since — the
   * same rule the path, the question and the board all follow. `draftFor` then
   * decides whether it is shown at all: a draft belonging to a game that no
   * longer exists comes back and is never seen.
   */
  useEffect(() => {
    let stale = false;
    void loadKeptDraft(draftKeeper).then((kept) => {
      if (!stale) setDraft((now) => (now === NOTHING_WRITTEN ? kept : now));
    });
    return () => {
      stale = true;
    };
  }, []);

  /**
   * And kept on every keystroke.
   *
   * Deliberately every one. A timer or a debounce would keep the sentence
   * except for the words typed in the last second or two, which is exactly the
   * window an app is killed in: the moment before somebody switches away is the
   * moment they stop typing.
   *
   * Not told about here. A device that refuses is worth saying at the moment
   * the player files — `takeAccount` says it there — and a warning that appears
   * mid-sentence and vanishes on the next keystroke is noise.
   */
  useEffect(() => {
    void keepDraft(draftKeeper, draft);
  }, [draft]);

  /**
   * And kept after every throw.
   *
   * On the game rather than on the throw, so a report — which changes the
   * session without turning the die — is kept too. Whether the device took it
   * is not said here: the player is told about their *writing*, which is
   * theirs, and a board that has to be re-entered is a smaller loss than words.
   */
  useEffect(() => {
    void keepGame(gameKeeper, game);
  }, [game]);
  const language = READER_LANGUAGE;
  // Which way the language reads. Arabic and Urdu are among the twenty-two, and
  // a field left at the default puts their text against the wrong margin with
  // the caret in the wrong corner.
  const reading_direction = directionOf(language);

  /**
   * The reader's direction, for the two kinds of text that take it.
   *
   * The mini app writes the rule down in one sentence — *prose follows the
   * reader; geometry does not* (`chrome.ts`) — and sets `dir` on the whole
   * document, so every word it shows obeys it. This app obeyed **only the
   * second half**: the board was pinned last pass, and the direction reached
   * the three boxes the player types into and not one word the game says.
   *
   * So the 72 plans and the whole rules book, in Arabic and Urdu, were laid out
   * left to right — the teaching this app exists to deliver, ragged down the
   * wrong margin, with every full stop on the wrong side of its sentence. The
   * comment written here one pass ago says *the fields already carry it* as
   * though the fields were the text. They are where the player answers; the
   * plan is what they are answering.
   *
   * Two, because a paragraph and a centred button label want different things.
   * `textAlign` is the half both platforms have always honoured;
   * `writingDirection` sets the paragraph's base direction, which is what
   * decides the side a full stop lands on — and on a control whose label is
   * centred, it is the only half that applies.
   */
  const prose = reading_direction === 'rtl' ? styles.rightToLeft : null;
  const label = reading_direction === 'rtl' ? styles.labelDirection : null;
  const here = standingOn(game);
  // Where the piece is drawn and what may be read are two questions. `here` is
  // 68 for a player who has never thrown — the engine parks them there and the
  // published app draws the gem there from the first screen — and printing that
  // square's teaching hands somebody the end of the game on page one.
  const square = squareToRead(game);
  const plan = square === null ? null : planFor(language, square);

  /**
   * What belongs in the writing box, which is nothing unless it was written
   * here, in this game.
   *
   * A bare string outlives the square it describes. Winning ends a game **on**
   * 68 while still owing an account of it, so the box and *Start over* are on
   * screen together; tapping the second with the box full used to carry the
   * words about Cosmic Consciousness into the next game, where they reappeared
   * as the opening of an account of the first square landed on — and one tap of
   * Save filed them there, in the record this game exists to produce.
   *
   * Structural rather than a line in the restart handler, the way the mini app
   * answered it: a draft says which square of which game it is about, and it is
   * shown only there. A rule kept by remembering to clear something is a rule
   * the next handler is written without.
   */
  const writing = draftFor(draft, game.seed, square);

  /**
   * Whether what is in the box is an account yet.
   *
   * The same question `takeAccount` asks, asked again here — a dimmed control
   * is a drawing and a drawing refuses nothing — and asked of the **engine**,
   * so it is the variant's answer and not `length === 0` written out by hand.
   * Under `classic` those are the same sentence; under the rules the published
   * app ships they are ninety-nine characters apart.
   */
  const enough = countsAsReport(writing, game.rules);

  /**
   * What the two bounds on writing have to say, or nothing.
   *
   * The box stops taking characters at `MAX_REPORT_CHARS` and `record` drops
   * the oldest account past `MAX_REPORTS`, and this screen said neither: the
   * text simply stopped appearing, and a player's first account went without a
   * word. The mini app wrote that down and answered it for itself — *a bound
   * nobody is shown is indistinguishable from a bug* — and the reading lives in
   * `@leela/journal` now, so the two surfaces cannot say different things about
   * the same two numbers.
   */
  const hint = writerHint(journal.entries.length, writing.length);

  /**
   * The question, and whether the box for it is open.
   *
   * `intention === ''` was the whole condition, so a player who had answered
   * could never revise it — in a game of seventy-two squares, with their answer
   * written into every square they shared for the rest of it. Both other
   * surfaces let it be changed, and the published app's screen opens with the
   * answer already in the box.
   */
  const ask = askingFor(intention, changing);

  /**
   * The whole path, read through the format rather than assembled here.
   *
   * `revisited` is `@leela/journal`'s, so a square that came back is the same
   * square on all three surfaces; counting them again would be a second answer
   * to a question already answered.
   */
  const path = pathOf(journal);

  const refusal = mayThrow(game, intention);

  /**
   * What just happened, in a sentence.
   *
   * This was `${roll} · ${from} → ${to} · ${direction}` — the event's fields
   * with dots between them, and `arrow 🏹` in English under a Russian board.
   * The nine sentences it needed were already in the catalogue in both
   * languages, and the mini app had been saying them since it was written:
   * *You threw 4. An arrow at 10 takes you to 23.*
   *
   * `describeMove` is now in `@leela/content`, beside the catalogue it is built
   * from, so the two surfaces cannot drift into two wordings.
   */
  const line =
    said ??
    (game.event
      ? describeMove(language, game.event, (plan) => planFor(language, plan)?.title ?? String(plan))
      : messageFor(language, 'app.waiting'));

  /**
   * Keep the account, then open the gate.
   *
   * In that order, and the order is the point: the gate is what the writing
   * buys. This app had the second half without the first — a button that
   * cleared the requirement and kept nothing — so the requirement was removed
   * rather than met.
   *
   * The game goes on whether or not the store took it. They wrote it; a device
   * that will not keep it is not their doing, and shutting a gate they have
   * earned would charge them for it. But they are told, while the words are
   * still on the screen.
   */
  const write = () => {
    const taken = takeAccount(journal, here, writing, Date.now(), store, game.rules);
    if (!taken.written) {
      // Refused, and told why. A control that declines without saying what it
      // wants is the app ending somebody's turn without telling them.
      setSaid(
        taken.refusal === 'too-short'
          ? messageFor(language, 'report.tooShort', { count: game.rules.minReportChars })
          : messageFor(language, 'app.reportEmpty'),
      );
      return;
    }

    setJournal(taken.journal);
    setDraft(NOTHING_WRITTEN);
    if (taken.gateOpens) setGame(fileReport(game));

    // Said when the device has answered, not before. The session already has
    // the words — the game goes on either way — and the sentence is about
    // whether they will still be here tomorrow, which nobody knows yet.
    void keep(keeper, taken.journal).then((landed) =>
      setSaid(
        landed && taken.kept
          ? messageFor(language, 'app.reportSaved')
          : messageFor(language, 'app.notKept'),
      ),
    );
  };

  return (
    /*
     * The keyboard covers the button that keeps what was just typed.
     *
     * Found by the walk rather than by reading: Detox refused to tap Save
     * because it was *not visible* — `view bounds: {{16, 702.7}, {370, 45}}` on
     * an 874-point screen, under a keyboard about 300 points tall. A player
     * would have to dismiss the keyboard to reach it, and nothing on screen
     * says so.
     *
     * `KeyboardContainer` in the published app is the same answer to the same
     * problem: `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`. This
     * is that, at the root, because both writers and the controls row all sit
     * below the fold.
     */
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="auto" />
      <ScrollView testID={HANDLE.page} contentContainerStyle={styles.body}>
        {plan !== null ? (
          <Text testID={HANDLE.square} accessibilityRole="header" style={[styles.title, prose]}>
            {square}. {plan.title}
          </Text>
        ) : null}
        <Text style={[styles.line, prose]}>{line}</Text>

        <View style={styles.board}>
          {BOARD_ROWS.map((row, index) => (
            <View key={index} style={styles.row}>
              {row.map((square) => (
                <View
                  key={square}
                  testID={squareHandle(square)}
                  accessibilityLabel={String(square)}
                  accessibilityState={{ selected: square === here }}
                  style={[styles.cell, square === here && styles.standing]}
                >
                  <Text style={[square === here ? styles.standingText : styles.cellText, styles.geometry]}>
                    {square}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {plan !== null ? <Text style={[styles.plan, prose]}>{plan.body}</Text> : null}

        {/*
          The book, which every other surface has and this one did not. A player
          on a square they do not understand had nowhere to look: the bot has
          `/rules`, the mini app has the chapters, and the phone had a plan's
          text and nothing around it.

          `bookFor` rather than `rulesFor`: a language with no chapters of its
          own is served the English ones, and a chapter its book is missing is
          borrowed and marked — the reader gets a whole book either way.
        */}
        <Pressable
          testID={HANDLE.rules}
          accessibilityRole="button"
          accessibilityLabel={messageFor(language, 'app.rules')}
          style={styles.button}
          onPress={() => setReading((open) => !open)}
        >
          <Text style={[styles.buttonText, label]}>{messageFor(language, 'app.rules')}</Text>
        </Pressable>

        {/*
          The whole path.

          This app could write one, carry it away and bring one back, and never
          once show it — so the record the game exists to produce was readable
          only by sending it somewhere else. The bot has `/path` and
          `/returns`; the mini app has a section per seat. Named out loud one
          pass ago and worked around, when the sentence about a device refusing
          a write had to stop saying *save a copy from “My path”*, because
          there was no such screen here.
        */}
        <Pressable
          testID={HANDLE.path}
          accessibilityRole="button"
          accessibilityLabel={messageFor(language, 'app.path')}
          style={styles.button}
          onPress={() => setWalking((open) => !open)}
        >
          <Text style={[styles.buttonText, label]}>{messageFor(language, 'app.path')}</Text>
        </Pressable>

        {walking ? (
          <View style={styles.written}>
            {/*
              The question at the head, above the writing it frames — the mini
              app's own placement, and its reason: an account is written inside
              a question, and a page of accounts with no question on it is a
              page of answers to nothing.
            */}
            {mayChangeIntention(intention) ? (
              <Text style={[styles.line, prose]}>
                {messageFor(language, 'app.intentionYours')} {intention}
              </Text>
            ) : null}

            {path.entries.length === 0 ? (
              <Text style={[styles.line, prose]}>{messageFor(language, 'app.pathEmpty')}</Text>
            ) : (
              <Text style={[styles.line, prose]}>
                {messageFor(language, 'app.pathCount', { count: path.entries.length })}
              </Text>
            )}

            {path.returns.map((visit) => (
              <Text key={`return-${visit.plan}`} style={[styles.line, prose]}>
                {visit.plan}. {planFor(language, visit.plan).title} —{' '}
                {messageFor(language, 'app.returns', { count: visit.times })}
              </Text>
            ))}

            {path.entries.map((entry) => (
              <View key={`walk-${entry.plan}-${entry.at}`}>
                <Text style={[styles.title, prose]}>
                  {entry.plan}. {planFor(language, entry.plan).title}
                </Text>
                <Text style={[styles.entry, prose]}>{entry.text}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {reading
          ? bookFor(language).map((chapter) => (
              <View key={chapter.slug} style={styles.written}>
                <Text style={[styles.title, prose]}>{chapter.title}</Text>
                <Text style={[styles.plan, prose]}>{chapter.body}</Text>
              </View>
            ))
          : null}

        {/*
          What they wrote here before.
          
          The app kept a path and showed none of it — the same shape the bot was
          found in, where reports were written, stored, and never read back. A
          record nobody can read is a record the game is not producing.
          
          On this square rather than the whole path, because the whole path is a
          screen of its own and this is the moment it matters: a player standing
          again on a square they have stood on is the thing `revisited` exists
          to notice.
        */}
        {square !== null && writingsOn(journal, square).length > 0 ? (
          <View style={styles.written}>
            {writingsOn(journal, square).map((entry) => (
              <Text key={`${entry.plan}-${entry.at}`} style={[styles.entry, prose]}>
                {entry.text}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/*
        The question, shown back.

        The app asked it and never showed it again — while writing it into every
        square the player shared. The mini app puts it at the head of the path,
        above the writing it frames; the published app puts it on the profile,
        where `IntentionOfGame` links to a screen that opens with the answer
        already in the box.
      */}
      {mayChangeIntention(intention) && !ask.open ? (
        <View style={styles.writer}>
          <Text testID={HANDLE.intentionYours} style={[styles.line, prose]}>
            {messageFor(language, 'app.intentionYours')} {intention}
          </Text>
          <Pressable
            testID={HANDLE.intentionChange}
            accessibilityRole="button"
            accessibilityLabel={messageFor(language, 'app.intentionChange')}
            style={styles.button}
            onPress={() => {
              // Opened with theirs, which is what makes this a change rather
              // than a replacement: `defaultValues: { newIntention:
              // prevIntention || '' }` in the published app's own screen.
              setAsking(askingFor(intention, true).prefill);
              setChanging(true);
            }}
          >
            <Text style={[styles.buttonText, label]}>
              {messageFor(language, 'app.intentionChange')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/*
        The question, before the board. `blockGoBack: true` in the published
        app: there is no way past it, because every account is written inside
        it and one written before it was asked answers nothing.
      */}
      {ask.open ? (
        <View style={styles.writer}>
          <Text style={[styles.line, prose]}>{messageFor(language, 'app.intention')}</Text>
          <TextInput
            testID={HANDLE.intention}
            accessibilityLabel={messageFor(language, 'app.intention')}
            maxLength={MAX_INTENTION_CHARS}
            autoCapitalize="sentences"
            autoCorrect
            textContentType="none"
            placeholderTextColor={PALETTE.hint}
            style={[styles.field, prose]}
            multiline
            value={asking}
            onChangeText={setAsking}
            placeholder={messageFor(language, 'app.intentionHint')}
          />
          <Pressable
            testID={HANDLE.intentionSave}
            accessibilityRole="button"
            accessibilityLabel={messageFor(language, 'app.reportSave')}
            disabled={!isIntention(asking)}
            style={[styles.button, !isIntention(asking) && styles.shut]}
            onPress={() => {
              // Held for the session whatever the device says, and the device
              // is asked separately — the two questions this app keeps apart.
              setIntention(asking.trim());
              setChanging(false);
              saveIntention(store, asking);

              // The device, and its answer.
              //
              // This used to be `void keepIntention(…)` beside a check on
              // `saveIntention`, which writes to the session's own `Map` and
              // can only fail when there is no store at all — so the branch
              // that spoke was dead, and the one write that can really refuse
              // was the one nobody asked. A player answered the question the
              // game is played to answer, the disk said no, and they were told
              // it was held: asked again at the next launch as though they
              // never had.
              void keepIntention(intentionKeeper, asking.trim()).then((landed) => {
                if (!landed) setSaid(messageFor(language, 'app.intentionNotKept'));
              });
            }}
          >
            <Text style={[styles.buttonText, label, !isIntention(asking) && styles.shutText]}>{messageFor(language, 'app.reportSave')}</Text>
          </Pressable>
        </View>
      ) : null}

      {owesAnAccount(game) ? (
        <View style={styles.writer}>
          <TextInput
            testID={HANDLE.report}
            accessibilityLabel={messageFor(language, 'app.reportPlaceholder')}
            maxLength={MAX_REPORT_CHARS}
            autoCapitalize="sentences"
            autoCorrect
            textContentType="none"
            placeholderTextColor={PALETTE.hint}
            style={[styles.field, prose]}
            multiline
            value={writing}
            onChangeText={(text) => setDraft(draftOn(game.seed, here, text))}
            placeholder={messageFor(language, 'app.reportPlaceholder')}
          />
          {hint === null ? null : (
            <Text testID={HANDLE.reportHint} style={[styles.line, prose]}>
              {messageFor(language, hint.key, hint.count === undefined ? {} : { count: hint.count })}
            </Text>
          )}
          <Pressable
            testID={HANDLE.reportSave}
            accessibilityRole="button"
            accessibilityLabel={messageFor(language, 'app.reportSave')}
            // Asked here and asked again by `write`: a dimmed control is a
            // drawing, and a drawing refuses nothing.
            disabled={!enough}
            style={[styles.button, !enough && styles.shut]}
            onPress={write}
          >
            <Text style={[styles.buttonText, label, !enough && styles.shutText]}>{messageFor(language, 'app.reportSave')}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.controls}>
        <Pressable
          testID={HANDLE.roll}
          accessibilityRole="button"
          accessibilityLabel={messageFor(language, 'app.roll')}
          // The same question the disabled state is drawn from, asked again by
          // the act: a dimmed control is a drawing, and a drawing refuses
          // nothing — a double tap walks straight past it.
          disabled={refusal !== 'yes'}
          style={[styles.button, styles.abreast, refusal !== 'yes' && styles.shut]}
          onPress={() => {
            setSaid(null);
            setGame(throwDie(game, intention).game);
          }}
        >
          <Text style={[styles.buttonText, label, refusal !== 'yes' && styles.shutText]}>{messageFor(language, 'app.roll')}</Text>
        </Pressable>

        {/*
          Carrying the path away. `Share` is React Native's own, so no native
          dependency comes with it, and what goes out is the format every other
          surface reads — question included.
        */}
        {/* This square, as a message somebody can read. */}
        {/*
          `square` and not `here`: a player who won, wrote about 68 and started
          over is waiting to enter again with that account still in their
          journal, so this offered them the winning square's text on a board
          they had not begun. The two are the same number for anybody in play.
        */}
        {plan !== null && square !== null && writingsOn(journal, square).length > 0 ? (
          <Pressable
            testID={HANDLE.shareSquare}
            accessibilityRole="button"
            accessibilityLabel={messageFor(language, 'app.share')}
            style={[styles.button, styles.abreast]}
            onPress={() => {
              void Share.share({
                message: shareSquare(
                  square,
                  plan.title,
                  writingsOn(journal, square).at(-1)?.text ?? '',
                  '',
                ),
              });
            }}
          >
            <Text style={[styles.buttonText, label]}>{messageFor(language, 'app.share')}</Text>
          </Pressable>
        ) : null}

        {journal.entries.length > 0 ? (
          <Pressable
            testID={HANDLE.sharePath}
            accessibilityRole="button"
            accessibilityLabel={messageFor(language, 'app.pathExport')}
            style={[styles.button, styles.abreast]}
            onPress={() => {
              const stamp = new Date().toISOString().slice(0, 10);
              void Share.share({
                title: shareName(stamp),
                message: JSON.stringify(toShare(journal, intention), null, 2),
              });
            }}
          >
            <Text style={[styles.buttonText, label]}>{messageFor(language, 'app.pathExport')}</Text>
          </Pressable>
        ) : null}

        {/*
          Taking one back. A path that can only leave is two paths, not one:
          somebody who began at a table or in the mini app could not carry it
          here. The decisions are the format's — nothing lost, the gate not
          opened, the question taken only where there is none.
        */}
        <TextInput
          testID={HANDLE.paste}
          accessibilityLabel={messageFor(language, 'app.pasteEither')}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          textContentType="none"
          placeholderTextColor={PALETTE.hint}
          style={[styles.field, prose]}
          multiline
          value={pasted}
          onChangeText={setPasted}
          // The field takes either; the button below does the bringing. Both
          // read 'Bring one back' until now, so the phone showed one sentence
          // twice and said nothing about what may be pasted.
          placeholder={messageFor(language, 'app.pasteEither')}
        />
        <Pressable
          testID={HANDLE.pasteTake}
          accessibilityRole="button"
          accessibilityLabel={messageFor(language, 'app.pathImport')}
          disabled={pasted.trim().length === 0}
          style={[styles.button, styles.abreast, pasted.trim().length === 0 && styles.shut]}
          onPress={() => {
            // A square first, because that is what people paste. A path is a
            // file and an occasion; a square is a message, and the two are told
            // apart by the format rather than by asking the player which it is.
            const square = takeSquare(journal, pasted, Date.now());
            if (square.readable) {
              setJournal(square.journal);
              setPasted('');
              setSaid(
                square.added
                  ? messageFor(language, 'square.took', { plan: square.plan ?? here })
                  : messageFor(language, 'app.pathImportedNothing'),
              );
              void keep(keeper, square.journal).then((landed) => {
                if (!landed) setSaid(messageFor(language, 'app.notKept'));
              });
              return;
            }

            const taken = takeIn(journal, pasted, intention);
            if (!taken.readable) {
              setSaid(messageFor(language, 'app.pathUnreadable'));
              return;
            }

            setJournal(taken.journal);
            setPasted('');
            if (taken.intention !== null) {
              setIntention(taken.intention);
              saveIntention(store, taken.intention);
            }
            // Both, when both happened: accounts came in *and* older ones no
            // longer fit. Saying only the first is the untruth this surface
            // already caught itself telling about a report a disk refused.
            const brought =
              taken.added === 0
                ? messageFor(language, 'app.pathImportedNothing')
                : messageFor(language, 'app.pathImported', { count: taken.added });
            setSaid(
              taken.dropped === 0
                ? brought
                : `${brought} ${messageFor(language, 'app.pathImportedCapped', {
                    count: taken.dropped,
                  })}`,
            );

            // And whether the device took it — both halves, answered together
            // and said once, because bringing a path back is one act. A path
            // that was not kept has to be brought back again, and saying
            // *twelve accounts brought in* over a disk that refused all twelve
            // is the untruth this surface told about a report.
            void Promise.all([
              keep(keeper, taken.journal),
              taken.intention === null
                ? Promise.resolve(true)
                : keepIntention(intentionKeeper, taken.intention),
            ]).then(([path, question]) => {
              if (!path || !question) setSaid(messageFor(language, 'app.notKept'));
            });
          }}
        >
          <Text style={[styles.buttonText, label, pasted.trim().length === 0 && styles.shutText]}>{messageFor(language, 'app.pathImport')}</Text>
        </Pressable>

        {isOver(game) ? (
          <Pressable
            testID={HANDLE.restart}
            accessibilityRole="button"
            accessibilityLabel={messageFor(language, 'app.restart')}
            style={[styles.button, styles.abreast]}
            onPress={() => {
              // Asked again, five lines from the control that is already
              // hidden: a drawing refuses nothing. `startOver` also carries the
              // ruleset forward and refuses to hand back the seed it was given.
              const over = startOver(game, startingSeed());
              if (!over.begun) return;

              setGame(over.game);

              // A new game is a new question. The board was emptied and the
              // seed replaced so no draft could survive it, and the sentence
              // the finished game was played to answer stood over the new one
              // — with the gate before the first throw already open on it, so
              // nobody beginning again was asked what they were beginning for.
              // Both places it is held, because a question cleared in one and
              // kept in the other comes back at the next launch.
              if (over.askAgain) {
                setIntention('');
                setAsking('');
                saveIntention(store, '');

                // Whether the device took the clearing is not said here, and
                // that is the smaller loss: the screen is already asking again,
                // and the answer they give writes over the old one on both
                // sides. A refusal costs them only the question coming back if
                // they close the app before answering — which is what happened
                // on every restart until now.
                void keepIntention(intentionKeeper, '');
              }

              // The line under the board still said whatever the last act said
              // — including *Written. You may throw.* over a board that had
              // just been emptied.
              setSaid(messageFor(language, 'app.restarted'));
            }}
          >
            <Text style={[styles.buttonText, label]}>{messageFor(language, 'app.restart')}</Text>
          </Pressable>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.page },
  body: { padding: 16, paddingTop: 64, gap: 12 },
  title: { fontSize: 20, fontWeight: '600' },
  line: { fontSize: 15, color: PALETTE.hint },
  /**
   * The board reads left to right, whatever the reader does.
   *
   * `BOARD_ROWS` is the path itself — eight rows of nine, counted from the
   * bottom and alternating direction — so which side a row starts on is the
   * game's geometry and not a matter of taste. Under a right-to-left layout
   * React Native reverses `flexDirection: 'row'`, which would mirror every row
   * and put the snakes and arrows on the wrong side of the board.
   *
   * It cannot happen today: the app declares no right-to-left localisation, so
   * `I18nManager.isRTL` is false on an Arabic phone too. It becomes possible
   * the moment somebody adds one — which is exactly what *the app now speaks
   * Arabic* invites, so the guard belongs with the change that invites it.
   *
   * The reader's direction belongs to the prose, which every `Text` on this
   * screen now answers for. This sentence read *the fields already carry it*
   * for one pass, as though the fields were the text — they are where the
   * player answers; the plan is what they are answering.
   */
  board: { gap: 2, alignSelf: 'center', direction: 'ltr' },
  row: { flexDirection: 'row', gap: 2 },
  cell: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.cell,
    borderRadius: 4,
  },
  standing: { backgroundColor: PALETTE.accent },
  cellText: { fontSize: 12, color: PALETTE.hint },
  standingText: { fontSize: 12, color: PALETTE.onAccent, fontWeight: '700' },
  plan: { fontSize: 15, lineHeight: 22, color: PALETTE.text },
  written: {
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: PALETTE.cell,
  },
  entry: { fontSize: 15, lineHeight: 21, color: PALETTE.entry },
  writer: { paddingHorizontal: 16, gap: 8 },
  /** Arabic and Urdu read the other way; the field has to as well. */
  /** A paragraph in a right-to-left language: the margin and the base direction. */
  rightToLeft: { textAlign: 'right', writingDirection: 'rtl' },

  /**
   * A control's label, which is centred and only wants the base direction.
   *
   * `textAlign: 'right'` here would push *Roll* off the middle of its own
   * button.
   */
  labelDirection: { writingDirection: 'rtl' },

  /**
   * A number in the grid, which is not prose and says so.
   *
   * Named rather than left out, because `reader.test.ts` requires every `Text`
   * in this file to answer whether it follows the reader — an omission and a
   * decision look identical otherwise, and this repository has now been caught
   * six times by a list that stopped being complete.
   */
  geometry: { writingDirection: 'ltr' },
  field: {
    borderWidth: 1,
    borderColor: PALETTE.rule,
    borderRadius: 8,
    padding: 12,
    minHeight: 72,
    backgroundColor: PALETTE.field,
    fontSize: 15,
  },
  controls: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 32 },
  /** A control sharing the bottom row, which is the only place `flex` belongs. */
  abreast: { flex: 1 },
  button: {
    // No `flex` here. It belongs to the row at the bottom, where three controls
    // share a line — and in the two column blocks above it gave the button a
    // flex-basis of zero, so it collapsed to its padding and clipped its own
    // label out of existence. The intention's Save button was an empty grey
    // strip on the one screen a new player cannot get past.
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: PALETTE.accent,
    alignItems: 'center',
  },
  shut: { backgroundColor: PALETTE.shut },
  buttonText: { color: PALETTE.onAccent, fontWeight: '600' },
  shutText: { color: PALETTE.onShut, fontWeight: '600' },
});
